-- Real PostgreSQL 17 integration checks for CF01-03 second migration. Synthetic data.
\set ON_ERROR_STOP on
INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes) VALUES('SESSION_CHALLENGE',3,15);
INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at)
 VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','LOGIN',decode(repeat('ab',32),'hex'),now()+interval '5 min'),
 ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','LOGIN',decode(repeat('cd',32),'hex'),now()+interval '5 min');
-- At privileged migration owner context, no policy context; authorized functions work for unprivileged tto_app only.
SET ROLE tto_app;
DO $test$ BEGIN
 IF tto.consume_challenge('77777777-7777-4777-8777-777777777777',decode(repeat('00',32),'hex'),decode(repeat('ed',32),'hex')) IS NOT NULL
 THEN RAISE EXCEPTION 'WRONG_OTP_ACCEPTED'; END IF;
 IF tto.consume_challenge('77777777-7777-4777-8777-777777777777',decode(repeat('ab',32),'hex'),decode(repeat('ed',32),'hex')) IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'::uuid
 THEN RAISE EXCEPTION 'VALID_OTP_REJECTED'; END IF;
 IF tto.consume_challenge('77777777-7777-4777-8777-777777777777',decode(repeat('ab',32),'hex'),decode(repeat('ef',32),'hex')) IS NOT NULL
 THEN RAISE EXCEPTION 'OTP_REPLAY_ACCEPTED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.resolve_session(decode(repeat('ed',32),'hex')))
 THEN RAISE EXCEPTION 'VALID_SESSION_NOT_ISSUED'; END IF;
END $test$;
RESET ROLE;
DO $test$ BEGIN
 IF (SELECT attempt_count FROM tto.auth_challenges WHERE challenge_id='77777777-7777-4777-8777-777777777777')<>2
 THEN RAISE EXCEPTION 'ATTEMPTS_NOT_PERSISTED'; END IF;
 IF (SELECT consumed_at IS NULL FROM tto.auth_challenges WHERE challenge_id='77777777-7777-4777-8777-777777777777')
 THEN RAISE EXCEPTION 'CHALLENGE_NOT_CONSUMED'; END IF;
END $test$;
-- Wrong OTP > max attempts must not allow later correct OTP (independent challenge).
SET ROLE tto_app;
DO $test$ DECLARE i int; BEGIN
 FOR i IN 1..4 LOOP
  IF tto.consume_challenge('88888888-8888-4888-8888-888888888888',decode(repeat('00',32),'hex'),decode(repeat('aa',32),'hex')) IS NOT NULL
  THEN RAISE EXCEPTION 'INVALID_OTP_LOCKOUT_FAILURE'; END IF;
 END LOOP;
 IF tto.consume_challenge('88888888-8888-4888-8888-888888888888',decode(repeat('cd',32),'hex'),decode(repeat('aa',32),'hex')) IS NOT NULL
 THEN RAISE EXCEPTION 'BRUTE_FORCE_LOCKOUT_FAILURE'; END IF;
END $test$;
RESET ROLE;
-- Verify unapproved JIT never confers authorization, and wrong actor cannot approve.
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
 VALUES('99999999-9999-4999-8999-999999999999',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'JIT_APPROVAL','33333333-3333-4333-8333-333333333331',
 '22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day');
-- Owner can never mutate audit table's rows. Do not execute any cleanup or deletion.
DO $test$ DECLARE banned boolean:=false; BEGIN
 BEGIN
 UPDATE tto.audit_events SET event_name='TAMPER';
 EXCEPTION WHEN raise_exception THEN banned:=true;
 END;
 -- If no audit rows yet trigger has nothing to reject. Guard trigger is tested below with data.
END $test$;
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $test$ BEGIN
 IF tto.has_verified_authority('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','JIT_APPROVAL')
 THEN RAISE EXCEPTION 'UNAUTHORIZED_JIT_APPROVER'; END IF;
END $test$;
ROLLBACK;
-- Audit append is done via restricted typed DB function, with no token content.
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $test$ DECLARE eid uuid; BEGIN
 eid:=tto.append_actor_audit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CF03_TEST_EVENT','33333333-3333-4333-8333-333333333331');
 IF eid IS NULL THEN RAISE EXCEPTION 'AUDIT_APPEND_FAILED'; END IF;
END $test$;
COMMIT;
RESET ROLE;
DO $test$ DECLARE denied boolean:=false; BEGIN
 BEGIN
 UPDATE tto.audit_events SET event_name='TAMPER' WHERE event_name='CF03_TEST_EVENT';
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'AUDIT_MUTATION_NOT_REJECTED'; END IF;
END $test$;
-- Test legal hold protects doc even when privileged owner tries accidental deletion.
INSERT INTO tto.legal_holds(hold_id,tenant_id,document_id,rule_reference,reason,applied_by)
VALUES('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'33333333-3333-4333-8333-333333333331','LEGAL-CASE-1','Synthetic court preservation order',
'11111111-1111-4111-8111-111111111111');
DO $test$ DECLARE denied boolean:=false; BEGIN
 BEGIN
 DELETE FROM tto.documents WHERE document_id='33333333-3333-4333-8333-333333333331';
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'LEGAL_HOLD_BYPASSED'; END IF;
END $test$;
-- No app privileges to overwrite scan verdict or evidence or view authority references.
DO $test$ BEGIN
 IF has_table_privilege('tto_app','tto.legal_authorities','SELECT')
 OR has_table_privilege('tto_app','tto.document_scans','INSERT')
 OR has_table_privilege('tto_app','tto.audit_events','UPDATE')
 THEN RAISE EXCEPTION 'SENSITIVE_METADATA_PRIVILEGE_LEAK'; END IF;
END $test$;
SELECT 'TTO_CF01_03_V2_REAL_SECURITY_TESTS_PASS' AS result;
