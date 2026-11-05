-- Disposable PG17 only. No real cooperative data. Never run against hosted Preview.
BEGIN;
INSERT INTO tto.user_accounts(user_id)
 VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO tto.national_root_accounts(singleton,user_id,must_change_credentials)
 VALUES(true,'11111111-1111-4111-8111-111111111111',false);
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by)
 VALUES ('22222222-2222-4222-8222-222222222222','synthetic-draft-ci',
 '11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE r jsonb; data jsonb := '{"legalName":"Synthetic, not real","province":"Test"}'::jsonb;
BEGIN
 SELECT tto.save_cooperative_onboarding_draft(
 'synthetic-draft-ci',data,0,'44444444-4444-4444-8444-444444444444') INTO r;
 IF (r->>'version')::integer<>1 OR r->>'tenantCreated'<>'false' OR
   r->>'submitted'<>'false' OR r->>'replayed'<>'false' THEN
   RAISE EXCEPTION 'draft save contract failed: %',r;
 END IF;
 SELECT tto.save_cooperative_onboarding_draft(
 'synthetic-draft-ci',data,0,'44444444-4444-4444-8444-444444444444') INTO r;
 IF r->>'replayed'<>'true' OR (r->>'version')::integer<>1 THEN
   RAISE EXCEPTION 'draft idempotent retry failed: %',r;
 END IF;
 BEGIN
  PERFORM tto.save_cooperative_onboarding_draft(
   'synthetic-draft-ci','{"legalName":"Changed body"}',0,
   '44444444-4444-4444-8444-444444444444');
  RAISE EXCEPTION 'same key with changed content allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  PERFORM tto.save_cooperative_onboarding_draft(
   'synthetic-draft-ci',data,0,
   '55555555-5555-4555-8555-555555555555');
  RAISE EXCEPTION 'stale version allowed';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
  PERFORM tto.save_cooperative_onboarding_draft(
   'missing-reservation',data,0,
   '66666666-6666-4666-8666-666666666666');
  RAISE EXCEPTION 'nonreserved workspace allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
  PERFORM tto.save_cooperative_onboarding_draft(
   'synthetic-draft-ci','{"roleCode":"COOPERATIVE_MANAGER"}'::jsonb,1,
   '77777777-7777-4777-8777-777777777777');
  RAISE EXCEPTION 'unauthorized field accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 SELECT tto.save_cooperative_onboarding_draft(
 'synthetic-draft-ci','{"legalName":"Synthetic revised"}'::jsonb,1,
 '88888888-8888-4888-8888-888888888888') INTO r;
 IF (r->>'version')::integer<>2 THEN RAISE EXCEPTION 'revision save failed'; END IF;
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF (SELECT count(*) FROM tto.cooperative_onboarding_draft_revisions)<>2
 THEN RAISE EXCEPTION 'draft revisions are not replay-safe'; END IF;
 IF EXISTS(SELECT 1 FROM tto.tenants) OR EXISTS(SELECT 1 FROM tto.role_assignments)
 THEN RAISE EXCEPTION 'draft created tenant or role'; END IF;
END $test$;
ROLLBACK;
SELECT 'PH10_COOPERATIVE_DRAFT_DISPOSABLE_PASS' AS result;
