/** Validate a persisted inert snapshot before exposing it; fixed failure only. */
import {prepareInertImport,inertImportLimits as caps} from './inert-import.mjs';
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function validateWorkspaceRecord(record,expectedId){
 try{
  if(!exact(record,['version','id','mode','files','totalBytes'])||record.version!==1||record.id!==expectedId||record.mode!=='inert'||!Array.isArray(record.files)||record.files.length===0||record.files.length>caps.files)throw Error();
  let total=0;const files=[];
  for(const f of record.files){
   if(!exact(f,['path','base64','sha256','size'])||!Number.isSafeInteger(f.size)||f.size<0||f.size>caps.fileBytes||typeof f.base64!=='string'||f.base64.length!==4*Math.ceil(f.size/3)||typeof f.sha256!=='string'||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error();
   total+=f.size;if(total>caps.totalBytes)throw Error();
   const bytes=Buffer.from(f.base64,'base64');if(bytes.length!==f.size||bytes.toString('base64')!==f.base64)throw Error();files.push({path:f.path,bytes});
  }
  if(record.totalBytes!==total)throw Error();
  const manifest=prepareInertImport({files}),byPath=new Map(record.files.map(f=>[f.path,f]));
  for(const f of manifest.files)if(byPath.get(f.path).sha256!==f.sha256)throw Error();
  return {version:1,id:expectedId,mode:'inert',totalBytes:manifest.totalBytes,files:manifest.files.map(f=>({path:f.path,base64:f.bytes.toString('base64'),sha256:f.sha256,size:f.size}))};
 }catch{throw Error('Workspace unavailable');}
}
