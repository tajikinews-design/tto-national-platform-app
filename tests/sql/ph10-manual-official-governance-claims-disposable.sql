-- PH10.7 synthetic only. No real cooperative, manager, PII, source import or preview migration.
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES('a1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  decode(repeat('11',32),'hex'),0,now()+interval '1 hour'),
 ('a2222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222',
  decode(repeat('22',32),'hex'),0,now()+interval '1 hour');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 ('44444444-4444-4444-8444-444444444444',
  'synthetic-gazette-only','Synthetic Legal Gazette Test','ACTIVE'),
 ('55555555-5555-4555-8555-555555555555',
  'synthetic-other-gazette','Synthetic Foreign Tenant','ACTIVE');
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,
 verified_by,verified_at,valid_until) VALUES(
 '66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444',
 'ROLE_MANAGEMENT','77777777-7777-4777-8777-777777777777',
 '33333333-3333-4333-8333-333333333333',now(),now()+interval '7 days');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code,
 legal_authority_id) VALUES(
 '88888888-8888-4888-8888-888888888888',
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444444',
 'COOPERATIVE_MANAGER','66666666-6666-4666-8666-666666666666');
DO $gate$
BEGIN
 IF has_table_privilege('tto_app','tto.cooperative_manual_official_governance_claims','INSERT')
 OR has_table_privilege('tto_app','tto.cooperative_manual_official_governance_claims','UPDATE')
 OR has_table_privilege('tto_app','tto.cooperative_manual_official_governance_claims','DELETE')
 OR has_table_privilege('tto_app','tto.cooperative_manual_official_governance_claims','SELECT') THEN
  RAISE EXCEPTION 'direct manager write/edit/read permission unexpectedly granted';
 END IF;
END $gate$;
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','44444444-4444-4444-8444-444444444444',true);
DO $gate$
BEGIN
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   '99999999-9999-4999-8999-999999999999',
   'Synthetic Board Member','BOARD_MEMBER','JOINT',
   'Signature requires both specified members and board resolution',
   '23001',CURRENT_DATE-1,'2001501',
   CURRENT_DATE-5,CURRENT_DATE+365,NULL,NULL,
   decode(repeat('22',32),'hex'));
  RAISE EXCEPTION 'non-manager submitted board authority';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   '99999999-9999-4999-8999-999999999999',
   'Synthetic Board Member','BOARD_MEMBER','JOINT',
   'Signature requires both specified members and board resolution',
   '23001',CURRENT_DATE-1,'2001501',
   CURRENT_DATE-5,CURRENT_DATE+365,NULL,NULL,
   decode(repeat('22',32),'hex'));
  RAISE EXCEPTION 'manager reused outsider session';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $gate$;
DO $gate$
DECLARE original jsonb; repeated jsonb;
BEGIN
 SELECT tto.submit_manual_official_governance_claim(
 '44444444-4444-4444-8444-444444444444',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Synthetic Board Member','BOARD_MEMBER','JOINT',
 'Signature requires both specified members and board resolution',
 '23001',CURRENT_DATE-1,'2001501',
 CURRENT_DATE-5,CURRENT_DATE+365,NULL,NULL,
 decode(repeat('11',32),'hex')) INTO original;
 IF original->>'status'<>'SELF_REPORTED_PENDING_REVIEW' OR
 original->>'officiallyVerified'<>'false' OR
 original->>'roleGranted'<>'false' OR
 original->>'legalApproval'<>'false' THEN
  RAISE EXCEPTION 'manual claim unexpectedly granted legal authority: %',original;
 END IF;
 SELECT tto.submit_manual_official_governance_claim(
 '44444444-4444-4444-8444-444444444444',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Synthetic Board Member','BOARD_MEMBER','JOINT',
 'Signature requires both specified members and board resolution',
 '23001',CURRENT_DATE-1,'2001501',
 CURRENT_DATE-5,CURRENT_DATE+365,NULL,NULL,
 decode(repeat('11',32),'hex')) INTO repeated;
 IF original->>'claimId'<>repeated->>'claimId' OR repeated->>'replayed'<>'true'
 THEN RAISE EXCEPTION 'manual governance idempotency failed';END IF;
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Synthetic Board Member','CEO','INDIVIDUAL',
   'Synthetic board-approved full financial authority',
   '23001',CURRENT_DATE-1,'2001501',
   CURRENT_DATE-5,NULL,NULL,NULL,
   decode(repeat('11',32),'hex'));
  RAISE EXCEPTION 'reused request key modified officer claim';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'Synthetic Board Member','BOARD_MEMBER','JOINT',
   'Signature requires both specified members and board resolution',
   '',CURRENT_DATE-1,'2001501',
   CURRENT_DATE-5,NULL,NULL,NULL,
   decode(repeat('11',32),'hex'));
  RAISE EXCEPTION 'empty Official Gazette issue number accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'Synthetic Board Member','CEO','INDIVIDUAL',
   'Synthetic scope accidentally linked to foreign tenant record',
   '23001',CURRENT_DATE-1,'2001501',
   CURRENT_DATE-5,NULL,NULL,
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   decode(repeat('11',32),'hex'));
  RAISE EXCEPTION 'cross-tenant supersession allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $gate$;
-- PH10.8: manager-only historical read, single append-only successor.
DO $gate$
DECLARE first_id uuid; second_id uuid; value jsonb;history jsonb;
BEGIN
 SELECT claim_id INTO first_id FROM tto.cooperative_manual_official_governance_claims
 WHERE request_key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 SELECT tto.list_manual_official_governance_claims(
  '44444444-4444-4444-8444-444444444444',decode(repeat('11',32),'hex')) INTO history;
 IF jsonb_array_length(history->'items')<>1 OR history->>'selfReportedOnly'<>'true' OR
   history->>'legalApproval'<>'false' OR history->'items'->0->>'hasCorrection'<>'false'
 THEN RAISE EXCEPTION 'manager history leaked or omitted claim'; END IF;
 SELECT tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'Synthetic Board Member','BOARD_MEMBER','JOINT',
   'Updated joint signature conditions asserted by cooperative management',
   '23002',CURRENT_DATE,'2001502',CURRENT_DATE-1,CURRENT_DATE+365,
   NULL,first_id,decode(repeat('11',32),'hex')) INTO value;
 second_id=(value->>'claimId')::uuid;
 IF second_id=first_id THEN RAISE EXCEPTION 'correction overwrote old claim'; END IF;
 BEGIN
  PERFORM tto.submit_manual_official_governance_claim(
   '44444444-4444-4444-8444-444444444444',
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'Synthetic Board Member','BOARD_MEMBER','JOINT',
   'Second contradictory correction must not branch version history',
   '23003',CURRENT_DATE,'2001503',CURRENT_DATE-1,CURRENT_DATE+365,
   NULL,first_id,decode(repeat('11',32),'hex'));
  RAISE EXCEPTION 'competing Gazette corrections accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT tto.list_manual_official_governance_claims(
  '44444444-4444-4444-8444-444444444444',decode(repeat('11',32),'hex')) INTO history;
 IF jsonb_array_length(history->'items')<>2 OR
   NOT EXISTS(SELECT 1 FROM jsonb_array_elements(history->'items') h
      WHERE h->>'claimId'=first_id::text AND h->>'hasCorrection'='true') OR
   NOT EXISTS(SELECT 1 FROM jsonb_array_elements(history->'items') h
      WHERE h->>'claimId'=second_id::text AND h->>'hasCorrection'='false')
 THEN RAISE EXCEPTION 'correction history relationship missing';END IF;
 PERFORM set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
 BEGIN
  PERFORM tto.list_manual_official_governance_claims(
   '44444444-4444-4444-8444-444444444444',decode(repeat('22',32),'hex'));
  RAISE EXCEPTION 'outsider read private Gazette history';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
 BEGIN
  PERFORM tto.list_manual_official_governance_claims(
   '55555555-5555-4555-8555-555555555555',decode(repeat('11',32),'hex'));
  RAISE EXCEPTION 'cross-tenant Gazette history read';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $gate$;
RESET ROLE;
DO $gate$
BEGIN
 -- Trigger blocks even DB owner mutations; changes must be a new cited record.
 BEGIN
  UPDATE tto.cooperative_manual_official_governance_claims
   SET office_type='CEO' WHERE request_key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'old official claim was edited';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  DELETE FROM tto.cooperative_manual_official_governance_claims
   WHERE request_key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'old official claim was deleted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF (SELECT count(*) FROM tto.cooperative_manual_official_governance_claims)<>2 OR
 EXISTS(SELECT 1 FROM tto.cooperative_manual_official_governance_claims
  WHERE verification_status<>'SELF_REPORTED_PENDING_REVIEW' OR
  official_issue_number NOT IN ('23001','23002') OR
  official_announcement_number NOT IN ('2001501','2001502')) OR
 (SELECT count(*) FROM tto.role_assignments)<>1 OR
 (SELECT count(*) FROM tto.legal_authorities)<>1 THEN
   RAISE EXCEPTION 'manual notice changed legal truth or lost provenance'; END IF;
END $gate$;
ROLLBACK;
SELECT 'PH10_MANUAL_GAZETTE_MANAGER_CLAIMS_DISPOSABLE_PASS_NO_ROLE_GRANT' AS result;
