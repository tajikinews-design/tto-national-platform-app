-- PH10.5 isolated PG17 negative test. ONLY synthetic data; transactional rollback.
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
('11111111-1111-4111-8111-111111111111'), -- root
('22222222-2222-4222-8222-222222222222'), -- independently appointed reviewer
('33333333-3333-4333-8333-333333333333'); -- outsider
INSERT INTO tto.national_root_accounts(singleton,user_id,must_change_credentials)
 VALUES(true,'11111111-1111-4111-8111-111111111111',false);
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by) VALUES
('44444444-4444-4444-8444-444444444444','synthetic-external-review-ci',
 '11111111-1111-4111-8111-111111111111');
INSERT INTO tto.cooperative_onboarding_evidence_quarantine(
 evidence_id,workspace_id,upload_key,uploaded_by,original_filename,mime_type,
 content_sha256,iv,tag,ciphertext) VALUES(
 '55555555-5555-4555-8555-555555555555',
 '44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111','document.pdf','application/pdf',
 decode(repeat('aa',32),'hex'),decode(repeat('bb',12),'hex'),
 decode(repeat('cc',16),'hex'),decode('cafe','hex'));
INSERT INTO tto.cooperative_onboarding_dossiers(
 dossier_id,workspace_id,legal_name,national_id,registration_number,
 province,county,legal_address,representative_name,candidate_manager_name,
 candidate_manager_mobile,evidence_reference,state,created_by) VALUES(
 '77777777-7777-4777-8777-777777777777',
 '44444444-4444-4444-8444-444444444444',
 'Synthetic Legal Review Only','12345678901','12345','Synthetic Province',
 'Synthetic County','Synthetic testing address','Synthetic Representative',
 'Synthetic Candidate','09123456789',
 '55555555-5555-4555-8555-555555555555','EXTERNAL_APPROVAL_REQUIRED',
 '11111111-1111-4111-8111-111111111111');
-- This appointment is seeded by DB-owner in the ephemeral test only.
-- Application role must not be able to seed or elevate itself.
INSERT INTO tto.cooperative_external_legal_review_mandates(
 reviewer_id,appointed_by,authority_name,appointment_reference,
 appointment_evidence_sha256,valid_from,expires_at) VALUES(
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',
 'Synthetic Independent Authority',
 'Synthetic Appointment Reference 2026',
 decode(repeat('ab',32),'hex'),
 clock_timestamp()-interval '1 hour',clock_timestamp()+interval '3 days');
DO $test$
BEGIN
 IF has_table_privilege('tto_app','tto.cooperative_external_legal_review_mandates','INSERT')
 OR has_table_privilege('tto_app','tto.cooperative_external_legal_review_mandates','UPDATE')
 OR has_table_privilege('tto_app','tto.cooperative_external_legal_review_mandates','DELETE')
 OR has_table_privilege('tto_app','tto.cooperative_external_source_check_records','INSERT')
 OR has_table_privilege('tto_app','tto.cooperative_onboarding_evidence_quarantine','SELECT')
 THEN RAISE EXCEPTION 'application can modify reviewers or read protected quarantine bytes'; END IF;
END $test$;
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
DO $test$
BEGIN
 -- National root may run server-only integrity packet but cannot impersonate legal reviewer.
 IF (SELECT count(*) FROM tto.cooperative_evidence_integrity_packet(
   '55555555-5555-4555-8555-555555555555'))<>1
 THEN RAISE EXCEPTION 'national root cannot read integrity packet for server-only verification'; END IF;
 BEGIN
  PERFORM tto.record_independent_cooperative_source_check(
   '77777777-7777-4777-8777-777777777777',
   '55555555-5555-4555-8555-555555555555',
   '88888888-8888-4888-8888-888888888888',
   'NATIONAL_REGISTRY','Synthetic Official Registry 1',
   decode(repeat('ee',32),'hex'),'MATCH_REPORTED_UNVERIFIED',
   'Synthetic source check, not official legal approval');
  RAISE EXCEPTION 'national root impersonated independent reviewer';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('tto.actor_id','33333333-3333-4333-8333-333333333333',true);
 IF (SELECT count(*) FROM tto.cooperative_evidence_integrity_packet(
   '55555555-5555-4555-8555-555555555555'))<>0
 THEN RAISE EXCEPTION 'nonroot can retrieve encrypted document packet'; END IF;
 BEGIN
  PERFORM tto.record_independent_cooperative_source_check(
   '77777777-7777-4777-8777-777777777777',
   '55555555-5555-4555-8555-555555555555',
   '99999999-9999-4999-8999-999999999999',
   'NATIONAL_REGISTRY','Synthetic Official Registry 1',
   decode(repeat('ee',32),'hex'),'MATCH_REPORTED_UNVERIFIED',
   'Synthetic outsider cannot verify a legal source');
  RAISE EXCEPTION 'outsider reported independent legal source';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
END $test$;
DO $test$
DECLARE one jsonb; two jsonb; key uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
 SELECT tto.record_independent_cooperative_source_check(
 '77777777-7777-4777-8777-777777777777',
 '55555555-5555-4555-8555-555555555555',
 key,'NATIONAL_REGISTRY','Synthetic Official Registry 1',
 decode(repeat('ee',32),'hex'),'MATCH_REPORTED_UNVERIFIED',
 'Synthetic source check, not official legal approval') INTO one;
 IF one->>'authenticity'<>'NOT_VERIFIED' OR
    one->>'legalApproval'<>'false' OR one->>'managerRoleGranted'<>'false'
 THEN RAISE EXCEPTION 'source claim improperly promoted to legal verification: %',one; END IF;
 SELECT tto.record_independent_cooperative_source_check(
 '77777777-7777-4777-8777-777777777777',
 '55555555-5555-4555-8555-555555555555',
 key,'NATIONAL_REGISTRY','Synthetic Official Registry 1',
 decode(repeat('ee',32),'hex'),'MATCH_REPORTED_UNVERIFIED',
 'Synthetic source check, not official legal approval') INTO two;
 IF one->>'checkId'<>two->>'checkId' OR two->>'replayed'<>'true'
 THEN RAISE EXCEPTION 'source check idempotency failed'; END IF;
 BEGIN
  PERFORM tto.record_independent_cooperative_source_check(
   '77777777-7777-4777-8777-777777777777',
   '55555555-5555-4555-8555-555555555555',
   key,'NATIONAL_REGISTRY','Synthetic Official Registry 1',
   decode(repeat('ee',32),'hex'),'MISMATCH_REPORTED',
   'Synthetic source check, not official legal approval');
  RAISE EXCEPTION 'request key replayed with altered decision';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  PERFORM tto.record_independent_cooperative_source_check(
   '77777777-7777-4777-8777-777777777777',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'NATIONAL_REGISTRY','Synthetic Official Registry 1',
   decode(repeat('ee',32),'hex'),'INCONCLUSIVE',
   'Attempt to cross reference another workspace file');
  RAISE EXCEPTION 'foreign evidence accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
UPDATE tto.cooperative_external_legal_review_mandates
 SET revoked_at=clock_timestamp() WHERE reviewer_id=
 '22222222-2222-4222-8222-222222222222';
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
DO $test$
BEGIN
 BEGIN
  PERFORM tto.record_independent_cooperative_source_check(
   '77777777-7777-4777-8777-777777777777',
   '55555555-5555-4555-8555-555555555555',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'NATIONAL_REGISTRY','Synthetic Official Registry 2',
   decode(repeat('ee',32),'hex'),'INCONCLUSIVE',
   'This reviewer mandate was explicitly revoked');
  RAISE EXCEPTION 'revoked reviewer mandate accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF (SELECT count(*) FROM tto.cooperative_external_source_check_records)<>1
 OR EXISTS(SELECT 1 FROM tto.cooperative_onboarding_evidence_quarantine
   WHERE authenticity_status<>'NOT_VERIFIED' OR scan_status<>'QUARANTINED')
 OR EXISTS(SELECT 1 FROM tto.tenants)
 OR EXISTS(SELECT 1 FROM tto.role_assignments)
 THEN RAISE EXCEPTION 'external record mutated legal truth or roles'; END IF;
END $test$;
ROLLBACK;
SELECT 'PH10_EXTERNAL_SOURCE_REVIEW_DISPOSABLE_PASS' AS result;
