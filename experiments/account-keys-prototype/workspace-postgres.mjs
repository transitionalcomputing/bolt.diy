/** Server-only candidate for a dedicated private Bolt database. No connection or migration. */
export function createPostgresWorkspaceRepository(client){
 if(typeof client?.query!=='function')throw Error('Invalid database client');
 return Object.freeze({
  async create(owner,id,record){
   // Immutable insert: database primary key makes duplicate creation fail, not overwrite.
   await client.query('INSERT INTO bolt_private.workspace_snapshots(owner_id,id,payload) VALUES($1,$2,$3::jsonb)',[owner,id,JSON.stringify(record)]);
  },
  async get(owner,id){const result=await client.query('SELECT payload FROM bolt_private.workspace_snapshots WHERE owner_id=$1 AND id=$2',[owner,id]);return result.rows[0]?.payload;},
 });
}
