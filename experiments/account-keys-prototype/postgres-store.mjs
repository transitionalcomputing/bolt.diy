/** Experimental server-only Postgres adapter, suitable for a dedicated DB candidate.
 * Inject a restricted server-owned client; never Supabase browser/service-role keys.
 * No schema creation, connection, credentials or migration is performed here.
 */
export function createPostgresStores(client){
 if(typeof client?.query!=='function')throw Error('Invalid database client');
 const namespace=name=>Object.freeze({
  async put(id,value){const json=JSON.stringify(value);if(json===undefined)throw Error('Invalid record');await client.query('INSERT INTO bolt_private.records(namespace,id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,id) DO UPDATE SET payload=excluded.payload',[name,id,json])},
  async get(id){const r=await client.query('SELECT payload FROM bolt_private.records WHERE namespace=$1 AND id=$2',[name,id]);return r.rows[0]?.payload},
  // Atomic SQL consume; never replace with separate SELECT then DELETE.
  async take(id){const r=await client.query('DELETE FROM bolt_private.records WHERE namespace=$1 AND id=$2 RETURNING payload',[name,id]);return r.rows[0]?.payload},
  async remove(id){await client.query('DELETE FROM bolt_private.records WHERE namespace=$1 AND id=$2',[name,id])},
 });return Object.freeze({transactions:namespace('transactions'),sessions:namespace('sessions'),credentials:namespace('credentials')});
}
