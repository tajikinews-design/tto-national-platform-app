/**
 * CHILD-07 receipt integrity gate: CANDIDATE ONLY.
 * A signed receipt and a matched share register are necessary engineering
 * evidence, NEVER proof of the custodian's legal mandate or of title transfer.
 * The candidate verifier is deliberately unavailable in Vercel/Production.
 */
import {createHash,createPublicKey,verify} from "node:crypto";
import {
  reviewOfficialRegisterReconciliation,
  type OfficialRegisterCandidateSnapshot,
  type Child07ReadProjectionSnapshot
} from "./share-register-reconciliation-review";

export interface RegisterProofReceipt {
 readonly tenantId:string;
 readonly registerId:string;
 readonly custodianSourceRef:string;
 readonly sourceVersion:number;
 readonly trustEpoch:number;
 readonly snapshotSha256:string;
 readonly challengeNonce:string;
 readonly keyId:string;
 readonly issuedAt:string;
 readonly expiresAt:string;
 readonly signatureBase64:string;
}
export interface SyntheticPinnedCustodianKey {
 readonly boundary:"SYNTHETIC_CI_ONLY";
 readonly tenantId:string;
 readonly registerId:string;
 readonly custodianSourceRef:string;
 readonly mandateReference:string;
 readonly keyId:string;
 readonly trustEpoch:number;
 readonly validFrom:string;
 readonly validUntil:string;
 readonly revokedAt:string|null;
 readonly publicKeyPem:string;
}
export interface CustodianReview {
 readonly status:"BLOCKED"|"INTEGRITY_CHECKED_CANDIDATE_ONLY";
 readonly blockers:readonly string[];
 readonly shareQuantityParityCandidate:boolean;
 readonly signatureVerified:boolean;
 readonly formalCustodianAcceptance:false;
 readonly officialSourceAccepted:false;
 readonly officialOwnershipTransferAuthorized:false;
 readonly officialRegisterCanBeWritten:false;
 readonly legallyAdmittedSource:false;
}
const HEX=/^[a-f0-9]{64}$/;
const NONCE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYID=/^[A-Za-z0-9_.:-]{8,128}$/;
const REF=/^[A-Za-z0-9_.:-]{8,256}$/;
const ZERO="BLOCKED" as const;
const final=(blockers:string[],sig:boolean,parity:boolean):CustodianReview=>({
 status:blockers.length===0?"INTEGRITY_CHECKED_CANDIDATE_ONLY":ZERO,
 blockers,shareQuantityParityCandidate:parity,signatureVerified:sig,
 formalCustodianAcceptance:false,officialSourceAccepted:false,
 officialOwnershipTransferAuthorized:false,officialRegisterCanBeWritten:false,
 legallyAdmittedSource:false
});
export function fingerprintRegisterCandidateSnapshot(s:OfficialRegisterCandidateSnapshot):string {
 const entries=[...s.positions].map(p=>[
    p.tenantId,p.accountId,p.quantity===null?null:p.quantity.toString(),p.sourceEntryRef
 ]).sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
 return createHash("sha256").update(JSON.stringify([
   "TTO_CHILD07_REGISTER_CANDIDATE_V1",
   s.tenantId,s.registerId,s.custodianSourceRef,s.sourceVersion,s.asOf,
   s.issuedShares===null?null:s.issuedShares.toString(),
   s.treasuryShares===null?null:s.treasuryShares.toString(),
   entries
 ]),"utf8").digest("hex");
}
export function signingBytesForCustodianProof(p:Omit<RegisterProofReceipt,"signatureBase64">):Buffer {
 return Buffer.from(JSON.stringify([
  "TTO_CHILD07_CUSTODIAN_RECEIPT_V1",p.tenantId,p.registerId,
  p.custodianSourceRef,p.sourceVersion,p.trustEpoch,
  p.snapshotSha256,p.challengeNonce,p.keyId,p.issuedAt,p.expiresAt
 ]),"utf8");
}

/** Receipts are supplied by a future independent trusted-source adapter.
 * The code cannot issue or recognize formal approval. Test keys are CI-only.
 */
export function reviewCandidateCustodianProof(
 official:OfficialRegisterCandidateSnapshot|null,
 projection:Child07ReadProjectionSnapshot|null,
 receipt:RegisterProofReceipt|null,
 pinned:SyntheticPinnedCustodianKey|null,
 expectedNonce:string|null,
 now=Date.now()
):CustodianReview {
 const parity=reviewOfficialRegisterReconciliation(official,projection);
 const blockers=[...parity.blockers];
 const stop=(code:string)=>{if(!blockers.includes(code))blockers.push(code);};
 if(parity.status!=="MATCHED_CANDIDATE_ONLY")stop("CHILD07_REGISTER_PARITY_NOT_VERIFIED");
 if(process.env.CI!=="true"||process.env.TTO_CHILD07_CUSTODIAN_LAB!=="1"||
    !!process.env.VERCEL||!!process.env.TTO_PRODUCTION_DB_URL)
   stop("CUSTODIAN_VERIFIER_CI_ONLY");
 if(!official||!projection||!receipt||!pinned) {
  stop("CUSTODIAN_RECEIPT_OR_PINNED_TRUST_MISSING");
  return final(blockers,false,false);
 }
 if(pinned.boundary!=="SYNTHETIC_CI_ONLY"||!REF.test(pinned.mandateReference))
   stop("INDEPENDENT_CUSTODIAN_MANDATE_NOT_ATTESTED");
 if(!Number.isSafeInteger(pinned.trustEpoch)||pinned.trustEpoch<1||
    !Number.isSafeInteger(receipt.trustEpoch)||receipt.trustEpoch!==pinned.trustEpoch)
   stop("CUSTODIAN_TRUST_EPOCH_MISMATCH");
 if(receipt.tenantId!==official.tenantId||receipt.tenantId!==pinned.tenantId||
    receipt.registerId!==official.registerId||receipt.registerId!==pinned.registerId||
    receipt.custodianSourceRef!==official.custodianSourceRef||
    receipt.custodianSourceRef!==pinned.custodianSourceRef)
   stop("CUSTODIAN_TENANT_REGISTER_OR_SOURCE_MISMATCH");
 if(!KEYID.test(receipt.keyId)||receipt.keyId!==pinned.keyId)
   stop("CUSTODIAN_SIGNING_KEY_NOT_PINNED");
 if(receipt.sourceVersion!==official.sourceVersion||
    !Number.isSafeInteger(receipt.sourceVersion)||receipt.sourceVersion<1)
   stop("CUSTODIAN_SOURCE_VERSION_MISMATCH");
 if(!NONCE.test(receipt.challengeNonce)||receipt.challengeNonce!==expectedNonce)
   stop("CUSTODIAN_CHALLENGE_NONCE_UNBOUND");
 if(!HEX.test(receipt.snapshotSha256)||
    receipt.snapshotSha256!==fingerprintRegisterCandidateSnapshot(official))
   stop("CUSTODIAN_SIGNED_SNAPSHOT_MISMATCH");
 const issued=Date.parse(receipt.issuedAt),expires=Date.parse(receipt.expiresAt),
       mandateFrom=Date.parse(pinned.validFrom),mandateUntil=Date.parse(pinned.validUntil);
 if(!Number.isFinite(now)||![issued,expires,mandateFrom,mandateUntil].every(Number.isFinite)||
    issued>now+30_000||issued<now-300_000||
    expires<=now||expires<=issued||expires-issued>300_000||
    issued<mandateFrom||expires>mandateUntil)
   stop("CUSTODIAN_RECEIPT_OR_MANDATE_STALE");
 if(pinned.revokedAt!==null)
   stop("CUSTODIAN_KEY_REVOKED_OR_UNKNOWN");
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(receipt.signatureBase64)||
    receipt.signatureBase64.length!==88)
   stop("CUSTODIAN_SIGNATURE_FORMAT_INVALID");
 if(blockers.length)return final(blockers,false,parity.status==="MATCHED_CANDIDATE_ONLY");
 try{
  const key=createPublicKey(pinned.publicKeyPem);
  if(key.asymmetricKeyType!=="ed25519"){
   stop("CUSTODIAN_SIGNING_ALGORITHM_NOT_ALLOWED");
   return final(blockers,false,true);
  }
  const {signatureBase64,...signed}=receipt;
  const signature=Buffer.from(signatureBase64,"base64");
  const ok=signature.length===64&&verify(null,signingBytesForCustodianProof(signed),key,signature);
  if(!ok)stop("CUSTODIAN_SIGNATURE_VERIFICATION_FAILED");
  return final(blockers,ok,true);
 }catch{
  stop("CUSTODIAN_SIGNATURE_VERIFICATION_FAILED");
  return final(blockers,false,true);
 }
}
