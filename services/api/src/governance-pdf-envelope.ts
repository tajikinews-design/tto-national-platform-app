/** CHILD-06 development-only encrypted original PDF envelope.
 * Versioned 32-byte keys are supplied out-of-repository by the runner.
 * Deliberately NOT a production KMS, verified issuer or file-release gate.
 */
import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from "node:crypto";
type KeyVersion="child06-lab-v1"|"child06-lab-v2";
export type SourcePacket={
 evidence_id:string;issuer_candidate_id:string;file_size:number;
 plaintext_sha256:Buffer;aes_gcm_iv:Buffer;aes_gcm_tag:Buffer;
 encrypted_body:Buffer;encryption_version:string;source_state:string
};
function versionKey(version:string):Buffer{
 const keyName=version==="child06-lab-v1"?"TTO_CHILD06_PDF_ESCROW_KEY_HEX":
  version==="child06-lab-v2"?"TTO_CHILD06_PDF_ESCROW_KEY_V2_HEX":null;
 if(!keyName)throw new Error("CHILD06_ESCROW_VERSION_NOT_TRUSTED");
 const hex=process.env[keyName]??"";
 if(!/^[a-f0-9]{64}$/i.test(hex))throw new Error("CHILD06_ESCROW_KEY_MISSING");
 return Buffer.from(hex,"hex");
}
function aad(version:KeyVersion,tenant:string,evidence:string):Buffer{
 // The v1 AAD format is an irreversible compatibility contract.
 return Buffer.from("CHILD06_ORIGINAL_PDF_V1|"+tenant+"|"+evidence,"utf8");
}
export function activePdfVersion():KeyVersion {
 const version=process.env.TTO_CHILD06_PDF_ESCROW_ACTIVE_KEY_VERSION??"child06-lab-v1";
 if(version!=="child06-lab-v1"&&version!=="child06-lab-v2")
  throw new Error("CHILD06_ESCROW_ACTIVE_VERSION_INVALID");
 return version;
}
export function encryptGovernancePdf(bytes:Buffer,tenant:string,evidence:string){
 const version=activePdfVersion(),key=versionKey(version);
 try{
  const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key,iv);
  c.setAAD(aad(version,tenant,evidence));
  const encrypted=Buffer.concat([c.update(bytes),c.final()]);
  return {version,iv,tag:c.getAuthTag(),encrypted,
   digest:createHash("sha256").update(bytes).digest()};
 }finally{key.fill(0);}
}
export function unlockGovernancePdf(packet:SourcePacket,tenant:string):Buffer{
 if(!["child06-lab-v1","child06-lab-v2"].includes(packet.encryption_version)||
    packet.source_state!=="ENCRYPTED_QUARANTINED_UNAUTHENTICATED"||
    !Buffer.isBuffer(packet.aes_gcm_iv)||packet.aes_gcm_iv.length!==12||
    !Buffer.isBuffer(packet.aes_gcm_tag)||packet.aes_gcm_tag.length!==16||
    !Buffer.isBuffer(packet.encrypted_body)||packet.encrypted_body.length!==packet.file_size||
    !Buffer.isBuffer(packet.plaintext_sha256)||packet.plaintext_sha256.length!==32)
  throw new Error("CHILD06_ESCROW_ENVELOPE_INVALID");
 const version=packet.encryption_version as KeyVersion,key=versionKey(version);
 let plain:Buffer|undefined;
 try{
  const c=createDecipheriv("aes-256-gcm",key,packet.aes_gcm_iv);
  c.setAAD(aad(version,tenant,packet.evidence_id));
  c.setAuthTag(packet.aes_gcm_tag);
  plain=Buffer.concat([c.update(packet.encrypted_body),c.final()]);
  const digest=createHash("sha256").update(plain).digest();
  if(!timingSafeEqual(digest,packet.plaintext_sha256)||
      !plain.subarray(0,5).equals(Buffer.from("%PDF-"))||
      !plain.subarray(Math.max(0,plain.length-2048)).includes(Buffer.from("%%EOF")))
   throw new Error("CHILD06_ESCROW_INTEGRITY_MISMATCH");
  const out=plain;plain=undefined;return out;
 }finally{key.fill(0);plain?.fill(0);}
}
