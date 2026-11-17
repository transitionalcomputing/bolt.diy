/** Fake-only smoke probe for the network-none candidate container. Never follows redirects. */
import {pathToFileURL} from 'node:url';
import {request} from 'node:http';
export async function nativeLoopbackProbe(url,options){
 const target=new URL(url);if(target.origin!=='http://127.0.0.1:3000')throw Error('Invalid probe target');
 return new Promise((resolve,reject)=>{const req=request(target,{method:options.method,headers:options.headers,signal:options.signal},res=>{resolve({status:res.statusCode,body:{cancel:async()=>{res.destroy();}}});});req.on('error',()=>reject(Error('Isolated readiness check failed')));req.end();});
}
export async function runIsolatedProbe(transport=nativeLoopbackProbe){
 const checks=[['health','GET','/healthz',200],['session denied','GET','/api/account/session',401],['list denied','GET','/api/workspaces',401],['upload denied','POST','/api/workspaces/import',401],['invalid callback','GET','/auth/oidc/callback',400],['AI disabled','GET','/api/account/openai',404]];
 const results=[];
 for(const [name,method,path,expected] of checks){
  const response=await transport('http://127.0.0.1:3000'+path,{method,headers:{Host:'bolt-test.invalid',Origin:'https://bolt-test.invalid'},redirect:'manual',signal:AbortSignal.timeout(5000)});
  const status=response.status;await response.body?.cancel();
  if(status!==expected)throw Error('Isolated readiness check failed');
  results.push({check:name,status});
 }
 return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{for(const result of await runIsolatedProbe())console.log(JSON.stringify(result));}catch{console.error('Isolated readiness check failed');process.exitCode=1;}
}
