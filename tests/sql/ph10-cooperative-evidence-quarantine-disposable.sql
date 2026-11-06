-- PH10 isolated PostgreSQL17 evidence quarantine. All writes rolled back.
BEGIN;
INSERT INTO tto.user_accounts(user_id)
 VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO tto.national_root_accounts(singleton,user_id,must_change_credentials)
 VALUES(true,'11111111-1111-4111-8111-111111111111',false);
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by)
 VALUES('22222222-2222-4222-8222-222222222222','synthetic-upload-ci',
 '11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE r jsonb; original uuid;
BEGIN
 SELECT tto.store_quarantined_cooperative_evidence(
 'synthetic-upload-ci','44444444-4444-4444-8444-444444444444',
 'document.pdf','application/pdf',
 decode(repeat('aa',32),'hex'),decode(repeat('bb',12),'hex'),
 decode(repeat('cc',16),'hex'),decode('cafe','hex')) INTO r;
 IF r->>'scanStatus'<>'QUARANTINED' OR r->>'authenticity'<>'NOT_VERIFIED' OR
  r->>'tenantCreated'<>'false' OR r->>'replayed'<>'false' THEN
   RAISE EXCEPTION 'quarantine insert contract failed: %',r;
 END IF;
 original:=(r->>'evidenceId')::uuid;
 SELECT tto.store_quarantined_cooperative_evidence(
 'synthetic-upload-ci','44444444-4444-4444-8444-444444444444',
 'document.pdf','application/pdf',
 decode(repeat('aa',32),'hex'),decode(repeat('bb',12),'hex'),
 decode(repeat('cc',16),'hex'),decode('cafe','hex')) INTO r;
 IF r->>'replayed'<>'true' OR (r->>'evidenceId')::uuid<>original THEN
   RAISE EXCEPTION 'upload idempotency replay failed';
 END IF;
 BEGIN
  PERFORM tto.store_quarantined_cooperative_evidence(
   'synthetic-upload-ci','44444444-4444-4444-8444-444444444444',
   'document.pdf','application/pdf',
   decode(repeat('dd',32),'hex'),decode(repeat('bb',12),'hex'),
   decode(repeat('cc',16),'hex'),decode('beef','hex'));
  RAISE EXCEPTION 'reused upload key accepted altered content';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  PERFORM tto.store_quarantined_cooperative_evidence(
   'unreserved-ci','55555555-5555-4555-8555-555555555555',
   'document.pdf','application/pdf',
   decode(repeat('aa',32),'hex'),decode(repeat('bb',12),'hex'),
   decode(repeat('cc',16),'hex'),decode('cafe','hex'));
  RAISE EXCEPTION 'unreserved upload permitted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $test$;
RESET ROLE;
-- Simulate a submitted dossier on the same pre-Tenant workspace.
INSERT INTO tto.cooperative_onboarding_dossiers(
 dossier_id,workspace_id,legal_name,national_id,registration_number,
 province,county,legal_address,representative_name,candidate_manager_name,
 candidate_manager_mobile,evidence_reference,created_by)
 VALUES(
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222','Synthetic only cooperative',
 '12345678901','12345','Synthetic Province','Synthetic County',
 'Synthetic address used only inside transaction','Synthetic Contact',
 'Synthetic Candidate','09123456789','quarantine-ci-evidence',
 '11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE replay jsonb;
BEGIN
 -- Retry of existing upload must be idempotent even after dossier submission.
 SELECT tto.store_quarantined_cooperative_evidence(
 'synthetic-upload-ci','44444444-4444-4444-8444-444444444444',
 'document.pdf','application/pdf',decode(repeat('aa',32),'hex'),
 decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),
 decode('cafe','hex')) INTO replay;
 IF replay->>'replayed'<>'true' THEN
   RAISE EXCEPTION 'existing upload was not replayable after submit';
 END IF;
 BEGIN
  PERFORM tto.store_quarantined_cooperative_evidence(
   'synthetic-upload-ci','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'document.pdf','application/pdf',decode(repeat('aa',32),'hex'),
   decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),
   decode('cafe','hex'));
  RAISE EXCEPTION 'new upload accepted outside correction window';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 -- Forged actor context without registered national-root principal must fail.
 PERFORM set_config('tto.actor_id','99999999-9999-4999-8999-999999999999',true);
 BEGIN
  PERFORM tto.store_quarantined_cooperative_evidence(
   'synthetic-upload-ci','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'document.pdf','application/pdf',decode(repeat('aa',32),'hex'),
   decode(repeat('bb',12),'hex'),decode(repeat('cc',16),'hex'),
   decode('cafe','hex'));
  RAISE EXCEPTION 'nonroot upload permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF (SELECT count(*) FROM tto.cooperative_onboarding_evidence_quarantine)<>1 THEN
   RAISE EXCEPTION 'duplicate upload stored';
 END IF;
 IF EXISTS(SELECT 1 FROM tto.cooperative_onboarding_evidence_quarantine
  WHERE scan_status<>'QUARANTINED' OR authenticity_status<>'NOT_VERIFIED') THEN
   RAISE EXCEPTION 'unverified upload was released';
 END IF;
 IF EXISTS(SELECT 1 FROM tto.tenants) OR EXISTS(SELECT 1 FROM tto.role_assignments) THEN
   RAISE EXCEPTION 'evidence unexpectedly granted a role or tenant';
 END IF;
END $test$;
ROLLBACK;
SELECT 'PH10_COOPERATIVE_ENCRYPTED_QUARANTINE_DISPOSABLE_PASS' AS result;
