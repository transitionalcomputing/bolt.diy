/** Experimental Node-only inert intake. No archive extraction, storage or execution. */
import {createHash} from 'node:crypto';
const LIMITS=Object.freeze({files:1000,fileBytes:8*1024*1024,totalBytes:32*1024*1024,pathBytes:512});
const fail=()=>{throw new Error('Invalid project import');};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
function safePath(path){
 if(typeof path!=='string'||!path||Buffer.byteLength(path)>LIMITS.pathBytes||path!==path.normalize('NFC')||/[\\:\x00-\x1f\x7f]/u.test(path))fail();
 const segments=path.split('/');
 if(segments.some(s=>!s||s==='.'||s==='..'||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)||s.toLowerCase()==='.git'))fail();
 return path;
}
export function prepareInertImport(input){
 if(!exact(input,['files'])||!Array.isArray(input.files)||input.files.length===0||input.files.length>LIMITS.files)fail();
 let totalBytes=0;const paths=new Set();const result=[];
 for(const file of input.files){
  if(!exact(file,['path','bytes'])||!(file.bytes instanceof Uint8Array))fail();
  const path=safePath(file.path);const folded=path.toLowerCase();
  if(paths.has(folded)||file.bytes.byteLength>LIMITS.fileBytes)fail();
  totalBytes+=file.bytes.byteLength;if(totalBytes>LIMITS.totalBytes)fail();paths.add(folded);
  // Snapshot caller-owned bytes; never decode or rewrite binary/text contents.
  const bytes=Buffer.from(file.bytes);result.push({path,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length});
 }
 for(const path of paths){const segments=path.split('/');for(let i=1;i<segments.length;i++)if(paths.has(segments.slice(0,i).join('/')))fail();}
 result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {version:1,mode:'inert',totalBytes,files:result};
}
export const inertImportLimits=LIMITS;
