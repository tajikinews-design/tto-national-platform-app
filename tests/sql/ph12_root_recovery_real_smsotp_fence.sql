-- Disposable PG17-only synthetic fence for real-transport SMSOTP evidence.
-- Test data are unrelated to any real identity.
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
 version bigint;
 n int;
BEGIN
 IF to_regprocedure('tto.begin_national_root_recovery_smsotp(uuid,bigint,uuid,uuid,bytea,bytea,bytea,timestamptz)') IS NULL
  OR to_regprocedure('tto.consume_national_root_recovery_smsotp(uuid,bytea,bytea,bytea)') IS NULL
 THEN RAISE EXCEPTION 'RECOVERY_OTP_SQL_FUNCTIONS_MISSING'; END IF;
 INSERT INTO tto.user_accounts(user_id,status) VALUES(u,'ACTIVE');
 INSERT INTO tto.national_root_accounts
 (singleton,user_id,username,password_scrypt,must_change_credentials,credentials_version)
 VALUES(true,u,'ci-national-root',
   'scrypt$v1$'||repeat('aa',16)||'$'||repeat('bb',64),false,5);
 IF tto.begin_national_root_recovery_smsotp(
   u,4,ch,nonce,mobile,national,good,clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'STALE_ROOT_VERSION_WAS_ACCEPTED'; END IF;
 IF NOT tto.begin_national_root_recovery_smsotp(
   u,5,ch,nonce,mobile,national,good,clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'VALID_RECOVERY_CHALLENGE_NOT_CREATED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>0 THEN RAISE EXCEPTION 'UNDELIVERED_SMS_ISSUED_PROOF'; END IF;
 IF NOT tto.complete_smsotp_delivery(ch,true) THEN
  RAISE EXCEPTION 'SMS_DELIVERY_CANNOT_BE_RECORDED'; END IF;
 -- The installed policy may permit only ONE attempt; prove the valid
 -- delivery independently before running any wrong-code negative challenge.
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>1 THEN RAISE EXCEPTION 'VALID_DELIVERED_OTP_NOT_CONSUMED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(ch,good,mobile,national);
 IF n<>0 THEN RAISE EXCEPTION 'SMS_OTP_PROOF_REPLAY_WAS_ACCEPTED'; END IF;
 -- Different challenge: national-ID digest mismatch is rejected.
 IF NOT tto.begin_national_root_recovery_smsotp(
   u,5,'a9999999-9999-4999-8999-999999999999',nonce,mobile,national,good,
   clock_timestamp()+interval '40 seconds')
 THEN RAISE EXCEPTION 'SECOND_CHALLENGE_NOT_ISSUED'; END IF;
 IF NOT tto.complete_smsotp_delivery('a9999999-9999-4999-8999-999999999999',true)
 THEN RAISE EXCEPTION 'SECOND_DELIVERY_NOT_RECORDED'; END IF;
 SELECT count(*) INTO n FROM tto.consume_national_root_recovery_smsotp(
   'a9999999-9999-4999-8999-999999999999',good,mobile,wrong);
 IF n<>0 THEN RAISE EXCEPTION 'WRONG_NATIONAL_ID_DIGEST_WAS_ACCEPTED'; END IF;
 -- Third separate challenge checks wrong OTP without exhausting the good
 -- challenge's authorized attempt budget.
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
