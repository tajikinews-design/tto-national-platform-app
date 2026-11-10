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
DO $test$
DECLARE v_id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 v jsonb;v_code text;v_collection jsonb;
BEGIN
 SELECT tto.nav02_member_number_policy_set('ci-nav02a',1000,'T-','-X') INTO v;
 IF v->>'nextSerial'<>'1000' THEN RAISE EXCEPTION 'NUMBER_POLICY_NOT_SAVED';END IF;
 SELECT tto.nav02_member_number_issue('ci-nav02a',v_id) INTO v_code;
 IF v_code<>'ci-nav02a-T-001000-X' THEN RAISE EXCEPTION 'WRONG_ISSUED_NUMBER: %',v_code;END IF;
 IF tto.nav02_member_number_issue('ci-nav02a',v_id)<>v_code
 THEN RAISE EXCEPTION 'NUMBER_REISSUED';END IF;
 SELECT tto.nav02_member_collection_create('ci-nav02a','شهرداری طرقبه') INTO v_collection;
 IF v_collection->>'name'<>'شهرداری طرقبه' THEN RAISE EXCEPTION 'COLLECTION_NOT_CREATED';END IF;
 SELECT tto.nav02_member_collections_list('ci-nav02a') INTO v_collection;
 IF jsonb_array_length(v_collection)<>1 THEN RAISE EXCEPTION 'COLLECTION_LIST_INVALID';END IF;
 SELECT tto.commerce_demo_nav02_list_secure('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>1 OR
 (v->0->>'photoState')<>'QUARANTINED' OR
 (v->0->>'initialShares')<>'2' OR
 (v->0->>'subscribedShares')<>'3' OR
 (v->0->>'nominalRial')<>'1000' OR
 (v->0->>'managementState')<>'ACTIVE_DRAFT'
 THEN RAISE EXCEPTION 'NAV02_LIST_CONTRACT_FAIL: %',v; END IF;
 SELECT tto.commerce_demo_nav02_edit_profile_secure('ci-nav02a',v_id,1,'خانم',
  decode(repeat('11',12),'hex'),decode(repeat('12',16),'hex'),
  decode(repeat('13',120),'hex')) INTO v;
 IF (v->>'version')::int<>2 THEN RAISE EXCEPTION 'PROFILE_VERSION_FAIL';END IF;
 PERFORM set_config('tto.actor_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 SELECT tto.commerce_demo_nav02_list_secure('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>0 THEN RAISE EXCEPTION 'CROSS_TENANT_READ_LEAK'; END IF;
 BEGIN
  PERFORM tto.nav02_member_number_policy_set('ci-nav02a',1,'HACK-','');
  RAISE EXCEPTION 'CROSS_TENANT_NUMBER_POLICY_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM tto.nav02_member_collection_create('ci-nav02a','Injected');
  RAISE EXCEPTION 'CROSS_TENANT_COLLECTION_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF tto.commerce_demo_nav02_profile_for_edit('ci-nav02a',v_id) IS NOT NULL
 THEN RAISE EXCEPTION 'CROSS_TENANT_PROFILE_LEAK';END IF;
 BEGIN
  PERFORM tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,2,'suspend');
  RAISE EXCEPTION 'CROSS_TENANT_WRITE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 PERFORM set_config('tto.actor_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 SELECT tto.commerce_demo_nav02_edit_capital_secure('ci-nav02a',v_id,2,
  '{"initialShares":"3","subscribedShares":"2","nominalRial":"5000","paidRial":"1000","paymentDate":""}'::jsonb,
  decode(repeat('14',40),'hex'),decode(repeat('15',12),'hex'),
  decode(repeat('16',16),'hex')) INTO v;
 IF (v->>'version')::int<>3 THEN RAISE EXCEPTION 'CAPITAL_VERSION_FAIL';END IF;
 SELECT tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,3,'suspend') INTO v;
 IF v->>'managementState'<>'SUSPENDED_DRAFT' THEN RAISE EXCEPTION 'SUSPEND_FAILED';END IF;
 BEGIN
  PERFORM tto.commerce_demo_nav02_edit_capital_secure('ci-nav02a',v_id,4,
   '{"initialShares":"4","subscribedShares":"2","nominalRial":"5000","paidRial":"1000","paymentDate":""}'::jsonb,
   decode(repeat('17',40),'hex'),decode(repeat('18',12),'hex'),
   decode(repeat('19',16),'hex'));
  RAISE EXCEPTION 'SUSPENDED_EDIT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,3,'resume');
  RAISE EXCEPTION 'STALE_VERSION_ALLOWED';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 SELECT tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,4,'resume') INTO v;
 IF v->>'managementState'<>'ACTIVE_DRAFT' THEN RAISE EXCEPTION 'RESUME_FAILED';END IF;
 SELECT tto.commerce_demo_nav02_audit('ci-nav02a',v_id) INTO v;
 IF jsonb_array_length(v)<>4 THEN RAISE EXCEPTION 'AUDIT_MISSING: %',v;END IF;
 SELECT tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,5,'archive') INTO v;
 IF v->>'managementState'<>'ARCHIVED_DRAFT' THEN RAISE EXCEPTION 'ARCHIVE_FAILED'; END IF;
 BEGIN
  PERFORM tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,6,'resume');
  RAISE EXCEPTION 'ARCHIVED_RESUME_ALLOWED';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 BEGIN
  PERFORM tto.commerce_demo_nav02_edit_profile_secure('ci-nav02a',v_id,6,
   'آقا',decode(repeat('21',12),'hex'),decode(repeat('22',16),'hex'),
   decode(repeat('23',120),'hex'));
  RAISE EXCEPTION 'ARCHIVED_EDIT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 SELECT tto.commerce_demo_nav02_change_state('ci-nav02a',v_id,6,'restore') INTO v;
 IF v->>'managementState'<>'ACTIVE_DRAFT' THEN RAISE EXCEPTION 'RESTORE_FAILED'; END IF;
 SELECT tto.commerce_demo_nav02_delete_unverified('ci-nav02a',v_id,7,'DELETE_SYNTHETIC_DRAFT') INTO v;
 IF v->>'deleted'<>'true' OR v->>'capitalErased'<>'true' OR v->>'photoErased'<>'true'
 THEN RAISE EXCEPTION 'DELETE_FAIL: %',v;END IF;
 SELECT tto.commerce_demo_nav02_list_secure('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>0 THEN RAISE EXCEPTION 'DELETED_DRAFT_STILL_READABLE';END IF;
 RAISE NOTICE 'NAV02_OWNER_CROSS_TENANT_VERSION_SUSPEND_RESUME_DELETE_PASS';
END $test$;
RESET ROLE;
DO $test$
DECLARE v_id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
BEGIN
 IF EXISTS(SELECT 1 FROM tto.commerce_demo_shareholder_drafts WHERE draft_id=v_id) OR
 EXISTS(SELECT 1 FROM tto.commerce_demo_nav02_sensitive_profiles WHERE draft_id=v_id) OR
 EXISTS(SELECT 1 FROM tto.commerce_demo_share_capital_drafts WHERE shareholder_draft_id=v_id) OR
 EXISTS(SELECT 1 FROM tto.commerce_demo_nav02_photo_quarantine WHERE draft_id=v_id)
 THEN RAISE EXCEPTION 'NAV02_SYNTHETIC_ERASURE_INCOMPLETE';END IF;
 IF (SELECT COUNT(*) FROM tto.commerce_demo_nav02_management_audit WHERE draft_id=v_id)<>7
 THEN RAISE EXCEPTION 'NAV02_NONPII_AUDIT_NOT_RETAINED';END IF;
 IF (SELECT count(*) FROM tto.nav02_member_number_registry
  WHERE draft_id=v_id AND member_number='ci-nav02a-T-001000-X'
   AND retired_at IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'PERMANENT_NUMBER_TOMBSTONE_MISSING'; END IF;
 IF (SELECT count(*) FROM tto.nav02_member_collections
  WHERE name='شهرداری طرقبه')<>1
 THEN RAISE EXCEPTION 'COLLECTION_REMOVED_BY_MEMBER_DELETE'; END IF;
 RAISE NOTICE 'NAV02_CASCADE_ERASURE_NONPII_AUDIT_PASS';
END $test$;
ROLLBACK;
