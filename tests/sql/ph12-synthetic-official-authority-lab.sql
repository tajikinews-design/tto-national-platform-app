-- PH12 mock authoritative-source pipeline. TEST-ONLY, DO NOT APPLY AS MIGRATION.
-- Run only against disposable PostgreSQL17 with all project migrations loaded.
-- Every case is wholly synthetic, in pg_temp and rolled back.
-- "SIMULATED_ELIGIBLE" is NOT legal verification, and NEVER creates ACTIVE.
BEGIN;
CREATE TEMP TABLE ph12_mock_official_cases (
 scenario text PRIMARY KEY,
 tenant_key text NOT NULL,
 expected_tenant_key text NOT NULL,
 synthetic_entity_key text NOT NULL,
 expected_entity_key text NOT NULL,
 document_origin text NOT NULL,
 source_hash_valid boolean NOT NULL,
 registry_signature_valid boolean NOT NULL,
 source_fresh boolean NOT NULL,
 source_reachable boolean NOT NULL,
 source_version_current boolean NOT NULL,
 source_revoked boolean NOT NULL,
 resolution_date date NOT NULL,
 board_term_from date NOT NULL,
 board_term_until date NOT NULL,
 signing_power_from date NOT NULL,
 signing_power_until date NOT NULL,
 signatory_revoked boolean NOT NULL,
 required_joint_signers integer NOT NULL,
 distinct_valid_signatures integer NOT NULL,
 quorum_required integer NOT NULL,
 quorum_present integer NOT NULL,
 bylaws_match boolean NOT NULL,
 reviewer_independent boolean NOT NULL,
 expected_assessment text NOT NULL,
 CHECK (synthetic_entity_key LIKE 'SYNTHETIC-%'),
 CHECK (document_origin='SYNTHETIC_TEST_DOCUMENT')
);

CREATE FUNCTION pg_temp.ph12_mock_official_assessment(p_scenario text)
RETURNS text LANGUAGE plpgsql AS $lab$
DECLARE s record;
BEGIN
 SELECT * INTO s FROM pg_temp.ph12_mock_official_cases WHERE scenario=p_scenario;
 IF NOT FOUND THEN RETURN 'MOCK_HOLD_MISSING_CASE';END IF;
 IF s.tenant_key<>s.expected_tenant_key OR
    s.synthetic_entity_key<>s.expected_entity_key
 THEN RETURN 'MOCK_HOLD_CROSS_ENTITY_OR_TENANT';END IF;
 IF NOT s.source_reachable THEN RETURN 'MOCK_HOLD_SOURCE_UNAVAILABLE';END IF;
 IF NOT s.registry_signature_valid OR NOT s.source_hash_valid
 THEN RETURN 'MOCK_HOLD_PROVENANCE_INVALID';END IF;
 IF NOT s.source_fresh THEN RETURN 'MOCK_HOLD_SOURCE_EXPIRED';END IF;
 IF NOT s.source_version_current THEN RETURN 'MOCK_HOLD_VERSION_ROLLBACK';END IF;
 IF s.source_revoked THEN RETURN 'MOCK_HOLD_SOURCE_REVOKED';END IF;
 IF s.resolution_date<s.board_term_from OR s.resolution_date>s.board_term_until OR
    s.resolution_date<s.signing_power_from OR s.resolution_date>s.signing_power_until OR
    s.signatory_revoked
 THEN RETURN 'MOCK_HOLD_SIGNING_AUTHORITY';END IF;
 IF s.distinct_valid_signatures<s.required_joint_signers
 THEN RETURN 'MOCK_HOLD_JOINT_SIGNATURES';END IF;
 IF s.quorum_present<s.quorum_required OR NOT s.bylaws_match
 THEN RETURN 'MOCK_HOLD_QUORUM_OR_BYLAWS';END IF;
 IF NOT s.reviewer_independent
 THEN RETURN 'MOCK_HOLD_FOUR_EYES';END IF;
 RETURN 'MOCK_ELIGIBLE_IN_LAB_ONLY';
END $lab$;

-- Coherent fictional reference cooperative and fictional resolution.
-- No published or real cooperative identity, person identity or document.
INSERT INTO pg_temp.ph12_mock_official_cases
(scenario,tenant_key,expected_tenant_key,synthetic_entity_key,expected_entity_key,
 document_origin,source_hash_valid,registry_signature_valid,
 source_fresh,source_reachable,source_version_current,source_revoked,
 resolution_date,board_term_from,board_term_until,signing_power_from,signing_power_until,
 signatory_revoked,required_joint_signers,distinct_valid_signatures,
 quorum_required,quorum_present,bylaws_match,reviewer_independent,expected_assessment)
VALUES
('MOCK_BASELINE','SYN-TENANT-A','SYN-TENANT-A','SYNTHETIC-ENTITY-A','SYNTHETIC-ENTITY-A',
 'SYNTHETIC_TEST_DOCUMENT',true,true,true,true,true,false,
 DATE '2026-10-01',DATE '2026-01-01',DATE '2027-01-01',DATE '2026-01-01',DATE '2027-01-01',
 false,2,2,3,4,true,true,'MOCK_ELIGIBLE_IN_LAB_ONLY');

INSERT INTO pg_temp.ph12_mock_official_cases
SELECT
  t.scenario,COALESCE(t.tenant_key,b.tenant_key),
  b.expected_tenant_key,COALESCE(t.entity_key,b.synthetic_entity_key),
  b.expected_entity_key,b.document_origin,COALESCE(t.hash_ok,b.source_hash_valid),
  COALESCE(t.signature_ok,b.registry_signature_valid),
  COALESCE(t.fresh,b.source_fresh),COALESCE(t.reachable,b.source_reachable),
  COALESCE(t.version_ok,b.source_version_current),
  COALESCE(t.revoked,b.source_revoked),b.resolution_date,
  COALESCE(t.board_start,b.board_term_from),COALESCE(t.board_end,b.board_term_until),
  COALESCE(t.power_start,b.signing_power_from),
  COALESCE(t.power_end,b.signing_power_until),
  COALESCE(t.signer_revoked,b.signatory_revoked),
  b.required_joint_signers,COALESCE(t.sign_count,b.distinct_valid_signatures),
  b.quorum_required,COALESCE(t.quorum_count,b.quorum_present),
  COALESCE(t.bylaws_ok,b.bylaws_match),
  COALESCE(t.four_eyes,b.reviewer_independent),t.expected
FROM pg_temp.ph12_mock_official_cases b
CROSS JOIN (VALUES
 ('TENANT_CROSS','SYN-TENANT-B',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_CROSS_ENTITY_OR_TENANT'),
 ('ENTITY_CROSS',NULL,'SYNTHETIC-ENTITY-B',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_CROSS_ENTITY_OR_TENANT'),
 ('SOURCE_OFFLINE',NULL,NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_SOURCE_UNAVAILABLE'),
 ('WRONG_ISSUER_SIGNATURE',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_PROVENANCE_INVALID'),
 ('TAMPERED_SOURCE_HASH',NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_PROVENANCE_INVALID'),
 ('SOURCE_EXPIRED',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_SOURCE_EXPIRED'),
 ('VERSION_ROLLBACK',NULL,NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_VERSION_ROLLBACK'),
 ('SOURCE_REVOKED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_SOURCE_REVOKED'),
 ('BOARD_TERM_EXPIRED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,DATE '2026-09-01',NULL,NULL,NULL,'MOCK_HOLD_SIGNING_AUTHORITY'),
 ('SIGNING_POWER_EXPIRED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,DATE '2026-09-01',NULL,NULL,'MOCK_HOLD_SIGNING_AUTHORITY'),
 ('SIGNER_REVOKED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_SIGNING_AUTHORITY'),
 ('JOINT_SIGNATURE_MISSING',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'MOCK_HOLD_JOINT_SIGNATURES'),
 ('QUORUM_MISSING',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'MOCK_HOLD_QUORUM_OR_BYLAWS'),
 ('WRONG_BYLAWS',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_QUORUM_OR_BYLAWS'),
 ('SAME_PERSON_REVIEW',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MOCK_HOLD_FOUR_EYES')
 ) AS t(scenario,tenant_key,entity_key,hash_ok,signature_ok,reachable,fresh,
 version_ok,revoked,signer_revoked,board_start,board_end,power_end,sign_count,
 quorum_count,expected)
WHERE b.scenario='MOCK_BASELINE';

-- Additional changes needing a boolean field not represented in the compact fixture matrix.
UPDATE pg_temp.ph12_mock_official_cases SET bylaws_match=false
WHERE scenario='WRONG_BYLAWS';
UPDATE pg_temp.ph12_mock_official_cases SET reviewer_independent=false
WHERE scenario='SAME_PERSON_REVIEW';

DO $assert$
DECLARE r record; observed text; passed integer:=0;
BEGIN
 FOR r IN SELECT scenario,expected_assessment FROM pg_temp.ph12_mock_official_cases LOOP
  observed:=pg_temp.ph12_mock_official_assessment(r.scenario);
  IF observed IS DISTINCT FROM r.expected_assessment THEN
    RAISE EXCEPTION 'PH12_MOCK_MISMATCH case=% expected=% observed=%',r.scenario,r.expected_assessment,observed;
  END IF;
  passed:=passed+1;
 END LOOP;
 IF passed<>16 THEN RAISE EXCEPTION 'PH12_MOCK_EXPECTED_16_SCENARIOS actual=%',passed;END IF;
 IF pg_temp.ph12_mock_official_assessment('MISSING-CASE')<>'MOCK_HOLD_MISSING_CASE'
 THEN RAISE EXCEPTION 'PH12_MOCK_MISSING_FAILCLOSED';END IF;
 RAISE NOTICE 'PH12_MOCK_OFFICIAL_SOURCE_17_CASES_PASS positive=1 negative=16';
END $assert$;
-- Every fixture, function and test result is transaction-local; zero durable data.
ROLLBACK;
