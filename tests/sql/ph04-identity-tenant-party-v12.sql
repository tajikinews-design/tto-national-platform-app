-- PH04 synthetic acceptance on disposable PostgreSQL17 only.
-- Run only after migrations 0001..0012, never against hosted database.
BEGIN;
DO $test$
DECLARE n integer; r record; required text;
BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='tto' AND c.relname IN ('auth_identifiers','auth_factors','role_definitions',
      'authority_references','tenant_slugs','tenant_legal_profiles','party_identifiers','party_merge_cases'))<>8
 THEN RAISE EXCEPTION 'PH04_8_TABLE_CONTRACTS_MISSING'; END IF;
 FOR r IN SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='tto' AND c.relname IN ('auth_identifiers','auth_factors','role_definitions',
      'authority_references','tenant_slugs','tenant_legal_profiles','party_identifiers','party_merge_cases')
 LOOP
   IF NOT r.relrowsecurity OR NOT r.relforcerowsecurity THEN
      RAISE EXCEPTION 'PH04_RLS_NOT_FORCED_%',r.relname;
   END IF;
   IF has_table_privilege('tto_app', 'tto.'||r.relname, 'SELECT')
      OR has_table_privilege('tto_app', 'tto.'||r.relname, 'INSERT')
      OR has_table_privilege('tto_app', 'tto.'||r.relname, 'UPDATE')
      OR has_table_privilege('tto_app', 'tto.'||r.relname, 'DELETE') THEN
      RAISE EXCEPTION 'PH04_TTO_APP_BYPASSES_SENSITIVE_%',r.relname;
   END IF;
 END LOOP;
 FOR required IN SELECT unnest(ARRAY[
  'user_accounts.authorization_epoch','user_accounts.version','user_sessions.assurance_level',
  'user_sessions.authorization_epoch_at_issue','auth_challenges.issued_at',
  'tenants.current_slug_ref','tenants.legal_profile_ref','tenants.geography_ref',
  'parties.merged_into','parties.status','user_party_links.basis','user_party_links.status',
  'role_assignments.scope_type','role_assignments.status','relationship_projections.relationship_type'])
 LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns col WHERE col.table_schema='tto'
   AND col.table_name=split_part(required,'.',1)
   AND col.column_name=split_part(required,'.',2)) THEN
   RAISE EXCEPTION 'PH04_REQUIRED_FIELD_MISSING_%',required;
  END IF;
 END LOOP;
END $test$;
-- Records are synthetic and transaction rollback removes them all.
INSERT INTO tto.user_accounts(user_id)
 VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph04-test-a','Synthetic A','ACTIVE'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ph04-test-b','Synthetic B','ACTIVE');
INSERT INTO tto.parties(party_id,party_kind,display_label)
 VALUES ('33333333-3333-4333-8333-333333333333','PERSON','Fake X'),
        ('44444444-4444-4444-8444-444444444444','PERSON','Fake Y');
INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code)
 VALUES ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','COOPERATIVE_MANAGER');
INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',
 decode(repeat('ab',32),'hex'),0,now()+interval '5 minutes');
DO $test$ BEGIN
 IF (SELECT count(*) FROM tto.resolve_session(decode(repeat('ab',32),'hex')))<>1 THEN
  RAISE EXCEPTION 'PH04_EXPECTED_CURRENT_SESSION';
 END IF;
END $test$;
UPDATE tto.user_accounts SET authorization_epoch=authorization_epoch+1
 WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.resolve_session(decode(repeat('ab',32),'hex'))) THEN
  RAISE EXCEPTION 'PH04_AUTH_EPOCH_FAILED_TO_REVOKE_SESSION';
 END IF;
END $test$;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true),
 set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $test$ BEGIN
 IF NOT tto.has_tenant_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null) THEN
  RAISE EXCEPTION 'PH04_EXPECTED_TENANT_ROLE';
 END IF;
 IF tto.has_tenant_role('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null) THEN
  RAISE EXCEPTION 'PH04_CROSS_TENANT_ROLE';
 END IF;
END $test$;
UPDATE tto.role_assignments SET status='REVOKED'
 WHERE assignment_id='55555555-5555-4555-8555-555555555555';
DO $test$ BEGIN
 IF tto.has_tenant_role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null) THEN
  RAISE EXCEPTION 'PH04_REVOKED_ROLE_STILL_ACTIVE';
 END IF;
END $test$;
INSERT INTO tto.user_party_links(user_id,party_id,verified_at)
 VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',now());
DO $test$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM tto.user_party_links
  WHERE user_id='11111111-1111-4111-8111-111111111111' AND status='VERIFIED') THEN
  RAISE EXCEPTION 'PH04_PARTY_LINK_SYNC_NOT_VERIFIED';
 END IF;
END $test$;
UPDATE tto.user_party_links SET status='REVOKED'
 WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM tto.user_party_links
  WHERE user_id='11111111-1111-4111-8111-111111111111' AND verified_at IS NOT NULL) THEN
  RAISE EXCEPTION 'PH04_REVOKED_PARTY_LINK_STILL_VERIFIED';
 END IF;
END $test$;
-- Same-tenant slug status and valid profile; no automatic real legal verification.
INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from)
 VALUES('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ph04-first','CURRENT',now());
INSERT INTO tto.tenant_legal_profiles(profile_id,tenant_id)
 VALUES('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
DO $test$ BEGIN
 BEGIN
  INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from)
   VALUES('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'ph04-second','CURRENT',now());
  RAISE EXCEPTION 'PH04_DUPLICATE_CURRENT_SLUG_ACCEPTED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO tto.auth_identifiers(identifier_id,user_account_id,identifier_type,
   normalized_hash,protected_value,verification_status)
   VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','MOBILE',
    decode(repeat('ef',32),'hex'),decode('012345','hex'),'VERIFIED');
  RAISE EXCEPTION 'PH04_UNVERIFIED_IDENTIFIER_MASQUERADED_AS_VERIFIED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO tto.party_merge_cases(case_id,tenant_id,survivor_party_id,duplicate_party_id,requested_by)
  VALUES(gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'PH04_SELF_MERGE_ACCEPTED';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $test$;
ROLLBACK;
-- Do NOT migrate or persist synthetic data.
SELECT 'TTO_PH04_PHYSICAL_IDENTITY_TENANT_PARTY_INVARIANTS_PASS' AS signal;
