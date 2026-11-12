"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHmac}=require("node:crypto");
const {verifyConsumedOtpRecoveryBinding,secretValid}=require("../ops/national-root-recovery-db-proof-binding.cjs");
const secret="CI-only-identity-secret-longer-than-32-bytes!";
const otp={
 rootUserId:"a1111111-1111-4111-8111-111111111111",
 expectedVersion:"7",challengeId:"a2222222-2222-4222-8222-222222222222",
 nonce:"a3333333-3333-4333-8333-333333333333",
 mobile:"09120000001",nationalId:"0012345679",
 verifiedAt:"2026-11-12T09:00:00.000Z"
};
function h(label,value){return createHmac("sha256",secret).update(label+":"+value).digest();}
function db({missing=false,mismatchTime=false,rootMismatch=false}={}){
 const calls=[];
 return {calls,async query(sql,args){
  calls.push({sql,args});
  assert.match(sql,/JOIN tto.auth_challenges a/);
  assert.match(sql,/JOIN tto.smsotp_delivery_attempts d/);
  assert.match(sql,/a.consumed_at IS NOT NULL/);
  assert.match(sql,/d.state='ACCEPTED'/);
  assert.match(sql,/FOR UPDATE OF c/);
  assert.deepEqual(args.slice(0,4),[otp.challengeId,otp.rootUserId,"7",otp.nonce]);
  assert.deepEqual(args[4],h("mobile",otp.mobile));
  assert.deepEqual(args[5],h("national",otp.nationalId));
  if(missing)return {rowCount:0,rows:[]};
  return {rowCount:1,rows:[{
    root_user_id:rootMismatch?"a4444444-4444-4444-8444-444444444444":otp.rootUserId,
    root_credentials_version:"7",recovery_nonce:otp.nonce,
    verified_at:mismatchTime?"2026-11-12T08:59:40Z":otp.verifiedAt
  }]};
 }};
}
test("signed proof must match consumed delivered root challenge and private HMAC hashes",async()=>{
 const database=db();
 const r=await verifyConsumedOtpRecoveryBinding(database,otp,secret);
 assert.equal(r.status,"SIGNED_AND_CONSUMED_OTP_BOUND_PREVIEW_ONLY");
 assert.equal(database.calls.length,1);
});
test("missing or unconsumed challenge fails closed (DB returned no matched row)",async()=>{
 await assert.rejects(verifyConsumedOtpRecoveryBinding(db({missing:true}),otp,secret),
  /SIGNED_OTP_NOT_CONSUMED_IN_CURRENT_ROOT_DATABASE/);
});
test("same signed receipt cannot substitute for a different database root",async()=>{
 await assert.rejects(verifyConsumedOtpRecoveryBinding(db({rootMismatch:true}),otp,secret),
  /SIGNED_OTP_DATABASE_ROOT_OR_VERSION_MISMATCH/);
});
test("forged verification timestamp is rejected",async()=>{
 await assert.rejects(verifyConsumedOtpRecoveryBinding(db({mismatchTime:true}),otp,secret),
  /SIGNED_OTP_DATABASE_VERIFICATION_TIME_MISMATCH/);
});
test("missing, empty or short HMAC secrets cannot be used",async()=>{
 for(const bad of [undefined,"",null,"short"]){
  assert.equal(secretValid(bad),false);
  await assert.rejects(verifyConsumedOtpRecoveryBinding(db(),otp,bad),
   /CONSUMED_OTP_DB_BINDING_INPUT_OR_SECRET_INVALID/);
 }
});
test("invalid challenge or root ID is not queried",async()=>{
 let queried=false;
 const database={query(){queried=true;throw Error("must not run");}};
 await assert.rejects(verifyConsumedOtpRecoveryBinding(database,{...otp,challengeId:"invalid"},secret),
  /CONSUMED_OTP_DB_BINDING_INPUT_OR_SECRET_INVALID/);
 assert.equal(queried,false);
});
