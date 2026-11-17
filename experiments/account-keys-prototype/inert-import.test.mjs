import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {prepareInertImport,inertImportLimits as caps} from './inert-import.mjs';
const file=(path,bytes=new Uint8Array([1]))=>({path,bytes});
const prepare=(...files)=>prepareInertImport({files});
test('binary bytes preserved, copied and hashed, package scripts stay inert',()=>{
 const binary=new Uint8Array([0,255,128,13,10]);const script=Buffer.from('{"scripts":{"postinstall":"do-not-run"}}');
 const out=prepare(file('img/logo.bin',binary),file('package.json',script));binary.fill(42);
 assert.deepEqual([...out.files[0].bytes],[0,255,128,13,10]);assert.equal(out.files[0].sha256,createHash('sha256').update(out.files[0].bytes).digest('hex'));
 assert.deepEqual(out.files[1].bytes,script);assert.equal(out.mode,'inert');assert.equal(out.totalBytes,5+script.length);assert.equal('owner' in out,false);
});
test('rejects traversal, ambiguous paths and special filesystem names',()=>{
 for(const path of ['../a','/a','a/../b','a//b','a/','./a','a\\b','C:a','a\0b','a\nb','a.','a ','CON','nul.txt','dir/LPT1.js','.git/config','a/.GIT/x','e\u0301.txt','a'.repeat(513)])assert.throws(()=>prepare(file(path)),/Invalid project import/,path);
});
test('rejects duplicates, case collisions and file/directory conflicts',()=>{
 for(const paths of [['a','a'],['A','a'],['dir','dir/file'],['Dir','dir/file']])assert.throws(()=>prepare(...paths.map(p=>file(p))),/Invalid project import/);
 assert.deepEqual(prepare(file('z'),file('a/b')).files.map(f=>f.path),['a/b','z']);
});
test('rejects symlinks, client ownership and unknown metadata rather than ignoring',()=>{
 for(const input of [{files:[{...file('a'),symlink:'secret'}]},{files:[file('a')],owner:'bob'},{files:[{path:'a',bytes:'base64'}]},{files:[]},{files:null},{files:[null]}])assert.throws(()=>prepareInertImport(input),/Invalid project import/);
});
test('enforces count and byte bounds before returning any manifest',()=>{
 assert.throws(()=>prepare(...Array.from({length:caps.files+1},(_,i)=>file(String(i)))),/Invalid project import/);
 assert.throws(()=>prepare(file('a',new Uint8Array(caps.fileBytes+1))),/Invalid project import/);
 const bytes=new Uint8Array(caps.fileBytes);assert.throws(()=>prepare(...Array.from({length:5},(_,i)=>file(String(i),bytes))),/Invalid project import/);
});
