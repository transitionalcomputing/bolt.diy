/** Explicit configuration parser, no environment reads on import. */
export function parseConfig(env){
 const required=k=>{if(typeof env[k]!=='string'||!env[k])throw Error('Missing test configuration');return env[k]};
 const origin=required('TEST_ORIGIN'),u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('Invalid test origin');
 const metadata=JSON.parse(required('OIDC_METADATA_JSON')),subjects=JSON.parse(required('OIDC_ALLOWED_SUBJECTS_JSON'));
 if(!Array.isArray(subjects)||subjects.length!==2||new Set(subjects).size!==2||subjects.some(s=>typeof s!=='string'||!s))throw Error('Exactly two test subjects required');
 const databaseUrl=required('DATABASE_URL'),db=new URL(databaseUrl);if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname)throw Error('Invalid database configuration');
 const databaseTls=required('DATABASE_TLS');if(!['verify-full','approved-private-test-network'].includes(databaseTls))throw Error('Invalid database TLS mode');
 // Reject connection-string SSL overrides: TLS mode is exclusively the explicit setting.
 if([...db.searchParams.keys()].some(k=>/^ssl/i.test(k)))throw Error('Conflicting database TLS configuration');
 return {origin,metadata,clientId:required('OIDC_CLIENT_ID'),clientSecret:required('OIDC_CLIENT_SECRET'),subjects,databaseUrl,databaseTls,port:3000};
}
