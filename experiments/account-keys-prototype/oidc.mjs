/** Isolated orchestration prototype. A reviewed OIDC library must implement protocol.
 * No JWT parsing, discovery URL following, forwarded-header trust, or default adapters.
 */
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
const random=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('base64url');
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function createAccountAuth({issuer,clientId,origin,protocol,transactions,sessions,authorize,now=Date.now}) {
  if(!issuer||!clientId||!protocol||!transactions||!sessions||typeof authorize!=='function'||new URL(origin).protocol!=='https:'||new URL(issuer).protocol!=='https:')throw Error('Invalid auth configuration');
  const callback=new URL('/auth/oidc/callback',origin).href;
  const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
  const read=(req,name)=>{
    const entries=(req.headers.get('cookie')||'').split(';').map(v=>v.trim().split('='));
    const matches=entries.filter(([k])=>k===name); return matches.length===1?matches[0][1]:undefined;
  };
  async function session(req){
    const token=read(req,'__Host-bolt-session');if(!token)return null;
    const s=await sessions.get(hash(token));if(!s||s.expires<=now())return null;return await authorize({issuer:s.issuer,subject:s.subject})===true?s:null;
  }
  return Object.freeze({
    async begin(){
      const state=random(),nonce=random(),verifier=random(),browser=random();
      await transactions.put(hash(state),{nonce,verifier,browser:hash(browser),expires:now()+300000});
      const url=await protocol.authorizationUrl({issuer,clientId,redirectUri:callback,state,nonce,codeChallenge:hash(verifier),codeChallengeMethod:'S256',responseType:'code',scope:'openid'});
      return {url,cookie:cookie('__Host-bolt-login',browser,300)};
    },
    async callback(req){
      const url=new URL(req.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
      if(url.origin!==new URL(origin).origin||url.pathname!=='/auth/oidc/callback'||!state||!code||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1)throw Error('Invalid login');
      // Atomic consume prevents concurrent callback replay, including failed callbacks.
      const tx=await transactions.take(hash(state));
      const browser=read(req,'__Host-bolt-login');
      if(!tx||tx.expires<=now()||!browser||!equal(tx.browser,hash(browser)))throw Error('Invalid login');
      // Adapter MUST validate signed ID token via pinned issuer discovery/JWKS,
      // issuer/audience/azp/exp/iat/nonce, code exchange and PKCE. No decode-only path.
      const identity=await protocol.exchangeAndVerify({issuer,clientId,redirectUri:callback,code,codeVerifier:tx.verifier,expectedNonce:tx.nonce});
      if(identity?.issuer!==issuer||typeof identity.subject!=='string'||!identity.subject)throw Error('Invalid identity');
      if(await authorize({issuer,subject:identity.subject})!==true)throw Error('Forbidden');
      const token=random(),csrf=random();
      await sessions.put(hash(token),{issuer,subject:identity.subject,csrf,expires:now()+3600000});
      return {cookies:[cookie('__Host-bolt-session',token,3600),cookie('__Host-bolt-login','',0)],redirect:'/'};
    },
    async verifyIdentity(req){const s=await session(req);if(!s)throw Error('Unauthenticated');return {issuer:s.issuer,subject:s.subject};},
    async csrf(req){const s=await session(req);if(!s)throw Error('Unauthenticated');return s.csrf;},
    async requireMutation(req){
      const s=await session(req);if(!s)throw Error('Unauthenticated');
      if(!['POST','PUT','DELETE'].includes(req.method)||req.headers.get('origin')!==new URL(origin).origin||!equal(req.headers.get('x-csrf-token'),s.csrf))throw Error('Forbidden');
    },
    async logout(req){
      await this.requireMutation(req);const token=read(req,'__Host-bolt-session');await sessions.remove(hash(token));
      return {cookie:cookie('__Host-bolt-session','',0)};
    }
  });
}
export function createMockStore(){const map=new Map();return {async put(k,v){map.set(k,structuredClone(v))},async get(k){return structuredClone(map.get(k))},async take(k){const v=map.get(k);map.delete(k);return structuredClone(v)},async remove(k){map.delete(k)}}}
