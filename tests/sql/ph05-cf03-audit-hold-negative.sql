-- PH05 first executable evidence slice: CF03 immutable audit + retention hold.
-- Disposable PostgreSQL17 only. NOT full CF03-AT-006/007 source acceptance.
-- No production migration, no real member, file upload or share operation.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id)
 VALUES('71111111-1111-4111-8111-111111111111');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ph05-audit-proof','PH05 synthetic cooperative','ACTIVE');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status)
 VALUES('72222222-2222-4222-8222-222222222222',
 '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'PH05 synthetic legal record','RESTRICTED','PUBLISHED');
INSERT INTO tto.audit_events(audit_id,tenant_id,actor_id,event_name,target_id)
 VALUES('73333333-3333-4333-8333-333333333333',
 '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '71111111-1111-4111-8111-111111111111',
 'PH05_SYNTHETIC_CHECK','72222222-2222-4222-8222-222222222222');
INSERT INTO tto.legal_holds(hold_id,tenant_id,document_id,rule_reference,reason,applied_by)
 VALUES('74444444-4444-4444-8444-444444444444',
 '7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '72222222-2222-4222-8222-222222222222',
 'PH05-LEGAL-TEST','Synthetic legal preservation requirement',
 '71111111-1111-4111-8111-111111111111');

DO $test$
BEGIN
 BEGIN
  DELETE FROM tto.audit_events WHERE audit_id='73333333-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'CF03_AUDIT_HARD_DELETE_UNEXPECTEDLY_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE tto.audit_events SET event_name='TAMPERED'
   WHERE audit_id='73333333-3333-4333-8333-333333333333';
  RAISE EXCEPTION 'CF03_AUDIT_REWRITE_UNEXPECTEDLY_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM tto.audit_events
  WHERE audit_id='73333333-3333-4333-8333-333333333333'
    AND event_name='PH05_SYNTHETIC_CHECK')<>1
 THEN RAISE EXCEPTION 'CF03_AUDIT_EVENT_NO_LONGER_INTACT';END IF;
 BEGIN
  DELETE FROM tto.documents
   WHERE document_id='72222222-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'CF03_HELD_DOCUMENT_HARD_DELETE_UNEXPECTEDLY_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'DOCUMENT_DISPOSITION_REQUIRES_CHILD22_POLICY'
  THEN RAISE;END IF;
 END;
 IF (SELECT count(*) FROM tto.documents
   WHERE document_id='72222222-2222-4222-8222-222222222222')<>1
 OR (SELECT count(*) FROM tto.legal_holds
   WHERE hold_id='74444444-4444-4444-8444-444444444444'
   AND released_at IS NULL)<>1
 THEN RAISE EXCEPTION 'CF03_LEGAL_HOLD_DATA_LOSS';END IF;
END $test$;
SELECT 'PH05_CF03_AT006_AUDIT_INSERT_ONLY_PHYSICAL_NEGATIVE_PASS' AS signal;
SELECT 'PH05_CF03_AT007_ACTIVE_HOLD_DISPOSITION_DENIED_PHYSICAL_PASS' AS signal;
ROLLBACK;
SELECT 'PH05_CF03_SYNTHETIC_TRANSACTION_ROLLED_BACK' AS signal;
