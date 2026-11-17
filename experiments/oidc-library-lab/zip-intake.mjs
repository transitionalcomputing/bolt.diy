/** Experimental bounded ZIP-to-inert-manifest parser. No filesystem extraction. */
import yauzl from 'yauzl';import {crc32} from 'node:zlib';
import {prepareInertImport,inertImportLimits as caps} from '../account-keys-prototype/inert-import.mjs';
const invalid=()=>new Error('Invalid project archive');
export async function readInertZip(input){
 if(!(input instanceof Uint8Array)||input.byteLength>32*1024*1024)throw invalid();
 // Own the bounded input while asynchronous parsing runs.
 const bytes=Buffer.from(input);
 return new Promise((resolve,reject)=>{
  let zip,active,settled=false,entries=0,total=0;const files=[],seen=new Map();
  const stop=()=>{active?.destroy();zip?.close();};
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);stop();reject(invalid());};
  const timer=setTimeout(fail,5000);
  yauzl.fromBuffer(bytes,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true},(error,value)=>{
   if(error)return fail();zip=value;if(settled){stop();return;}
   zip.on('error',fail);zip.on('end',()=>{if(settled)return;try{const result=prepareInertImport({files});settled=true;clearTimeout(timer);stop();resolve(result);}catch{fail();}});
   zip.on('entry',entry=>{(async()=>{
    if(++entries>2000||entry.generalPurposeBitFlag&1||![0,8].includes(entry.compressionMethod))throw invalid();
    const directory=entry.fileName.endsWith('/');const path=directory?entry.fileName.slice(0,-1):entry.fileName;
    // Validate path before decompression; reject special Unix types including symlinks.
    prepareInertImport({files:[{path,bytes:new Uint8Array()}]});
    const mode=(entry.externalFileAttributes>>>16)&0xf000;
    if(mode!==0&&mode!==(directory?0x4000:0x8000))throw invalid();
    const folded=path.toLowerCase();if(seen.has(folded))throw invalid();
    const parts=folded.split('/');for(let i=1;i<parts.length;i++)if(seen.get(parts.slice(0,i).join('/'))==='file')throw invalid();
    if(!directory&&[...seen.keys()].some(p=>p.startsWith(folded+'/')))throw invalid();
    seen.set(folded,directory?'directory':'file');
    if(directory){if(entry.uncompressedSize!==0)throw invalid();zip.readEntry();return;}
    if(files.length>=caps.files||entry.uncompressedSize>caps.fileBytes||total+entry.uncompressedSize>caps.totalBytes)throw invalid();
    const stream=await new Promise((res,rej)=>zip.openReadStream(entry,(e,s)=>e?rej(e):res(s)));active=stream;
    if(settled){stream.destroy();return;}
    let size=0,crc=0;const chunks=[];
    for await(const chunk of stream){size+=chunk.length;if(size>caps.fileBytes||total+size>caps.totalBytes)throw invalid();crc=crc32(chunk,crc);chunks.push(chunk);}
    active=undefined;if(size!==entry.uncompressedSize||crc!==entry.crc32)throw invalid();
    total+=size;files.push({path,bytes:Buffer.concat(chunks,size)});if(!settled)zip.readEntry();
   })().catch(fail);});zip.readEntry();
  });
 });
}
