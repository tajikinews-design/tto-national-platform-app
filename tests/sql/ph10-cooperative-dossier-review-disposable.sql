-- Disposable PostgreSQL17 ONLY. Entire synthetic transaction rolls back.
-- Preconditions: migrations 0001..9998 on a fresh empty database.
BEGIN;
INSERT INTO tto.user_accounts(user_id)
 VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO tto.national_root_accounts(singleton,user_id)
 VALUES (true,'11111111-1111-4111-8111-111111111111');
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by)
 VALUES ('22222222-2222-4222-8222-222222222222','synthetic-ci-only',
         '11111111-1111-4111-8111-111111111111');
INSERT INTO tto.cooperative_onboarding_dossiers(
 dossier_id,workspace_id,legal_name,national_id,registration_number,province,
 county,legal_address,representative_name,candidate_manager_name,
 candidate_manager_mobile,evidence_reference,created_by)
 VALUES ('33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222','Synthetic CI Cooperative',
 '12345678901','12345','Synthetic Province','Synthetic County',
 'Synthetic address used only inside a transaction','Synthetic Representative',
 'Synthetic Candidate','09123456789','synthetic-ci-evidence',
 '11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE r jsonb; cnt integer;
BEGIN
 SELECT tto.review_cooperative_onboarding(
 '33333333-3333-4333-8333-333333333333','START_REVIEW',1,
 '44444444-4444-4444-8444-444444444444') INTO r;
 IF r->>'status'<>'IN_REVIEW' OR (r->>'version')::int<>2 OR
   r->>'tenantCreated'<>'false' THEN
   RAISE EXCEPTION 'START_REVIEW failed: %',r;
 END IF;
 -- Exact idempotency replay is safe; it cannot create a duplicate audit event.
 SELECT tto.review_cooperative_onboarding(
 '33333333-3333-4333-8333-333333333333','START_REVIEW',1,
 '44444444-4444-4444-8444-444444444444') INTO r;
 IF r->>'replayed'<>'true' OR (r->>'version')::int<>2 THEN
  RAISE EXCEPTION 'idempotency replay failed: %',r;
 END IF;
 BEGIN
  PERFORM tto.review_cooperative_onboarding(
   '33333333-3333-4333-8333-333333333333','REJECT',1,
   '55555555-5555-4555-8555-555555555555','Missing evidence');
  RAISE EXCEPTION 'stale version was accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 -- Submitter is not an independent reviewer; recommendation must fail closed.
 BEGIN
  PERFORM tto.review_cooperative_onboarding(
   '33333333-3333-4333-8333-333333333333','RECOMMEND_EXTERNAL_APPROVAL',2,
   '66666666-6666-4666-8666-666666666666','No independent sign-off');
  RAISE EXCEPTION 'self-recommendation was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT tto.review_cooperative_onboarding(
 '33333333-3333-4333-8333-333333333333','REQUEST_CHANGES',2,
 '77777777-7777-4777-8777-777777777777','Correct the documents') INTO r;
 IF r->>'status'<>'CHANGES_REQUESTED' OR (r->>'version')::int<>3 THEN
   RAISE EXCEPTION 'request changes failed: %',r;
 END IF;
 SELECT tto.review_cooperative_onboarding(
 '33333333-3333-4333-8333-333333333333','RESUBMIT',3,
 '88888888-8888-4888-8888-888888888888') INTO r;
 IF r->>'status'<>'PENDING_LEGAL_REVIEW' OR (r->>'version')::int<>4 THEN
   RAISE EXCEPTION 'resubmission failed: %',r;
 END IF;
 -- Deliberately cannot reach any APPROVED or ACTIVATED state.
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF (SELECT count(*) FROM tto.cooperative_onboarding_audit
   WHERE dossier_id='33333333-3333-4333-8333-333333333333')<>3 THEN
  RAISE EXCEPTION 'duplicate or missing audit records';
 END IF;
 IF EXISTS(SELECT 1 FROM tto.tenants)
   OR EXISTS(SELECT 1 FROM tto.role_assignments) THEN
  RAISE EXCEPTION 'review unexpectedly created tenant or manager';
 END IF;
END $test$;
ROLLBACK;
SELECT 'PH10_COOPERATIVE_DOSSIER_REVIEW_DISPOSABLE_PASS' AS result;
