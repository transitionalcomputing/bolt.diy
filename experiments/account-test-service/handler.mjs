/** Isolated workspace-only test harness. No AI key routes or project execution. */
import {createFakeCredentialHandler} from './fake-credential-http.mjs';
import {createAccountHandler} from '../account-keys-prototype/http.mjs';
import {createWorkspaceImportHandler} from '../account-keys-prototype/workspace-http.mjs';
export function createTestHandler({origin,auth,workspaces,parseArchive,html,script,fakeCredentials,now=Date.now}){
 const fakeKeys=fakeCredentials?createFakeCredentialHandler({origin,auth,service:fakeCredentials}):null;
 const accounts=createAccountHandler({auth,accounts:null,origin});
 const upload=createWorkspaceImportHandler({origin,auth,workspaces,parseArchive:async bytes=>{const manifest=await parseArchive(bytes);if(manifest.totalBytes>4*1024*1024)throw Error('Invalid project archive');return manifest;},maxUploadBytes:8*1024*1024});
 let importing=false,window=now(),requests=0;
 const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
 const staticResponse=(body,type)=>new Response(body,{headers:{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'referrer-policy':'no-referrer'}});
 return async request=>{
  try{
   const url=new URL(request.url);if(url.origin!==origin)return json({error:'Not found'},404);
   if(now()-window>=60000){window=now();requests=0;}if(++requests>120)return json({error:'Try again later'},429);
   if(url.pathname==='/healthz'&&request.method==='GET')return json({status:'test-harness'});
   if(url.pathname==='/'&&request.method==='GET'&&!url.search)return staticResponse(html,'text/html; charset=utf-8');
   if(url.pathname==='/client.js'&&request.method==='GET'&&!url.search)return staticResponse(script,'text/javascript; charset=utf-8');
   if(url.pathname==='/api/test-credentials')return fakeKeys?await fakeKeys(request):json({error:'Not found'},404);
   if(url.pathname==='/api/account/openai')return json({error:'Not found'},404);
   if(url.pathname==='/api/workspaces/import'){
    await auth.requireMutation(request);await auth.verifyIdentity(request);
    if(importing)return json({error:'Import busy'},429);
    importing=true;try{
     // Test-only process-local admission control. Not a distributed quota guarantee.
     const read=new Request(origin+'/api/workspaces',{headers:request.headers});
     if((await workspaces.list(read)).length>=25)return json({error:'Test project limit reached'},409);
     return await upload(request);
    }finally{importing=false;}
   }
   if(url.pathname==='/api/workspaces'&&request.method==='GET'&&!url.search)return json({projects:await workspaces.list(request)});
   if(url.pathname.startsWith('/api/workspaces/')&&request.method==='GET'&&!url.search){const id=url.pathname.slice('/api/workspaces/'.length);const record=await workspaces.read(request,id);return json(record,200,{'content-disposition':'attachment; filename="workspace.json"'});}
   return await accounts(request);
  }catch(e){const status=new Map([['Unauthenticated',401],['Forbidden',403],['Workspace not found',404],['Invalid workspace',400],['Method not allowed',405]]).get(e?.message)||500;return json({error:status===401?'Sign in required':status===403?'Forbidden':status===404?'Not found':'Request failed'},status);}
 };
}
