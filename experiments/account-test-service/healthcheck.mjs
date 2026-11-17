/** Canonical Host healthcheck; fixed local connection, no credentials or output. */
import {request} from 'node:http';import {pathToFileURL} from 'node:url';
export async function checkLocalHealth(origin,{port=3000}={}){
 const target=new URL(origin);if(target.protocol!=='https:'||target.origin!==origin)throw Error('Invalid origin');
 return new Promise(resolve=>{const req=request({hostname:'127.0.0.1',port,path:'/healthz',headers:{Host:target.host},method:'GET'},res=>{res.resume();res.on('end',()=>resolve(res.statusCode===200));res.on('error',()=>resolve(false));});req.setTimeout(3000,()=>{req.destroy();resolve(false);});req.on('error',()=>resolve(false));req.end();});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{process.exit(await checkLocalHealth(process.env.TEST_ORIGIN)?0:1);}catch{process.exit(1);}}
