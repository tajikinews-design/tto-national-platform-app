-- CF03 source-aligned bounded negative tests, disposable PG17, ROLLBACK.
-- NOT a real malware scanner, file storage signed URL, or full source acceptance.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES('81111111-1111-4111-8111-111111111111');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph05-file-a','Test A','ACTIVE'),
 ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ph05-file-b','Test B','ACTIVE');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code)
 VALUES('82222222-2222-4222-8222-222222222222','81111111-1111-4111-8111-111111111111',
 '8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMBER');
INSERT INTO tto.file_objects(file_object_id,tenant_id,storage_key,sha256,classification,scan_status)
 VALUES
 ('83333333-3333-4333-8333-333333333331','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph05/private/a/clean',decode(repeat('11',32),'hex'),'MEMBER','CLEAN'),
 ('83333333-3333-4333-8333-333333333332','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph05/private/a/infected',decode(repeat('22',32),'hex'),'MEMBER','BLOCKED'),
 ('83333333-3333-4333-8333-333333333333','8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ph05/private/b/clean',decode(repeat('33',32),'hex'),'MEMBER','CLEAN'),
 ('83333333-3333-4333-8333-333333333334','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph05/private/a/unpublished',decode(repeat('44',32),'hex'),'MEMBER','CLEAN');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES
 ('84444444-4444-4444-8444-444444444441','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A clean','MEMBER','PUBLISHED'),
 ('84444444-4444-4444-8444-444444444442','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A infected','MEMBER','PUBLISHED'),
 ('84444444-4444-4444-8444-444444444443','8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B clean','MEMBER','PUBLISHED'),
 ('84444444-4444-4444-8444-444444444444','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A draft','MEMBER','DRAFT');
INSERT INTO tto.document_versions(document_id,tenant_id,version_num,file_object_id) VALUES
 ('84444444-4444-4444-8444-444444444441','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'83333333-3333-4333-8333-333333333331'),
 ('84444444-4444-4444-8444-444444444442','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'83333333-3333-4333-8333-333333333332'),
 ('84444444-4444-4444-8444-444444444443','8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'83333333-3333-4333-8333-333333333333'),
 ('84444444-4444-4444-8444-444444444444','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'83333333-3333-4333-8333-333333333334');
INSERT INTO tto.document_publications(document_id,version_num,publisher_id) VALUES
 ('84444444-4444-4444-8444-444444444441',1,'81111111-1111-4111-8111-111111111111'),
 ('84444444-4444-4444-8444-444444444442',1,'81111111-1111-4111-8111-111111111111'),
 ('84444444-4444-4444-8444-444444444443',1,'81111111-1111-4111-8111-111111111111');
INSERT INTO tto.document_scans(file_object_id,scanner_name,scanner_version,scan_evidence_hash,verdict) VALUES
 ('83333333-3333-4333-8333-333333333331','PH05_SYNTHETIC','1',decode(repeat('a1',32),'hex'),'CLEAN'),
 ('83333333-3333-4333-8333-333333333332','PH05_SYNTHETIC','1',decode(repeat('a2',32),'hex'),'BLOCKED'),
 ('83333333-3333-4333-8333-333333333333','PH05_SYNTHETIC','1',decode(repeat('a3',32),'hex'),'CLEAN'),
 ('83333333-3333-4333-8333-333333333334','PH05_SYNTHETIC','1',decode(repeat('a4',32),'hex'),'CLEAN');
SELECT set_config('tto.actor_id','81111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SET LOCAL ROLE tto_app;
DO $checks$ BEGIN
 IF NOT tto.ph05_can_download_file('83333333-3333-4333-8333-333333333331')
 THEN RAISE EXCEPTION 'CF03_CLEAN_PUBLISHED_SAME_TENANT_DENIED';END IF;
 IF tto.ph05_can_download_file('83333333-3333-4333-8333-333333333332')
 THEN RAISE EXCEPTION 'CF03_MALWARE_BLOCKED_FILE_DOWNLOAD_ALLOWED';END IF;
 IF tto.ph05_can_download_file('83333333-3333-4333-8333-333333333333')
 THEN RAISE EXCEPTION 'CF03_FOREIGN_TENANT_FILE_READ_ALLOWED';END IF;
 IF tto.ph05_can_download_file('83333333-3333-4333-8333-333333333334')
 THEN RAISE EXCEPTION 'CF03_UNPUBLISHED_FILE_READ_ALLOWED';END IF;
 IF tto.ph05_can_download_file('85555555-5555-4555-8555-555555555555')
 THEN RAISE EXCEPTION 'CF03_GUESSED_STORAGE_KEY_ALLOWED';END IF;
END $checks$;
RESET ROLE;
SELECT 'PH05_CF03_AT001_BLOCKED_SCAN_FILE_NO_READ_DECISION_PASS' AS signal;
SELECT 'PH05_CF03_AT004_UNKNOWN_FILE_NO_STORAGE_KEY_READ_PASS' AS signal;
SELECT 'PH05_CF03_AT008_CROSS_TENANT_DOWNLOAD_DECISION_DENIED_PASS' AS signal;
ROLLBACK;
