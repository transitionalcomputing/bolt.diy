import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createTestAuth} from './auth.mjs';
test('changed test allowlist after reconstruction rejects retained revoked session',async()=>{
 const records=new Map(),issuer='https://issuer.example',origin='https://test.example';
 for(const subject of ['alice','bob']){const token='fake-'+subject;records.set(createHash('sha256').update(token).digest('base64url'),{issuer,subject,csrf:'fake',expires:Date.now()+3600000});}
 const stores={transactions:{},sessions:{get:async id=>records.get(id)}},protocol={};const config={origin,metadata:{issuer},clientId:'fake',subjects:['alice','bob']};
 const req=subject=>new Request(origin+'/api/workspaces',{headers:{cookie:'__Host-bolt-session=fake-'+subject}});
 const before=createTestAuth({config,protocol,stores});assert.equal((await before.verifyIdentity(req('alice'))).subject,'alice');
 const after=createTestAuth({config:{...config,subjects:['bob','carol']},protocol,stores});await assert.rejects(after.verifyIdentity(req('alice')),/Unauthenticated/);assert.equal((await after.verifyIdentity(req('bob'))).subject,'bob');
});

test('malformed expiry never authenticates even before cleanup runs',async()=>{
 const issuer='https://issuer.example',origin='https://test.example';let record;const auth=createTestAuth({config:{origin,metadata:{issuer},clientId:'fake',subjects:['alice','bob']},protocol:{},stores:{transactions:{},sessions:{get:async()=>record}}});
 for(const expires of [undefined,null,'9999999999999',NaN,Infinity,Date.now()+0.5]){record={issuer,subject:'alice',csrf:'fake',expires};await assert.rejects(auth.verifyIdentity(new Request(origin,{headers:{cookie:'__Host-bolt-session=fake'}})),/Unauthenticated/);}
});

test('malformed session CSRF makes the retained session invalid',async()=>{
 const issuer='https://issuer.example',origin='https://test.example';let record;const auth=createTestAuth({config:{origin,metadata:{issuer},clientId:'fake',subjects:['alice','bob']},protocol:{},stores:{transactions:{},sessions:{get:async()=>record}}});
 for(const csrf of [undefined,null,'',123]){record={issuer,subject:'alice',csrf,expires:Date.now()+3600000};await assert.rejects(auth.verifyIdentity(new Request(origin,{headers:{cookie:'__Host-bolt-session=fake'}})),/Unauthenticated/);}
});
