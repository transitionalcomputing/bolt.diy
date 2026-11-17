/** Experimental browser controller. No credential persistence or secret state. */
export function createSettingsClient({fetcher,onChange=()=>{}}){
 let state={connected:false,busy:false,error:null},csrf;
 const publish=patch=>{state={...state,...patch};onChange({...state})};
 async function call(path,options={}){const response=await fetcher(path,{credentials:'same-origin',cache:'no-store',...options,redirect:'error'});if(!response.ok)throw Error('Account request failed');return response.status===204?null:response.json()}
 async function refresh(){const session=await call('/api/account/session');if(session.authenticated!==true||typeof session.csrfToken!=='string')throw Error('Authentication required');csrf=session.csrfToken;const status=await call('/api/account/openai');if(typeof status.configured!=='boolean')throw Error('Invalid status');publish({connected:status.configured})}
 async function run(action){if(state.busy)return false;publish({busy:true,error:null});try{await action();return true}catch{csrf=undefined;publish({connected:false,error:'Unable to update account settings. Please sign in and try again.'});return false}finally{publish({busy:false})}}
 return Object.freeze({state:()=>({...state}),load:()=>run(refresh),
 save:key=>run(async()=>{await refresh();await call('/api/account/openai',{method:'PUT',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({apiKey:key})});await refresh()}),
 remove:()=>run(async()=>{await refresh();await call('/api/account/openai',{method:'DELETE',headers:{'x-csrf-token':csrf}});await refresh()})});
}
/** DOM wiring kept separate for review. Tests cover controller, not real browsers. */
export function mountSettings(root,fetcher){
 const doc=root.ownerDocument,form=doc.createElement('form'),input=doc.createElement('input'),save=doc.createElement('button'),remove=doc.createElement('button'),status=doc.createElement('p');
 input.type='password';input.autocomplete='new-password';input.setAttribute('aria-label','OpenAI API key');save.type='submit';save.textContent='Save key';remove.type='button';remove.textContent='Remove saved key';status.setAttribute('role','status');
 const client=createSettingsClient({fetcher,onChange:s=>{save.disabled=remove.disabled=s.busy;status.textContent=s.error||(s.connected?'OpenAI key connected':'No OpenAI key saved')}});
 form.append(input,save,remove,status);root.replaceChildren(form);
 form.addEventListener('submit',event=>{event.preventDefault();const key=input.value;input.value='';void client.save(key)});remove.addEventListener('click',()=>{input.value='';void client.remove()});void client.load();return client;
}
