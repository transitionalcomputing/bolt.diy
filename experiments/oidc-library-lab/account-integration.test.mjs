/** Fake-only Node integration; no HTTP listener, real IdP, API or credentials. */
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createPostgresWorkspaceRepository} from '../account-keys-prototype/workspace-postgres.mjs';
import {createWorkspaceService} from '../account-keys-prototype/workspaces.mjs';
import {createWorkspaceImportHandler} from '../account-keys-prototype/workspace-http.mjs';
import {readInertZip} from './zip-intake.mjs';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createOpenAIBoundary} from '../account-keys-prototype/openai-boundary.mjs';
import {createOpenAIDriver} from '../account-keys-prototype/openai-driver.mjs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';import {createProtocol} from './adapter.mjs';
import {createAccountAuth} from '../account-keys-prototype/oidc.mjs';import {createCredentialVault} from '../account-keys-prototype/vault.mjs';import {createAccountService} from '../account-keys-prototype/account-service.mjs';import {createAccountHandler} from '../account-keys-prototype/http.mjs';import {openSqliteStores} from '../account-keys-prototype/sqlite-store.mjs';
globalThis.fetch=()=>{throw Error('Real network forbidden')};
const origin='https://bolt-test.example',issuer='https://issuer.example',clientId='fake-client',redirectUri=origin+'/auth/oidc/callback';
test('composed OIDC HTTP SQLite lifecycle: two browsers, two accounts, restart and revocation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bolt-fake-integration-'));let stores,workspaceDb;
 try{
 const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'test',alg:'RS256'},codes=new Map(),allowed=new Set(['alice','bob']);
 const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',id_token_signing_alg_values_supported:['RS256']};
 let requests=0,pkceRejections=0;const protocol=createProtocol({metadata,clientId,clientSecret:'fake-secret',redirectUri,transport:async(url,options)=>{
 requests++;if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});assert.equal(String(url),metadata.token_endpoint);const code=options.body.get('code'),entry=codes.get(code);assert.ok(entry);if(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url')!==entry.challenge){pkceRejections++;return Response.json({error:'invalid_grant'},{status:400})}codes.delete(code);const now=Math.floor(Date.now()/1000);const id_token=await new SignJWT({iss:issuer,sub:entry.subject,aud:clientId,nonce:entry.nonce,iat:now,exp:now+300}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(keys.privateKey);return Response.json({access_token:'fake-access',token_type:'Bearer',id_token});}});
 let handler,accounts,auth,workspaces,upload;
 function start(){stores=openSqliteStores(join(dir,'fake.sqlite'));auth=createAccountAuth({issuer,clientId,origin,protocol,transactions:stores.transactions,sessions:stores.sessions,authorize:async p=>p.issuer===issuer&&allowed.has(p.subject)});const vault=createCredentialVault({verifyIdentity:r=>auth.verifyIdentity(r),repository:stores.credentials,masterKey:Buffer.alloc(32,6)});accounts=createAccountService({auth,vault});handler=createAccountHandler({auth,accounts,origin});workspaces=createWorkspaceService({auth,repository:createPostgresWorkspaceRepository(workspaceDb)});upload=createWorkspaceImportHandler({origin,auth,workspaces,parseArchive:readInertZip});}
 function request(path,cookie,method='GET',data,csrf){return new Request(origin+path,{method,headers:{cookie:cookie||'',origin,'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});}
 let counter=0;
 async function login(subject){const start=await handler(request('/auth/oidc/login'));assert.equal(start.status,302);const location=new URL(start.headers.get('location')),code='fake-code-'+counter++;codes.set(code,{subject,nonce:location.searchParams.get('nonce'),challenge:location.searchParams.get('code_challenge')});const callback=request('/auth/oidc/callback?state='+location.searchParams.get('state')+'&code='+code,start.headers.get('set-cookie').split(';')[0]);const result=await handler(callback);assert.equal(result.status,303);assert.equal((await handler(callback)).status,400);return result.headers.getSetCookie().find(s=>s.startsWith('__Host-bolt-session=')).split(';')[0];}
 async function csrf(cookie){return(await(await handler(request('/api/account/session',cookie))).json()).csrfToken;}
 workspaceDb=new PGlite(join(dir,'workspace-db'));await workspaceDb.exec(await readFile(new URL('../account-keys-prototype/workspace-schema.sql',import.meta.url),'utf8'));
 start();
 const pkceStart=await handler(request('/auth/oidc/login')),pkceUrl=new URL(pkceStart.headers.get('location'));codes.set('fake-bad-pkce',{subject:'alice',nonce:pkceUrl.searchParams.get('nonce'),challenge:pkceUrl.searchParams.get('code_challenge')});
 await assert.rejects(protocol.exchangeAndVerify({currentUrl:redirectUri+'?code=fake-bad-pkce&state='+pkceUrl.searchParams.get('state'),expectedState:pkceUrl.searchParams.get('state'),expectedNonce:pkceUrl.searchParams.get('nonce'),codeVerifier:'wrong-verifier'}));assert.equal(pkceRejections,1);
 const alice=await login('alice'),alice2=await login('alice'),bob=await login('bob');
 // Synthetic ZIP with binary asset and inert package script; no file execution.
 const archive=Buffer.from('UEsDBBQAAAAIAA6GcF0sQ1jTBgAAAAQAAAAJAAAAYXNzZXQuYmluY/jfwAgAUEsDBBQAAAAIAA6GcF1Jzj3GKQAAACcAAAAMAAAAcGFja2FnZS5qc29uq1YqTi7KLCgpVrKqVirILy7JzCsuSczJUbJSykstSy3SLSrNU6qtBQBQSwECFAMUAAAACAAOhnBdLENY0wYAAAAEAAAACQAAAAAAAAAAAAAAgAEAAAAAYXNzZXQuYmluUEsBAhQDFAAAAAgADoZwXUnOPcYpAAAAJwAAAAwAAAAAAAAAAAAAAIABLQAAAHBhY2thZ2UuanNvblBLBQYAAAAAAgACAHEAAACAAAAAAAA=','base64');
 async function importArchive(cookie){const res=await upload(new Request(origin+'/api/workspaces/import',{method:'POST',headers:{cookie,origin,'x-csrf-token':await csrf(cookie),'content-type':'application/zip'},body:archive}));assert.equal(res.status,201);return res.json();}
 const aliceProject=await importArchive(alice),bobProject=await importArchive(bob);
 assert.equal((await workspaces.read(request('/',alice2),aliceProject.id)).files[0].base64,'AP+AAQ==');
 await assert.rejects(workspaces.read(request('/',bob),aliceProject.id),/Workspace not found/);

 assert.equal((await handler(request('/api/account/openai',alice,'PUT',{apiKey:'fake-alice-persistent'},await csrf(alice)))).status,200);
 assert.deepEqual(await(await handler(request('/api/account/openai',alice2))).json(),{configured:true});
 assert.deepEqual(await(await handler(request('/api/account/openai',bob))).json(),{configured:false});await assert.rejects(accounts.resolveForProvider(request('/',bob)),/not configured/);
 // Same database, separately constructed service after connection shutdown.
 stores.close();stores=undefined;await workspaceDb.close();workspaceDb=new PGlite(join(dir,'workspace-db'));start();
 const aliceReturning=await login('alice'),bobReturning=await login('bob');
 assert.equal((await workspaces.read(request('/',aliceReturning),aliceProject.id)).files[0].base64,'AP+AAQ==');
 assert.equal((await workspaces.read(request('/',bobReturning),bobProject.id)).id,bobProject.id);
 await assert.rejects(workspaces.read(request('/',aliceReturning),bobProject.id),/Workspace not found/);
 assert.equal((await accounts.resolveForProvider(request('/',alice2))).apiKey,'fake-alice-persistent');
 let providerCalls=0;const driver=createOpenAIDriver({transport:async(url,options)=>{providerCalls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options.headers.authorization,'Bearer fake-alice-persistent');assert.equal(options.redirect,'error');return Response.json({choices:[{message:{content:'fake provider output'}}]});}});
 const boundary=createOpenAIBoundary({auth,accounts,driver});
 assert.deepEqual(await boundary.generate(request('/chat',alice2,'POST',undefined,await csrf(alice2)),{model:'fake-model',prompt:'hello'}),{text:'fake provider output'});
 await assert.rejects(boundary.generate(request('/chat',bob,'POST',undefined,await csrf(bob)),{model:'fake-model',prompt:'hello'}),/not configured/);assert.equal(providerCalls,1);
 const leaked=await(await handler(request('/api/account/openai',alice2))).text();assert.ok(!leaked.includes('fake-alice-persistent'));
 assert.equal((await handler(request('/auth/logout',alice,'POST',undefined,await csrf(alice)))).status,204);assert.equal((await handler(request('/api/account/session',alice))).status,401);assert.equal((await handler(request('/api/account/session',alice2))).status,200);
 allowed.delete('alice');assert.equal((await handler(request('/api/account/openai',alice2))).status,401);await assert.rejects(accounts.resolveForProvider(request('/',alice2)),/Unauthenticated/);assert.ok(requests>=4);
 }finally{stores?.close();if(workspaceDb)await workspaceDb.close();await rm(dir,{recursive:true,force:true});}
});
