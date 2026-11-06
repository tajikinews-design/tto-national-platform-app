/**
 * Cryptographic transport proof for a contractually authorized official source.
 * No public registry is called/scraped. Verifying signatures alone DOES NOT
 * authorize a cooperative, a legal sign-off, a Tenant or any privileges.
 */
import {createPublicKey,verify,createHash} from "node:crypto";
export type SourceIssuer="NATIONAL_REGISTRY"|"OFFICIAL_GAZETTE"|"COOPERATIVE_AUTHORITY";
export type OfficialReceipt={
 issuer:SourceIssuer;
 nationalId:string;
 reference:string;
 evidenceSha256:string;
 nonce:string;
 issuedAt:string;
 expiresAt:string;
 signatureBase64:string;
};
const ISSUERS=new Set(["NATIONAL_REGISTRY","OFFICIAL_GAZETTE","COOPERATIVE_AUTHORITY"]);
const HEX=/^[a-f0-9]{64}$/;
const NONCE=/^[a-f0-9-]{36}$/;
const BASE64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export function verifyOfficialSourceReceipt(
 receipt:OfficialReceipt,
 expected:{issuer:SourceIssuer;nationalId:string;reference:string;nonce:string;evidenceSha256:string},
 publicKeyPem:string,
 now=Date.now()
):{integrity:"SIGNED_RECEIPT_CHECKED";legalApproval:false;authenticity:"NOT_VERIFIED";documentHash:string}{
 if(process.env.TTO_OFFICIAL_REGISTRY_API_AUTHORIZED!=="true")
   throw Error("OFFICIAL_SOURCE_CONNECTION_NOT_AUTHORIZED");
 if(!receipt||!expected||!ISSUERS.has(receipt.issuer)||
  receipt.issuer!==expected.issuer||
  !/^\d{11}$/.test(receipt.nationalId)||
  receipt.nationalId!==expected.nationalId||
  receipt.reference!==expected.reference||
  receipt.reference.length<8||receipt.reference.length>240||
  !NONCE.test(receipt.nonce)||receipt.nonce!==expected.nonce||
  !HEX.test(receipt.evidenceSha256)||receipt.evidenceSha256!==expected.evidenceSha256||
  !BASE64.test(receipt.signatureBase64)||receipt.signatureBase64.length!==88||
  !Number.isFinite(now))throw Error("OFFICIAL_RECEIPT_INVALID");
 const issued=Date.parse(receipt.issuedAt),expires=Date.parse(receipt.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||
  issued>now+30_000||issued<now-300_000||
  expires<now||expires-issued>300_000||expires<=issued)
  throw Error("OFFICIAL_RECEIPT_EXPIRED_OR_STALE");
 if(!publicKeyPem||publicKeyPem.length>2000||
    !publicKeyPem.includes("BEGIN PUBLIC KEY"))
   throw Error("PINNED_PUBLIC_KEY_REQUIRED");
 const key=createPublicKey(publicKeyPem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("OFFICIAL_SIGNING_ALGORITHM_NOT_ALLOWED");
 const body=Buffer.from(JSON.stringify([
   "TTO_OFFICIAL_SOURCE_V1",receipt.issuer,receipt.nationalId,receipt.reference,
   receipt.evidenceSha256,receipt.nonce,receipt.issuedAt,receipt.expiresAt
 ]),"utf8");
 const rawSignature=Buffer.from(receipt.signatureBase64,"base64");
 if(rawSignature.length!==64||!verify(null,body,key,rawSignature))
   throw Error("OFFICIAL_RECEIPT_SIGNATURE_INVALID");
 return {integrity:"SIGNED_RECEIPT_CHECKED",legalApproval:false,
   authenticity:"NOT_VERIFIED",documentHash:createHash("sha256").update(body).digest("hex")};
}
