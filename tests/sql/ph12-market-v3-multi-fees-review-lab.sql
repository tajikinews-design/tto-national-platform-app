-- Disposable synthetic fee engine & documentary review; NOT a production migration.
-- v3 §§21-23: FIXED / PERCENTAGE / FIXED_PLUS_PERCENTAGE and BUYER / SELLER / SPLIT.
-- All actual legal fee-payment confirmations and money movement remain prohibited.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE market_v3_disposable.actors DROP CONSTRAINT actors_role_check;
ALTER TABLE market_v3_disposable.actors ADD CONSTRAINT actors_role_check
 CHECK(role IN('SELLER','BUYER','COOP_MARKET_MANAGER','COOP_OPERATOR',
 'BOARD_SECRETARIAT','BOARD_EVIDENCE_REVIEWER','COOP_FINANCE_OPERATOR'));
INSERT INTO market_v3_disposable.actors
 (tenant_id,actor_id,role,status,source_verified)
 VALUES ('91111111-1111-4111-8111-111111111111',
 'aeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','COOP_FINANCE_OPERATOR','ACTIVE',true);
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 DROP CONSTRAINT lab_fee_policy_sources_calculation_mode_check;
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 ADD CONSTRAINT lab_fee_policy_sources_calculation_mode_check
 CHECK(calculation_mode IN('FIXED','PERCENTAGE','FIXED_PLUS_PERCENTAGE'));
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 DROP CONSTRAINT lab_fee_policy_sources_payer_mode_check;
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 ADD CONSTRAINT lab_fee_policy_sources_payer_mode_check
 CHECK(payer_mode IN('BUYER','SELLER','SPLIT'));
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 ALTER COLUMN fixed_amount DROP NOT NULL;
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 DROP CONSTRAINT lab_fee_policy_sources_fixed_amount_check;
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 ADD CONSTRAINT lab_fee_policy_sources_fixed_amount_check
 CHECK(fixed_amount IS NULL OR fixed_amount>=0);
ALTER TABLE market_v3_disposable.lab_fee_policy_sources
 ADD COLUMN percentage_basis text NOT NULL DEFAULT 'TRADE_GROSS_VALUE'
 CHECK(percentage_basis IN('TRADE_GROSS_VALUE','SHARE_VALUE','CUSTOM_APPROVED_BASE')),
 ADD COLUMN percentage_rate_bps integer NOT NULL DEFAULT 0
 CHECK(percentage_rate_bps BETWEEN 0 AND 10000),
 ADD COLUMN buyer_percent integer NOT NULL DEFAULT 100 CHECK(buyer_percent BETWEEN 0 AND 100),
 ADD COLUMN seller_percent integer NOT NULL DEFAULT 0 CHECK(seller_percent BETWEEN 0 AND 100),
 ADD COLUMN minimum_amount bigint CHECK(minimum_amount IS NULL OR minimum_amount>=0),
 ADD COLUMN maximum_amount bigint CHECK(maximum_amount IS NULL OR maximum_amount>=0),
 ADD CONSTRAINT fee_split_exactly_100 CHECK(buyer_percent+seller_percent=100),
 ADD CONSTRAINT fee_payer_shape CHECK(
 (payer_mode='BUYER' AND buyer_percent=100 AND seller_percent=0) OR
 (payer_mode='SELLER' AND buyer_percent=0 AND seller_percent=100) OR
 (payer_mode='SPLIT' AND buyer_percent>0 AND seller_percent>0)
 ),
 ADD CONSTRAINT fee_limits_consistent CHECK(maximum_amount IS NULL OR minimum_amount IS NULL OR maximum_amount>=minimum_amount);
ALTER TABLE market_v3_disposable.lab_fee_policy_snapshots
 DROP CONSTRAINT lab_fee_policy_snapshots_payer_mode_check;
ALTER TABLE market_v3_disposable.lab_fee_policy_snapshots
 ADD CONSTRAINT lab_fee_policy_snapshots_payer_mode_check
 CHECK(payer_mode IN('BUYER','SELLER','SPLIT'));
ALTER TABLE market_v3_disposable.lab_fee_policy_snapshots
 ADD COLUMN buyer_amount bigint NOT NULL DEFAULT 0 CHECK(buyer_amount>=0),
 ADD COLUMN seller_amount bigint NOT NULL DEFAULT 0 CHECK(seller_amount>=0),
 ADD COLUMN calculation_mode text NOT NULL DEFAULT 'FIXED',
 ADD COLUMN percentage_rate_bps integer NOT NULL DEFAULT 0,
 ADD CONSTRAINT fee_snapshot_conservation CHECK(buyer_amount+seller_amount=fee_amount);
CREATE TABLE market_v3_disposable.lab_fee_component_reports(
 report_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL, buy_request_id uuid NOT NULL, fee_id text NOT NULL,
 payer_id uuid NOT NULL, payer_side text NOT NULL CHECK(payer_side IN('BUYER','SELLER')),
 amount bigint NOT NULL CHECK(amount>0),
 beneficiary_reference text NOT NULL CHECK(beneficiary_reference='TEST-COOP-ACCOUNT-001'),
 evidence_reference text NOT NULL,
 idempotency_key text NOT NULL,
 evidence_status text NOT NULL DEFAULT 'UNVERIFIED_EXTERNAL_REPORT'
 CHECK(evidence_status='UNVERIFIED_EXTERNAL_REPORT'),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,buy_request_id,fee_id,payer_side),
 UNIQUE(tenant_id,payer_id,idempotency_key),
 FOREIGN KEY(tenant_id,buy_request_id,fee_id)
 REFERENCES market_v3_disposable.lab_fee_policy_snapshots(tenant_id,buy_request_id,fee_id),
 FOREIGN KEY(tenant_id,payer_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TRIGGER lab_fee_component_reports_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_fee_component_reports
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
CREATE TABLE market_v3_disposable.lab_fee_documentary_reviews(
 review_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 report_id uuid NOT NULL UNIQUE REFERENCES market_v3_disposable.lab_fee_component_reports(report_id),
 reviewer_id uuid NOT NULL,
 decision text NOT NULL CHECK(decision IN('LAB_DOCUMENT_CHECKED_NOT_PAID','LAB_DOCUMENT_REJECTED')),
 review_reason text NOT NULL CHECK(length(review_reason)>=8),
 source_document_reference text NOT NULL CHECK(length(source_document_reference)>=8),
 idempotency_key text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,reviewer_id,idempotency_key),
 FOREIGN KEY(tenant_id,reviewer_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TRIGGER lab_fee_reviews_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_fee_documentary_reviews
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
INSERT INTO market_v3_disposable.lab_fee_policy_sources
 (tenant_id,fee_id,source_version,fee_title,legal_fee_type,
 calculation_mode,payer_mode,fixed_amount,percentage_rate_bps,
 buyer_percent,seller_percent,percentage_basis,minimum_amount,maximum_amount,
 approval_reference,legal_basis_reference,valid_from,valid_until,evidence_status)
 VALUES
 ('91111111-1111-4111-8111-111111111111','TEST-PERCENT-SERVICE',1,
  'TEST service fee (NOT statutory)','PLATFORM_SERVICE_FEE','PERCENTAGE','SELLER',
  0,250,0,100,'TRADE_GROSS_VALUE',0,NULL,
  'TEST-APPROVAL-SERVICE-001','TEST-SERVICE-BASIS-001','2026-01-01','2028-01-01','LAB_TEST_ATTESTED'),
 ('91111111-1111-4111-8111-111111111111','TEST-COMBINED-SPLIT',1,
  'TEST combined split coop fee (NOT statutory)','COOP_APPROVED_FEE','FIXED_PLUS_PERCENTAGE','SPLIT',
  100,100,60,40,'TRADE_GROSS_VALUE',0,600,
  'TEST-APPROVAL-SPLIT-001','TEST-COOP-BASIS-SPLIT-001','2026-01-01','2028-01-01','LAB_TEST_ATTESTED');
COMMIT;
