/** Experimental composition root. Requires all server-owned dependencies explicitly.
 * No environment secret reads, default identities, listeners or live endpoints.
 */
import {createAccountAuth} from './oidc.mjs';import {createCredentialVault} from './vault.mjs';import {createAccountService} from './account-service.mjs';import {createAccountHandler} from './http.mjs';import {createOpenAIBoundary} from './openai-boundary.mjs';
export function createAccountApplication({origin,issuer,clientId,protocol,stores,masterKey,authorize,driver}){
 const auth=createAccountAuth({origin,issuer,clientId,protocol,transactions:stores.transactions,sessions:stores.sessions,authorize});
 const vault=createCredentialVault({verifyIdentity:r=>auth.verifyIdentity(r),repository:stores.credentials,masterKey});
 const accounts=createAccountService({auth,vault});
 return Object.freeze({handle:createAccountHandler({auth,accounts,origin}),
 // Server-internal integration only, never serialize this capability to a client.
 provider:createOpenAIBoundary({auth,accounts,driver})});
}
