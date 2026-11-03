-- CF04 source-specific synthetic legal-policy assertions. No statutory approval.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('b1111111-1111-4111-8111-111111111111'),
 ('b2222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph05-rule-contract','Synthetic CF04','ACTIVE');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 VALUES('b3333333-3333-4333-8333-333333333333',
 'baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTHETIC_ONLY',
 'b4444444-4444-4444-8444-444444444444');
INSERT INTO tto.ph05_legal_source_refs(source_id,citation,authority_label,evidence_id,
 verified_by,verified_at)
 VALUES('b5555555-5555-4555-8555-555555555555',
 'TEST LEGAL SOURCE REFERENCE ONLY','Synthetic reviewer',
 'b3333333-3333-4333-8333-333333333333',
 'b2222222-2222-4222-8222-222222222222',now());
DO $t$ BEGIN
 BEGIN
  INSERT INTO tto.ph05_rule_versions(version_id,rule_code,rule_version,source_id,
   effective_from,candidate_disposition,status,created_by,approved_by)
  VALUES('b6666666-6666-4666-8666-666666666663','TEST_RULE',99,
   'b7777777-7777-4777-8777-777777777777',now(),
   'REVIEW_REQUIRED','ACTIVE','b1111111-1111-4111-8111-111111111111',
   'b2222222-2222-4222-8222-222222222222');
  RAISE EXCEPTION 'CF04_SOURCELESS_ACTIVATION_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $t$;
INSERT INTO tto.ph05_rule_versions(version_id,rule_code,rule_version,source_id,
 effective_from,candidate_disposition,status,created_by,approved_by)
 VALUES
 ('b6666666-6666-4666-8666-666666666661','TEST_RULE',1,
 'b5555555-5555-4555-8555-555555555555',now()-interval '2 days',
 'REVIEW_REQUIRED','ACTIVE','b1111111-1111-4111-8111-111111111111',
 'b2222222-2222-4222-8222-222222222222'),
 ('b6666666-6666-4666-8666-666666666662','TEST_RULE',2,
 'b5555555-5555-4555-8555-555555555555',now()+interval '1 day',
 'BLOCK','ACTIVE','b1111111-1111-4111-8111-111111111111',
 'b2222222-2222-4222-8222-222222222222');
INSERT INTO tto.ph05_rule_snapshots(snapshot_id,source_version_id,evaluated_as_of,
 recorded_disposition,evidence_id)
 VALUES('b8888888-8888-4888-8888-888888888888',
 'b6666666-6666-4666-8666-666666666661',now()-interval '1 day',
 'REVIEW_ONLY','b3333333-3333-4333-8333-333333333333');
DO $t$ BEGIN
 IF tto.ph05_rule_candidate_asof('TEST_RULE',now())<>'REVIEW_ONLY'
 OR tto.ph05_rule_candidate_asof('TEST_RULE',now()+interval '2 days')<>'BLOCKED'
 OR tto.ph05_rule_candidate_asof('TEST_RULE',now()-interval '3 days')<>'BLOCKED'
 THEN RAISE EXCEPTION 'CF04_ASOF_RULE_SELECTION_INVALID'; END IF;
 IF (SELECT count(*) FROM tto.ph05_rule_snapshots s
 JOIN tto.ph05_rule_versions r ON r.version_id=s.source_version_id
 WHERE s.snapshot_id='b8888888-8888-4888-8888-888888888888'
   AND r.rule_version=1 AND s.recorded_disposition='REVIEW_ONLY')<>1
 THEN RAISE EXCEPTION 'CF04_HISTORICAL_RULE_SNAPSHOT_LOST';END IF;
 BEGIN
  UPDATE tto.ph05_rule_versions SET rule_version=3
   WHERE version_id='b6666666-6666-4666-8666-666666666661';
  RAISE EXCEPTION 'CF04_OLD_RULE_MUTATION_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
 IF (SELECT count(*) FROM tto.ph05_rule_versions
 WHERE rule_code='TEST_RULE')<>2
 THEN RAISE EXCEPTION 'CF04_SUPERSEDED_RULE_NOT_QUERYABLE';END IF;
END $t$;
DO $t$ BEGIN
 BEGIN
  INSERT INTO tto.ph05_tenant_policy_value_candidates(tenant_id,policy_code,numeric_value,source_id)
  VALUES('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MAX_PROXIES',4,
  'b5555555-5555-4555-8555-555555555555');
  RAISE EXCEPTION 'CF04_INVALID_TENANT_OVERRIDE_ACCEPTED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO tto.ph05_tenant_policy_value_candidates(tenant_id,policy_code,numeric_value,source_id)
  VALUES('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UNDEFINED_SETTING',1,
  'b5555555-5555-4555-8555-555555555555');
  RAISE EXCEPTION 'CF04_INVALID_POLICY_SCHEMA_ACCEPTED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF tto.ph05_proxy_baseline_review(3)<>'REVIEW_ONLY'
 OR tto.ph05_proxy_baseline_review(4)<>'BLOCKED'
 OR tto.ph05_proxy_baseline_review(NULL)<>'BLOCKED'
 OR tto.ph05_two_stage_review(500)<>'REVIEW_ONLY'
 OR tto.ph05_two_stage_review(501)<>'TWO_STAGE'
 OR tto.ph05_two_stage_review(NULL)<>'BLOCKED'
 THEN RAISE EXCEPTION 'CF04_PROXY_OR_TWO_STAGE_BASELINE_INVALID';END IF;
END $t$;
INSERT INTO tto.ph05_legal_gates(gate_code,gate_status) VALUES('TEST_RULE','OPEN');
DO $t$ BEGIN
 IF tto.ph05_rule_candidate_asof('TEST_RULE',now())<>'BLOCKED'
 THEN RAISE EXCEPTION 'CF04_OPEN_GATE_FAILED_CLOSED';END IF;
END $t$;
SELECT 'PH05_CORE_RULE_AT001_INVALID_SOURCE_REJECT_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT002_FUTURE_VERSION_NOT_EARLY_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT003_HISTORICAL_RULE_SNAPSHOT_RETAINED_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT004_OPEN_GATE_BLOCKED_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT005_TENANT_SCHEMA_OVERRIDE_REJECT_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT006_PROXY_SYNTHETIC_MAX3_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT007_SYNTHETIC_TWO_STAGE_ABOVE500_PASS' AS signal;
SELECT 'PH05_CORE_RULE_AT008_OLD_RULE_VERSION_QUERYABLE_PASS' AS signal;
ROLLBACK;
