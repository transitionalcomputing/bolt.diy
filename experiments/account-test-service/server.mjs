/** Candidate separate test bootstrap. Running requires explicit reviewed secret/config injection. */
import {purgeExpiredAuthRecords} from './maintenance.mjs';
import {readFile} from 'node:fs/promises';import pg from 'pg';import {parseConfig} from './config.mjs';import {createTestHandler} from './handler.mjs';
import {createProtocol} from '../oidc-library-lab/adapter.mjs';import {readInertZip} from '../oidc-library-lab/zip-intake.mjs';
import {createTestAuth} from './auth.mjs';import {createPostgresStores} from '../account-keys-prototype/postgres-store.mjs';import {createPostgresWorkspaceRepository} from '../account-keys-prototype/workspace-postgres.mjs';import {createWorkspaceService} from '../account-keys-prototype/workspaces.mjs';import {createNodeAccountServer} from '../account-keys-prototype/node-http.mjs';
let pool,server,cleanupTimer;
try{
 const c=parseConfig(process.env);pool=new pg.Pool({connectionString:c.databaseUrl,ssl:c.databaseTls==='verify-full'?{rejectUnauthorized:true}:false,max:4,connectionTimeoutMillis:5000,query_timeout:10000,statement_timeout:10000});
 pool.on('error',()=>{console.error('Test database connection failed');});await pool.query('SELECT 1');await pool.query('SELECT id FROM bolt_private.records LIMIT 0');await pool.query('SELECT id FROM bolt_private.workspace_snapshots LIMIT 0');
 const protocol=createProtocol({metadata:c.metadata,clientId:c.clientId,clientSecret:c.clientSecret,redirectUri:c.origin+'/auth/oidc/callback',transport:(url,options)=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)})});
 await purgeExpiredAuthRecords(pool);cleanupTimer=setInterval(()=>{void purgeExpiredAuthRecords(pool).catch(()=>console.error('Test auth cleanup failed'));},60000);cleanupTimer.unref();
 const stores=createPostgresStores(pool),auth=createTestAuth({config:c,protocol,stores});
 const workspaces=createWorkspaceService({auth,repository:createPostgresWorkspaceRepository(pool)});
 const html=await readFile(new URL('./public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('./public/client.js',import.meta.url),'utf8');
 server=createNodeAccountServer({publicOrigin:c.origin,handler:createTestHandler({origin:c.origin,auth,workspaces,parseArchive:readInertZip,html,script})});
 server.listen(c.port,'0.0.0.0',()=>console.log('Isolated test harness listening'));const stop=()=>{clearInterval(cleanupTimer);server.close(()=>pool.end());};process.once('SIGTERM',stop);process.once('SIGINT',stop);
}catch{clearInterval(cleanupTimer);console.error('Test harness startup failed; verify private configuration');await pool?.end();process.exitCode=1;}
