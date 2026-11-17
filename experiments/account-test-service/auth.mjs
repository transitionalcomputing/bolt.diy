/** Test-only allowlist snapshot. Replace config/restart to revoke local session access. */
import {createAccountAuth} from '../account-keys-prototype/oidc.mjs';
export function createTestAuth({config,protocol,stores}){
 const allowed=new Set(config.subjects);
 return createAccountAuth({issuer:config.metadata.issuer,clientId:config.clientId,origin:config.origin,protocol,transactions:stores.transactions,sessions:stores.sessions,authorize:async p=>p.issuer===config.metadata.issuer&&allowed.has(p.subject)});
}
