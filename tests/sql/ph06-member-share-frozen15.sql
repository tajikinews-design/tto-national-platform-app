-- PH06 exact source-ID synthetic security assertions; PG17 throw on every violation.
-- No share transfer; all inserts rolled back. Exact individual source scenarios
-- are derived from locked Child06/07 invariants, not verbatim per-test wording.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
('a6111111-1111-4111-8111-111111111111'),
('a6222222-2222-4222-8222-222222222222'),
('a6333333-3333-4333-8333-333333333333');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
('a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ph06-test-a','PH06 Synthetic Tenant A','ACTIVE'),
('a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','ph06-test-b','PH06 Synthetic Tenant B','ACTIVE');
INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
('a6444444-4444-4444-8444-444444444441','PERSON','Synthetic Seller'),
('a6444444-4444-4444-8444-444444444442','PERSON','Synthetic Buyer'),
('a6444444-4444-4444-8444-444444444443','PERSON','Synthetic Stranger');
INSERT INTO tto.user_party_links(user_id,party_id,verified_at) VALUES
('a6111111-1111-4111-8111-111111111111','a6444444-4444-4444-8444-444444444441',now()),
('a6222222-2222-4222-8222-222222222222','a6444444-4444-4444-8444-444444444442',now()),
('a6333333-3333-4333-8333-333333333333','a6444444-4444-4444-8444-444444444443',now());
INSERT INTO tto.ph06_shareholder_accounts(account_id,tenant_id,party_id) VALUES
('a6555555-5555-4555-8555-555555555551','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','a6444444-4444-4444-8444-444444444441'),
('a6555555-5555-4555-8555-555555555552','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','a6444444-4444-4444-8444-444444444442'),
('a6555555-5555-4555-8555-555555555553','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','a6444444-4444-4444-8444-444444444443');
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.ph06_membership_current) THEN
  RAISE EXCEPTION 'MEMBER001_PARTY_IMPLICITLY_CREATED_MEMBERSHIP';END IF;
END $x$;
SELECT 'PH06_MEMBER_AT001_PARTY_NOT_MEMBERSHIP_PASS' AS signal;
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.ph06_ownership_ledger) THEN
 RAISE EXCEPTION 'MEMBER002_SHAREHOLDER_ACCOUNT_IMPLICIT_OWNERSHIP';END IF;
END $x$;
SELECT 'PH06_MEMBER_AT002_ACCOUNT_NOT_OWNERSHIP_PASS' AS signal;
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.role_assignments
 WHERE user_id='a6222222-2222-4222-8222-222222222222') OR
 EXISTS(SELECT 1 FROM tto.ph06_membership_current
 WHERE party_id='a6444444-4444-4444-8444-444444444442') THEN
 RAISE EXCEPTION 'MEMBER003_NONMEMBER_INHERITED_ROLE_OR_MEMBERSHIP';END IF;
END $x$;
SELECT 'PH06_MEMBER_AT003_NONMEMBER_NO_VOTE_OR_ROLE_INFERENCE_PASS' AS signal;
SELECT set_config('tto.actor_id','a6111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF (SELECT count(*) FROM tto.ph06_own_shareholder_accounts())<>1
 OR NOT EXISTS(SELECT 1 FROM tto.ph06_own_shareholder_accounts()
 WHERE party_id='a6444444-4444-4444-8444-444444444441')
 THEN RAISE EXCEPTION 'MEMBER004_SELF_SERVICE_LEAK';END IF;
END $x$;
RESET ROLE;
SELECT 'PH06_MEMBER_AT004_OWN_ONLY_ACCOUNT_READ_PASS' AS signal;
SELECT set_config('tto.tenant_id','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.ph06_own_shareholder_accounts())
 THEN RAISE EXCEPTION 'MEMBER005_CROSS_TENANT_ACCOUNT_READ';END IF;
END $x$;
RESET ROLE;
SELECT 'PH06_MEMBER_AT005_CROSS_TENANT_ACCOUNT_DENIED_PASS' AS signal;
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 VALUES('a6666666-6666-4666-8666-666666666666',
 'a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','PH06_SYNTHETIC_MEMBERSHIP_DECISION',
 'a6777777-7777-4777-8777-777777777777');
INSERT INTO tto.ph06_membership_applications(application_id,tenant_id,party_id)
 VALUES('a6888888-8888-4888-8888-888888888888',
 'a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'a6444444-4444-4444-8444-444444444441');
DO $x$ BEGIN
 IF NOT tto.ph06_decide_membership(
 'a6888888-8888-4888-8888-888888888888',1,true,
 'a6333333-3333-4333-8333-333333333333',
 'a6666666-6666-4666-8666-666666666666','PH06_TESTED_SOURCE_EVENT')
 OR tto.ph06_decide_membership(
 'a6888888-8888-4888-8888-888888888888',1,true,
 'a6333333-3333-4333-8333-333333333333',
 'a6666666-6666-4666-8666-666666666666','PH06_TESTED_SOURCE_EVENT')
 THEN RAISE EXCEPTION 'MEMBER006_APPLICATION_IDEMPOTENCY_FAILURE';END IF;
 IF (SELECT count(*) FROM tto.ph06_membership_events
 WHERE application_id='a6888888-8888-4888-8888-888888888888')<>1
 THEN RAISE EXCEPTION 'MEMBER006_SECOND_SOURCE_EVENT';END IF;
END $x$;
SELECT 'PH06_MEMBER_AT006_IDEMPOTENT_DECISION_PASS' AS signal;
DO $x$ BEGIN
 IF (SELECT source_version FROM tto.ph06_membership_current
 WHERE party_id='a6444444-4444-4444-8444-444444444441')<>1
 THEN RAISE EXCEPTION 'MEMBER007_SOURCE_VERSION_NOT_MONOTONIC';END IF;
 BEGIN
 DELETE FROM tto.ph06_membership_events
 WHERE application_id='a6888888-8888-4888-8888-888888888888';
 RAISE EXCEPTION 'MEMBER007_SOURCE_HISTORY_HARD_DELETE_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
END $x$;
SELECT 'PH06_MEMBER_AT007_IMMUTABLE_MEMBERSHIP_HISTORY_PASS' AS signal;
INSERT INTO tto.ph06_ownership_ledger(ledger_id,tenant_id,party_id,delta_shares,source_kind,source_reference)
 VALUES('a6999999-9999-4999-8999-999999999999',
 'a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'a6444444-4444-4444-8444-444444444441',10,
 'OPENING_VERIFIED','a6bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.ph06_transfer_cases
(case_id,tenant_id,seller_party_id,buyer_party_id,requested_quantity)
 VALUES
 ('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'a6444444-4444-4444-8444-444444444441',
 'a6444444-4444-4444-8444-444444444442',7),
 ('a6cccccc-cccc-4ccc-8ccc-ccccccccccc2',
 'a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
 'a6444444-4444-4444-8444-444444444441',
 'a6444444-4444-4444-8444-444444444442',6);
DO $x$ BEGIN
 IF tto.ph06_try_finalize_transfer('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'a6111111-1111-4111-8111-111111111111') THEN
 RAISE EXCEPTION 'SHARE001_TRANSFER_WITHOUT_VALUATION_ALLOWED';END IF;
END $x$;
SELECT 'PH06_SHARE_AT001_MISSING_VALUATION_FAIL_CLOSED_PASS' AS signal;
DO $x$ BEGIN
 IF tto.ph06_try_finalize_transfer('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'a6222222-2222-4222-8222-222222222222') THEN
 RAISE EXCEPTION 'SHARE002_NO_POST_TRANSFER_CAP_SOURCE_ALLOWED';END IF;
END $x$;
SELECT 'PH06_SHARE_AT002_OWNERSHIP_CAP_UNSOURCED_FAIL_CLOSED_PASS' AS signal;
DO $x$ BEGIN
 IF NOT tto.ph06_try_lock_shares('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
   'a6dddddd-dddd-4ddd-8ddd-ddddddddddd1')
 OR tto.ph06_try_lock_shares('a6cccccc-cccc-4ccc-8ccc-ccccccccccc2',
   'a6dddddd-dddd-4ddd-8ddd-ddddddddddd2')
 THEN RAISE EXCEPTION 'SHARE003_LOCK_OVERBOOKING';END IF;
 IF (SELECT sum(quantity) FROM tto.ph06_share_locks WHERE state='ACTIVE')<>7
 THEN RAISE EXCEPTION 'SHARE003_INCORRECT_LOCK_QUANTITY';END IF;
END $x$;
SELECT 'PH06_SHARE_AT003_SHARE_LOCK_CAPACITY_PASS' AS signal;
UPDATE tto.ph06_transfer_cases SET state='PAYMENT_VERIFIED'
 WHERE case_id='a6cccccc-cccc-4ccc-8ccc-ccccccccccc1';
DO $x$ BEGIN
 IF (SELECT count(*) FROM tto.ph06_ownership_ledger)<>1
 OR tto.ph06_try_finalize_transfer('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'a6222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'SHARE004_PAYMENT_CHANGED_OWNERSHIP';END IF;
END $x$;
SELECT 'PH06_SHARE_AT004_PAYMENT_VERIFIED_NOT_TRANSFER_PASS' AS signal;
DO $x$ BEGIN
 IF tto.ph06_try_finalize_transfer('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
 'a6111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'SHARE005_SELF_APPROVAL_WITHOUT_SOD';END IF;
 BEGIN
 UPDATE tto.ph06_transfer_cases SET state='TRANSFERRED'
 WHERE case_id='a6cccccc-cccc-4ccc-8ccc-ccccccccccc1';
 RAISE EXCEPTION 'SHARE005_DIRECT_TRANSFER_FINALIZATION_ALLOWED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $x$;
SELECT 'PH06_SHARE_AT005_FINALIZATION_NO_AUTHORITY_SOD_DENIED_PASS' AS signal;
DO $x$ BEGIN
 BEGIN
 UPDATE tto.ph06_ownership_ledger SET delta_shares=999;
 RAISE EXCEPTION 'SHARE006_LEDGER_MUTABLE';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
 IF tto.ph06_try_finalize_transfer('a6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'a6222222-2222-4222-8222-222222222222') THEN
 RAISE EXCEPTION 'SHARE006_DUPLICATE_FINALIZATION';END IF;
END $x$;
SELECT 'PH06_SHARE_AT006_APPEND_ONLY_LEDGER_AND_NO_FINALIZATION_PASS' AS signal;
SELECT set_config('tto.actor_id','a6333333-3333-4333-8333-333333333333',true);
SELECT set_config('tto.tenant_id','a6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true);
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.ph06_my_transfer_cases())
 THEN RAISE EXCEPTION 'SHARE007_STRANGER_READ_OTHERS_CASE';END IF;
 IF has_table_privilege('tto_app','tto.ph06_transfer_cases','SELECT')
 OR has_table_privilege('tto_app','tto.ph06_ownership_ledger','INSERT')
 THEN RAISE EXCEPTION 'SHARE007_DIRECT_APP_ACCESS_TO_PRIVATE_DOMAIN';END IF;
END $x$;
RESET ROLE;
SELECT set_config('tto.actor_id','a6111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE tto_app;
DO $x$ BEGIN
 IF (SELECT count(*) FROM tto.ph06_my_transfer_cases())<>2
 THEN RAISE EXCEPTION 'SHARE007_SELLER_CANNOT_VIEW_OWN_CASES';END IF;
END $x$;
RESET ROLE;
SELECT 'PH06_SHARE_AT007_OWN_CASE_SCOPE_AND_APP_DENY_PASS' AS signal;
DO $x$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.tables
 WHERE table_schema='tto' AND table_name LIKE 'ph06%wallet%')
 OR EXISTS(SELECT 1 FROM information_schema.tables
 WHERE table_schema='tto' AND table_name LIKE 'ph06%fund_reservation%')
 OR (SELECT sum(delta_shares) FROM tto.ph06_ownership_ledger
 WHERE party_id='a6444444-4444-4444-8444-444444444441')<>10
 THEN RAISE EXCEPTION 'SHARE008_WALLET_OR_PAYMENT_SIDE_EFFECT';END IF;
END $x$;
SELECT 'PH06_SHARE_AT008_NO_CASH_WALLET_NO_SETTLEMENT_PASS' AS signal;
ROLLBACK;
SELECT 'PH06_15_SYNTHETIC_CASES_ROLLED_BACK_NO_REAL_SHARES' AS signal;
