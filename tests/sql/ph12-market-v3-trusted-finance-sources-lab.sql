-- Phase12 v3 §§21-25: ephemeral PostgreSQL fixture for source-bound fee bases,
-- revocable scoped finance mandates, and simulated bank-statement checks.
-- LAB ONLY: no statutory validation, real accounts, real funds or legal PAID.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE market_v3_disposable.lab_fee_policy_snapshots
 ADD COLUMN verified_custom_base_amount bigint,
 ADD COLUMN custom_base_source_version bigint,
 ADD COLUMN custom_base_source_reference text,
 ADD CONSTRAINT custom_base_source_snapshot_consistent CHECK (
   (verified_custom_base_amount IS NULL AND custom_base_source_version IS NULL
    AND custom_base_source_reference IS NULL) OR
   (verified_custom_base_amount>0 AND custom_base_source_version>0
    AND length(custom_base_source_reference)>=8)
 );
CREATE TABLE market_v3_disposable.lab_custom_fee_base_sources(
 tenant_id uuid NOT NULL,
 offer_id uuid NOT NULL,
 fee_id text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 base_amount bigint NOT NULL CHECK(base_amount>0),
 source_reference text NOT NULL CHECK(length(source_reference)>=8),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 evidence_state text NOT NULL CHECK(evidence_state IN('LAB_TEST_ATTESTED','REVOKED','UNVERIFIED')),
 PRIMARY KEY(tenant_id,offer_id,fee_id,source_version),
 FOREIGN KEY(offer_id,tenant_id) REFERENCES market_v3_disposable.offers(offer_id,tenant_id),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.lab_finance_mandates(
 tenant_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,
 mandate_version bigint NOT NULL CHECK(mandate_version>0),
 mandate_reference text NOT NULL CHECK(length(mandate_reference)>=8),
 scope text NOT NULL CHECK(scope='FEE_DOCUMENTARY_REVIEW_TEST_ONLY'),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN('LAB_ATTESTED','LAB_REVOKED','UNVERIFIED')),
 PRIMARY KEY(tenant_id,reviewer_id,mandate_version),
 FOREIGN KEY(tenant_id,reviewer_id)
 REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.lab_coop_statement_sources(
 tenant_id uuid NOT NULL,
 source_reference text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 external_reference text NOT NULL,
 beneficiary_reference text NOT NULL CHECK(beneficiary_reference='TEST-COOP-ACCOUNT-001'),
 settled_amount bigint NOT NULL CHECK(settled_amount>0),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 evidence_state text NOT NULL CHECK(evidence_state IN('LAB_TEST_ATTESTED','REVOKED')),
 PRIMARY KEY(tenant_id,source_reference,source_version),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.lab_coop_receipt_checks(
 check_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 report_id uuid NOT NULL UNIQUE REFERENCES market_v3_disposable.lab_fee_component_reports(report_id),
 reviewer_id uuid NOT NULL,
 mandate_version bigint NOT NULL,
 source_reference text NOT NULL,
 source_version bigint NOT NULL,
 result text NOT NULL CHECK(result='LAB_REFERENCE_MATCHED_NOT_OFFICIAL_PAID'),
 idempotency_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,reviewer_id,idempotency_key),
 FOREIGN KEY(tenant_id,reviewer_id,mandate_version)
 REFERENCES market_v3_disposable.lab_finance_mandates(tenant_id,reviewer_id,mandate_version),
 FOREIGN KEY(tenant_id,source_reference,source_version)
 REFERENCES market_v3_disposable.lab_coop_statement_sources(tenant_id,source_reference,source_version)
);
CREATE TRIGGER lab_coop_receipt_checks_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_coop_receipt_checks
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
INSERT INTO market_v3_disposable.lab_finance_mandates
 (tenant_id,reviewer_id,mandate_version,mandate_reference,scope,valid_from,valid_until,state)
 VALUES('91111111-1111-4111-8111-111111111111',
 'aeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',1,
 'TEST-FINANCE-MANDATE-v1','FEE_DOCUMENTARY_REVIEW_TEST_ONLY',
 '2026-01-01','2028-01-01','LAB_ATTESTED');
INSERT INTO market_v3_disposable.lab_coop_statement_sources
 (tenant_id,source_reference,source_version,external_reference,beneficiary_reference,
 settled_amount,valid_from,valid_until,evidence_state)
 VALUES('91111111-1111-4111-8111-111111111111',
 'TEST-BANK-SOURCE-STATEMENT-001',1,'TEST-SELLER-FEE-REPORT-001',
 'TEST-COOP-ACCOUNT-001',250,'2026-01-01','2028-01-01','LAB_TEST_ATTESTED');
COMMIT;
