import test from 'node:test';import assert from 'node:assert/strict';import {crc32,deflateRawSync} from 'node:zlib';import {readInertZip} from './zip-intake.mjs';
function zip(entries){let offset=0;const locals=[],central=[];
 for(const e of entries){const name=Buffer.from(e.path),data=Buffer.from(e.data??'hello'),compressed=e.deflate?deflateRawSync(data):data,crc=crc32(data);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(e.encrypted?1:0,6);local.writeUInt16LE(e.deflate?8:0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(e.claim??data.length,22);local.writeUInt16LE(name.length,26);locals.push(local,name,compressed);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(e.encrypted?1:0,8);c.writeUInt16LE(e.deflate?8:0,10);c.writeUInt32LE(e.badCrc?0:crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(e.claim??data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(((e.mode??0x81a4)<<16)>>>0,38);c.writeUInt32LE(offset,42);central.push(c,name);offset+=local.length+name.length+compressed.length;
 }const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,dir,end]);}
test('ZIP binary bytes and compressed package scripts remain inert',async()=>{const binary=Buffer.from([0,255,128,1]);const out=await readInertZip(zip([{path:'image.bin',data:binary},{path:'package.json',data:'{"scripts":{"postinstall":"no"}}',deflate:true}]));assert.deepEqual(out.files[0].bytes,binary);assert.equal(out.mode,'inert');assert.equal(out.files.length,2);});
test('reject ZIP traversal, symlink and encryption before intake',async()=>{for(const e of [{path:'../x'},{path:'x',mode:0xa1ff},{path:'x',encrypted:true},{path:'x\\y'}])await assert.rejects(readInertZip(zip([e])),/^Error: Invalid project archive$/);});
test('reject corrupt, forged-size and oversized decompression metadata',async()=>{for(const input of [Buffer.from('bad'),zip([{path:'x',badCrc:true}]),zip([{path:'x',deflate:true,claim:1}]),zip([{path:'x',deflate:true,claim:9*1024*1024}]),zip([{path:'x',data:Buffer.alloc(9*1024*1024),deflate:true,claim:1}])])await assert.rejects(readInertZip(input),/^Error: Invalid project archive$/);});
test('reject duplicate/colliding entries and count bound',async()=>{for(const entries of [[{path:'x'},{path:'X'}],[{path:'x'},{path:'x/y'}],Array.from({length:1001},(_,i)=>({path:String(i),data:''}))])await assert.rejects(readInertZip(zip(entries)),/^Error: Invalid project archive$/);});

test('directory prefixes reject files in either order but allow directory children',async()=>{
 const parent={path:'x',data:'file'},childDir={path:'x/y/',data:'',mode:0x41ed};
 for(const entries of [[parent,childDir],[childDir,parent]])await assert.rejects(readInertZip(zip(entries)),/^Error: Invalid project archive$/);
 for(const entries of [[{path:'x/',data:'',mode:0x41ed},{path:'x/y',data:'child'}],[{path:'x/y',data:'child'},{path:'x/',data:'',mode:0x41ed}]]){
  const out=await readInertZip(zip(entries));assert.equal(out.files.length,1);assert.equal(out.files[0].path,'x/y');
 }
});
test('ZIP manifest can enter owner-scoped inert service without autorun',async()=>{
 const {createWorkspaceService,createMockWorkspaceRepository}=await import('../account-keys-prototype/workspaces.mjs');const identities=new WeakMap();
 const auth={async verifyIdentity(r){const p=identities.get(r);if(!p)throw Error('Unauthenticated');return p},async requireMutation(r){await this.verifyIdentity(r);if(r.headers.get('origin')!=='https://test.example'||r.headers.get('x-csrf-token')!=='fake')throw Error('Forbidden')}};
 const service=createWorkspaceService({auth,repository:createMockWorkspaceRepository()});const req=(subject,method)=>{const r=new Request('https://test.example/import',{method,headers:{origin:'https://test.example','x-csrf-token':'fake'}});identities.set(r,{issuer:'mock',subject});return r};
 const parsed=await readInertZip(zip([{path:'logo.bin',data:Buffer.from([0,255])},{path:'package.json',data:'{"scripts":{"postinstall":"never-run"}}'}]));
 const result=await service.create(req('alice','POST'),{files:parsed.files.map(({path,bytes})=>({path,bytes}))});const record=await service.read(req('alice','GET'),result.id);
 assert.equal(record.mode,'inert');assert.equal(record.files[0].base64,'AP8=');await assert.rejects(service.read(req('bob','GET'),result.id),/Workspace not found/);
});
