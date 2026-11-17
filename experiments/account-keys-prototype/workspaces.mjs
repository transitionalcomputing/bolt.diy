/** Experimental server-internal immutable workspace snapshot service; explicit trusted storage adapter. */
import {randomUUID} from 'node:crypto';import {prepareInertImport} from './inert-import.mjs';
export function createWorkspaceService({auth,repository}){
 const owner=async request=>{const p=await auth.verifyIdentity(request);if(typeof p?.issuer!=='string'||!p.issuer||typeof p?.subject!=='string'||!p.subject)throw Error('Unauthenticated');return JSON.stringify([p.issuer,p.subject]);};
 const idCheck=id=>{if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error('Invalid workspace');};
 return Object.freeze({
  async create(request,input){
   if(request.method!=='POST')throw Error('Method not allowed');await auth.requireMutation(request);const scope=await owner(request);
   const manifest=prepareInertImport(input),id=randomUUID();
   // One immutable complete snapshot; repository contract is atomic create-if-absent.
   const record={version:1,id,mode:'inert',files:manifest.files.map(f=>({path:f.path,base64:f.bytes.toString('base64'),sha256:f.sha256,size:f.size})),totalBytes:manifest.totalBytes};
   await repository.create(scope,id,record);return {id,mode:'inert',fileCount:record.files.length,totalBytes:record.totalBytes};
  },
  async list(request){
   if(request.method!=='GET')throw Error('Method not allowed');const scope=await owner(request);
   return structuredClone(await repository.list(scope));
  },
  async read(request,id){
   if(request.method!=='GET')throw Error('Method not allowed');const scope=await owner(request);idCheck(id);
   const result=await repository.get(scope,id);if(!result)throw Error('Workspace not found');return structuredClone(result);
  },
 });
}
/** Tests only. This is not durable, quota-aware or a database permission boundary. */
export function createMockWorkspaceRepository(){
 const records=new Map(),key=(owner,id)=>JSON.stringify([owner,id]);
 return Object.freeze({async create(owner,id,value){const k=key(owner,id);if(records.has(k))throw Error('Workspace exists');records.set(k,structuredClone(value));},async list(owner){return [...records.entries()].filter(([k])=>JSON.parse(k)[0]===owner).slice(0,50).map(([,r])=>({id:r.id,mode:r.mode,fileCount:r.files.length,totalBytes:r.totalBytes}));},async get(owner,id){const record=records.get(key(owner,id));return record===undefined?undefined:structuredClone(record);}});
}
