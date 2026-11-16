import {build} from 'esbuild';import {Miniflare} from 'miniflare';import assert from 'node:assert/strict';
await build({entryPoints:['worker.mjs'],bundle:true,format:'esm',platform:'browser',outfile:'worker.bundle.mjs'});
const mf=new Miniflare({modules:true,scriptPath:'worker.bundle.mjs',compatibilityDate:'2026-08-06',compatibilityFlags:['nodejs_compat'],outboundService:()=>{throw Error('Outbound network forbidden');}});
try{const r=await mf.dispatchFetch('https://test.example');const data=await r.json();assert.equal(data.identity.subject,'alice');assert.equal(data.calls,2);assert.equal(data.wrongStateRejected,true);console.log(JSON.stringify(data));}finally{await mf.dispose();}
