-- NAV02-02 disposable PG17 only: synthetic non-PII fixture and transaction rollback.
-- Isolated PostgreSQL17 synthetic NAV02 management; never run against shared or real data.
-- Prepared fixtures are deliberately non-PII and there is NO official ledger operation.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
('11111111-1111-4111-8111-111111111111','ci-nav02a','Synthetic A','ACTIVE'),
('22222222-2222-4222-8222-222222222222','ci-nav02b','Synthetic B','ACTIVE');
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by) VALUES
('33333333-3333-4333-8333-333333333331','ci-nav02a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('33333333-3333-4333-8333-333333333332','ci-nav02b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.commerce_demo_orders(order_id,workspace_id,owner_id,slug,proposed_name,
 verified_mobile,plan_code,submitted_amount_irr,expires_at) VALUES
('44444444-4444-4444-8444-444444444441','33333333-3333-4333-8333-333333333331',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ci-nav02a','Synthetic Test Cooperative A',
 '09111111111','demo-basic',1000,now()+interval '2 days'),
('44444444-4444-4444-8444-444444444442','33333333-3333-4333-8333-333333333332',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ci-nav02b','Synthetic Test Cooperative B',
 '09222222222','demo-basic',1000,now()+interval '2 days');
INSERT INTO tto.commerce_demo_workspace_owners(order_id,tenant_id,user_id) VALUES
('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('44444444-4444-4444-8444-444444444442','22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.commerce_demo_shareholder_drafts(draft_id,order_id,title,entered_by)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '44444444-4444-4444-8444-444444444441','آقا',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO tto.commerce_demo_nav02_sensitive_profiles(
 draft_id,order_id,national_id_hmac,aes_gcm_iv,aes_gcm_tag,encrypted_profile)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '44444444-4444-4444-8444-444444444441',
 decode(repeat('a1',32),'hex'),decode(repeat('b1',12),'hex'),
 decode(repeat('c1',16),'hex'),decode(repeat('d1',100),'hex'));
INSERT INTO tto.commerce_demo_share_capital_drafts(
 shareholder_draft_id,initial_purchased_shares,subscribed_shares,nominal_value_rial,
 declared_paid_rial,encrypted_receipt_ref,aes_receipt_iv,aes_receipt_tag,entered_by)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',2,3,1000,2000,
 decode(repeat('e1',40),'hex'),decode(repeat('f1',12),'hex'),
 decode(repeat('a2',16),'hex'),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO tto.commerce_demo_nav02_photo_quarantine(
 draft_id,order_id,entered_by,declared_mime,plaintext_bytes,content_sha256,
 aes_gcm_iv,aes_gcm_tag,encrypted_bytes)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '44444444-4444-4444-8444-444444444441',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','image/png',80,
 decode(repeat('a3',32),'hex'),decode(repeat('b3',12),'hex'),
 decode(repeat('c3',16),'hex'),decode(repeat('d3',80),'hex'));
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $case$
DECLARE v_id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 v jsonb; first_number text; current_number text; last_number text;
BEGIN
 SELECT tto.nav02_member_number_policy_set('ci-nav02a',100,'R1-','') INTO v;
 SELECT tto.nav02_member_number_issue('ci-nav02a',v_id) INTO first_number;
 IF first_number<>'ci-nav02a-R1-000100' THEN RAISE EXCEPTION 'BAD_ORIGINAL_NUMBER'; END IF;
 BEGIN
  PERFORM tto.nav02_member_number_policy_set('ci-nav02a',101,'R2-','');
  RAISE EXCEPTION 'MISSING_REISSUE_ACK_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM tto.nav02_member_number_reissue('ci-nav02a',102,'R2-','',2,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED');
  RAISE EXCEPTION 'INCORRECT_EXPECTED_COUNT_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 SELECT tto.nav02_member_number_reissue('ci-nav02a',102,'R2-','',1,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED') INTO v;
 IF v->>'count'<>'1' THEN RAISE EXCEPTION 'REISSUE_COUNT_INVALID';END IF;
 SELECT result->0->>'membershipNumber' INTO current_number
 FROM (SELECT tto.nav02_member_numbers_for_owner('ci-nav02a') AS result) x;
 IF current_number<>'ci-nav02a-R2-000102' THEN RAISE EXCEPTION 'NUMBER_NOT_REISSUED: %',current_number;END IF;
 SELECT tto.nav02_member_number_reissue('ci-nav02a',103,'R3-','',1,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED') INTO v;
 SELECT result->0->>'membershipNumber' INTO last_number
 FROM (SELECT tto.nav02_member_numbers_for_owner('ci-nav02a') AS result) x;
 IF last_number<>'ci-nav02a-R3-000103' THEN RAISE EXCEPTION 'SECOND_NUMBER_NOT_ISSUED';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.nav02_member_number_registry WHERE draft_id=v_id AND member_number=first_number)
 OR NOT EXISTS(SELECT 1 FROM tto.nav02_member_number_history WHERE draft_id=v_id AND member_number=current_number)
 THEN RAISE EXCEPTION 'ORIGINAL_OR_INTERMEDIATE_REFERENCE_LOST';END IF;
 SELECT tto.nav02_member_collection_create('ci-nav02a','مجموعه نمونه') INTO v;
 SELECT tto.nav02_member_collection_archive('ci-nav02a','مجموعه نمونه') INTO v;
 SELECT tto.nav02_member_collections_list('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>0 THEN RAISE EXCEPTION 'ARCHIVED_COLLECTION_STILL_VISIBLE';END IF;
 SELECT tto.nav02_member_collection_create('ci-nav02a','مجموعه نمونه') INTO v;
 SELECT tto.nav02_member_collections_list('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>1 THEN RAISE EXCEPTION 'COLLECTION_RESTORATION_FAILED';END IF;
 SELECT tto.nav02_member_end_request_submit('ci-nav02a',v_id,'RESIGNATION','BOARD-REFERENCE-001',null) INTO v;
 IF v->>'state'<>'PENDING_LEGAL_REVIEW' THEN RAISE EXCEPTION 'ENDING_ACTIVATED_WITHOUT_REVIEW';END IF;
 SELECT tto.nav02_photo_ready_for_owner('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>0 OR tto.nav02_photo_payload_for_owner('ci-nav02a',v_id) IS NOT NULL
 THEN RAISE EXCEPTION 'QUARANTINED_PHOTO_EXPOSED'; END IF;
 RAISE NOTICE 'NAV02_R2_REISSUE_ARCHIVE_END_PRIVACY_PASS';
END $case$;
RESET ROLE;
ROLLBACK;
