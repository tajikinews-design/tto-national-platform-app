-- PH05 CF05: integration receipts are NOT payment finalization.
-- Additive evidence-only physical contracts. No provider secret, payment gateway,
-- notification delivery, wallet, bank transaction or live webhook is enabled.
BEGIN;
CREATE TABLE tto.ph05_webhook_receipts (
 receipt_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 integration_code text NOT NULL CHECK(length(trim(integration_code))>=3),
 external_event_id text NOT NULL CHECK(length(trim(external_event_id))>=6),
 signature_status text NOT NULL CHECK(signature_status IN ('UNVERIFIED','VERIFIED','REJECTED')),
 attestation_hash bytea CHECK (attestation_hash IS NULL OR octet_length(attestation_hash)=32),
 received_at timestamptz NOT NULL DEFAULT now(),
 CHECK (signature_status<>'VERIFIED' OR attestation_hash IS NOT NULL),
 UNIQUE(tenant_id,integration_code,external_event_id)
);
CREATE TABLE tto.ph05_payment_evidence_reports (
 report_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 business_reference uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 status text NOT NULL DEFAULT 'REPORTED' CHECK(status='REPORTED'),
 -- No internal payment finalization or custody.
 business_finalized boolean NOT NULL DEFAULT false CHECK (business_finalized=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.ph05_webhook_status_projection (
 receipt_id uuid PRIMARY KEY REFERENCES tto.ph05_webhook_receipts(receipt_id),
 state text NOT NULL CHECK(state IN('RECEIVED','SIGNATURE_VERIFIED','PROCESSED')),
 version bigint NOT NULL CHECK(version>0)
);
CREATE FUNCTION tto.ph05_guard_webhook_status_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE old_rank int;new_rank int;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'WEBHOOK_STATE_DELETE_DENIED';END IF;
 old_rank=CASE OLD.state WHEN 'RECEIVED' THEN 1 WHEN 'SIGNATURE_VERIFIED' THEN 2 ELSE 3 END;
 new_rank=CASE NEW.state WHEN 'RECEIVED' THEN 1 WHEN 'SIGNATURE_VERIFIED' THEN 2 ELSE 3 END;
 IF NEW.version<>OLD.version+1 OR new_rank<=old_rank
 THEN RAISE EXCEPTION 'WEBHOOK_STATE_REGRESSION_OR_REPLAY_DENIED';END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER ph05_webhook_progress_guard BEFORE UPDATE OR DELETE
 ON tto.ph05_webhook_status_projection FOR EACH ROW
 EXECUTE FUNCTION tto.ph05_guard_webhook_status_progress();
CREATE TRIGGER ph05_webhook_receipt_immutable BEFORE UPDATE OR DELETE
 ON tto.ph05_webhook_receipts FOR EACH ROW
 EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph05_payment_report_immutable BEFORE UPDATE OR DELETE
 ON tto.ph05_payment_evidence_reports FOR EACH ROW
 EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'ph05_webhook_receipts','ph05_payment_evidence_reports',
  'ph05_webhook_status_projection']
 LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);
 END LOOP;
END $p$;
REVOKE ALL ON FUNCTION tto.ph05_guard_webhook_status_progress()
 FROM PUBLIC,tto_app;
COMMIT;
