import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {listenTestServer,createTestShutdown} from './lifecycle.mjs';
test('loopback listener starts and repeated shutdown closes pool once',async()=>{
 const server=createServer((q,s)=>s.end('ok'));await listenTestServer(server,{host:'127.0.0.1',port:0});let ended=0,cleared=0;
 const stop=createTestShutdown({server,pool:{end:async()=>{ended++;}},clearMaintenance:()=>cleared++});await Promise.all([stop(),stop()]);assert.equal(ended,1);assert.equal(cleared,1);assert.equal(server.listening,false);
});
test('occupied loopback port rejects with fixed message without exposing source error',async()=>{
 const first=createServer();await listenTestServer(first,{host:'127.0.0.1',port:0});const second=createServer();
 try{await assert.rejects(listenTestServer(second,{host:'127.0.0.1',port:first.address().port}),{message:'Test listener failed'});}finally{await new Promise(r=>first.close(r));}
});
test('stuck server and pool are bounded and emit only fixed messages',async()=>{
 let force=0;const errors=[];const stop=createTestShutdown({server:{close(){},closeAllConnections(){force++;}},pool:{end:()=>new Promise(()=>{})},timeoutMs:5,onFailure:s=>errors.push(s)});
 await stop();assert.equal(force,1);assert.deepEqual(errors,['Test shutdown deadline reached','Test database shutdown deadline reached']);
});
test('deadline closes actual active loopback HTTP connection',{timeout:2000},async t=>{
 const {connect}=await import('node:net');let received;const requestSeen=new Promise(r=>received=r);
 const server=createServer(()=>received());await listenTestServer(server,{host:'127.0.0.1',port:0});
 const socket=connect({host:'127.0.0.1',port:server.address().port});socket.on('error',()=>{});t.after(()=>{socket.destroy();server.closeAllConnections();server.close();});
 await new Promise(r=>socket.once('connect',r));socket.write('GET / HTTP/1.1\r\nHost: test.invalid\r\n\r\n');await requestSeen;
 const closed=new Promise(r=>socket.once('close',r));let ended=0;const errors=[];
 const stop=createTestShutdown({server,pool:{end:async()=>{ended++;}},timeoutMs:10,onFailure:s=>errors.push(s)});
 await stop();await closed;assert.equal(ended,1);assert.deepEqual(errors,['Test shutdown deadline reached']);assert.equal(server.listening,false);
});
