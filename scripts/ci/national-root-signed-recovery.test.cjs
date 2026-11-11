"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {kinds,signingBytes,verifyOwnerRecoveryEvidence}=require("../ops/national-root-signed-recovery-evidence.cjs");
const {assertEnvironment,executeAtomicRecovery}=require("../ops/recover-national-root-preview.cjs");
const ROOT="a1111111-1111-4111-8111-111111111111";
const REVIEWER="a2222222-2222-4222-8222-222222222222";
const CHALLENGE="a3333333-3333-4333-8333-333333333333";
const NONCE="a4444444-4444-4444-8444-444444444444";
const VERSION="4";
const NOW=Date.now();
const date=x=>new Date(x).toISOString();
const key1=generateKeyPairSync("ed25519");
const key2=generateKeyPairSync("ed25519");
const trust={
 otpVerifierPublicKeyPem:key1.publicKey.export({format:"pem",type:"spki"}),
 reviewerPublicKeyPem:key2.publicKey.export({format:"pem",type:"spki"})
};
function makeNationalId(firstNine){
 const r=[...firstNine].reduce((n,ch,i)=>n+Number(ch)*(10-i),0)%11;
 return firstNine+(r<2?r:11-r);
}
const ID=makeNationalId("001234567"),MOBILE="09120000001";
function receipt(kind,data,key){
 return {...data,signature:sign(null,signingBytes(kind,data),key).toString("base64")};
}
function input(){
 const common={rootUserId:ROOT,expectedVersion:VERSION,nationalId:ID,mobile:MOBILE,challengeId:CHALLENGE,nonce:NONCE};
 const otp=receipt("otp",{kind:kinds.otp,...common,verifiedAt:date(NOW-15000),
  issuedAt:date(NOW-60000),expiresAt:date(NOW+60000)},key1.privateKey);
 const approval=receipt("approval",{kind:kinds.approval,...common,reviewerUserId:REVIEWER,
  mandateRef:"CI-MANDATE-SYNTHETIC-0001",reviewedAt:date(NOW-10000),
  issuedAt:date(NOW-60000),expiresAt:date(NOW+60000)},key2.privateKey);
 return {expectedRootUserId:ROOT,expectedRootVersion:VERSION,otp,approval};
}
function evidence(value=input(),keys=trust){return verifyOwnerRecoveryEvidence(value,keys,NOW)}
test("valid TWO synthetic signed receipts remain review-only, not login authorization",()=>{
 assert.deepEqual(evidence(),{status:"SIGNED_EVIDENCE_CHECKED_PREVIEW_ONLY",blockers:[]});
});
test("unsigned, missing or mutated SMS OTP proof fails closed",()=>{
 for(const v of [null,{}, {...input().otp,mobile:"09120000002"},{...input().otp,signature:""}]){
  const p=input();p.otp=v;assert.equal(evidence(p).status,"BLOCKED");
 }
});
test("independent review cannot be self-asserted or replaced by another mobile",()=>{
 const p=input();p.approval.reviewerUserId=ROOT;
 assert.equal(evidence(p).status,"BLOCKED");
 const x=input();x.approval.mobile="09120000002";
 assert.ok(evidence(x).blockers.includes("TWO_RECEIPTS_NOT_BOUND_TO_SAME_RECOVERY"));
});
test("approval and OTP signers must have independent pinned Ed25519 public keys",()=>{
 assert.ok(evidence(input(),{otpVerifierPublicKeyPem:trust.otpVerifierPublicKeyPem,
  reviewerPublicKeyPem:trust.otpVerifierPublicKeyPem}).blockers.includes("TWO_INDEPENDENT_PINNED_KEYS_REQUIRED"));
});
test("replayed challenge root/version mismatch cannot change someone else's root",()=>{
 const p=input();p.expectedRootVersion="3";
 assert.ok(evidence(p).blockers.includes("LIVE_ROOT_ID_OR_VERSION_NOT_ATTESTED"));
 const x=input();x.expectedRootUserId=REVIEWER;
 assert.ok(evidence(x).blockers.includes("LIVE_ROOT_ID_OR_VERSION_NOT_ATTESTED"));
});
test("expired signed OTP or stale verification cannot pass",()=>{
 const p=input();p.otp=receipt("otp",{...p.otp,signature:undefined,issuedAt:date(NOW-400000),expiresAt:date(NOW-1000)},key1.privateKey);
 assert.equal(evidence(p).status,"BLOCKED");
 const q=input();q.otp=receipt("otp",{...q.otp,signature:undefined,verifiedAt:date(NOW-400000)},key1.privateKey);
 assert.ok(evidence(q).blockers.includes("RECENT_OTP_SUCCESS_NOT_ATTESTED"));
});
test("Preview operator requires exact approved Supabase host and refuses production and CI",()=>{
 const env={TTO_ISOLATED_DEMO_DB:"true",TTO_ENVIRONMENT:"preview",
  TTO_PREVIEW_NATIONAL_ROOT_RECOVERY:"operator-approved",TTO_PREVIEW_DATABASE_URL:"postgresql://operator@db.zkfwsgrgslxxlusxrwce.supabase.co:5432/postgres",
  TTO_PREVIEW_APPROVED_DB_HOST:"db.zkfwsgrgslxxlusxrwce.supabase.co",TTO_PREVIEW_DB_PROJECT_REF:"zkfwsgrgslxxlusxrwce",
  TTO_PREVIEW_DB_SSL:"required",TTO_RECOVERY_OTP_VERIFIER_PUBLIC_KEY_PEM:trust.otpVerifierPublicKeyPem,
  TTO_RECOVERY_REVIEWER_PUBLIC_KEY_PEM:trust.reviewerPublicKeyPem};
 assert.equal(assertEnvironment(env,["node","program","--apply"]).trust.otpVerifierPublicKeyPem,trust.otpVerifierPublicKeyPem);
 for(const patch of [{CI:"true"},{VERCEL:"1"},{TTO_ENVIRONMENT:"production"},{TTO_PREVIEW_DB_SSL:"disabled"},
  {TTO_PREVIEW_APPROVED_DB_HOST:"db.other.supabase.co"},{TTO_PREVIEW_DB_PROJECT_REF:"aaaaaaaaaaaaaaaaaaaa"}]){
  assert.throws(()=>assertEnvironment({...env,...patch},["node","program","--apply"]));
 }
});
function fakeDb({wrongRoot=false,claimedByAnother=false}={}){
 const log=[];
 const db={log,async query(sql,args=[]){
  log.push({sql,argsCount:args.length});
  if(sql.startsWith("BEGIN")||sql==="COMMIT"||sql==="ROLLBACK")return {rowCount:0,rows:[]};
  if(sql.includes("FROM tto.national_root_accounts r JOIN"))
   return {rowCount:1,rows:[{user_id:wrongRoot?REVIEWER:ROOT,credentials_version:VERSION,status:"ACTIVE"}]};
  if(sql.includes("SELECT user_id FROM tto.user_accounts WHERE user_id"))
   return {rowCount:1,rows:[{user_id:REVIEWER}]};
  if(sql.includes("FROM tto.verified_mobile_identifiers"))
   return claimedByAnother?{rowCount:1,rows:[{user_id:REVIEWER,revoked_at:null}]}:{rowCount:0,rows:[]};
  if(sql.includes("INSERT INTO tto.verified_mobile_identifiers"))return {rowCount:1,rows:[]};
  if(sql.startsWith("UPDATE tto.national_root_accounts"))
   return {rowCount:1,rows:[{credentials_version:"5"}]};
  if(sql.startsWith("UPDATE tto.user_accounts"))
   return {rowCount:1,rows:[{security_epoch:"2"}]};
  if(sql.startsWith("UPDATE tto.user_sessions"))return {rowCount:1,rows:[]};
  if(sql.startsWith("INSERT INTO tto.national_root_recovery_receipts"))
   return {rowCount:1,rows:[{recovery_nonce:NONCE}]};
  throw Error("unexpected SQL shape");
 }};
 return db;
}
test("successful synthetic transaction rotates existing root and revokes every session with audit",async()=>{
 const db=fakeDb();
 const result=await executeAtomicRecovery(db,input(),trust,NOW);
 assert.equal(result.status,"ROOT_RECOVERED_PREVIEW_ONLY");
 assert.equal(result.rootUserIdPreserved,true);
 const sql=db.log.map(x=>x.sql);
 assert.equal(sql[0],"BEGIN ISOLATION LEVEL SERIALIZABLE");
 assert.equal(sql.at(-1),"COMMIT");
 assert.equal(sql.some(x=>x.startsWith("UPDATE tto.user_sessions")),true);
 assert.equal(sql.some(x=>x.startsWith("INSERT INTO tto.national_root_recovery_receipts")),true);
 assert.equal(sql.some(x=>x.startsWith("INSERT INTO tto.national_root_accounts")),false);
});
test("wrong existing root aborts atomically before credential and mobile changes",async()=>{
 const db=fakeDb({wrongRoot:true});
 await assert.rejects(executeAtomicRecovery(db,input(),trust,NOW),/ROOT_ID_VERSION_OR_STATUS_CONFLICT/);
 const sql=db.log.map(x=>x.sql);
 assert.equal(sql.at(-1),"ROLLBACK");
 assert.equal(sql.some(x=>x.startsWith("UPDATE tto.national_root_accounts")),false);
});
test("mobile already claimed by another user cannot be seized; rollback preserves root",async()=>{
 const db=fakeDb({claimedByAnother:true});
 await assert.rejects(executeAtomicRecovery(db,input(),trust,NOW),/MOBILE_IS_LINKED_TO_ANOTHER_OR_REVOKED_USER/);
 assert.equal(db.log.at(-1).sql,"ROLLBACK");
 assert.equal(db.log.some(x=>x.sql.startsWith("UPDATE tto.national_root_accounts")),false);
});
test("invalid independent signature never begins a database transaction",async()=>{
 const db=fakeDb(),p=input();p.approval.signature=p.otp.signature;
 await assert.rejects(executeAtomicRecovery(db,p,trust,NOW),/RECOVERY_SIGNED_EVIDENCE_REJECTED/);
 assert.equal(db.log.length,0);
});
