/** Restricted auth housekeeping. Never removes credentials or workspace records. */
export async function purgeExpiredAuthRecords(client,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid cleanup time');
 await client.query("DELETE FROM bolt_private.records WHERE namespace IN ('transactions','sessions') AND CASE WHEN jsonb_typeof(payload->'expires')='number' AND (payload->>'expires') ~ '^[0-9]{1,16}$' THEN (payload->>'expires')::numeric <= $1 ELSE TRUE END",[now]);
}
