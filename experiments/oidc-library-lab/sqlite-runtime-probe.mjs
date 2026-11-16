// Local fake-only negative compatibility probe, no deployed settings changed.
import {Miniflare} from 'miniflare';import assert from 'node:assert/strict';
const mf=new Miniflare({modules:true,compatibilityDate:'2026-08-06',compatibilityFlags:['nodejs_compat'],script:`import {DatabaseSync} from 'node:sqlite'; export default {fetch(){try{const db=new DatabaseSync(':memory:');db.close();return Response.json({supported:true})}catch(e){return Response.json({supported:false,error:e.message})}}}`,outboundService:()=>{throw Error('Outbound forbidden')}});
try{const result=await (await mf.dispatchFetch('https://test.example')).json();console.log(JSON.stringify(result));assert.equal(result.supported,false);}finally{await mf.dispose()}
