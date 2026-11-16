/** Experimental Node-only durable adapter. Not compatible with workerd file I/O.
 * Database path must be server-owned, never selected from an HTTP request.
 */
import {DatabaseSync} from 'node:sqlite';
export function openSqliteStores(filename){
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS records(namespace TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(namespace,id)) STRICT;');
  const put=db.prepare('INSERT INTO records(namespace,id,payload) VALUES(?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET payload=excluded.payload');
  const get=db.prepare('SELECT payload FROM records WHERE namespace=? AND id=?');
  const take=db.prepare('DELETE FROM records WHERE namespace=? AND id=? RETURNING payload');
  const remove=db.prepare('DELETE FROM records WHERE namespace=? AND id=?');
  const decode=row=>row?JSON.parse(row.payload):undefined;
  function store(namespace){return Object.freeze({
    async put(id,value){const payload=JSON.stringify(value);if(payload===undefined)throw Error('Invalid record');put.run(namespace,id,payload)},
    async get(id){return decode(get.get(namespace,id))},
    // Single SQL statement, atomic across connections/processes. No get-then-delete gap.
    async take(id){return decode(take.get(namespace,id))},
    async remove(id){remove.run(namespace,id)},
  });}
  return Object.freeze({transactions:store('transactions'),sessions:store('sessions'),credentials:store('credentials'),close(){db.close()}});
}
