/** Bounded test-service lifecycle. Fixed public messages; no exception details. */
export async function listenTestServer(server, {port=3000,host='0.0.0.0'}={}) {
 await new Promise((resolve,reject)=>{
  const failed=()=>{server.removeListener('listening',ready);reject(Error('Test listener failed'));};
  const ready=()=>{server.removeListener('error',failed);resolve();};
  server.once('error',failed);server.once('listening',ready);
  try{server.listen(port,host);}catch{server.removeListener('listening',ready);server.removeListener('error',failed);reject(Error('Test listener failed'));}
 });
}
export function createTestShutdown({server,pool,clearMaintenance=()=>{},timeoutMs=5000,onFailure=()=>{}}){
 let stopping;
 return ()=>stopping??=(async()=>{
  clearMaintenance();
  let timer;
  const closed=new Promise(resolve=>{try{server.close(()=>resolve());server.closeIdleConnections?.();}catch{resolve();}});
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{server.closeAllConnections?.();onFailure('Test shutdown deadline reached');resolve();},timeoutMs);});
  await Promise.race([closed,deadline]);clearTimeout(timer);
  // pg.end may wait for a stuck checked-out client; bound this phase too.
  let poolTimer;
  await Promise.race([Promise.resolve().then(()=>pool.end()).catch(()=>onFailure('Test database shutdown failed')),new Promise(resolve=>{poolTimer=setTimeout(()=>{onFailure('Test database shutdown deadline reached');resolve();},timeoutMs);})]);
  clearTimeout(poolTimer);
 })();
}
