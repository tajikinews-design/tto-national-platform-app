-- CF05 synthetic integration state. Never contact provider/bank or finalize finance.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa','ph05-cf05-test','Synthetic integration','ACTIVE');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,source_entity_type,source_entity_id)
 VALUES('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb',
 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa','PH05_SYNTHETIC_BANK_STUB',
 'cccccccc-5555-4555-8555-cccccccccccc');
INSERT INTO tto.ph05_payment_evidence_reports
 (report_id,tenant_id,business_reference,evidence_id)
 VALUES('dddddddd-5555-4555-8555-dddddddddddd',
 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
 'bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb');
INSERT INTO tto.ph05_webhook_receipts
 (receipt_id,tenant_id,integration_code,external_event_id,signature_status)
 VALUES('ffffffff-5555-4555-8555-ffffffffffff',
 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
 'SYNTHETIC_PROVIDER','evt-example-001','UNVERIFIED');
INSERT INTO tto.ph05_webhook_receipts
 (receipt_id,tenant_id,integration_code,external_event_id,signature_status)
 VALUES('ffffffff-5555-4555-8555-fffffffffffe',
 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
 'SYNTHETIC_PROVIDER','evt-example-001','UNVERIFIED')
 ON CONFLICT(tenant_id,integration_code,external_event_id) DO NOTHING;
DO $test$ BEGIN
 IF (SELECT count(*) FROM tto.ph05_webhook_receipts
   WHERE integration_code='SYNTHETIC_PROVIDER'
   AND external_event_id='evt-example-001')<>1
 THEN RAISE EXCEPTION 'PH05_CF05_DUPLICATE_WEBHOOK_CREATED_SECOND_RECEIPT';END IF;
 IF (SELECT count(*) FROM tto.ph05_payment_evidence_reports
   WHERE report_id='dddddddd-5555-4555-8555-dddddddddddd'
   AND status='REPORTED' AND business_finalized=false)<>1
 THEN RAISE EXCEPTION 'PH05_CF05_RECEIPT_AUTO_FINALIZED_PAYMENT';END IF;
 BEGIN
  UPDATE tto.ph05_payment_evidence_reports SET status='VERIFIED'
   WHERE report_id='dddddddd-5555-4555-8555-dddddddddddd';
  RAISE EXCEPTION 'PH05_CF05_CALLBACK_VERIFIED_PAYMENT';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE;END IF;
 END;
END $test$;
INSERT INTO tto.ph05_webhook_receipts
 (receipt_id,tenant_id,integration_code,external_event_id,signature_status,attestation_hash)
 VALUES('ffffffff-5555-4555-8555-fffffffffffd',
 'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
 'SYNTHETIC_PROVIDER','evt-example-002','VERIFIED',decode(repeat('ab',32),'hex'));
INSERT INTO tto.ph05_webhook_status_projection(receipt_id,state,version)
 VALUES('ffffffff-5555-4555-8555-fffffffffffd','RECEIVED',1);
UPDATE tto.ph05_webhook_status_projection SET state='SIGNATURE_VERIFIED',version=2
 WHERE receipt_id='ffffffff-5555-4555-8555-fffffffffffd';
UPDATE tto.ph05_webhook_status_projection SET state='PROCESSED',version=3
 WHERE receipt_id='ffffffff-5555-4555-8555-fffffffffffd';
DO $test$ BEGIN
 BEGIN
  UPDATE tto.ph05_webhook_status_projection SET state='RECEIVED',version=4
   WHERE receipt_id='ffffffff-5555-4555-8555-fffffffffffd';
  RAISE EXCEPTION 'PH05_CF05_WEBHOOK_STATE_REGRESSED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'WEBHOOK_STATE_REGRESSION_OR_REPLAY_DENIED' THEN RAISE;END IF;
 END;
 IF (SELECT count(*) FROM tto.ph05_webhook_status_projection
    WHERE receipt_id='ffffffff-5555-4555-8555-fffffffffffd'
    AND state='PROCESSED' AND version=3)<>1
 THEN RAISE EXCEPTION 'PH05_CF05_FINAL_STATE_CHANGED';END IF;
 IF has_table_privilege('tto_app','tto.ph05_payment_evidence_reports','INSERT')
 OR has_table_privilege('tto_app','tto.ph05_webhook_receipts','INSERT')
 THEN RAISE EXCEPTION 'PH05_CF05_UNTRUSTED_APP_CAN_FORGE_EVIDENCE';END IF;
END $test$;
SELECT 'PH05_CF05_AT001_WEBHOOK_DEDUP_SYNTHETIC_PASS' AS signal;
SELECT 'PH05_CF05_AT002_PAYMENT_REPORTED_ONLY_PASS' AS signal;
SELECT 'PH05_CF05_AT004_CALLBACK_NEVER_FINALIZES_PAYMENT_PASS' AS signal;
SELECT 'PH05_CF05_AT008_WEBHOOK_STATE_REGRESSION_DENIED_PASS' AS signal;
ROLLBACK;
