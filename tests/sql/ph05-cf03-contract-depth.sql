-- Source-specific CF03 authorization/version/evidence tests on disposable PostgreSQL17.
-- These are SQL-boundary assertions, not scanner object storage or HTTP E2E.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('a1111111-1111-4111-8111-111111111111'),
 ('a2222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ph05-advanced-doc-a','Synthetic A','ACTIVE'),
 ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2','ph05-advanced-doc-b','Synthetic B','ACTIVE');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code)
 VALUES('a3333333-3333-4333-8333-333333333333',
 'a1111111-1111-4111-8111-111111111111',
 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','COOPERATIVE_MANAGER');
INSERT INTO tto.file_objects(file_object_id,tenant_id,storage_key,sha256,classification,scan_status)
 VALUES
 ('a4444444-4444-4444-8444-444444444441','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'quarantine/advanced-file-a-1',decode(repeat('11',32),'hex'),'MEMBER','PENDING'),
 ('a4444444-4444-4444-8444-444444444442','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'quarantine/advanced-file-a-2',decode(repeat('22',32),'hex'),'MEMBER','PENDING'),
 ('a4444444-4444-4444-8444-444444444443','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'quarantine/advanced-infected',decode(repeat('33',32),'hex'),'MEMBER','PENDING'),
 ('a4444444-4444-4444-8444-444444444444','aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'quarantine/advanced-foreign',decode(repeat('44',32),'hex'),'MEMBER','PENDING');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status)
 VALUES('a5555555-5555-4555-8555-555555555555',
 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Versioned test document','MEMBER','DRAFT');
SET LOCAL ROLE tto_scanner;
DO $x$ BEGIN
 IF NOT tto.record_scan_verdict('a4444444-4444-4444-8444-444444444441','SyntheticScanner','v1',decode(repeat('a1',32),'hex'),'CLEAN')
 OR NOT tto.record_scan_verdict('a4444444-4444-4444-8444-444444444442','SyntheticScanner','v1',decode(repeat('a2',32),'hex'),'CLEAN')
 OR NOT tto.record_scan_verdict('a4444444-4444-4444-8444-444444444443','SyntheticScanner','v1',decode(repeat('a3',32),'hex'),'BLOCKED')
 OR NOT tto.record_scan_verdict('a4444444-4444-4444-8444-444444444444','SyntheticScanner','v1',decode(repeat('a4',32),'hex'),'CLEAN')
 THEN RAISE EXCEPTION 'PH05_CF03_SCANNER_ATTESTATION_FAILED'; END IF;
END $x$;
RESET ROLE;
SELECT set_config('tto.actor_id','a1111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF tto.publish_document('a5555555-5555-4555-8555-555555555555',
    'a4444444-4444-4444-8444-444444444441',1)
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT002_PUBLISH_WITHOUT_VERIFIED_AUTHORITY_ALLOWED';END IF;
 IF tto.ph05_can_download_file('a4444444-4444-4444-8444-444444444443')
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT001_INFECTED_FILE_DOWNLOAD_ALLOWED';END IF;
END $x$;
RESET ROLE;
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,
 verified_by,verified_at,valid_until)
 VALUES('a6666666-6666-4666-8666-666666666666',
 'a1111111-1111-4111-8111-111111111111',
 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','DOC_PUBLISH',
 'a7777777-7777-4777-8777-777777777777',
 'a2222222-2222-4222-8222-222222222222',
 now(),now()+interval '1 day');
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF NOT tto.publish_document('a5555555-5555-4555-8555-555555555555',
   'a4444444-4444-4444-8444-444444444441',1)
 THEN RAISE EXCEPTION 'PH05_CF03_APPROVED_VERSION_1_PUBLISH_FAILED';END IF;
 IF NOT tto.publish_document('a5555555-5555-4555-8555-555555555555',
   'a4444444-4444-4444-8444-444444444442',2)
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT003_PUBLISHED_EDIT_NEW_VERSION_FAILED';END IF;
 IF NOT tto.ph05_request_file_access('a4444444-4444-4444-8444-444444444441')
 THEN RAISE EXCEPTION 'PH05_CF03_APPROVED_PUBLISHED_DOC_UNREADABLE';END IF;
 IF tto.ph05_request_file_access('a4444444-4444-4444-8444-444444444444')
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT008_FOREIGN_FILE_ACCESS_ALLOWED';END IF;
END $x$;
RESET ROLE;
DO $x$ BEGIN
 IF (SELECT count(*) FROM tto.document_versions
   WHERE document_id='a5555555-5555-4555-8555-555555555555')<>2
 OR (SELECT count(*) FROM tto.document_publications
   WHERE document_id='a5555555-5555-4555-8555-555555555555')<>2
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT003_VERSION_HISTORY_INCORRECT';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.audit_events WHERE tenant_id=
   'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND event_name='FILE_ACCESS_DENIED'
   AND target_id='a4444444-4444-4444-8444-444444444444')
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT008_DENIAL_AUDIT_MISSING';END IF;
END $x$;
INSERT INTO tto.ph05_evidence_bundle_seals
 (bundle_id,tenant_id,document_id,version_num,file_hash,seal_hash,sealed_by)
 VALUES('a8888888-8888-4888-8888-888888888888',
 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'a5555555-5555-4555-8555-555555555555',1,
 decode(repeat('11',32),'hex'),
 sha256(convert_to('a5555555-5555-4555-8555-555555555555:1:'||repeat('11',32),'UTF8')),
 'a1111111-1111-4111-8111-111111111111');
DO $x$ DECLARE recorded bytea; BEGIN
 SELECT seal_hash INTO recorded FROM tto.ph05_evidence_bundle_seals
 WHERE bundle_id='a8888888-8888-4888-8888-888888888888';
 BEGIN
  UPDATE tto.ph05_evidence_bundle_seals SET seal_hash=decode(repeat('00',32),'hex');
  RAISE EXCEPTION 'PH05_CORE_DOC_AT005_SEAL_TAMPER_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE; END IF;
 END;
 IF recorded IS DISTINCT FROM (SELECT seal_hash FROM tto.ph05_evidence_bundle_seals
  WHERE bundle_id='a8888888-8888-4888-8888-888888888888')
 THEN RAISE EXCEPTION 'PH05_CORE_DOC_AT005_SEAL_HASH_CHANGED';END IF;
END $x$;
SELECT 'PH05_CORE_DOC_AT001_SCANNER_BLOCKED_PHYSICAL_PROOF_PASS' AS signal;
SELECT 'PH05_CORE_DOC_AT002_VERIFIED_DOCUMENT_AUTHORITY_REQUIRED_PASS' AS signal;
SELECT 'PH05_CORE_DOC_AT003_APPROVED_NEW_VERSION_HISTORY_RETAINED_PASS' AS signal;
SELECT 'PH05_CORE_DOC_AT005_SEAL_HASH_IMMUTABLE_PASS' AS signal;
SELECT 'PH05_CORE_DOC_AT008_CROSS_TENANT_DENIAL_AUDITED_PASS' AS signal;
ROLLBACK;
