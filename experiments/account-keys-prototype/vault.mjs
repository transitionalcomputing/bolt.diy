import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

/** Prototype only. Production must supply a reviewed identity verifier and durable repository. */
export function createCredentialVault({verifyIdentity,repository,masterKey}) {
  if(typeof verifyIdentity!=='function'||!repository||!Buffer.isBuffer(masterKey)||masterKey.length!==32) throw Error('Invalid vault configuration');
  const encryptionKey=Buffer.from(masterKey);
  async function principal(request) {
    const identity=await verifyIdentity(request);
    if(!identity||typeof identity.issuer!=='string'||!identity.issuer||typeof identity.subject!=='string'||!identity.subject) throw Error('Unauthenticated');
    // Identity supplied only by verifier, never by a caller-provided user id or header.
    return {issuer:identity.issuer,subject:identity.subject};
  }
  const ownerId=p=>JSON.stringify([p.issuer,p.subject,'OpenAI']);
  function decrypt(row,id) {
    if(row.version!==1) throw Error('Unsupported encryption version');
    const decipher=createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(row.nonce,'base64'));
    decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(row.tag,'base64'));
    return Buffer.concat([decipher.update(Buffer.from(row.ciphertext,'base64')),decipher.final()]).toString('utf8');
  }
  return Object.freeze({
    async save(request,key) {
      const id=ownerId(await principal(request));
      if(typeof key!=='string'||key.length<8||key.length>4096||/[\r\n]/.test(key))throw Error('Invalid credential');
      const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce);cipher.setAAD(Buffer.from(id));
      const ciphertext=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
      await repository.put(id,{version:1,nonce:nonce.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64'),revision:randomBytes(16).toString('hex')});
      return {configured:true};
    },
    async status(request) {return {configured:Boolean(await repository.get(ownerId(await principal(request))))};},
    async remove(request) {await repository.remove(ownerId(await principal(request)));return {configured:false};},
    async resolveForProvider(request) {
      const id=ownerId(await principal(request)),row=await repository.get(id);
      if(!row)throw Error('OpenAI credential not configured');
      // Internal server-only return. No fallback to env/cookies/request body.
      try{return {apiKey:decrypt(row,id),credentialRevision:row.revision};}catch{throw Error('Credential unavailable');}
    },
  });
}

/** Test adapter, intentionally not durable and never selected automatically. */
export function createMemoryRepository() {
  const rows=new Map();return {async get(k){const v=rows.get(k);return v?structuredClone(v):undefined},async put(k,v){rows.set(k,structuredClone(v))},async remove(k){rows.delete(k)},snapshot(){return structuredClone([...rows])}};
}
