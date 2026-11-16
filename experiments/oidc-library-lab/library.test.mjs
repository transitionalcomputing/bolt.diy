import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';import {createProtocol} from './adapter.mjs';
globalThis.fetch=()=>{throw Error('Real network forbidden');};
const issuer='https://issuer.example',clientId='fake-client',redirectUri='https://bolt-test.example/auth/oidc/callback';
const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',id_token_signing_alg_values_supported:['RS256'],response_types_supported:['code']};
const keys=await generateKeyPair('RS256'),wrongKeys=await generateKeyPair('RS256');const jwk={...await exportJWK(keys.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
async function attempt({claims={},signingKey=keys.privateKey,missing=false,state='state',kid='test-key'}={}){
 let calls=[];const now=Math.floor(Date.now()/1000);
 const token=await new SignJWT({iss:issuer,sub:'alice',aud:clientId,iat:now,exp:now+300,nonce:'nonce',...claims}).setProtectedHeader({alg:'RS256',kid}).sign(signingKey);
 const transport=async(url,options)=>{calls.push(String(url));assert.equal(options.redirect,'error');if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});assert.equal(String(url),metadata.token_endpoint);assert.equal(options.body.get('code_verifier'),'fake-verifier');assert.equal(options.body.get('redirect_uri'),redirectUri);return Response.json({access_token:'fake-access',token_type:'Bearer',...(missing?{}:{id_token:token})});};
 const p=createProtocol({metadata,clientId,clientSecret:'fake-secret',redirectUri,transport});
 const result=await p.exchangeAndVerify({currentUrl:redirectUri+'?code=fake-code&state='+state,expectedState:'state',expectedNonce:'nonce',codeVerifier:'fake-verifier'});return {result,calls};
}
test('signed RS256 fake token verified through mock token+JWKS transport',async()=>{const {result,calls}=await attempt();assert.deepEqual(result,{issuer,subject:'alice'});assert.ok(calls.includes(metadata.jwks_uri));});
for(const [name,options] of Object.entries({signature:{signingKey:wrongKeys.privateKey},issuer:{claims:{iss:'https://evil.example'}},audience:{claims:{aud:'someone-else'}},nonce:{claims:{nonce:'wrong'}},expired:{claims:{exp:1}},state:{state:'wrong'},missing:{missing:true},unknownKid:{kid:'unknown'}}))test('rejects '+name,async()=>{await assert.rejects(attempt(options));});
test('rejects foreign metadata endpoint before requests',()=>{assert.throws(()=>createProtocol({metadata:{...metadata,jwks_uri:'https://evil.example/keys'},clientId,clientSecret:'fake',redirectUri,transport:()=>{throw Error('must not call')}}),/Untrusted endpoint/);});

test('real library adapter integrates with transaction/session orchestration and vault using fake transport',async()=>{
 const {createAccountAuth,createMockStore}=await import('../account-keys-prototype/oidc.mjs');
 const {createCredentialVault,createMemoryRepository}=await import('../account-keys-prototype/vault.mjs');
 const {createAccountService}=await import('../account-keys-prototype/account-service.mjs');
 let nonce,transportCalls=0;
 const protocol=createProtocol({metadata,clientId,clientSecret:'fake-secret',redirectUri,transport:async(url,options)=>{
   transportCalls++;
   if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});
   assert.equal(String(url),metadata.token_endpoint);assert.ok(options.body.get('code_verifier'));assert.equal(options.body.get('redirect_uri'),redirectUri);
   const now=Math.floor(Date.now()/1000),id_token=await new SignJWT({iss:issuer,sub:'alice',aud:clientId,iat:now,exp:now+300,nonce}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(keys.privateKey);
   return Response.json({access_token:'fake-access',token_type:'Bearer',id_token});
 }});
 const auth=createAccountAuth({issuer,clientId,origin:new URL(redirectUri).origin,protocol,transactions:createMockStore(),sessions:createMockStore(),authorize:async p=>p.issuer===issuer&&p.subject==='alice'});
 const vault=createCredentialVault({verifyIdentity:r=>auth.verifyIdentity(r),repository:createMemoryRepository(),masterKey:Buffer.alloc(32,3)}),service=createAccountService({auth,vault});
 async function login(){const b=await auth.begin(),u=new URL(b.url);nonce=u.searchParams.get('nonce');const req=new Request(redirectUri+'?code=fake&state='+u.searchParams.get('state'),{headers:{cookie:b.cookie.split(';')[0]}});const result=await auth.callback(req);await assert.rejects(auth.callback(req),/Invalid login/);return result.cookies[0].split(';')[0];}
 const cookie=await login(),req=new Request('https://bolt-test.example/',{headers:{cookie}}),csrf=await auth.csrf(req);
 await service.save(new Request('https://bolt-test.example/key',{method:'PUT',headers:{cookie,origin:'https://bolt-test.example','x-csrf-token':csrf}}),'fake-integration-key');
 const cookie2=await login();assert.equal((await service.resolveForProvider(new Request('https://bolt-test.example/',{headers:{cookie:cookie2}}))).apiKey,'fake-integration-key');assert.ok(transportCalls>=3);
});
