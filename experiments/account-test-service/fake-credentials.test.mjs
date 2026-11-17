import test from 'node:test';import assert from 'node:assert/strict';import {createFakeCredentialService} from './fake-credentials.mjs';import {createMemoryRepository} from '../account-keys-prototype/vault.mjs';
function setup(repository=createMemoryRepository(),masterKey=Buffer.alloc(32,7)){
 const auth={async verifyIdentity(r){if(!['alice','bob'].includes(r))throw Error('Unauthenticated');return {issuer:'https://fake-idp.invalid',subject:r}},async requireMutation(r){await this.verifyIdentity(r)}};
 return {repository,service:createFakeCredentialService({auth,repository,masterKey})};
}
test('two fake credentials persist encrypted and return only own fixture after reconstruction',async()=>{
 const {service,repository}=setup();await service.select('alice',{fixture:'alpha'});await service.select('bob',{fixture:'beta'});
 assert.equal(JSON.stringify(repository.snapshot()).includes('FAKE-ONLY'),false);
 const fresh=setup(repository).service;assert.deepEqual(await fresh.status('alice'),{configured:true,fixture:'alpha'});assert.deepEqual(await fresh.status('bob'),{configured:true,fixture:'beta'});
 await fresh.remove('alice');assert.deepEqual(await fresh.status('alice'),{configured:false});assert.deepEqual(await fresh.status('bob'),{configured:true,fixture:'beta'});
});
test('synthetic seam rejects arbitrary credentials, owner overrides, inherited names and anonymous requests',async()=>{
 const {service,repository}=setup();for(const input of [{apiKey:'sk-fake-not-real'},{fixture:'alpha',owner:'bob'},{fixture:'toString'},{fixture:['alpha']},null])await assert.rejects(service.select('alice',input));
 await assert.rejects(service.select('anonymous',{fixture:'alpha'}),{message:'Unauthenticated'});assert.equal(repository.snapshot().length,0);
});
test('wrong encryption key cannot resolve stored fake fixture',async()=>{const f=setup();await f.service.select('alice',{fixture:'alpha'});await assert.rejects(setup(f.repository,Buffer.alloc(32,8)).service.status('alice'),{message:'Credential unavailable'});});
