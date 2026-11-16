/** Experimental D1-style binding adapter. No network client or production binding. */
export async function createD1Stores(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS records(namespace TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(namespace,id))').run();
  const names=['transactions','sessions','credentials'];
  const store=namespace=>Object.freeze({
    async put(id,value){const text=JSON.stringify(value);if(text===undefined)throw Error('Invalid record');await db.prepare('INSERT INTO records(namespace,id,payload) VALUES(?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET payload=excluded.payload').bind(namespace,id,text).run()},
    async get(id){const row=await db.prepare('SELECT payload FROM records WHERE namespace=? AND id=?').bind(namespace,id).first();return row?JSON.parse(row.payload):undefined},
    async take(id){const row=await db.prepare('DELETE FROM records WHERE namespace=? AND id=? RETURNING payload').bind(namespace,id).first();return row?JSON.parse(row.payload):undefined},
    async remove(id){await db.prepare('DELETE FROM records WHERE namespace=? AND id=?').bind(namespace,id).run()},
  });return Object.freeze(Object.fromEntries(names.map(n=>[n,store(n)])));
}
