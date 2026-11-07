-- TTO-SHARE-MARKET-SPEC v3.0 §§18-25.
-- TEST-ONLY schema extension. No official signatures, bank account numbers,
-- actual payments, production migrations, real ownership or register writes.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE market_v3_disposable.lab_source_keys(
 tenant_id uuid NOT NULL,
 source_id text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 public_key_pem text NOT NULL,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 source_status text NOT NULL CHECK(source_status='LAB_TEST_ONLY'),
 PRIMARY KEY(tenant_id,source_id,source_version),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.lab_board_attestations(
 attestation_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 decision_id uuid NOT NULL,
 source_id text NOT NULL,
 source_version bigint NOT NULL,
 evidence_signature_base64 text NOT NULL,
 reviewed_by uuid NOT NULL,
 attestation_type text NOT NULL CHECK(attestation_type='SYNTHETIC_SIGNATURE_TEST_NOT_LEGAL'),
 idempotency_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,buy_request_id),
 UNIQUE(tenant_id,reviewed_by,idempotency_key),
 FOREIGN KEY(tenant_id,source_id,source_version)
  REFERENCES market_v3_disposable.lab_source_keys(tenant_id,source_id,source_version),
 FOREIGN KEY(decision_id) REFERENCES market_v3_disposable.board_decision_drafts(decision_id),
 FOREIGN KEY(tenant_id,buy_request_id) REFERENCES market_v3_disposable.buy_requests(tenant_id,buy_request_id)
);
CREATE TABLE market_v3_disposable.lab_seller_bank_refs(
 tenant_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 bank_reference text NOT NULL CHECK(bank_reference LIKE 'TEST-BANK-%'),
 source_state text NOT NULL CHECK(source_state='LAB_TEST_ONLY'),
 PRIMARY KEY(tenant_id,seller_id),
 FOREIGN KEY(tenant_id,seller_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TABLE market_v3_disposable.lab_trade_progress(
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 buyer_id uuid NOT NULL,
 bank_reference text NOT NULL,
 expected_gross bigint NOT NULL CHECK(expected_gross>0),
 state text NOT NULL CHECK(state IN('PAYMENT_PENDING','PAYMENT_REPORTED','PAYMENT_CONFIRMED','PAYMENT_DISPUTED')),
 seller_continuation_key text NOT NULL,
 continued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,buy_request_id),
 UNIQUE(tenant_id,seller_id,seller_continuation_key),
 FOREIGN KEY(tenant_id,buy_request_id) REFERENCES market_v3_disposable.buy_requests(tenant_id,buy_request_id)
);
CREATE TABLE market_v3_disposable.lab_payment_reports(
 report_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 buyer_id uuid NOT NULL,
 amount bigint NOT NULL CHECK(amount>0),
 bank_label text NOT NULL,
 tracking_reference text NOT NULL,
 receipt_reference text NOT NULL,
 payment_date date NOT NULL,
 idempotency_key text NOT NULL,
 state text NOT NULL CHECK(state='BUYER_REPORTED_UNVERIFIED'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,buy_request_id),
 UNIQUE(tenant_id,buyer_id,idempotency_key),
 FOREIGN KEY(tenant_id,buy_request_id) REFERENCES market_v3_disposable.buy_requests(tenant_id,buy_request_id)
);
CREATE TABLE market_v3_disposable.lab_seller_receipts(
 receipt_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 buy_request_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 response text NOT NULL CHECK(response IN('RECEIVED_FULL','NOT_RECEIVED','AMOUNT_MISMATCH')),
 reason_code text,
 idempotency_key text NOT NULL,
 responded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,buy_request_id),
 UNIQUE(tenant_id,seller_id,idempotency_key),
 FOREIGN KEY(tenant_id,buy_request_id) REFERENCES market_v3_disposable.buy_requests(tenant_id,buy_request_id),
 CHECK ((response='RECEIVED_FULL' AND reason_code IS NULL) OR
        (response!='RECEIVED_FULL' AND reason_code IN('PAYMENT_NOT_RECEIVED','PAYMENT_AMOUNT_MISMATCH')))
);
INSERT INTO market_v3_disposable.lab_seller_bank_refs
 (tenant_id,seller_id,bank_reference,source_state) VALUES
 ('91111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','TEST-BANK-SELLER-001','LAB_TEST_ONLY');
-- All lab-only records are append-only except explicitly allowed synthetic
-- trade progress state transitions made by the isolated API under tests.
CREATE TRIGGER lab_board_attestations_append_only
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_board_attestations
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
CREATE TRIGGER lab_payment_reports_append_only
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_payment_reports
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
CREATE TRIGGER lab_seller_receipts_append_only
 BEFORE UPDATE OR DELETE ON market_v3_disposable.lab_seller_receipts
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
COMMIT;
