\set ON_ERROR_STOP on
BEGIN;
-- OPS-001 requires separately sourced 108-requirement/47-legacy-test per-item mapping;
-- only the frozen baseline counts and 155 new official IDs can be checked here.
DO $x$ BEGIN IF (SELECT count(*) FROM tto.tenants WHERE slug LIKE 'ph09-test-%')<>2
THEN RAISE EXCEPTION 'OPS001_FIXTURE_SOURCE_MISSING';END IF;END $x$;
SELECT 'PH09_OPS_AT001_SOURCE_TOTALS_ONLY_PARTIAL_MAPPING_NOT_PROVEN';
SELECT set_config('tto.tenant_id','99000000-0000-4000-8000-000000000001',true);
SELECT set_config('tto.actor_id','99100000-0000-4000-8000-000000000002',true);
DO $x$ BEGIN
IF has_table_privilege('tto_app','tto.ph09_grc_cases','SELECT')
OR has_table_privilege('tto_app','tto.ph09_retention_records','SELECT')
OR has_table_privilege('tto_app','tto.ph09_metric_snapshots','SELECT')
THEN RAISE EXCEPTION 'OPS002_CROSS_TENANT_DIRECT_TABLE_READ';END IF;END $x$;
SELECT 'PH09_OPS_AT002_CROSS_TENANT_RESTRICTED_SCHEMA_CHECK_PASS';
DO $x$ BEGIN
IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='tto'
AND table_name LIKE '%wallet_balance%')
OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='tto'
AND table_name IN('wallet','wallets','cash_wallet','cash_wallets'))
THEN RAISE EXCEPTION 'OPS003_CASH_WALLET_TABLE';END IF;END $x$;
SELECT 'PH09_OPS_AT003_NO_CASH_WALLET_TABLE_STATIC_PASS';
-- OPS-004 real backup + restore verification happens in CI outside SQL.
SELECT 'PH09_OPS_AT004_PG_DUMP_RESTORE_ASSERTION_PENDING_CI';
-- OPS-005 migration reconciliation is checked separately in disposable CI.
SELECT 'PH09_OPS_AT005_ALL_MIGRATION_RECONCILIATION_PENDING_CI';
INSERT INTO tto.ph09_release_candidates(candidate_id,source_sha,mandatory_test_total,
 mandatory_test_passed,rollback_verified)
VALUES('99900000-0000-4000-8000-000000000001','PH09_TEST_ONLY',38,37,true);
DO $x$ BEGIN IF tto.ph09_release_allowed('99900000-0000-4000-8000-000000000001')
THEN RAISE EXCEPTION 'OPS006_FAILED_MANDATORY_TEST_RELEASE_ALLOWED';END IF;END $x$;
SELECT 'PH09_OPS_AT006_FAILED_MANDATORY_TEST_BLOCKS_RELEASE_PASS';
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
SELECT gen_random_uuid(),'ph09-scale-'||i,'Synthetic Cooperative '||i,'ACTIVE'
FROM generate_series(1,500) i;
DO $x$ BEGIN IF (SELECT count(*) FROM tto.tenants WHERE slug LIKE 'ph09-scale-%')<>500
THEN RAISE EXCEPTION 'OPS007_CANNOT_CREATE_500_TENANTS';END IF;END $x$;
SELECT 'PH09_OPS_AT007_500_SYNTHETIC_TENANTS_NO_HARD_CAP_PASS';
-- OPS-008 verifies transaction rollback at end of script (and again in CI).
ROLLBACK;
SELECT 'PH09_OPS_AT008_ROLLBACK_TRANSACTION_EXECUTED_PENDING_OUTSIDE_VERIFICATION';
