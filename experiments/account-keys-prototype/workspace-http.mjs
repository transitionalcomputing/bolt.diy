/** Experimental unmounted upload handler. Parser and account service are explicit capabilities. */
export function createWorkspaceImportHandler({origin,auth,workspaces,parseArchive,maxUploadBytes=32*1024*1024}){
 const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin||!Number.isSafeInteger(maxUploadBytes)||maxUploadBytes<1||maxUploadBytes>32*1024*1024)throw Error('Invalid import configuration');
 const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
 const statuses=new Map([['Unauthenticated',401],['Forbidden',403],['Invalid project archive',400],['Invalid project import',400],['Upload too large',413],['Upload cancelled',400]]);
 return async request=>{
  try{
   const url=new URL(request.url);if(url.origin!==origin||url.pathname!=='/api/workspaces/import'||url.search)return response(404,{error:'Not found'});
   if(request.method!=='POST')return response(405,{error:'Method not allowed'});
   // Both guards precede body reading and archive parsing. The service rechecks before write.
   await auth.requireMutation(request);await auth.verifyIdentity(request);
   if(request.headers.get('content-type')!=='application/zip')return response(415,{error:'Expected ZIP upload'});
   const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxUploadBytes))return response(413,{error:'Upload too large'});
   if(request.signal.aborted)throw Error('Upload cancelled');if(!request.body)return response(400,{error:'Invalid project archive'});
   const reader=request.body.getReader(),chunks=[];let size=0,complete=false;
   const abort=()=>{void reader.cancel().catch(()=>{});};request.signal.addEventListener('abort',abort,{once:true});
   if(request.signal.aborted)abort();
   try{for(;;){if(request.signal.aborted)throw Error('Upload cancelled');const next=await reader.read();if(next.done){complete=true;break;}size+=next.value.byteLength;if(size>maxUploadBytes)throw Error('Upload too large');chunks.push(next.value);}}
   finally{request.signal.removeEventListener('abort',abort);if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(request.signal.aborted)throw Error('Upload cancelled');
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
   const manifest=await parseArchive(bytes);if(request.signal.aborted)throw Error('Upload cancelled');
   const result=await workspaces.create(request,{files:manifest.files.map(({path,bytes})=>({path,bytes}))});return response(201,result);
  }catch(error){const status=statuses.get(error?.message)||500;return response(status,{error:status===500?'Import failed':status===401?'Unauthenticated':status===403?'Forbidden':status===413?'Upload too large':'Invalid project archive'});}
 };
}
