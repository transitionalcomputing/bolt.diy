/** Experimental Node HTTP bridge. No listener or production auth is created here.
 * Caller must supply server-owned canonical origin and reviewed Fetch handler.
 */
import {createServer} from 'node:http';import {Readable} from 'node:stream';
export function createNodeAccountServer({publicOrigin,handler,handlerTimeoutMs=30000}){
 if(!Number.isInteger(handlerTimeoutMs)||handlerTimeoutMs<1)throw Error('Invalid timeout');
 const canonical=new URL(publicOrigin);if(canonical.protocol!=='https:'||canonical.pathname!=='/'||canonical.search||canonical.hash||canonical.username||canonical.password||typeof handler!=='function')throw Error('Invalid server configuration');
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{
  const abort=new AbortController();let timer;
  const disconnected=()=>{if(!res.writableEnded)abort.abort()};req.once('aborted',disconnected);res.once('close',disconnected);
  try{
   if(req.headers.host!==canonical.host||!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"Invalid request"}');return;}
   const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(name==='forwarded'||name.startsWith('x-forwarded-')||name.startsWith('x-authentik-'))continue;headers.append(name,req.rawHeaders[i+1]);}
   // Origin/identity derived from configured URL plus authenticated app session,
   // never from unverified forwarded headers. Original Origin header is retained.
   const url=new URL(req.url,canonical);if(url.origin!==canonical.origin)throw Error('Invalid target');
   const request=new Request(url,{method:req.method,headers,signal:abort.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('Handler timeout'))},handlerTimeoutMs)});
   const response=await Promise.race([handler(request),deadline]);clearTimeout(timer);res.statusCode=response.status;
   for(const [key,value]of response.headers){if(key!=='set-cookie')res.setHeader(key,value)}const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
   if(!response.body||req.method==='HEAD'){res.end();return;}
   const stream=Readable.fromWeb(response.body);stream.on('error',()=>res.destroy());res.once('close',()=>stream.destroy());stream.pipe(res);
  }catch{clearTimeout(timer);if(!res.headersSent){res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"Account request failed"}')}else res.destroy();}
 });
 server.headersTimeout=10000;server.requestTimeout=20000;server.keepAliveTimeout=5000;return server;
}
