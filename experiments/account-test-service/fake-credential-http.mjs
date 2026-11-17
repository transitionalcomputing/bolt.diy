/** Unmounted synthetic fixture API. Authenticate before reading any mutation body. */
export function createFakeCredentialHandler({origin,auth,service,bodyTimeoutMs=2000}){
 if(!Number.isSafeInteger(bodyTimeoutMs)||bodyTimeoutMs<1||bodyTimeoutMs>5000)throw Error('Invalid test timeout');
 const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
 return async request=>{
  try{
   const url=new URL(request.url);
   if(url.origin!==origin||url.pathname!=='/api/test-credentials'||url.search)return response({error:'Not found'},404);
   if(request.method==='GET')return response(await service.status(request));
   if(!['PUT','DELETE'].includes(request.method))return response({error:'Method not allowed'},405);
   await auth.requireMutation(request);
   if(request.method==='DELETE')return response(await service.remove(request));
   if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return response({error:'Invalid request'},400);
   if(request.signal.aborted)return response({error:'Invalid request'},400);
   const reader=request.body?.getReader();if(!reader)return response({error:'Invalid request'},400);
   let size=0,parts=[],timer,interrupted=false,rejectStop;
   const stopped=new Promise((_,reject)=>{rejectStop=reject;});
   const interrupt=()=>{interrupted=true;rejectStop(Error('Invalid synthetic credential'));void reader.cancel().catch(()=>{});};
   request.signal.addEventListener('abort',interrupt,{once:true});timer=setTimeout(interrupt,bodyTimeoutMs);
   if(request.signal.aborted)interrupt();
   try{while(true){const {done,value}=await Promise.race([reader.read(),stopped]);if(interrupted)throw Error('Invalid synthetic credential');if(done)break;size+=value.byteLength;if(size>128){void reader.cancel().catch(()=>{});return response({error:'Invalid request'},400);}parts.push(value);}}
   finally{clearTimeout(timer);request.signal.removeEventListener('abort',interrupt);reader.releaseLock();}
   if(request.signal.aborted)return response({error:'Invalid request'},400);
   const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
   let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return response({error:'Invalid request'},400);}
   return response(await service.select(request,data));
  }catch(error){const status=new Map([['Unauthenticated',401],['Forbidden',403],['Invalid synthetic credential',400]]).get(error?.message)??500;return response({error:status===401?'Sign in required':status===403?'Forbidden':'Request failed'},status);}
 };
}
