-- PH10.9 database-only disposable regression; no live identity or legal attestation.
BEGIN;
DO $$
BEGIN
 IF has_table_privilege('tto_app','tto.cooperative_manual_gazette_review_findings','INSERT')
 OR has_table_privilege('tto_app','tto.cooperative_manual_gazette_review_findings','UPDATE')
 OR has_table_privilege('tto_app','tto.cooperative_manual_gazette_review_findings','DELETE')
 OR has_table_privilege('tto_app','tto.cooperative_manual_gazette_review_findings','SELECT')
 THEN RAISE EXCEPTION 'unexpected direct review-table privilege'; END IF;
 IF NOT has_function_privilege('tto_app',
 'tto.record_independent_gazette_finding(uuid,uuid,text,bytea,text,text,bytea)','EXECUTE')
 THEN RAISE EXCEPTION 'review command execute privilege missing'; END IF;
END $$;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('a1000000-0000-4000-8000-000000000001'),
 ('a1000000-0000-4000-8000-000000000002');
INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
VALUES ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
 decode(repeat('a1',32),'hex'),0,now()+interval '30 minutes');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
VALUES ('a3000000-0000-4000-8000-000000000001','test-ph109-gazette','PH109 Synthetic','ACTIVE');
INSERT INTO tto.cooperative_manual_official_governance_claims(
 claim_id,tenant_id,request_key,submitted_by,person_full_name,office_type,
 signing_mode,authority_scope,official_issue_number,official_publication_date,
 official_announcement_number
) VALUES(
 'a4000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000001',
 'a5000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001',
 'Synthetic Member','BOARD_MEMBER','NONE','No delegated signature permissions',
 '23000',CURRENT_DATE,'90001'
);
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','a1000000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
 BEGIN
  PERFORM tto.record_independent_gazette_finding(
   'a4000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000001','Test Gazette Reference',
   decode(repeat('cc',32),'hex'),'MATCH_REPORTED_UNVERIFIED',
   'Synthetic reviewer-only comparison',decode(repeat('a1',32),'hex'));
  RAISE EXCEPTION 'self-review or absent mandate accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM tto.record_independent_gazette_finding(
   'a4000000-0000-4000-8000-000000000001',
   'a6000000-0000-4000-8000-000000000002','Test Gazette Reference',
   decode(repeat('cc',32),'hex'),'INCONCLUSIVE',
   'Synthetic reviewer-only comparison',decode(repeat('bb',32),'hex'));
  RAISE EXCEPTION 'forged session accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM tto.cooperative_manual_gazette_review_findings) THEN
  RAISE EXCEPTION 'unauthorized reviewer created a finding'; END IF;
 INSERT INTO tto.cooperative_manual_gazette_review_findings(
  request_key,claim_id,tenant_id,reviewer_id,mandate_appointment_reference,
  source_reference,source_sha256,outcome,rationale)
 VALUES(
  'a6000000-0000-4000-8000-000000000003',
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'synthetic appointment evidence','Synthetic Gazette reference',
  decode(repeat('cc',32),'hex'),'INCONCLUSIVE','Not an official authenticity judgment');
 BEGIN
  DELETE FROM tto.cooperative_manual_gazette_review_findings;
  RAISE EXCEPTION 'review finding deleted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE tto.cooperative_manual_gazette_review_findings SET outcome='MATCH_REPORTED_UNVERIFIED';
  RAISE EXCEPTION 'review finding overwritten';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT count(*) FROM tto.cooperative_manual_gazette_review_findings)<>1 OR
   (SELECT count(*) FROM tto.role_assignments)<>0 OR
   (SELECT count(*) FROM tto.legal_authorities)<>0 THEN
  RAISE EXCEPTION 'review modified permissions or evidence'; END IF;
END $$;
ROLLBACK;
SELECT 'PH10_9_GAZETTE_REVIEW_NEGATIVE_AND_IMMUTABILITY_PASS' AS result;
