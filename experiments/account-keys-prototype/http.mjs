/** Experimental HTTP routing seam. Not imported by Bolt; mock environment only. */
export function createAccountHandler({auth,accounts,origin,maxBytes=8192}) {
  const expectedOrigin=new URL(origin).origin;
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
  async function body(request){
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw Error('Unsupported media');
    const reader=request.body?.getReader();if(!reader)throw Error('Invalid body');let size=0,parts=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('Too large');}parts.push(value);}}
    finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('Invalid body');}
  }
  return async request=>{
    try{
      const url=new URL(request.url);if(url.origin!==expectedOrigin)return json({error:'Not found'},404);
      const path=url.pathname;
      if(path==='/auth/oidc/login'&&request.method==='GET'){
        const start=await auth.begin();return new Response(null,{status:302,headers:{location:start.url,'set-cookie':start.cookie,'cache-control':'no-store'}});
      }
      if(path==='/auth/oidc/callback'&&request.method==='GET'){
        const result=await auth.callback(request);const headers=new Headers({location:result.redirect,'cache-control':'no-store'});for(const cookie of result.cookies)headers.append('set-cookie',cookie);return new Response(null,{status:303,headers});
      }
      if(path==='/api/account/session'&&request.method==='GET'){
        await auth.verifyIdentity(request);return json({authenticated:true,csrfToken:await auth.csrf(request)});
      }
      if(path==='/auth/logout'&&request.method==='POST'){
        const result=await auth.logout(request);return new Response(null,{status:204,headers:{'set-cookie':result.cookie,'cache-control':'no-store'}});
      }
      if(path==='/api/account/openai'){
        if(request.method==='GET')return json(await accounts.status(request));
        if(request.method==='PUT'){
          // Authenticate and reject cross-origin/CSRF before reading sensitive body.
          await auth.requireMutation(request);const data=await body(request);
          if(!data||Array.isArray(data)||Object.keys(data).length!==1||typeof data.apiKey!=='string')throw Error('Invalid body');
          return json(await accounts.save(request,data.apiKey));
        }
        if(request.method==='DELETE'){await accounts.remove(request);return new Response(null,{status:204,headers:{'cache-control':'no-store'}});}
        return json({error:'Method not allowed'},405);
      }
      return json({error:'Not found'},404);
    }catch(error){
      // Never reflect messages, headers, tokens, keys, stack or upstream responses.
      const statuses=new Map([['Unauthenticated',401],['Forbidden',403],['Invalid login',400],['Invalid identity',401],['Invalid body',400],['Invalid credential',400],['Unsupported media',415],['Too large',413]]);
      const status=statuses.get(error?.message)||500;
      return json({error:status===500?'Account request failed':status===401?'Authentication required':status===403?'Forbidden':'Invalid request'},status);
    }
  };
}
