-- Executed against an isolated PostgreSQL 17 container as postgres; tests switch to nonprivileged tto_app.
\set ON_ERROR_STOP on
INSERT INTO tto.user_accounts(user_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','Synthetic Cooperative A','ACTIVE'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tenant-b','Synthetic Cooperative B','ACTIVE');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code) VALUES
 ('aaaa1111-1111-4111-8111-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','COOPERATIVE_MANAGER'),
 ('bbbb2222-2222-4222-8222-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','MEMBER');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status) VALUES
 ('33333333-3333-4333-8333-333333333331','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A member notice','MEMBER','PUBLISHED'),
 ('33333333-3333-4333-8333-333333333332','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic B member notice','MEMBER','PUBLISHED'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A restricted','RESTRICTED','PUBLISHED'),
 ('33333333-3333-4333-8333-333333333334','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A highly restricted','HIGHLY_RESTRICTED','PUBLISHED');
-- app may not directly read session, role assignment, file-object or audit tables.
DO $t$ BEGIN
 IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname='tto_app') THEN
   RAISE EXCEPTION 'APP_ROLE_CAN_BYPASS_RLS';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='tto' AND c.relname IN ('tenants','documents','relationship_projections',
          'file_objects','document_versions','evidence_references','audit_events')
     AND c.relrowsecurity AND c.relforcerowsecurity)<>7 THEN
   RAISE EXCEPTION 'TENANT_TABLE_WITHOUT_FORCED_RLS';
 END IF;
 IF has_table_privilege('tto_app','tto.file_objects','SELECT') OR
    has_table_privilege('tto_app','tto.audit_events','SELECT') OR
    has_table_privilege('tto_app','tto.role_assignments','SELECT') OR
    has_table_privilege('tto_app','tto.user_sessions','SELECT') THEN
   RAISE EXCEPTION 'SENSITIVE_TABLE_EXPOSED';
 END IF;
END $t$;
SET ROLE tto_app;
-- No context => zero, including after a prior rollback and pooled role context reuse.
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.documents)<>0 OR (SELECT count(*) FROM tto.tenants)<>0 THEN
   RAISE EXCEPTION 'FAIL_CLOSED_NO_CONTEXT';
 END IF;
END $t$;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.tenants)<>1 THEN RAISE EXCEPTION 'TENANT_A_LOOKUP_FAILED'; END IF;
 IF (SELECT count(*) FROM tto.documents)<>1 THEN RAISE EXCEPTION 'TENANT_A_DOCUMENT_VISIBILITY_FAILED'; END IF;
 IF (SELECT count(*) FROM tto.documents WHERE tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0 THEN
   RAISE EXCEPTION 'CROSS_TENANT_READ';
 END IF;
 IF (SELECT count(*) FROM tto.documents WHERE classification IN ('RESTRICTED','HIGHLY_RESTRICTED'))<>0 THEN
   RAISE EXCEPTION 'CLASSIFICATION_BYPASS';
 END IF;
END $t$;
-- Direct INSERT into other tenant must fail via RLS WITH CHECK.
DO $t$ DECLARE was_denied boolean:=false; BEGIN
 BEGIN
   INSERT INTO tto.documents(document_id,tenant_id,title,classification)
     VALUES('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Forbidden','MEMBER');
 EXCEPTION WHEN insufficient_privilege THEN was_denied:=true;
 END;
 IF NOT was_denied THEN RAISE EXCEPTION 'CROSS_TENANT_WRITE_ALLOWED'; END IF;
END $t$;
-- A valid A-only write is accepted under manager role; rolled back below.
INSERT INTO tto.documents(document_id,tenant_id,title,classification) VALUES
 ('44444444-4444-4444-8444-444444444445','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Allowed in tenant A','MEMBER');
ROLLBACK;
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.documents)<>0 THEN RAISE EXCEPTION 'TRANSACTION_CONTEXT_LEAK'; END IF;
END $t$;
-- A second, unrelated synthetic cooperative/actor can see its own
-- MEMBER-only records but cannot view A or write as a manager.
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
DO $t$ DECLARE denied boolean:=false; BEGIN
 IF (SELECT count(*) FROM tto.tenants)<>1 OR
    (SELECT count(*) FROM tto.documents)<>1 OR
    (SELECT count(*) FROM tto.documents WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0 THEN
   RAISE EXCEPTION 'TENANT_B_READ_ISOLATION_FAILED';
 END IF;
 BEGIN
   INSERT INTO tto.documents(document_id,tenant_id,title,classification)
   VALUES ('44444444-4444-4444-8444-444444444446','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Member tried manager insert','MEMBER');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'TENANT_B_MEMBER_CAN_CREATE_DOCUMENT'; END IF;
END $t$;
ROLLBACK;
-- Tenant B actor cannot acquire A's identity by selecting tenant A context.
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.tenants)<>0 OR
    (SELECT count(*) FROM tto.documents)<>0 THEN
   RAISE EXCEPTION 'TENANT_B_CROSS_CONTEXT_ESCALATION';
 END IF;
END $t$;
ROLLBACK;
-- Actor A may not switch tenant selector to B and gain access.
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.tenants)<>0 OR (SELECT count(*) FROM tto.documents)<>0 THEN
   RAISE EXCEPTION 'TENANT_SELECTION_ESCALATION';
 END IF;
END $t$;
ROLLBACK;
RESET ROLE;
-- Revoked roles fail immediately.
UPDATE tto.role_assignments SET revoked_at=now()
 WHERE user_id='11111111-1111-4111-8111-111111111111';
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.tenants)<>0 OR (SELECT count(*) FROM tto.documents)<>0 THEN
   RAISE EXCEPTION 'REVOKED_ROLE_ACCESS';
 END IF;
END $t$;
ROLLBACK;
RESET ROLE;
-- Schema-only session gate has no issued sessions and must deny.
SET ROLE tto_app;
DO $t$ BEGIN
 IF EXISTS (SELECT 1 FROM tto.resolve_session(decode(repeat('00',32),'hex'))) THEN
   RAISE EXCEPTION 'INVALID_SESSION_ACCEPTED';
 END IF;
END $t$;
RESET ROLE;
SELECT 'TTO_PG17_REAL_RLS_TESTS_PASS' AS result;
