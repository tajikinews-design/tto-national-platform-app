"use strict";
/**
 * PH12 Preview owner-recovery proof binding (read-only inside the caller's
 * SERIALIZABLE transaction). A valid signature is NOT sufficient: the exact
 * OTP must have been accepted, consumed, and bound to this root in Postgres.
 * Never produces credentials, issues sessions, sends SMS or modifies a table.
 */
const {createHmac}=require("node:crypto");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function secretValid(secret){
 return typeof secret==="string"&&Buffer.byteLength(secret,"utf8")>=32;
}
function digest(secret,label,value){
 return createHmac("sha256",secret).update(label+":"+value,"utf8").digest();
}
async function verifyConsumedOtpRecoveryBinding(db,otp,identityHmacSecret){
 if(!otp||!UUID.test(otp.challengeId)||!UUID.test(otp.rootUserId)||
    !UUID.test(otp.nonce)||!secretValid(identityHmacSecret)||
    typeof otp.mobile!=="string"||typeof otp.nationalId!=="string"||
    !/^(0|[1-9][0-9]{0,15})$/.test(String(otp.expectedVersion)))
   throw Error("CONSUMED_OTP_DB_BINDING_INPUT_OR_SECRET_INVALID");
 const result=await db.query(`
  SELECT c.root_user_id,c.root_credentials_version,c.recovery_nonce,c.verified_at
  FROM tto.national_root_recovery_smsotp_challenges c
  JOIN tto.auth_challenges a ON a.challenge_id=c.challenge_id
  JOIN tto.smsotp_delivery_attempts d ON d.challenge_id=c.challenge_id
  WHERE c.challenge_id=$1::uuid
    AND c.root_user_id=$2::uuid
    AND c.root_credentials_version=$3::bigint
    AND c.recovery_nonce=$4::uuid
    AND c.mobile_hmac=$5
    AND c.national_id_hmac=$6
    AND c.verified_at IS NOT NULL
    AND a.purpose='NATIONAL_ROOT_RECOVERY_SMSOTP'
    AND a.user_id=c.root_user_id
    AND a.consumed_at IS NOT NULL
    AND d.state='ACCEPTED'
  FOR UPDATE OF c`,[
   otp.challengeId,otp.rootUserId,otp.expectedVersion,otp.nonce,
   digest(identityHmacSecret,"mobile",otp.mobile),
   digest(identityHmacSecret,"national",otp.nationalId)
 ]);
 if(result.rowCount!==1)throw Error("SIGNED_OTP_NOT_CONSUMED_IN_CURRENT_ROOT_DATABASE");
 const record=result.rows[0];
 if(record.root_user_id!==otp.rootUserId||
    String(record.root_credentials_version)!==String(otp.expectedVersion)||
    record.recovery_nonce!==otp.nonce)
   throw Error("SIGNED_OTP_DATABASE_ROOT_OR_VERSION_MISMATCH");
 const signedTime=Date.parse(otp.verifiedAt);
 const recordedTime=Date.parse(record.verified_at);
 if(!Number.isFinite(signedTime)||!Number.isFinite(recordedTime)||
    Math.abs(signedTime-recordedTime)>1000)
   throw Error("SIGNED_OTP_DATABASE_VERIFICATION_TIME_MISMATCH");
 return {status:"SIGNED_AND_CONSUMED_OTP_BOUND_PREVIEW_ONLY"};
}
module.exports={secretValid,verifyConsumedOtpRecoveryBinding};
