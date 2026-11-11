-- Disposable PG17 only: synthetic recovery SMSOTP never creates a root session.
BEGIN;
DO $fence$
DECLARE
 u uuid:='a1111111-1111-4111-8111-111111111111';
 ch uuid:='a7777777-7777-4777-8777-777777777777';
 nonce uuid:='a8888888-8888-4888-8888-888888888888';
 good bytea:=decode(repeat('12',32),'hex');
 mobile bytea:=decode(repeat('34',32),'hex');
 national bytea:=decode(repeat('56',32),'hex');
 wrong bytea:=decode(repeat('78',32),'hex');
 n integer;
BEGIN
 IF to_regprocedure('tto.begin_national_root_recovery_smsotp(uuid,bigint,uuid,uuid,bytea,bytea,bytea,timestamptz)') IS NULL
  OR to_regprocedure('tto.consume_national_root_recovery_smsotp(uuid,bytea,bytea,bytea)') IS NULL
 THEN RAISE EXCEPTION 'RECOVERY_OTP_SQL_FUNCTIONS_MISSING'; END IF;
 INSERT INTO tto.user_accounts(user_id,status) VALUES(u,'ACTIVE');
 INSERT INTO tto.national_root_accounts
  (singleton,user_id,username,password_scrypt,must_change_credentials,credentials_version)
 VALUES(true,u,'ci-national-root',
  'scrypt$v1$'||repeat('aa',16)||'$'||repeat('bb',64),false,5);
 -- The approved OTP attempt policy has no migration default. Without it,
 -- not even SMS issuance is permitted. Seed policy ONLY in rolled-back CI.
 IF NOT EXISTS(SELECT 1 FROM tto.auth_policy WHERE policy_key='SESSION_CHALLENGE') THEN
  IF tto.begin_national_root_recovery_smsotp(
   u,5,'accccccc-cccc-4ccc-8ccc-cccccccccccc',nonce,mobile,national,good,
   clock_timestamp()+interval '40 seconds')
  THEN RAISE EXCEPTION 'MISSING_POLICY_ALLOWED_SMS_ISSUANCE'; END IF;
  INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes)
  VALUES('SESSION_CHALLENGE',2,15);
 END IF;
 IF tto.begin_national_root_recovery_smsotp(
  u,4,ch,nonce,mobile,national,good,clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'STALE_ROOT_VERSION_WAS_ACCEPTED'; END IF;
 IF NOT tto.begin_national_root_recovery_smsotp(
  u,5,ch,nonce,mobile,national,good,clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'VALID_RECOVERY_CHALLENGE_NOT_CREATED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>0 THEN RAISE EXCEPTION 'UNDELIVERED_SMS_ISSUED_PROOF'; END IF;
 IF NOT tto.complete_smsotp_delivery(ch,true)
 THEN RAISE EXCEPTION 'SMS_DELIVERY_CANNOT_BE_RECORDED'; END IF;
 -- Positive proof first: do not assume the policy allows second attempts.
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>1 THEN RAISE EXCEPTION 'VALID_DELIVERED_OTP_NOT_CONSUMED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>0 THEN RAISE EXCEPTION 'SMS_OTP_PROOF_REPLAY_WAS_ACCEPTED'; END IF;
 -- Distinct challenge for wrong national-ID digest.
 IF NOT tto.begin_national_root_recovery_smsotp(
  u,5,'a9999999-9999-4999-8999-999999999999',nonce,mobile,national,good,
  clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'SECOND_CHALLENGE_NOT_ISSUED'; END IF;
 IF NOT tto.complete_smsotp_delivery('a9999999-9999-4999-8999-999999999999',true)
 THEN RAISE EXCEPTION 'SECOND_DELIVERY_NOT_RECORDED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(
  'a9999999-9999-4999-8999-999999999999',good,mobile,wrong);
 IF n<>0 THEN RAISE EXCEPTION 'WRONG_NATIONAL_ID_DIGEST_WAS_ACCEPTED'; END IF;
 -- Distinct challenge for wrong OTP.
 IF NOT tto.begin_national_root_recovery_smsotp(
  u,5,'abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',nonce,mobile,national,good,
  clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'WRONG_CODE_TEST_CHALLENGE_NOT_ISSUED'; END IF;
 IF NOT tto.complete_smsotp_delivery('abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true)
 THEN RAISE EXCEPTION 'WRONG_CODE_TEST_DELIVERY_NOT_ACCEPTED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(
  'abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',wrong,mobile,national);
 IF n<>0 THEN RAISE EXCEPTION 'WRONG_OTP_WAS_ACCEPTED'; END IF;
 IF EXISTS(SELECT 1 FROM tto.user_sessions WHERE user_id=u)
 THEN RAISE EXCEPTION 'RECOVERY_OTP_MUST_NOT_CREATE_SESSION'; END IF;
 IF (SELECT credentials_version FROM tto.national_root_accounts WHERE singleton)<>5
 THEN RAISE EXCEPTION 'RECOVERY_OTP_MUST_NOT_ROTATE_ROOT'; END IF;
 IF EXISTS(SELECT 1 FROM tto.verified_mobile_identifiers WHERE user_id=u)
 THEN RAISE EXCEPTION 'RECOVERY_OTP_MUST_NOT_BIND_MOBILE'; END IF;
END $fence$;
ROLLBACK;
