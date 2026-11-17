/** Experimental nonstreaming OpenAI adapter. Explicit transport injection only.
 * Tests supply fake Responses; never mounted or called against the real API here.
 */
export function createOpenAIDriver({transport,maxResponseBytes=1048576,timeoutMs=15000}){
 if(typeof transport!=='function')throw Error('Invalid transport');
 async function send(config,path,body){
  if(config.baseURL!=='https://api.openai.com/v1'||typeof config.apiKey!=='string'||!config.apiKey||/[\r\n]/.test(config.apiKey))throw Error('Provider configuration invalid');
  try{
   const response=await transport('https://api.openai.com/v1'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+config.apiKey,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   if(response.redirected||response.status<200||response.status>=300||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){await response.body?.cancel();throw Error('Rejected response')}
   const reader=response.body?.getReader();if(!reader)throw Error('Empty response');let length=0,chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxResponseBytes){await reader.cancel();throw Error('Oversized response')}chunks.push(value)}}finally{reader.releaseLock()}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   // Prevent direct credential reflection even from a malformed upstream response.
   const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid response shape');if(text.includes(config.apiKey)||JSON.stringify(data).includes(config.apiKey))throw Error('Credential reflection');return data;
  }catch{throw Error('OpenAI request failed')}
 }
 return Object.freeze({
  async listModels(config){const data=await send(config,'/models');if(!Array.isArray(data.data))throw Error('Invalid OpenAI response');const ids=data.data.map(item=>item?.id);if(ids.length>10000||ids.some(id=>typeof id!=='string'||!/^[-a-zA-Z0-9_.:]{1,128}$/.test(id)))throw Error('Invalid OpenAI response');return ids},
  async generate(config,{model,prompt}){const data=await send(config,'/chat/completions',{model,messages:[{role:'user',content:prompt}],stream:false,max_completion_tokens:1024});const content=data.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error('Invalid OpenAI response');return {text:content}}
 });
}
