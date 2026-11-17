import test from 'node:test';import assert from 'node:assert/strict';import {createFakeCredentialHandler} from './fake-credential-http.mjs';import {createFakeCredentialService} from './fake-credentials.mjs';import {createMemoryRepository} from '../account-keys-prototype/vault.mjs';
const origin='https://test.invalid';
function fixture(){const auth={async verifyIdentity(r){const subject=r.headers.get('cookie');if(!['alice','bob'].includes(subject))throw Error('Unauthenticated');return {issuer:'mock',subject}},async requireMutation(r){await this.verifyIdentity(r);if(r.headers.get('origin')!==origin||r.headers.get('x-csrf-token')!=='test-csrf')throw Error('Forbidden')}};const service=createFakeCredentialService({auth,repository:createMemoryRepository(),masterKey:Buffer.alloc(32,5)});return createFakeCredentialHandler({origin,auth,service});}
function req(method,owner='alice',body,csrf='test-csrf'){return new Request(origin+'/api/test-credentials',{method,headers:{cookie:owner,origin,'x-csrf-token':csrf,'content-type':'application/json'},...(body!==undefined?{body}:{} )});}
test('synthetic HTTP flow only saves enum and isolates two owners',async()=>{const handle=fixture();assert.equal((await handle(req('PUT','alice','{"fixture":"alpha"}'))).status,200);assert.deepEqual(await(await handle(req('GET'))).json(),{configured:true,fixture:'alpha'});assert.deepEqual(await(await handle(req('GET','bob'))).json(),{configured:false});assert.equal((await handle(req('PUT','bob','{"fixture":"beta"}'))).status,200);await handle(req('DELETE'));assert.deepEqual(await(await handle(req('GET','bob'))).json(),{configured:true,fixture:'beta'});});
test('anonymous and wrong-CSRF requests leave bodies unread',async()=>{const handle=fixture();for(const [owner,csrf,status] of [['anonymous','test-csrf',401],['alice','wrong',403]]){const r=req('PUT',owner,'{"fixture":"alpha"}',csrf);assert.equal((await handle(r)).status,status);assert.equal(r.bodyUsed,false);}});
test('raw key, oversized/malformed body and owner field rejected',async()=>{const handle=fixture();for(const body of ['{"apiKey":"sk-NOT-REAL"}',' '.repeat(129),'broken','{"fixture":"alpha","owner":"bob"}'])assert.equal((await handle(req('PUT','alice',body))).status,400);assert.deepEqual(await(await handle(req('GET'))).json(),{configured:false});});
test('stalled body deadline cancels reader and never saves', {timeout:1000},async()=>{
 let cancelled=0,saves=0;const handle=createFakeCredentialHandler({origin,auth:{requireMutation:async()=>{}},service:{select:async()=>saves++},bodyTimeoutMs:5});
 const body=new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}});
 const r=new Request(origin+'/api/test-credentials',{method:'PUT',headers:{'content-type':'application/json'},body,duplex:'half'});
 assert.equal((await handle(r)).status,400);assert.equal(cancelled,1);assert.equal(saves,0);
});
test('aborted stalled body cancels without saving',{timeout:1000},async()=>{
 let cancelled=0,saves=0;const ac=new AbortController();const handle=createFakeCredentialHandler({origin,auth:{requireMutation:async()=>{}},service:{select:async()=>saves++}});
 const body=new ReadableStream({cancel(){cancelled++;}});const r=new Request(origin+'/api/test-credentials',{method:'PUT',headers:{'content-type':'application/json'},body,duplex:'half',signal:ac.signal});
 const result=handle(r);setTimeout(()=>ac.abort(),5);assert.equal((await result).status,400);assert.equal(cancelled,1);assert.equal(saves,0);
});
