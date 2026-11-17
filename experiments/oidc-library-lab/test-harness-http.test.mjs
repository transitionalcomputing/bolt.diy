/** Loopback-only HTTP integration with manual cookies and synthetic signed OIDC.
 * This is not a browser, TLS, Authentik, crash or multi-connection Postgres test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createProtocol} from './adapter.mjs';
import {readInertZip} from './zip-intake.mjs';
import {createFakeCredentialService} from '../account-test-service/fake-credentials.mjs';
import {createTestHandler} from '../account-test-service/handler.mjs';
import {createTestAuth} from '../account-test-service/auth.mjs';
import {generateTestFixtures} from '../account-test-service/generate-test-fixtures.mjs';
import {createNodeAccountServer} from '../account-keys-prototype/node-http.mjs';
import {createPostgresStores} from '../account-keys-prototype/postgres-store.mjs';
import {createPostgresWorkspaceRepository} from '../account-keys-prototype/workspace-postgres.mjs';
import {createWorkspaceService} from '../account-keys-prototype/workspaces.mjs';

const origin='https://bolt-test.example';
const issuer='https://synthetic-issuer.example';
const clientId='fake-http-client';

test('loopback harness: signed fake logins, distinct imports, scoped reads, reopen and logout', {timeout:30000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bolt-http-readiness-'));
 const originalFetch=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Outbound fetch forbidden in loopback test');};
 let db,server,port,codeSequence=0,tokenExchanges=0;
 const codes=new Map();
 try{
  const keys=await generateKeyPair('RS256');
  const jwk={...await exportJWK(keys.publicKey),kid:'synthetic-http',alg:'RS256'};
  const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',id_token_signing_alg_values_supported:['RS256']};
  const config={origin,metadata,clientId,subjects:['alice','bob']};
  const protocol=createProtocol({metadata,clientId,clientSecret:'fake-http-secret',redirectUri:origin+'/auth/oidc/callback',transport:async(url,options)=>{
   assert.equal(options.redirect,'error');
   if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});
   assert.equal(String(url),metadata.token_endpoint);
   const code=options.body.get('code'),grant=codes.get(code);
   assert.ok(grant,'Only a synthetic locally issued code can be exchanged');
   assert.equal(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'),grant.challenge);
   codes.delete(code);tokenExchanges++;
   const now=Math.floor(Date.now()/1000);
   const id_token=await new SignJWT({iss:issuer,sub:grant.subject,aud:clientId,nonce:grant.nonce,iat:now,exp:now+300}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).sign(keys.privateKey);
   return Response.json({access_token:'fake-unused-access-token',token_type:'Bearer',id_token});
  }});
  const schemas=await Promise.all(['postgres-schema.sql','workspace-schema.sql'].map(name=>readFile(new URL('../account-keys-prototype/'+name,import.meta.url),'utf8')));
  const fixtures=await generateTestFixtures(join(directory,'fixtures'));
  assert.notEqual(fixtures[0].assetBase64,fixtures[1].assetBase64);

  async function start(){
   db=new PGlite(join(directory,'database'));
   for(const schema of schemas)await db.exec(schema);
   const stores=createPostgresStores(db),auth=createTestAuth({config,protocol,stores});
   const workspaces=createWorkspaceService({auth,repository:createPostgresWorkspaceRepository(db)});
   const fakeCredentials=createFakeCredentialService({auth,repository:stores.credentials,masterKey:Buffer.alloc(32,11)});
   const handler=createTestHandler({origin,auth,workspaces,fakeCredentials,parseArchive:readInertZip,html:'<h1>Fake-only HTTP harness</h1>',script:'// No browser execution in this test'});
   server=createNodeAccountServer({publicOrigin:origin,handler});
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const address=server.address();assert.equal(address.address,'127.0.0.1');port=address.port;
  }
  async function stop(){
   if(server){const closing=server;server=undefined;await new Promise((resolve,reject)=>closing.close(e=>e?reject(e):resolve()));}
   if(db){const closing=db;db=undefined;await closing.close();}
  }
  function client(){return {cookies:new Map()};}
  // Only the connection uses loopback HTTP. Public Host is canonical; this manual
  // cookie jar deliberately does NOT model Secure/SameSite/browser/TLS enforcement.
  async function send(browser,path,{method='GET',body,csrf,contentType='application/zip'}={}){
   assert.ok(path.startsWith('/')&&!path.startsWith('//'));
   const headers={host:new URL(origin).host,origin,connection:'close'};
   if(browser.cookies.size)headers.cookie=[...browser.cookies].map(([k,v])=>k+'='+v).join('; ');
   if(csrf)headers['x-csrf-token']=csrf;
   if(body!==undefined){headers['content-type']=contentType;headers['content-length']=body.length;}
   const response=await new Promise((resolve,reject)=>{
    const request=httpRequest({hostname:'127.0.0.1',port,path,method,headers,agent:false},incoming=>{
     const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('error',reject);
     incoming.on('end',()=>resolve({status:incoming.statusCode,headers:incoming.headers,text:Buffer.concat(chunks).toString('utf8')}));
    });
    request.setTimeout(5000,()=>request.destroy(Error('Loopback request timed out')));request.on('error',reject);request.end(body);
   });
   for(const cookie of response.headers['set-cookie']??[]){
    const first=cookie.split(';')[0],equals=first.indexOf('=');const name=first.slice(0,equals),value=first.slice(equals+1);
    if(/(?:^|;)\s*Max-Age=0(?:;|$)/i.test(cookie))browser.cookies.delete(name);else browser.cookies.set(name,value);
   }
   return {...response,json(){return JSON.parse(response.text);}};
  }
  async function login(browser,subject){
   const beginning=await send(browser,'/auth/oidc/login');assert.equal(beginning.status,302);
   const authorization=new URL(beginning.headers.location);assert.equal(authorization.origin,issuer);
   const code='synthetic-http-code-'+codeSequence++;
   codes.set(code,{subject,nonce:authorization.searchParams.get('nonce'),challenge:authorization.searchParams.get('code_challenge')});
   assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
   const callback='/auth/oidc/callback?'+new URLSearchParams({state:authorization.searchParams.get('state'),code});
   const result=await send(browser,callback);assert.equal(result.status,303);
   assert.ok(result.headers['set-cookie'].some(c=>c.startsWith('__Host-bolt-session=')&&c.includes('Secure')&&c.includes('HttpOnly')));
   assert.equal((await send(browser,callback)).status,400,'Callback replay must fail');
  }
  async function csrf(browser){const response=await send(browser,'/api/account/session');assert.equal(response.status,200);return response.json().csrfToken;}
  async function importFixture(browser,fixture){const response=await send(browser,'/api/workspaces/import',{method:'POST',body:await readFile(join(directory,'fixtures',fixture.name)),csrf:await csrf(browser)});assert.equal(response.status,201);return response.json().id;}
  async function verifyOwn(browser,id,fixture){
   const listed=await send(browser,'/api/workspaces');assert.equal(listed.status,200);assert.deepEqual(listed.json().projects.map(p=>p.id),[id]);assert.equal('files' in listed.json().projects[0],false);
   const downloaded=await send(browser,'/api/workspaces/'+id);assert.equal(downloaded.status,200);assert.match(downloaded.headers['content-disposition'],/^attachment/);
   assert.equal(downloaded.json().files.find(f=>f.path==='asset.bin').base64,fixture.assetBase64);
  }

  await start();
  const anonymous=client(),alice=client(),bob=client();
  assert.equal((await send(anonymous,'/api/workspaces')).status,401);
  assert.equal((await send(anonymous,'/api/workspaces/import',{method:'POST',body:Buffer.from('not a ZIP')})).status,401);
  await login(alice,'alice');await login(bob,'bob');
  for(const [browser,fixture] of [[alice,'alpha'],[bob,'beta']]){
   const selected=await send(browser,'/api/test-credentials',{method:'PUT',contentType:'application/json',body:Buffer.from(JSON.stringify({fixture})),csrf:await csrf(browser)});assert.equal(selected.status,200);
   assert.deepEqual((await send(browser,'/api/test-credentials')).json(),{configured:true,fixture});
  }
  const ciphertextRows=await db.query("SELECT payload FROM bolt_private.records WHERE namespace='credentials'");
  assert.equal(ciphertextRows.rows.length,2);assert.equal(JSON.stringify(ciphertextRows.rows).includes('FAKE-ONLY'),false);
  assert.equal((await send(anonymous,'/api/test-credentials')).status,401);

  const aliceId=await importFixture(alice,fixtures[0]),bobId=await importFixture(bob,fixtures[1]);
  assert.notEqual(aliceId,bobId);
  await verifyOwn(alice,aliceId,fixtures[0]);await verifyOwn(bob,bobId,fixtures[1]);
  assert.equal((await send(alice,'/api/workspaces/'+bobId)).status,404);
  assert.equal((await send(bob,'/api/workspaces/'+aliceId)).status,404);
  assert.equal((await send(alice,'/api/workspaces/import',{method:'POST',body:Buffer.from('not a ZIP'),csrf:'wrong'})).status,403);

  await stop();await start();
  // Real listener and disk engine reconstructed, but still within one Node process.
  const returningAlice=client(),returningBob=client();
  await login(returningAlice,'alice');await login(returningBob,'bob');
  assert.deepEqual((await send(returningAlice,'/api/test-credentials')).json(),{configured:true,fixture:'alpha'});
  assert.deepEqual((await send(returningBob,'/api/test-credentials')).json(),{configured:true,fixture:'beta'});
  assert.equal((await send(returningAlice,'/api/test-credentials',{method:'DELETE',csrf:await csrf(returningAlice)})).status,200);
  assert.deepEqual((await send(returningAlice,'/api/test-credentials')).json(),{configured:false});
  assert.deepEqual((await send(returningBob,'/api/test-credentials')).json(),{configured:true,fixture:'beta'});

  await verifyOwn(returningAlice,aliceId,fixtures[0]);await verifyOwn(returningBob,bobId,fixtures[1]);
  assert.equal((await send(returningAlice,'/api/workspaces/'+bobId)).status,404);
  assert.equal((await send(returningBob,'/api/workspaces/'+aliceId)).status,404);
  const retainedCookieClient={cookies:new Map(returningAlice.cookies)};
  const logout=await send(returningAlice,'/auth/logout',{method:'POST',csrf:await csrf(returningAlice)});assert.equal(logout.status,204);
  assert.equal((await send(returningAlice,'/api/workspaces')).status,401);
  assert.equal((await send(retainedCookieClient,'/api/workspaces')).status,401,'Deleted session must reject retained cookie');
  await verifyOwn(returningBob,bobId,fixtures[1]);
  assert.equal(tokenExchanges,4);
  await stop();
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(db)await db.close();
  globalThis.fetch=originalFetch;
  await rm(directory,{recursive:true,force:true});
 }
});
