-- PH04: SOURCE CHILD02 8 original scenarios, synthetic and rolled back.
-- Label partial assertions explicitly; a unique constraint test is NOT a true race test.
BEGIN;
INSERT INTO tto.user_accounts(user_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO tto.tenants(tenant_id,slug,display_name)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ph04-original','Synthetic county cooperative');
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
 VALUES
 ('f1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TENANT_LIFECYCLE',
 'f2222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',
 now(),now()+interval '1 day'),
 ('f3333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PARTY_MERGE',
 'f4444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
 now(),now()+interval '1 day');
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true),
 set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

-- CORE-TENANT-AT-001: authorized activation creates no role, membership or shareholding.
DO $case$
BEGIN
 IF NOT tto.transition_tenant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'PROVISIONING','SETUP_PENDING',1,'11111111-1111-4111-8111-111111111111')
 OR NOT tto.transition_tenant('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'SETUP_PENDING','ACTIVE',2,'11111111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'CHILD02_001_AUTHORIZED_ACTIVATION_DENIED';
 END IF;
 IF (SELECT count(*) FROM tto.role_assignments WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0
 OR (SELECT count(*) FROM tto.relationship_projections WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0
 OR (SELECT count(*) FROM tto.shareholding_source_snapshots WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0 THEN
  RAISE EXCEPTION 'CHILD02_001_ACTIVATION_IMPLICIT_PERMISSIONS_OR_SHARES';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-001_SYNTHETIC_DIRECT_ASSERTION_PASS' AS signal;

-- CORE-TENANT-AT-002: stable immutable tenant_id through owner-side slug update.
-- Contractual authorized slug-change command and full redirect history are NOT yet proven.
UPDATE tto.tenants SET slug='ph04-renamed'
 WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $case$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM tto.tenants WHERE
  tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND slug='ph04-renamed') THEN
  RAISE EXCEPTION 'CHILD02_002_TENANT_ID_CHANGED';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-002_PARTIAL_IMMUTABLE_UUID_ONLY' AS signal;

-- CORE-TENANT-AT-003: existing UNIQUE catches sequential competing slug;
-- a two-connection concurrent transaction race must still be tested.
INSERT INTO tto.tenants(tenant_id,slug,display_name)
 VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ph04-race','Synthetic B');
DO $case$ BEGIN
 BEGIN
  INSERT INTO tto.tenants(tenant_id,slug,display_name)
   VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','ph04-race','Synthetic C');
  RAISE EXCEPTION 'CHILD02_003_DUPLICATE_SLUG_ALLOWED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $case$;
SELECT 'CORE-TENANT-AT-003_PARTIAL_SEQUENTIAL_NOT_CONCURRENT' AS signal;

-- CORE-TENANT-AT-004: Party global registry exists independently of User.
INSERT INTO tto.parties(party_id,party_kind,display_label)
 VALUES('33333333-3333-4333-8333-333333333333','PERSON','Synthetic A party'),
       ('44444444-4444-4444-8444-444444444444','PERSON','Synthetic B party');
DO $case$ BEGIN
 IF (SELECT count(*) FROM tto.user_party_links WHERE party_id='33333333-3333-4333-8333-333333333333')<>0 THEN
  RAISE EXCEPTION 'CHILD02_004_PARTY_REQUIRED_USER';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-004_SYNTHETIC_DIRECT_ASSERTION_PASS' AS signal;

-- CORE-TENANT-AT-005: UserParty link must not create membership or holdings.
INSERT INTO tto.user_party_links(user_id,party_id,verified_at)
 VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',now());
DO $case$ BEGIN
 IF (SELECT count(*) FROM tto.relationship_projections WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0
 OR (SELECT count(*) FROM tto.shareholding_source_snapshots WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0 THEN
  RAISE EXCEPTION 'CHILD02_005_LINK_CREATED_FINANCIAL_STATE';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-005_SYNTHETIC_DIRECT_ASSERTION_PASS' AS signal;

-- Build a wholly fictitious sourced snapshot to test approved Party alias.
INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 'ACTIVE','b1111111-1111-4111-8111-111111111111');
INSERT INTO tto.member_source_snapshots(tenant_id,party_id,source_ref,source_event_id,
 source_version,membership_status,source_as_of)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 'PH04_SYNTHETIC_SOURCE','b1111111-1111-4111-8111-111111111111',1,'ACTIVE',now());
INSERT INTO tto.shareholder_source_accounts(tenant_id,party_id,shareholder_account_id,
 source_ref,source_version,account_status)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 'b2222222-2222-4222-8222-222222222222','PH04_SYNTHETIC_SOURCE',1,'ACTIVE');
INSERT INTO tto.shareholding_source_snapshots(snapshot_id,tenant_id,shareholder_account_id,
 source_ref,ledger_entry_ref,ledger_version,share_quantity,ledger_as_of)
 VALUES('b3333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'b2222222-2222-4222-8222-222222222222','PH04_SYNTHETIC_SOURCE',
 'b4444444-4444-4444-8444-444444444444',1,11,now());

-- CORE-TENANT-AT-006: authorized Party alias does not rewrite source account or ledger.
DO $case$ BEGIN
 IF NOT tto.merge_party_alias('33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'CHILD02_006_AUTHORIZED_PARTY_MERGE_DENIED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.shareholder_source_accounts
    WHERE party_id='33333333-3333-4333-8333-333333333333'
      AND shareholder_account_id='b2222222-2222-4222-8222-222222222222')
 OR NOT EXISTS(SELECT 1 FROM tto.shareholding_source_snapshots
     WHERE ledger_entry_ref='b4444444-4444-4444-8444-444444444444'
       AND share_quantity=11) THEN
  RAISE EXCEPTION 'CHILD02_006_PARTY_MERGE_TRANSFERRED_SHARES';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-006_SYNTHETIC_DIRECT_ASSERTION_PASS' AS signal;

-- CORE-TENANT-AT-007: same projection (tenant,party) cannot duplicate,
-- but a full source-event idempotent ingestion command is not implemented.
INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 'ACTIVE','b1111111-1111-4111-8111-111111111111') ON CONFLICT DO NOTHING;
DO $case$ BEGIN
 IF (SELECT count(*) FROM tto.relationship_projections
     WHERE tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       AND party_id='33333333-3333-4333-8333-333333333333')<>1 THEN
  RAISE EXCEPTION 'CHILD02_007_DUPLICATE_PROJECTION';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-007_PARTIAL_NO_SOURCE_EVENT_INGESTION' AS signal;

-- CORE-TENANT-AT-008: no authenticated or unauthenticated runtime actor may enumerate global Party.
DO $case$ BEGIN
 IF has_table_privilege('tto_app','tto.parties','SELECT')
    OR has_table_privilege('tto_app','tto.party_identifiers','SELECT') THEN
  RAISE EXCEPTION 'CHILD02_008_GLOBAL_PARTY_ENUMERATION_ALLOWED';
 END IF;
END $case$;
SELECT 'CORE-TENANT-AT-008_SYNTHETIC_DIRECT_SQL_PRIVILEGE_PASS' AS signal;
ROLLBACK;
SELECT 'TTO_PH04_CHILD02_8_SOURCE_SCENARIO_PROBES_EXECUTED_WITH_PARTIAL_FLAGS' AS signal;
