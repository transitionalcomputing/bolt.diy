/** Experimental library adapter. Explicit trusted configuration; no discovery or real endpoints in tests. */
import * as oidc from 'openid-client';
export function createProtocol({metadata,clientId,clientSecret,redirectUri,transport}) {
  if(typeof transport!=='function')throw Error('Explicit transport required');
  const origin=new URL(metadata.issuer).origin;
  for(const key of ['issuer','authorization_endpoint','token_endpoint','jwks_uri']){
    const u=new URL(metadata[key]);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('Untrusted endpoint');
  }
  if(new URL(redirectUri).protocol!=='https:')throw Error('Invalid redirect');
  const config=new oidc.Configuration(metadata,clientId,{client_secret:clientSecret,id_token_signed_response_alg:'RS256'},oidc.ClientSecretPost(clientSecret));
  // Require actual JWS verification in addition to normal TLS/claim validation.
  oidc.enableNonRepudiationChecks(config);
  config[oidc.customFetch]=async(input,options)=>{
    const url=String(input);if(![metadata.token_endpoint,metadata.jwks_uri].includes(url))throw Error('Unexpected endpoint');
    return transport(input,{...options,redirect:'error'});
  };
  return Object.freeze({
    authorizationUrl({state,nonce,codeChallenge}){return oidc.buildAuthorizationUrl(config,{redirect_uri:redirectUri,response_type:'code',scope:'openid',state,nonce,code_challenge:codeChallenge,code_challenge_method:'S256'}).href;},
    async exchangeAndVerify({currentUrl,expectedState,expectedNonce,codeVerifier}){
      const u=new URL(currentUrl);if(u.origin+u.pathname!==redirectUri||!expectedState||!expectedNonce||!codeVerifier)throw Error('Invalid callback');
      const tokens=await oidc.authorizationCodeGrant(config,u,{expectedState,expectedNonce,pkceCodeVerifier:codeVerifier,idTokenExpected:true});
      const claims=tokens.claims();if(!claims?.sub)throw Error('Missing subject');
      return {issuer:claims.iss,subject:claims.sub};
    }
  });
}
