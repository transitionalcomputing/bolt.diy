// Fake-only test worker. NEVER deploy: mock subject is selected by test action.
import {createD1Stores} from '../account-keys-prototype/d1-store.mjs';
import {createCredentialVault} from '../account-keys-prototype/vault.mjs';
export default {async fetch(request,env){const stores=await createD1Stores(env.FAKE_DB);const action=new URL(request.url).pathname;const user=action==='/bob'?'bob':'alice';const vault=createCredentialVault({verifyIdentity:async()=>({issuer:'mock',subject:user}),repository:stores.credentials,masterKey:Buffer.alloc(32,8)});
if(action==='/seed'){await vault.save({},'fake-worker-key');await stores.sessions.put('fake-hash',{subject:'alice'});await stores.transactions.put('once',{nonce:'fake'});return Response.json({seeded:true});}
if(action==='/take')return Response.json({consumed:!!await stores.transactions.take('once')});
if(action==='/bob')return Response.json(await vault.status({}));
if(action==='/read')return Response.json({keyMatches:(await vault.resolveForProvider({})).apiKey==='fake-worker-key',session:await stores.sessions.get('fake-hash')});
return new Response(null,{status:404});}};
