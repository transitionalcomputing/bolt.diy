import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createProtocol} from './adapter.mjs';
export default {async fetch(){
const issuer='https://issuer.example',clientId='fake-client',redirectUri='https://bolt-test.example/auth/oidc/callback';
const metadata={issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',id_token_signing_alg_values_supported:['RS256']};
const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'test',alg:'RS256'};
const now=Math.floor(Date.now()/1000);const token=await new SignJWT({iss:issuer,sub:'alice',aud:clientId,iat:now,exp:now+300,nonce:'nonce'}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(keys.privateKey);
let calls=0;const transport=async url=>{calls++;if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});if(String(url)===metadata.token_endpoint)return Response.json({access_token:'fake-access',token_type:'Bearer',id_token:token});throw Error('No network');};
const p=createProtocol({metadata,clientId,clientSecret:'fake-secret',redirectUri,transport});
const identity=await p.exchangeAndVerify({currentUrl:redirectUri+'?code=fake&state=state',expectedState:'state',expectedNonce:'nonce',codeVerifier:'fake-verifier'});
let rejected=false;try{await p.exchangeAndVerify({currentUrl:redirectUri+'?code=fake&state=wrong',expectedState:'state',expectedNonce:'nonce',codeVerifier:'fake-verifier'})}catch{rejected=true;}
return Response.json({identity,calls,wrongStateRejected:rejected});
}};
