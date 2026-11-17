import test from 'node:test';import assert from 'node:assert/strict';import {runIsolatedProbe} from './isolated-probe.mjs';
test('isolated probe fixed loopback, fake host, no redirects or sensitive output',async()=>{
 const statuses=[200,401,401,401,400,404];let calls=0,cancelled=0;
 const results=await runIsolatedProbe(async(url,options)=>{assert.equal(new URL(url).origin,'http://127.0.0.1:3000');assert.equal(options.headers.Host,'bolt-test.invalid');assert.equal(options.redirect,'manual');assert.ok(options.signal);return {status:statuses[calls++],body:{cancel:async()=>cancelled++}};});
 assert.equal(calls,6);assert.equal(cancelled,6);assert.deepEqual(results.map(r=>r.status),statuses);assert.ok(results.every(r=>Object.keys(r).join(',')==='check,status'));
});
test('unexpected redirect stops probe without following or reflecting response',async()=>{
 let calls=0;await assert.rejects(runIsolatedProbe(async()=>{calls++;return new Response('secret',{status:302,headers:{location:'https://example.invalid/secret'}});}),{message:'Isolated readiness check failed'});assert.equal(calls,1);
});
test('actual Node HTTP probe preserves canonical Host on fixed loopback', {timeout:3000},async t=>{
 const {createServer}=await import('node:http');let calls=0;const statuses=[200,401,401,401,400,404];
 const server=createServer((req,res)=>{assert.equal(req.headers.host,'bolt-test.invalid');assert.equal(req.headers.origin,'https://bolt-test.invalid');res.writeHead(statuses[calls++]);res.end('not printed');});
 t.after(()=>{server.closeAllConnections();server.close();});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3000,'127.0.0.1',resolve);});
 const results=await runIsolatedProbe();assert.equal(calls,6);assert.deepEqual(results.map(r=>r.status),statuses);
});
