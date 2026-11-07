-- Disposable lab: admin-editable versioned per-coop fee tariffs with BOARD evidence
-- and dual FINANCE + CEO documentary receipt. NOT a deployable migration.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE market_v3_disposable.actors DROP CONSTRAINT actors_role_check;
ALTER TABLE market_v3_disposable.actors ADD CONSTRAINT actors_role_check
 CHECK(role IN('SELLER','BUYER','COOP_MARKET_MANAGER','COOP_OPERATOR',
 'BOARD_SECRETARIAT','BOARD_EVIDENCE_REVIEWER','COOP_FINANCE_OPERATOR','COOP_CEO'));
INSERT INTO market_v3_disposable.actors
 (tenant_id,actor_id,role,status,source_verified)
 VALUES('91111111-1111-4111-8111-111111111111',
 'abcd0000-1111-4111-8111-111111111111','COOP_CEO','ACTIVE',true);
CREATE TABLE market_v3_disposable.lab_tariff_drafts(
 draft_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 fee_id text NOT NULL,
 proposed_version bigint NOT NULL CHECK(proposed_version>0),
 fee_title text NOT NULL,
 fee_type text NOT NULL CHECK(fee_type IN('STATUTORY_FEE','COOP_APPROVED_FEE','PLATFORM_SERVICE_FEE')),
 calculation_mode text NOT NULL CHECK(calculation_mode IN('FIXED','PERCENTAGE','FIXED_PLUS_PERCENTAGE')),
 payer_mode text NOT NULL CHECK(payer_mode IN('BUYER','SELLER','SPLIT')),
 fixed_amount bigint NOT NULL CHECK(fixed_amount>=0),
 percentage_rate_bps integer NOT NULL CHECK(percentage_rate_bps BETWEEN 0 AND 10000),
 percentage_basis text NOT NULL CHECK(percentage_basis IN('TRADE_GROSS_VALUE','SHARE_VALUE','CUSTOM_APPROVED_BASE')),
 buyer_percent integer NOT NULL CHECK(buyer_percent BETWEEN 0 AND 100),
 seller_percent integer NOT NULL CHECK(seller_percent BETWEEN 0 AND 100),
 minimum_amount bigint,
 maximum_amount bigint,
 proposed_from timestamptz NOT NULL,
 proposed_until timestamptz NOT NULL,
 legal_basis_reference text NOT NULL,
 created_by uuid NOT NULL,
 board_resolution_reference text,
 board_record_reference text,
 board_recorded_by uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','LAB_BOARD_REFERENCED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,fee_id,proposed_version),
 FOREIGN KEY(tenant_id,created_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK(buyer_percent+seller_percent=100),
 CHECK((payer_mode='BUYER' AND buyer_percent=100 AND seller_percent=0)
    OR (payer_mode='SELLER' AND buyer_percent=0 AND seller_percent=100)
    OR (payer_mode='SPLIT' AND buyer_percent>0 AND seller_percent>0)),
 CHECK(proposed_until>proposed_from),
 CHECK(minimum_amount IS NULL OR minimum_amount>=0),
 CHECK(maximum_amount IS NULL OR maximum_amount>=0),
 CHECK(maximum_amount IS NULL OR minimum_amount IS NULL OR maximum_amount>=minimum_amount)
);
CREATE TABLE market_v3_disposable.lab_tariff_board_events(
 event_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 draft_id uuid NOT NULL,
 submitted_by uuid NOT NULL,
 resolution_reference text NOT NULL,
 evidence_reference text NOT NULL,
 status text NOT NULL CHECK(status='LAB_BOARD_REFERENCE_NOT_SIGNATURE'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,draft_id),
 FOREIGN KEY(tenant_id,submitted_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 FOREIGN KEY(draft_id) REFERENCES market_v3_disposable.lab_tariff_drafts(draft_id)
);
CREATE TRIGGER lab_tariff_board_events_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_tariff_board_events
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
CREATE TABLE market_v3_disposable.lab_ceo_mandates(
 tenant_id uuid NOT NULL,ceo_id uuid NOT NULL,
 mandate_version bigint NOT NULL CHECK(mandate_version>0),
 board_resolution_reference text NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN('LAB_ATTESTED','LAB_REVOKED','UNVERIFIED')),
 PRIMARY KEY(tenant_id,ceo_id,mandate_version),
 FOREIGN KEY(tenant_id,ceo_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.lab_dual_receipt_endorsements(
 event_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 report_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 approver_role text NOT NULL CHECK(approver_role IN('COOP_FINANCE_OPERATOR','COOP_CEO')),
 board_mandate_version bigint NOT NULL,
 reference text NOT NULL,
 idempotency_key text NOT NULL,
 outcome text NOT NULL CHECK(outcome='LAB_ENDORSED_NOT_OFFICIAL_PAID'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,report_id,approver_role),
 UNIQUE(tenant_id,actor_id,idempotency_key),
 FOREIGN KEY(report_id) REFERENCES market_v3_disposable.lab_fee_component_reports(report_id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TRIGGER lab_dual_receipt_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_dual_receipt_endorsements
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
INSERT INTO market_v3_disposable.lab_ceo_mandates
 (tenant_id,ceo_id,mandate_version,board_resolution_reference,valid_from,valid_until,state)
 VALUES('91111111-1111-4111-8111-111111111111',
 'abcd0000-1111-4111-8111-111111111111',1,'TEST-BOARD-CEO-RESOLUTION-001',
 '2026-01-01','2028-01-01','LAB_ATTESTED');
COMMIT;
