/** Experimental server-only provider boundary. Not mounted in Bolt.
 * Driver is a trusted server adapter, never caller-supplied. Never expose vault
 * resolver or driver configuration as a browser response. No shared-key fallback.
 */
export function createOpenAIBoundary({auth,accounts,driver}) {
  if(!auth||!accounts||typeof driver?.listModels!=='function'||typeof driver?.generate!=='function')throw Error('Invalid provider configuration');
  async function credential(request){await auth.verifyIdentity(request);return accounts.resolveForProvider(request)}
  const config=key=>Object.freeze({apiKey:key,baseURL:'https://api.openai.com/v1'});
  return Object.freeze({
    async listModels(request){
      if(request.method!=='GET')throw Error('Method not allowed');
      const {apiKey}=await credential(request);
      // No process-global provider, cache, environment mutation or secret identifier.
      return driver.listModels(config(apiKey));
    },
    async generate(request,input){
      if(request.method!=='POST')throw Error('Method not allowed');
      await auth.requireMutation(request);
      // Narrow prototype request schema; real chat/tools/streaming are not implemented.
      if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['model','prompt'].includes(k))||typeof input.model!=='string'||!/^[-a-zA-Z0-9_.:]{1,128}$/.test(input.model)||typeof input.prompt!=='string'||input.prompt.length<1||input.prompt.length>16384)throw Error('Invalid request');
      const {apiKey}=await credential(request);
      return driver.generate(config(apiKey),{model:input.model,prompt:input.prompt});
    }
  });
}
