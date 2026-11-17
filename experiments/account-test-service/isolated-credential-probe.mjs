/** Disposable native-PG synthetic acceptance only. No IdP or provider requests. */
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {parseConfig} from './config.mjs';
import {createPostgresStores} from '../account-keys-prototype/postgres-store.mjs';
import {createFakeCredentialService} from './fake-credentials.mjs';
export async function exerciseSyntheticCredentials(service,phase){
 if(!['seed','verify','remove'].includes(phase))throw Error('Invalid probe phase');
 if(phase==='seed'){await service.select('fake-alice',{fixture:'alpha'});await service.select('fake-bob',{fixture:'beta'});}
 for(const [owner,fixture]of [['fake-alice','alpha'],['fake-bob','beta']]){const value=await service.status(owner);if(value.configured!==true||value.fixture!==fixture)throw Error('Synthetic persistence check failed');}
 if(phase==='remove'){
  await service.remove('fake-alice');if((await service.status('fake-alice')).configured!==false)throw Error('Synthetic removal failed');
  if((await service.status('fake-bob')).fixture!=='beta')throw Error('Synthetic isolation failed');
  await service.remove('fake-bob');
 }
 return {check:'synthetic credentials',phase,passed:true};
}
export function assertIsolatedCredentialConfig(config){
 const db=new URL(config.databaseUrl);
 if(db.search||db.hash||config.origin!=='https://bolt-test.invalid'||config.metadata.issuer!=='https://fake-idp.invalid'||config.databaseTls!=='approved-private-test-network'||db.hostname!=='127.0.0.1'||db.port!=='5432'||db.username!=='bolt_test_runtime'||!config.fakeCredentialKey||JSON.stringify(config.subjects)!=='["fake-alice","fake-bob"]')throw Error('Invalid isolated configuration');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let pool;const timer=setTimeout(()=>{console.error('Synthetic credential check failed');process.exit(1);},15000);
 try{
  const config=parseConfig(process.env);assertIsolatedCredentialConfig(config);
  const phase=process.argv[2];if(!['seed','verify','remove'].includes(phase))throw Error('Invalid probe phase');
  pool=new pg.Pool({connectionString:config.databaseUrl,ssl:false,max:1,connectionTimeoutMillis:3000,query_timeout:3000,statement_timeout:3000});pool.on('error',()=>{});
  const auth={async verifyIdentity(owner){if(!config.subjects.includes(owner))throw Error('Unauthenticated');return {issuer:config.metadata.issuer,subject:owner};},async requireMutation(owner){await this.verifyIdentity(owner);}};
  const service=createFakeCredentialService({auth,repository:createPostgresStores(pool).credentials,masterKey:config.fakeCredentialKey});
  const result=await exerciseSyntheticCredentials(service,phase);await pool.end();clearTimeout(timer);console.log(JSON.stringify(result));
 }catch{console.error('Synthetic credential check failed');try{await pool?.end();}finally{clearTimeout(timer);process.exit(1);}}
}
