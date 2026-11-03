-- PH05 CF04 synthetic versioned legal-rule acceptance evidence.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('91111111-1111-4111-8111-111111111111'),
 ('92222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ph05-rule-fixture','Synthetic rule test','ACTIVE');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 VALUES('93333333-3333-4333-8333-333333333333',
 '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'PH05_SYNTHETIC','94444444-4444-4444-8444-444444444444');
INSERT INTO tto.ph05_legal_source_refs
 (source_id,citation,authority_label,evidence_id,verified_by,verified_at)
 VALUES('95555555-5555-4555-8555-555555555555',
 'PH05 SYNTHETIC REFERENCE','Fixture reviewer',
 '93333333-3333-4333-8333-333333333333',
 '92222222-2222-4222-8222-222222222222',now());
INSERT INTO tto.ph05_rule_versions(version_id,rule_code,rule_version,
 source_id,effective_from,candidate_disposition,status,created_by,approved_by)
 VALUES
 ('96666666-6666-4666-8666-666666666661','PH05_RULE',1,
 '95555555-5555-4555-8555-555555555555',now()-interval '2 days',
 'REVIEW_REQUIRED','ACTIVE',
 '91111111-1111-4111-8111-111111111111',
 '92222222-2222-4222-8222-222222222222'),
 ('96666666-6666-4666-8666-666666666662','PH05_RULE',2,
 '95555555-5555-4555-8555-555555555555',now()+interval '1 day',
 'BLOCK','ACTIVE',
 '91111111-1111-4111-8111-111111111111',
 '92222222-2222-4222-8222-222222222222');
DO $test$ BEGIN
 IF tto.ph05_rule_candidate_asof('UNKNOWN',now())<>'BLOCKED'
 OR tto.ph05_rule_candidate_asof('PH05_RULE',now())<>'REVIEW_ONLY'
 OR tto.ph05_rule_candidate_asof('PH05_RULE',now()+interval '2 days')<>'BLOCKED'
 THEN RAISE EXCEPTION 'PH05_CF04_ASOF_VIOLATION';END IF;
END $test$;
INSERT INTO tto.ph05_legal_gates(gate_code,gate_status) VALUES('PH05_RULE','OPEN');
DO $test$ BEGIN
 IF tto.ph05_rule_candidate_asof('PH05_RULE',now())<>'BLOCKED'
 THEN RAISE EXCEPTION 'PH05_CF04_GATE_VIOLATION';END IF;
END $test$;
SELECT 'PH05_CF04_UNKNOWN_AND_FUTURE_FAIL_CLOSED_PASS' AS signal;
SELECT 'PH05_CF04_OPEN_GATE_BLOCK_PASS' AS signal;
ROLLBACK;
