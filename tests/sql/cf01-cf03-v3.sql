\set ON_ERROR_STOP on
-- ONLY synthetic fixtures and ephemeral PostgreSQL 17, never real-user data.
UPDATE tto.role_assignments SET revoked_at=NULL WHERE user_id='11111111-1111-4111-8111-111111111111';
INSERT INTO tto.user_accounts(user_id) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO tto.platform_operator_authorizations(user_id,approved_by,evidence_id,expires_at)
VALUES('22222222-2222-4222-8222-222222222222',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'33333333-3333-4333-8333-333333333331',now()+interval '1 day');
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
VALUES
('aaaa0001-0001-4001-8001-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ROLE_MANAGEMENT',
'33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day'),
('aaaa0002-0002-4002-8002-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DOC_PUBLISH',
'33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day'),
('aaaa0003-0003-4003-8003-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LEGAL_HOLD',
'33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day');
-- National operator (user B) cannot read any Tenant A detail until JIT independently approved.
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.has_jit_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
  RAISE EXCEPTION 'JIT_AUTO_ALLOWED'; END IF;
 IF (SELECT count(*) FROM tto.documents)<>0 THEN RAISE EXCEPTION 'NATIONAL_SUPERUSER_BYPASS'; END IF;
END $t$;
SELECT tto.request_jit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic review purpose for test',now()+interval '30 min') AS requested_id \gset
COMMIT;
RESET ROLE;
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SELECT tto.decide_jit(:'requested_id'::uuid,true) AS jit_decision \gset
\if :jit_decision
\else
  SELECT 1/0;
\endif
COMMIT;
RESET ROLE;
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF NOT tto.has_jit_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'APPROVED_JIT_DENIED'; END IF;
 IF (SELECT count(*) FROM tto.tenants)<>1 THEN RAISE EXCEPTION 'APPROVED_JIT_TENANT_DENIED'; END IF;
 IF (SELECT count(*) FROM tto.documents)<>1 THEN RAISE EXCEPTION 'JIT_SCOPE_NOT_RESTRICTED_TO_RESTRICTED_DOCS'; END IF;
END $t$;
ROLLBACK;
RESET ROLE;
-- Role management needs tenant manager AND verified legal authority.
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.assign_tenant_role('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DOCUMENT_REVIEWER',
 'aaaa0001-0001-4001-8001-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'ROLE_SELF_APPROVAL'; END IF;
 IF NOT tto.assign_tenant_role('22222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DOCUMENT_REVIEWER',
 'aaaa0001-0001-4001-8001-aaaaaaaaaaaa') THEN RAISE EXCEPTION 'ROLE_ASSIGN_DENIED'; END IF;
END $t$;
COMMIT;
RESET ROLE;
-- Scanner principal is separate from the app. No scan client can directly read Tenant files.
INSERT INTO tto.file_objects(file_object_id,tenant_id,storage_key,sha256,classification)
VALUES
('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic-only-key-a',decode(repeat('aa',32),'hex'),'MEMBER'),
('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','synthetic-only-key-b',decode(repeat('bb',32),'hex'),'MEMBER');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status)
VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic publish target','MEMBER','DRAFT');
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.publish_document('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',1)
 THEN RAISE EXCEPTION 'UNSCANNED_DOCUMENT_PUBLISHED'; END IF;
END $t$;
ROLLBACK;
RESET ROLE;
SET ROLE tto_scanner;
DO $t$ BEGIN
 IF NOT tto.record_scan_verdict('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','CI_SYNTHETIC','test-1',decode(repeat('cc',32),'hex'),'CLEAN')
 THEN RAISE EXCEPTION 'CLEAN_ATTESTATION_REJECTED'; END IF;
 IF NOT tto.record_scan_verdict('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','CI_SYNTHETIC','test-1',decode(repeat('cc',32),'hex'),'BLOCKED')
 THEN RAISE EXCEPTION 'BLOCKED_ATTESTATION_REJECTED'; END IF;
 IF tto.record_scan_verdict('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','CI_SYNTHETIC','test-1',decode(repeat('cc',32),'hex'),'CLEAN')
 THEN RAISE EXCEPTION 'SCAN_REPLAY_ALLOWED'; END IF;
END $t$;
RESET ROLE;
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.publish_document('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-ddddddddddd2',1)
 THEN RAISE EXCEPTION 'CROSS_TENANT_FILE_PUBLISHED'; END IF;
 IF NOT tto.publish_document('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',1)
 THEN RAISE EXCEPTION 'CLEAN_DOCUMENT_PUBLISH_DENIED'; END IF;
 IF tto.place_legal_hold('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'LEGAL-TEST-2026','Synthetic preservation review') IS NULL
 THEN RAISE EXCEPTION 'AUTHORISED_LEGAL_HOLD_DENIED'; END IF;
END $t$;
COMMIT;
RESET ROLE;
DO $t$ DECLARE denied boolean:=false; BEGIN
 BEGIN DELETE FROM tto.documents WHERE document_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'NEW_DOCUMENT_HOLD_BYPASS'; END IF;
 IF (SELECT count(*) FROM tto.document_versions WHERE document_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')<>1
 OR (SELECT count(*) FROM tto.document_publications WHERE document_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')<>1 THEN
 RAISE EXCEPTION 'DOCUMENT_VERSION_OR_PUBLICATION_MISSING'; END IF;
END $t$;
-- Tenant lifecycle is never granted directly to app runtime: privileged verified admin only.
INSERT INTO tto.tenants(tenant_id,slug,display_name) VALUES
 ('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa','tenant-c','Synthetic C');
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
VALUES('bbbb0001-0001-4001-8001-bbbbbbbbbbbb',
'11111111-1111-4111-8111-111111111111',
'cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa','TENANT_LIFECYCLE',
'33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day');
DO $t$ BEGIN
 IF tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa','PROVISIONING','ACTIVE',1,'11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'ILLEGAL_TENANT_TRANSITION'; END IF;
 IF NOT tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa','PROVISIONING','SETUP_PENDING',1,'11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'LEGAL_TENANT_TRANSITION_FAILED'; END IF;
 IF tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa','SETUP_PENDING','ACTIVE',1,'11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'STALE_TENANT_VERSION_ACCEPTED'; END IF;
END $t$;
-- Party merge links old to current without moving member/share records or deleting historical Party.
INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
('cccc1111-1111-4111-8111-cccccccccccc','PERSON','Synthetic Old Party'),
('cccc2222-2222-4222-8222-cccccccccccc','PERSON','Synthetic Current Party');
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
VALUES('bbbb0002-0002-4002-8002-bbbbbbbbbbbb',
'11111111-1111-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PARTY_MERGE',
'33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',now(),now()+interval '1 day');
DO $t$ BEGIN
 IF NOT tto.merge_party_alias('cccc1111-1111-4111-8111-cccccccccccc','cccc2222-2222-4222-8222-cccccccccccc',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'PARTY_ALIAS_MERGE_FAILED'; END IF;
 IF tto.merge_party_alias('cccc1111-1111-4111-8111-cccccccccccc','cccc2222-2222-4222-8222-cccccccccccc',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'PARTY_MERGE_REPLAY_ALLOWED'; END IF;
 IF (SELECT count(*) FROM tto.parties WHERE party_id IN
 ('cccc1111-1111-4111-8111-cccccccccccc','cccc2222-2222-4222-8222-cccccccccccc'))<>2
 THEN RAISE EXCEPTION 'PARTY_HISTORY_DESTROYED'; END IF;
END $t$;
SELECT 'TTO_CF01_03_V3_LIFECYCLE_AND_DOCUMENT_PASS' AS result;
