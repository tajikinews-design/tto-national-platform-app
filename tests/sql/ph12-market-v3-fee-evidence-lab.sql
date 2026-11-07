-- TTO-Share-Market-Spec v3 §§21-26: disposable fee policy source and
-- trade-time snapshot. TEST ONLY: no bank integration, no PAID/WAIVED
-- or official appointment permission. Do NOT add to database/migrations.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE market_v3_disposable.lab_fee_policy_sources(
 tenant_id uuid NOT NULL, fee_id text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 fee_title text NOT NULL,
 legal_fee_type text NOT NULL
   CHECK(legal_fee_type IN('STATUTORY_FEE','COOP_APPROVED_FEE','PLATFORM_SERVICE_FEE')),
 calculation_mode text NOT NULL CHECK(calculation_mode='FIXED'),
 payer_mode text NOT NULL CHECK(payer_mode='BUYER'),
 fixed_amount bigint NOT NULL CHECK(fixed_amount>0),
 approval_reference text NOT NULL,
 legal_basis_reference text NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 evidence_status text NOT NULL CHECK(evidence_status IN('LAB_TEST_ATTESTED','UNVERIFIED')),
 PRIMARY KEY(tenant_id,fee_id,source_version),
 CHECK(valid_until>valid_from),
 CHECK(length(approval_reference)>=8 AND length(legal_basis_reference)>=8)
);
CREATE TABLE market_v3_disposable.lab_fee_policy_snapshots(
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 fee_id text NOT NULL,
 source_version bigint NOT NULL,
 category text NOT NULL,
 payer_mode text NOT NULL CHECK(payer_mode='BUYER'),
 fee_amount bigint NOT NULL CHECK(fee_amount>0),
 approval_reference text NOT NULL,
 legal_basis_reference text NOT NULL,
 status text NOT NULL DEFAULT 'UNPAID' CHECK(status IN('UNPAID','PAYMENT_REPORTED','DISPUTED')),
 snapshot_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,buy_request_id,fee_id),
 FOREIGN KEY(tenant_id,buy_request_id)
  REFERENCES market_v3_disposable.buy_requests(tenant_id,buy_request_id),
 FOREIGN KEY(tenant_id,fee_id,source_version)
  REFERENCES market_v3_disposable.lab_fee_policy_sources(tenant_id,fee_id,source_version)
);
CREATE TABLE market_v3_disposable.lab_fee_payment_reports(
 report_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 fee_id text NOT NULL,
 payer_id uuid NOT NULL,
 amount bigint NOT NULL CHECK(amount>0),
 external_reference text NOT NULL,
 beneficiary_reference text NOT NULL CHECK(beneficiary_reference LIKE 'TEST-COOP-%'),
 idempotency_key text NOT NULL,
 status text NOT NULL CHECK(status='UNVERIFIED_EXTERNAL_FEE_REPORT'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,buy_request_id,fee_id),
 UNIQUE(tenant_id,payer_id,idempotency_key),
 FOREIGN KEY(tenant_id,buy_request_id,fee_id)
  REFERENCES market_v3_disposable.lab_fee_policy_snapshots(tenant_id,buy_request_id,fee_id),
 FOREIGN KEY(tenant_id,payer_id)
  REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TRIGGER lab_fee_payment_reports_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_fee_payment_reports
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
INSERT INTO market_v3_disposable.lab_fee_policy_sources
 (tenant_id,fee_id,source_version,fee_title,legal_fee_type,calculation_mode,
  payer_mode,fixed_amount,approval_reference,legal_basis_reference,
  valid_from,valid_until,evidence_status)
 VALUES('91111111-1111-4111-8111-111111111111','TEST-COOP-TRANSFER-ADMIN',1,
  'Test cooperative transfer processing fee; NOT a statutory claim',
  'COOP_APPROVED_FEE','FIXED','BUYER',300,'TEST-COOP-RESOLUTION-2026',
  'TEST-COOPERATIVE-FEE-BASIS','2026-01-01','2028-01-01','LAB_TEST_ATTESTED');
COMMIT;
