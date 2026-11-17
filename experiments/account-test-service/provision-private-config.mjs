/** Writes fresh local private test config only; no network or credentials printed. */
import {randomBytes} from 'node:crypto';import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {parseConfig} from './config.mjs';import {createProtocol} from '../oidc-library-lab/adapter.mjs';
export async function provisionPrivateConfig(input,directory){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join(',')!=='clientId,clientSecret,metadata,subjects')throw Error('Invalid private configuration');
 const runtime=randomBytes(32).toString('hex'),admin=randomBytes(32).toString('hex'),vault=randomBytes(32).toString('base64');
 const app={TEST_ORIGIN:'https://bolt-test.signallayerit.com',OIDC_METADATA_JSON:JSON.stringify(input.metadata),OIDC_ALLOWED_SUBJECTS_JSON:JSON.stringify(input.subjects),OIDC_CLIENT_ID:input.clientId,OIDC_CLIENT_SECRET:input.clientSecret,DATABASE_URL:`postgres://bolt_test_runtime:${runtime}@database:5432/bolt_account_test`,DATABASE_TLS:'approved-private-test-network',TEST_FAKE_CREDENTIALS:'enabled',TEST_FAKE_VAULT_KEY:vault};
 for(const value of Object.values(app))if(typeof value!=='string'||!value||/[\r\n\0]/.test(value))throw Error('Invalid private configuration');
 const config=parseConfig(app);createProtocol({metadata:config.metadata,clientId:config.clientId,clientSecret:config.clientSecret,redirectUri:config.origin+'/auth/oidc/callback',transport:()=>{throw Error('Network forbidden during provisioning');}});
 const database={POSTGRES_DB:'bolt_account_test',POSTGRES_USER:'bolt_test_admin',POSTGRES_PASSWORD:admin,BOLT_RUNTIME_PASSWORD:runtime,POSTGRES_INITDB_ARGS:'--auth-host=scram-sha-256 --auth-local=trust'};
 // Intentionally fails if directory already exists. No overwrites or key rotation.
 await mkdir(directory,{mode:0o700});
 const encode=values=>Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n';
 await writeFile(join(directory,'app.env'),encode(app),{flag:'wx',mode:0o600});
 await writeFile(join(directory,'database.env'),encode(database),{flag:'wx',mode:0o600});
 return {created:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const file=process.argv[2],directory=process.argv[3];const info=await stat(file);if(!info.isFile()||info.size>65536||(info.mode&0o077)!==0)throw Error('Invalid input');const input=JSON.parse(await readFile(file,'utf8'));await provisionPrivateConfig(input,directory);console.log('Private test configuration created');}catch{console.error('Private test configuration failed');process.exitCode=1;}
}
