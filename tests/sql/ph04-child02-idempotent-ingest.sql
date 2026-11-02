-- PH04 Child02 source AT007: actual idempotent ingestion under approved source evidence.
-- Strictly synthetic PostgreSQL17 disposable CI. ROLLBACK all records.
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph04-ingest-only','Synthetic Ingest Tenant','ACTIVE');
INSERT INTO tto.parties(party_id,party_kind,display_label)
 VALUES('33333333-3333-4333-8333-333333333333','PERSON','Synthetic source Party');
INSERT INTO tto.documents(document_id,tenant_id,title,classification,status)
 VALUES('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Synthetic approved source evidence','MEMBER','PUBLISHED');
INSERT INTO tto.evidence_references(evidence_id,tenant_id,document_id,source_entity_type,source_entity_id)
 VALUES('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '55555555-5555-4555-8555-555555555555','SYNTHETIC_SOURCE_APPROVAL',
 '77777777-7777-4777-8777-777777777777');
INSERT INTO tto.source_contract_approvals
 (tenant_id,domain,source_ref,rule_snapshot_ref,evidence_id,approved_by,valid_until,enabled)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CHILD06_MEMBERSHIP','PH04_SYNTHETIC_SOURCE_REF',
 '88888888-8888-4888-8888-888888888888','66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',now()+interval '1 day',true);
DO $verify$ BEGIN
 IF has_function_privilege('tto_app',
  'tto.ingest_verified_relationship_event(uuid,uuid,uuid,bigint,text,text)','EXECUTE')
 OR has_table_privilege('tto_ingestor','tto.relationship_projections','INSERT')
 OR has_table_privilege('tto_app','tto.relationship_event_receipts','SELECT') THEN
   RAISE EXCEPTION 'CHILD02_AT007_UNTRUSTED_APP_CAN_INJECT_SOURCE';
 END IF;
END $verify$;
SET LOCAL ROLE tto_ingestor;
SELECT tto.ingest_verified_relationship_event(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 '99999999-9999-4999-8999-999999999999',1,'ACTIVE','PH04_SYNTHETIC_SOURCE_REF') AS first_insert;
SELECT tto.ingest_verified_relationship_event(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 '99999999-9999-4999-8999-999999999999',1,'ACTIVE','PH04_SYNTHETIC_SOURCE_REF') AS replay;
-- Dedicated §29 CORE-REL-AT-003: accept newer authoritative version,
-- then replay an out-of-order *new* event_id with an older source_version.
-- The receipt may record the delivery, but projection MUST NOT regress.
SELECT tto.ingest_verified_relationship_event(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 '99999999-9999-4999-8999-999999999997',2,'SUSPENDED','PH04_SYNTHETIC_SOURCE_REF') AS newer_source;
SELECT tto.ingest_verified_relationship_event(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 '99999999-9999-4999-8999-999999999996',1,'ENDED','PH04_SYNTHETIC_SOURCE_REF') AS stale_new_event;
SELECT tto.ingest_verified_relationship_event(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 '99999999-9999-4999-8999-999999999998',2,'SUSPENDED','UNKNOWN_UNAPPROVED_REF') AS unapproved_source;
RESET ROLE;
DO $verify$ BEGIN
 IF (SELECT count(*) FROM tto.relationship_event_receipts WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>3
 OR (SELECT count(*) FROM tto.relationship_projections
    WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     AND party_id='33333333-3333-4333-8333-333333333333' AND source_version=2
     AND membership_status='SUSPENDED' AND relationship_status='SUSPENDED'
     AND source_event_id='99999999-9999-4999-8999-999999999997')<>1
 OR (SELECT count(*) FROM tto.shareholding_source_snapshots WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0 THEN
  RAISE EXCEPTION 'CHILD02_REL003_SOURCE_VERSION_REGRESSION_OR_DUPLICATE_EFFECT';
 END IF;
 BEGIN
  UPDATE tto.relationship_event_receipts SET source_version=2
   WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'CHILD02_AT007_RECEIPT_NOT_IMMUTABLE';
 EXCEPTION WHEN raise_exception THEN
  -- distinguish the trigger from our own fail sentinel
  IF SQLERRM <> 'IMMUTABLE_AUDIT_OR_EVIDENCE' THEN RAISE; END IF;
 END;
END $verify$;
ROLLBACK;
SELECT 'CORE-TENANT-AT-007_SYNTHETIC_DUPLICATE_EVENT_IDEMPOTENCY_PASS' AS signal;

SELECT 'CORE-REL-AT-003_OUT_OF_ORDER_SOURCE_VERSION_NO_REGRESSION_PASS' AS signal;
