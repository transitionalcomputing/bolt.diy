/** Synthetic credential acceptance seam. No arbitrary key input or provider calls. */
import {createCredentialVault} from '../account-keys-prototype/vault.mjs';
const fixtures=Object.freeze({alpha:'FAKE-ONLY-ALPHA-NOT-AN-API-KEY',beta:'FAKE-ONLY-BETA-NOT-AN-API-KEY'});
export function createFakeCredentialService({auth,repository,masterKey}){
 const vault=createCredentialVault({verifyIdentity:r=>auth.verifyIdentity(r),repository,masterKey});
 return Object.freeze({
  async status(request){
   if(!(await vault.status(request)).configured)return {configured:false};
   const {apiKey}=await vault.resolveForProvider(request);
   const fixture=Object.keys(fixtures).find(k=>fixtures[k]===apiKey);
   if(!fixture)throw Error('Invalid synthetic credential');
   return {configured:true,fixture};
  },
  async select(request,input){
   await auth.requireMutation(request);
   if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).length!==1||!Object.hasOwn(input,'fixture')||typeof input.fixture!=='string'||!Object.hasOwn(fixtures,input.fixture))throw Error('Invalid synthetic credential');
   await vault.save(request,fixtures[input.fixture]);return {configured:true,fixture:input.fixture};
  },
  async remove(request){await auth.requireMutation(request);return vault.remove(request);},
 });
}
