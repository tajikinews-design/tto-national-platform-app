-- NAV02-02: disposable PG17 only. Two imaginary owners; no PII or legal operations.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
('11111111-1111-4111-8111-111111111111','ci-nav02a','Fictional Tenant A','ACTIVE'),
('22222222-2222-4222-8222-222222222222','ci-nav02b','Fictional Tenant B','ACTIVE');
INSERT INTO tto.cooperative_workspace_addresses(workspace_id,slug,created_by) VALUES
('33333333-3333-4333-8333-333333333331','ci-nav02a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('33333333-3333-4333-8333-333333333332','ci-nav02b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.commerce_demo_orders(order_id,workspace_id,owner_id,slug,proposed_name,
 verified_mobile,plan_code,submitted_amount_irr,expires_at) VALUES
('44444444-4444-4444-8444-444444444441','33333333-3333-4333-8333-333333333331',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ci-nav02a','Fictional A',
 '09111111111','demo-basic',1000,now()+interval '2 days'),
('44444444-4444-4444-8444-444444444442','33333333-3333-4333-8333-333333333332',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ci-nav02b','Fictional B',
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
SET LOCAL ROLE tto_app;
SELECT set_config('tto.actor_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $checks$
DECLARE v jsonb; v_number text;v_id uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 v_first text;v_coll jsonb;
BEGIN
 PERFORM tto.nav02_member_number_policy_set('ci-nav02a',1000,'A-','');
 SELECT tto.nav02_member_number_issue('ci-nav02a',v_id) INTO v_first;
 IF v_first<>'ci-nav02a-A-001000' THEN RAISE EXCEPTION 'ISSUED_NOT_AS_EXPECTED';END IF;
 SELECT tto.nav02_member_number_policy_get('ci-nav02a') INTO v;
 IF (v->>'issuedCount')::int<>1 THEN RAISE EXCEPTION 'ISSUE_COUNT_INCORRECT';END IF;
 BEGIN
  PERFORM tto.nav02_member_number_policy_set('ci-nav02a',2000,'N-','');
  RAISE EXCEPTION 'CHANGED_UNISSUED_POLICY_AFTER_NUMBER';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM tto.nav02_member_number_reissue('ci-nav02a',2000,'N-','',2,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED');
  RAISE EXCEPTION 'STALE_MEMBER_COUNT_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
  PERFORM tto.nav02_member_number_reissue('ci-nav02a',2000,'N-','',1,'MISSING_ACK');
  RAISE EXCEPTION 'UNCONFIRMED_REISSUE_ACCEPTED';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 SELECT tto.nav02_member_number_reissue('ci-nav02a',2000,'N-','',1,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED') INTO v;
 IF (v->>'count')::int<>1 THEN RAISE EXCEPTION 'REISSUE_NOT_CONFIRMED';END IF;
 SELECT tto.nav02_member_numbers_for_owner('ci-nav02a') INTO v;
 IF (v->0->>'membershipNumber')<>'ci-nav02a-N-002000' THEN
  RAISE EXCEPTION 'CURRENT_MEMBER_NUMBER_NOT_UPDATED';END IF;
 SELECT tto.nav02_member_number_reissue('ci-nav02a',3000,'Q-','',1,'REISSUE_ALL_MEMBERS_ACKNOWLEDGED') INTO v;
 SELECT tto.nav02_member_numbers_for_owner('ci-nav02a') INTO v;
 IF (v->0->>'membershipNumber')<>'ci-nav02a-Q-003000' THEN
  RAISE EXCEPTION 'SECOND_REVISION_NOT_UPDATED';END IF;
 SELECT tto.nav02_member_collection_create('ci-nav02a','Synthetic Collection') INTO v_coll;
 SELECT tto.nav02_member_collection_archive('ci-nav02a','Synthetic Collection') INTO v;
 IF v->>'archived'<>'true' THEN RAISE EXCEPTION 'ARCHIVE_NOT_CONFIRMED';END IF;
 SELECT tto.nav02_member_collections_list('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>0 THEN RAISE EXCEPTION 'ARCHIVED_COLLECTION_LISTED';END IF;
 SELECT tto.nav02_member_collection_create('ci-nav02a','Synthetic Collection') INTO v;
 SELECT tto.nav02_member_collections_list('ci-nav02a') INTO v;
 IF jsonb_array_length(v)<>1 THEN RAISE EXCEPTION 'COLLECTION_RESTORATION_FAILED';END IF;
 SELECT tto.nav02_member_end_request_submit('ci-nav02a',v_id,'RESIGNATION',
  'TEST-DOCUMENT-REFERENCE-001',DATE '2026-11-10') INTO v;
 IF v->>'state'<>'PENDING_LEGAL_REVIEW' THEN RAISE EXCEPTION 'END_REQUEST_NOT_PENDING';END IF;
 PERFORM set_config('tto.actor_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 BEGIN
  PERFORM tto.nav02_member_end_request_submit('ci-nav02a',v_id,'DEATH',
   'TEST-DOCUMENT-REFERENCE-002',NULL);
  RAISE EXCEPTION 'CROSS_TENANT_TERMINATION_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM tto.nav02_member_collection_archive('ci-nav02a','Synthetic Collection');
  RAISE EXCEPTION 'CROSS_TENANT_ARCHIVE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RAISE NOTICE 'NAV02_R2_CONFIRMED_RENUMBER_AND_GOVERNANCE_DENY_PASS';
END $checks$;
RESET ROLE;
DO $check_history$
BEGIN
 IF (SELECT count(*) FROM tto.nav02_member_number_history
  WHERE draft_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND member_number='ci-nav02a-N-002000')<>1
 THEN RAISE EXCEPTION 'PREVIOUS_REVISION_NOT_AUDITED';END IF;
 IF (SELECT count(*) FROM tto.nav02_member_number_registry
  WHERE draft_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND member_number='ci-nav02a-A-001000')<>1
 THEN RAISE EXCEPTION 'ORIGINAL_NUMBER_NOT_PRESERVED';END IF;
 IF (SELECT count(*) FROM tto.nav02_member_end_requests WHERE reason='RESIGNATION')<>1
 THEN RAISE EXCEPTION 'LEGAL_REQUEST_NOT_PERSISTED';END IF;
END $check_history$;
ROLLBACK;
