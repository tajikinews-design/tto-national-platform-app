-- Run only after 0001..0014 on disposable PostgreSQL17.
BEGIN;
-- Synthetic policy required only in this rollback-only acceptance transaction.
INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes)
 VALUES('SESSION_CHALLENGE',5,15);
INSERT INTO tto.user_accounts(user_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph04-role-gate','Synthetic role tenant','ACTIVE'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ph04-role-other','Synthetic other tenant','ACTIVE');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code)
 VALUES('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','COOPERATIVE_MANAGER');
INSERT INTO tto.legal_authorities
 (authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
 VALUES('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ROLE_MANAGEMENT',
  '77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222',
  now(),now()+interval '1 hour');
INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,
 authorization_epoch_at_issue,assurance_level,expires_at)
 VALUES('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',
 decode(repeat('ab',32),'hex'),0,0,'OTP',now()+interval '1 hour');
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true),
 set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

DO $check$ DECLARE code text; BEGIN
 code:=tto.assign_tenant_role_guarded(
  '33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',
  decode(repeat('ab',32),'hex'));
 IF code<>'STEP_UP_REQUIRED' THEN RAISE EXCEPTION 'DED_018_OTP_NOT_DENIED: %',code;END IF;
 IF EXISTS(SELECT 1 FROM tto.role_assignments WHERE user_id='33333333-3333-4333-8333-333333333333')
 THEN RAISE EXCEPTION 'DED_018_LOW_ASSURANCE_MUTATED_ROLE'; END IF;
END $check$;
-- A manual database flip to ELEVATED is NOT a step-up; it requires a
-- fresh delivered and consumed challenge bound to this exact session.
UPDATE tto.user_sessions SET assurance_level='ELEVATED'
 WHERE session_id='88888888-8888-4888-8888-888888888888';
DO $check$ DECLARE code text;BEGIN
 code:=tto.assign_tenant_role_guarded(
  '33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',
  decode(repeat('ab',32),'hex'));
 IF code<>'STEP_UP_REQUIRED' THEN RAISE EXCEPTION 'DED_018_FAKE_ELEVATION_ACCEPTED';END IF;
END $check$;
UPDATE tto.user_sessions SET assurance_level='OTP'
 WHERE session_id='88888888-8888-4888-8888-888888888888';
INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at)
 VALUES('09120000001','11111111-1111-4111-8111-111111111111',now());
DO $check$ DECLARE mobile text;ok boolean;bad_session uuid;BEGIN
 mobile:=tto.begin_session_stepup_smsotp(
  '99999999-9999-4999-8999-999999999990',decode(repeat('cd',32),'hex'),
  decode(repeat('ab',32),'hex'));
 IF mobile<>'09120000001' THEN RAISE EXCEPTION 'STEPUP_VERIFIED_IDENTIFIER_MISSING';END IF;
 IF tto.consume_challenge('99999999-9999-4999-8999-999999999990',
   decode(repeat('cd',32),'hex'),decode(repeat('ef',32),'hex')) IS NOT NULL THEN
  RAISE EXCEPTION 'STEPUP_CODE_CREATED_NEW_SESSION';END IF;
 IF tto.consume_session_stepup_smsotp('99999999-9999-4999-8999-999999999990',
   decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex')) THEN
  RAISE EXCEPTION 'STEPUP_ACCEPTED_BEFORE_PROVIDER_DELIVERY';END IF;
 ok:=tto.complete_smsotp_delivery('99999999-9999-4999-8999-999999999990',true);
 IF NOT ok THEN RAISE EXCEPTION 'STEPUP_DELIVERY_STATUS_FAILED';END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,
  authorization_epoch_at_issue,assurance_level,expires_at)
  VALUES('a2222222-2222-4222-8222-222222222222',
   '11111111-1111-4111-8111-111111111111',decode(repeat('bc',32),'hex'),
   0,0,'OTP',now()+interval '1 hour');
 IF tto.consume_session_stepup_smsotp('99999999-9999-4999-8999-999999999990',
   decode(repeat('cd',32),'hex'),decode(repeat('bc',32),'hex')) THEN
  RAISE EXCEPTION 'STEPUP_OTHER_SAME_USER_SESSION_ACCEPTED';END IF;
 ok:=tto.consume_session_stepup_smsotp('99999999-9999-4999-8999-999999999990',
   decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex'));
 IF NOT ok THEN RAISE EXCEPTION 'STEPUP_FRESH_PROOF_DENIED';END IF;
 IF tto.consume_session_stepup_smsotp('99999999-9999-4999-8999-999999999990',
   decode(repeat('cd',32),'hex'),decode(repeat('ab',32),'hex')) THEN
  RAISE EXCEPTION 'STEPUP_REPLAY_ACCEPTED';END IF;
END $check$;
DO $check$ DECLARE code text; BEGIN
 code:=tto.assign_tenant_role_guarded(
  '33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',
  decode(repeat('ab',32),'hex'));
 IF code<>'ASSIGNED' THEN RAISE EXCEPTION 'DED_015_NEW_REQUEST_FAILED: %',code;END IF;
 code:=tto.assign_tenant_role_guarded(
  '33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',
  decode(repeat('ab',32),'hex'));
 IF code<>'ALREADY_APPLIED' THEN RAISE EXCEPTION 'DED_015_REPLAY_MUST_NOT_REASSIGN: %',code;END IF;
 code:=tto.assign_tenant_role_guarded(
  '44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',
  decode(repeat('ab',32),'hex'));
 IF code<>'IDEMPOTENCY_CONFLICT' THEN RAISE EXCEPTION 'DED_015_REPLAY_TARGET_CHANGED: %',code;END IF;
 code:=tto.assign_tenant_role_guarded(
  '44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MEMBER',
  '66666666-6666-4666-8666-666666666666','aaaaaaaa-0000-4000-8000-000000000000',
  decode(repeat('ab',32),'hex'));
 IF code<>'PERMISSION_DENIED' THEN RAISE EXCEPTION 'CROSS_TENANT_GUARDED_ASSIGN: %',code;END IF;
 IF (SELECT count(*) FROM tto.role_assignments WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND role_code='MEMBER')<>1 THEN RAISE EXCEPTION 'DED_015_MORE_THAN_ONE_ROLE'; END IF;
 IF (SELECT count(*) FROM tto.role_assignment_request_receipts
    WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 THEN
    RAISE EXCEPTION 'DED_015_MORE_THAN_ONE_REQUEST_RECEIPT'; END IF;
 IF (SELECT count(*) FROM tto.audit_events
    WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND event_name='ROLE_ASSIGNED')<>1
 THEN RAISE EXCEPTION 'DED_015_MORE_THAN_ONE_ROLE_AUDIT'; END IF;
 IF has_table_privilege('tto_app','tto.role_assignment_request_receipts','SELECT') OR
    has_function_privilege('tto_app',
     'tto.assign_tenant_role(uuid,uuid,text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'GUARDED_ROLE_REQUEST_CAN_BYPASS';END IF;
END $check$;
UPDATE tto.user_accounts SET authorization_epoch=1
 WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $check$ DECLARE code text; BEGIN
 code:=tto.assign_tenant_role_guarded(
  '44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER',
  '66666666-6666-4666-8666-666666666666','a1111111-1111-4111-8111-111111111111',
  decode(repeat('ab',32),'hex'));
 IF code<>'STEP_UP_REQUIRED' THEN RAISE EXCEPTION 'DED_018_STALE_SESSION_AFTER_EPOCH: %',code;END IF;
END $check$;
ROLLBACK;
SELECT 'TTO_PH04_DED015_IDEMPOTENT_ASSIGN_AND_DED018_STEPUP_SQL_PASS' AS signal;
