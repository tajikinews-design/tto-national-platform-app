-- Disposable PostgreSQL17 only; two entirely synthetic cooperatives; full rollback.
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
INSERT INTO tto.commerce_demo_shareholder_drafts(draft_id,order_id,title,entered_by) VALUES
('dddddddd-dddd-4ddd-8ddd-ddddddddddda','44444444-4444-4444-8444-444444444441',
 'آقا','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddb','44444444-4444-4444-8444-444444444442',
 'خانم','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tto.commerce_demo_nav02_sensitive_profiles(
 draft_id,order_id,national_id_hmac,aes_gcm_iv,aes_gcm_tag,encrypted_profile) VALUES
('dddddddd-dddd-4ddd-8ddd-ddddddddddda','44444444-4444-4444-8444-444444444441',
 decode(repeat('a1',32),'hex'),decode(repeat('b1',12),'hex'),decode(repeat('c1',16),'hex'),decode(repeat('d1',100),'hex')),
('dddddddd-dddd-4ddd-8ddd-dddddddddddb','44444444-4444-4444-8444-444444444442',
 decode(repeat('a2',32),'hex'),decode(repeat('b2',12),'hex'),decode(repeat('c2',16),'hex'),decode(repeat('d2',100),'hex'));
SET LOCAL ROLE tto_app;
DO $test$
DECLARE a text;b text;ra uuid;rb uuid;v jsonb;
BEGIN
 PERFORM set_config('tto.actor_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
 PERFORM tto.nav02_member_number_policy_set('ci-nav02a',123,'','');
 a:=tto.nav02_member_number_issue('ci-nav02a','dddddddd-dddd-4ddd-8ddd-ddddddddddda');
 IF a<>'000123' THEN RAISE EXCEPTION 'SLUG_PRESENT_OR_BAD_NUMBER_A:%',a;END IF;
 -- Synthetic receipt only: ClamAV protocol and GCM integrity are checked separately.
 IF tto.nav02_attachment_save('ci-nav02a','dddddddd-dddd-4ddd-8ddd-ddddddddddda',
   'Synthetic resolution attachment','application/pdf','synthetic.pdf',80,
   decode(repeat('a4',32),'hex'),decode(repeat('b4',12),'hex'),
   decode(repeat('c4',16),'hex'),decode(repeat('d4',80),'hex'),
   'ClamAV synthetic CI verdict') IS NULL
 THEN RAISE EXCEPTION 'ATTACHMENT_STORE_FAILED';END IF;
 IF jsonb_array_length(tto.nav02_attachment_list('ci-nav02a',
   'dddddddd-dddd-4ddd-8ddd-ddddddddddda'))<>1
 THEN RAISE EXCEPTION 'ATTACHMENT_OWNER_LIST_FAILED';END IF;
 ra:=tto.nav02_office_holder_draft_create('ci-nav02a',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddda',null,'MEMBER','BOARD_CHAIR',true,
  'Joint signatures subject to official resolution','2026-01-01','2028-01-01',
  'Synthetic Gazette','2026-02-01','55','NA-77');
 IF ra IS NULL THEN RAISE EXCEPTION 'BOARD_DRAFT_FAILED';END IF;
 IF tto.nav02_office_holder_draft_edit('ci-nav02a',ra,1,
  'dddddddd-dddd-4ddd-8ddd-ddddddddddda',null,'MEMBER','BOARD_CHAIR',true,
  'Both signatures required under unverified draft','2026-01-01','2028-01-01',
  'Synthetic Gazette','2026-02-01','55','NA-77')<>2
 THEN RAISE EXCEPTION 'OFFICE_EDIT_VERSION_FAILED';END IF;
 IF jsonb_array_length(tto.nav02_office_holder_draft_history('ci-nav02a',ra))<>1
 THEN RAISE EXCEPTION 'OFFICE_HISTORY_MISSING';END IF;
 BEGIN
  PERFORM tto.nav02_office_holder_draft_edit('ci-nav02a',ra,1,
   'dddddddd-dddd-4ddd-8ddd-ddddddddddda',null,'MEMBER','BOARD_CHAIR',false,
   'Illegal stale write','2026-01-01','2028-01-01','',null,'','');
  RAISE EXCEPTION 'STALE_OFFICE_VERSION_ACCEPTED';
 EXCEPTION WHEN serialization_failure THEN NULL;END;
 ra:=tto.nav02_office_holder_draft_create('ci-nav02a',
  null,'Synthetic External CEO','EXTERNAL','CEO',false,
  'No registered authority','2026-01-01','2027-01-01',
  'Synthetic Gazette',null,'56','NA-78');
 IF ra IS NULL THEN RAISE EXCEPTION 'EXTERNAL_CEO_DRAFT_FAILED';END IF;
 v:=tto.nav02_office_holder_drafts_list('ci-nav02a');
 IF jsonb_array_length(v)<>2 OR EXISTS(
   SELECT 1 FROM jsonb_array_elements(v) item WHERE item->>'status'<>'DRAFT_ONLY')
 THEN RAISE EXCEPTION 'OFFICE_DRAFT_LIST_FAIL';END IF;
 PERFORM set_config('tto.actor_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 PERFORM tto.nav02_member_number_policy_set('ci-nav02b',123,'','');
 b:=tto.nav02_member_number_issue('ci-nav02b','dddddddd-dddd-4ddd-8ddd-dddddddddddb');
 IF a<>b THEN RAISE EXCEPTION 'CROSS_COOPERATIVE_IDENTICAL_NUMBER_REJECTED:%/%',a,b;END IF;
 v:=tto.nav02_office_holder_drafts_list('ci-nav02b');
 IF jsonb_array_length(v)<>0 THEN RAISE EXCEPTION 'CROSS_TENANT_OFFICER_LEAK';END IF;
 BEGIN
  PERFORM tto.nav02_attachment_list('ci-nav02a',
   'dddddddd-dddd-4ddd-8ddd-ddddddddddda');
  RAISE EXCEPTION 'CROSS_TENANT_ATTACHMENT_LIST_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM tto.nav02_attachment_save('ci-nav02b',
   'dddddddd-dddd-4ddd-8ddd-ddddddddddda','Forbidden foreign attachment',
   'application/pdf','wrong.pdf',80,decode(repeat('e4',32),'hex'),
   decode(repeat('b4',12),'hex'),decode(repeat('c4',16),'hex'),
   decode(repeat('d4',80),'hex'),'ClamAV synthetic CI verdict');
  RAISE EXCEPTION 'CROSS_TENANT_ATTACHMENT_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM tto.nav02_office_holder_draft_create('ci-nav02b',
   'dddddddd-dddd-4ddd-8ddd-ddddddddddda',null,'MEMBER','BOARD_MEMBER',false,'',
   '2026-01-01','2027-01-01','',null,'','');
  RAISE EXCEPTION 'CROSS_TENANT_OFFICER_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM tto.nav02_office_holder_drafts_list('ci-nav02a');
  RAISE EXCEPTION 'CROSS_TENANT_OFFICER_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'NAV02_ISSUE185_IDENTICAL_CROSS_TENANT_NUMBERS_AND_DRAFT_ISOLATION_PASS';
END $test$;
RESET ROLE;
ROLLBACK;
