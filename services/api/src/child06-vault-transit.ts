/** CHILD06 external Vault Transit data-key wrapping (no local master key).
 * Real Vault Transit transport; production requires valid HTTPS and external credentials.
 * Lab HTTP allowed only against localhost under CI flag.
 * Does NOT certify durable HA, official issuer, or legal release.
 */
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
type VaultOut={data?:{ciphertext?:string;plaintext?:string}};
function policy(){
 const raw=process.env.TTO_CHILD06_VAULT_ADDR??"";
 let url:URL;
 try{url=new URL(raw);}catch{throw new Error("CHILD06_KMS_ADDRESS_REQUIRED");}
 const lab=process.env.CI==="true"&&process.env.TTO_CHILD06_VAULT_LAB==="true"&&
  url.protocol==="http:"&&["127.0.0.1","localhost"].includes(url.hostname);
 if(!(url.protocol==="https:"||lab)||url.username||url.password||url.search||url.hash||
     url.pathname!=="/"||process.env.VERCEL)
  throw new Error("CHILD06_KMS_TLS_OR_LAB_POLICY_DENIED");
 const mount=process.env.TTO_CHILD06_VAULT_TRANSIT_MOUNT??"transit";
 const name=process.env.TTO_CHILD06_VAULT_TRANSIT_KEY??"child06-pdf";
 if(!/^[a-z0-9-]{1,60}$/.test(mount)||!/^[a-z0-9-]{1,60}$/.test(name))
  throw new Error("CHILD06_KMS_KEY_PATH_DENIED");
 let token=process.env.TTO_CHILD06_VAULT_TOKEN??"";
 if(!lab){
  const file=process.env.TTO_CHILD06_VAULT_TOKEN_FILE??"";
  if(!file.startsWith("/")||file.includes("\0"))
   throw new Error("CHILD06_KMS_EXTERNAL_TOKEN_FILE_REQUIRED");
  token=readFileSync(file,"utf8").trim();
 }
 if(token.length<8||token.length>300)
  throw new Error("CHILD06_KMS_TOKEN_UNAVAILABLE");
 return {url,mount,name,token};
}
async function transit(operation:"encrypt"|"decrypt",request:{plaintext?:string;ciphertext?:string}){
 const cfg=policy(),target=new URL(
  "/v1/"+cfg.mount+"/"+operation+"/"+cfg.name,cfg.url);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4000);
 try{
  const r=await fetch(target,{
   method:"POST",
   headers:{"Content-Type":"application/json","X-Vault-Token":cfg.token},
   body:JSON.stringify(request),signal:controller.signal,redirect:"error",
   cache:"no-store"});
  if(!r.ok)throw new Error("CHILD06_KMS_BACKEND_HTTP_"+r.status);
  const body=await r.json() as VaultOut;
  return body.data??{};
 }catch{throw new Error("CHILD06_KMS_BACKEND_UNAVAILABLE");}
 finally{clearTimeout(timer);}
}
export async function wrapChild06DataKey(key:Buffer):Promise<string>{
 if(key.length!==32)throw new Error("CHILD06_KMS_DEK_LENGTH");
 const result=await transit("encrypt",{plaintext:key.toString("base64")});
 if(!/^vault:v[1-9][0-9]*:[A-Za-z0-9+/=]+$/.test(result.ciphertext??""))
  throw new Error("CHILD06_KMS_WRAPPED_KEY_INVALID");
 return result.ciphertext!;
}
export async function unwrapChild06DataKey(wrapped:string):Promise<Buffer>{
 if(typeof wrapped!=="string"||wrapped.length>2048||
    !/^vault:v[1-9][0-9]*:[A-Za-z0-9+/=]+$/.test(wrapped))
  throw new Error("CHILD06_KMS_WRAPPED_KEY_INVALID");
 const result=await transit("decrypt",{ciphertext:wrapped});
 const decoded=Buffer.from(result.plaintext??"","base64");
 if(decoded.length!==32||decoded.toString("base64")!==result.plaintext){
  decoded.fill(0);throw new Error("CHILD06_KMS_UNWRAPPED_KEY_INVALID");
 }
 return decoded;
}
export function newChild06DataKey():Buffer{return randomBytes(32);}
