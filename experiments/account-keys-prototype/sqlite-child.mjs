// Fake-only subprocess fixture. No live configuration or credentials.
import {openSqliteStores} from './sqlite-store.mjs';
import {createCredentialVault} from './vault.mjs';
const [action,file]=process.argv.slice(2),stores=openSqliteStores(file);
try{
 const vault=createCredentialVault({verifyIdentity:async()=>({issuer:'mock',subject:'alice'}),repository:stores.credentials,masterKey:Buffer.alloc(32,4)});
 if(action==='seed'){await vault.save({},'fake-restart-credential');await stores.sessions.put('hashed-fake-session',{issuer:'mock',subject:'alice',expires:123});await stores.transactions.put('one-use',{nonce:'fake-nonce'});console.log('seeded');}
 else if(action==='read'){const key=await vault.resolveForProvider({});console.log(JSON.stringify({keyMatches:key.apiKey==='fake-restart-credential',session:await stores.sessions.get('hashed-fake-session')}));}
 else if(action==='take'){console.log(JSON.stringify({consumed:!!await stores.transactions.take('one-use')}));}
 else throw Error('Invalid test action');
}finally{stores.close();}
