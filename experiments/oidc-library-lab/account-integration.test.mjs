/** Fake-only Node integration; no HTTP listener, real IdP, API or credentials. */
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createOpenAIBoundary} from '../account-keys-prototype/openai-boundary.mjs';
import {createOpenAIDriver} from '../account-keys-prototype/openai-driver.mjs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';import {createProtocol} from './adapter.mjs';
import {createAccountAuth} from '../account-keys-prototype/oidc.mjs';import {createCredentialVault} from '../account-keys-prototype/vault.mjs';import {createAccountService} from '../account-keys-prototype/account-service.mjs';import {createAccountHandler} from '../account-keys-prototype/http.mjs';import {openSqliteStores} from '../account-keys-prototype/sqlite-store.mjs';
globalThis.fetch=()=>{throw Error('Real network forbidden')};
const origin='https://bolt-test.example',issuer='https://issuer.example',clientId='fake-client',redirectUri=origin+'/auth/oidc/callback';
test('composed OIDC HTTP SQLite lifecycle: two browsers, two accounts, restart and revocation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bolt-fake-integration-'));let stores;
 try{
 const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'test',alg:'RS256'},codes=new Map(),allowed=new Set(['alice','bob']);
 const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',id_token_signing_alg_values_supported:['RS256']};
 let requests=0;const protocol=createProtocol({metadata,clientId,clientSecret:'fake-secret',redirectUri,transport:async(url,options)=>{
 requests++;if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});assert.equal(String(url),metadata.token_endpoint);const code=options.body.get('code'),entry=codes.get(code);assert.ok(entry);codes.delete(code);const now=Math.floor(Date.now()/1000);const id_token=await new SignJWT({iss:issuer,sub:entry.subject,aud:clientId,nonce:entry.nonce,iat:now,exp:now+300}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(keys.privateKey);return Response.json({access_token:'fake-access',token_type:'Bearer',id_token});}});
 let handler,accounts,auth;
 function start(){stores=openSqliteStores(join(dir,'fake.sqlite'));auth=createAccountAuth({issuer,clientId,origin,protocol,transactions:stores.transactions,sessions:stores.sessions,authorize:async p=>p.issuer===issuer&&allowed.has(p.subject)});const vault=createCredentialVault({verifyIdentity:r=>auth.verifyIdentity(r),repository:stores.credentials,masterKey:Buffer.alloc(32,6)});accounts=createAccountService({auth,vault});handler=createAccountHandler({auth,accounts,origin});}
 function request(path,cookie,method='GET',data,csrf){return new Request(origin+path,{method,headers:{cookie:cookie||'',origin,'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});}
 let counter=0;
 async function login(subject){const start=await handler(request('/auth/oidc/login'));assert.equal(start.status,302);const location=new URL(start.headers.get('location')),code='fake-code-'+counter++;codes.set(code,{subject,nonce:location.searchParams.get('nonce')});const callback=request('/auth/oidc/callback?state='+location.searchParams.get('state')+'&code='+code,start.headers.get('set-cookie').split(';')[0]);const result=await handler(callback);assert.equal(result.status,303);assert.equal((await handler(callback)).status,400);return result.headers.getSetCookie().find(s=>s.startsWith('__Host-bolt-session=')).split(';')[0];}
 async function csrf(cookie){return(await(await handler(request('/api/account/session',cookie))).json()).csrfToken;}
 start();const alice=await login('alice'),alice2=await login('alice'),bob=await login('bob');
 assert.equal((await handler(request('/api/account/openai',alice,'PUT',{apiKey:'fake-alice-persistent'},await csrf(alice)))).status,200);
 assert.deepEqual(await(await handler(request('/api/account/openai',alice2))).json(),{configured:true});
 assert.deepEqual(await(await handler(request('/api/account/openai',bob))).json(),{configured:false});await assert.rejects(accounts.resolveForProvider(request('/',bob)),/not configured/);
 // Same database, separately constructed service after connection shutdown.
 stores.close();stores=undefined;start();
 assert.equal((await accounts.resolveForProvider(request('/',alice2))).apiKey,'fake-alice-persistent');
 let providerCalls=0;const driver=createOpenAIDriver({transport:async(url,options)=>{providerCalls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options.headers.authorization,'Bearer fake-alice-persistent');assert.equal(options.redirect,'error');return Response.json({choices:[{message:{content:'fake provider output'}}]});}});
 const boundary=createOpenAIBoundary({auth,accounts,driver});
 assert.deepEqual(await boundary.generate(request('/chat',alice2,'POST',undefined,await csrf(alice2)),{model:'fake-model',prompt:'hello'}),{text:'fake provider output'});
 await assert.rejects(boundary.generate(request('/chat',bob,'POST',undefined,await csrf(bob)),{model:'fake-model',prompt:'hello'}),/not configured/);assert.equal(providerCalls,1);
 const leaked=await(await handler(request('/api/account/openai',alice2))).text();assert.ok(!leaked.includes('fake-alice-persistent'));
 assert.equal((await handler(request('/auth/logout',alice,'POST',undefined,await csrf(alice)))).status,204);assert.equal((await handler(request('/api/account/session',alice))).status,401);assert.equal((await handler(request('/api/account/session',alice2))).status,200);
 allowed.delete('alice');assert.equal((await handler(request('/api/account/openai',alice2))).status,401);await assert.rejects(accounts.resolveForProvider(request('/',alice2)),/Unauthenticated/);assert.ok(requests>=4);
 }finally{stores?.close();await rm(dir,{recursive:true,force:true});}
});
