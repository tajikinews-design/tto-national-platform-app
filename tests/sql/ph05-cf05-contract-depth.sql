-- CF05 extended synthetic failures; NONE of these contact a real provider/bank.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ph05-provider-a','A','ACTIVE'),
       ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','ph05-provider-b','B','ACTIVE');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 VALUES('c1111111-1111-4111-8111-111111111111',
 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','PH05_TEST_ONLY',
 'c2222222-2222-4222-8222-222222222222');
INSERT INTO tto.ph05_payment_evidence_reports
 (report_id,tenant_id,business_reference,evidence_id)
 VALUES('c3333333-3333-4333-8333-333333333333',
 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'c4444444-4444-4444-8444-444444444444',
 'c1111111-1111-4111-8111-111111111111');
INSERT INTO tto.ph05_notification_delivery_fixtures(job_id,tenant_id,business_ref,delivery_status)
 VALUES('c5555555-5555-4555-8555-555555555555',
 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'c4444444-4444-4444-8444-444444444444','FAILED');
INSERT INTO tto.ph05_integration_credential_refs
 (credential_id,tenant_id,integration_code,external_secret_ref)
 VALUES('c6666666-6666-4666-8666-666666666666',
 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'BANK_SANDBOX','vault://synthetic-only-A-credential');
DO $t$ BEGIN
 IF NOT tto.ph05_credential_tenant_match(
  'c6666666-6666-4666-8666-666666666666',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
 OR tto.ph05_credential_tenant_match(
  'c6666666-6666-4666-8666-666666666666',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')
 THEN RAISE EXCEPTION 'CF05_CROSS_TENANT_CREDENTIAL_SCOPE_FAILURE';END IF;
 IF (SELECT count(*) FROM tto.ph05_payment_evidence_reports
 WHERE report_id='c3333333-3333-4333-8333-333333333333'
 AND status='REPORTED' AND business_finalized=false)<>1
 THEN RAISE EXCEPTION 'CF05_NOTIFICATION_FAILURE_ROLLED_BACK_BUSINESS_EVIDENCE';END IF;
 IF has_table_privilege('tto_app','tto.ph05_integration_credential_refs','SELECT')
 OR has_table_privilege('tto_app','tto.ph05_notification_delivery_fixtures','UPDATE')
 THEN RAISE EXCEPTION 'CF05_APP_CAN_READ_PROVIDER_REF_OR_FORGE_DELIVERY';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables
  WHERE table_schema='tto' AND table_name LIKE '%wallet%')
 THEN RAISE EXCEPTION 'CF05_TTO_SCHEMA_WALLET_PRESENT';END IF;
END $t$;
SELECT 'PH05_CORE_INT_AT005_SYNTHETIC_FAILED_DELIVERY_ISOLATED_PASS' AS signal;
SELECT 'PH05_CORE_INT_AT006_TENANT_CREDENTIAL_REF_SCOPE_DENIES_FOREIGN_PASS' AS signal;
SELECT 'PH05_CORE_INT_AT007_NO_WALLET_IN_TTO_SQL_SCHEMA_PASS' AS signal;
ROLLBACK;
