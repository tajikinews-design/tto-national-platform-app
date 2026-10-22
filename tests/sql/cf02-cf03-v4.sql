\set ON_ERROR_STOP on
-- v4 checks against already-seeded v1,v2,v3 synthetic DB.
INSERT INTO tto.legal_authorities(authority_id,holder_id,tenant_id,scope,evidence_id,verified_by,verified_at,valid_until)
VALUES('dddd1111-1111-4111-8111-dddddddddddd',
 '22222222-2222-4222-8222-222222222222',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LEGAL_HOLD',
 '33333333-3333-4333-8333-333333333332',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',now(),now()+interval '1 day');
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.release_legal_hold('66666666-6666-4666-8666-666666666666',
 '33333333-3333-4333-8333-333333333332') THEN
 RAISE EXCEPTION 'SELF_HOLD_RELEASE_ALLOWED'; END IF;
END $t$;
ROLLBACK;
BEGIN;
SELECT set_config('tto.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF NOT tto.release_legal_hold('66666666-6666-4666-8666-666666666666',
 '33333333-3333-4333-8333-333333333332') THEN
 RAISE EXCEPTION 'INDEPENDENT_HOLD_RELEASE_DENIED'; END IF;
 IF tto.release_legal_hold('66666666-6666-4666-8666-666666666666',
 '33333333-3333-4333-8333-333333333332') THEN
 RAISE EXCEPTION 'HOLD_RELEASE_REPLAY'; END IF;
END $t$;
COMMIT;
RESET ROLE;
DO $t$ DECLARE denied boolean:=false; BEGIN
 BEGIN DELETE FROM tto.documents WHERE document_id='33333333-3333-4333-8333-333333333331';
 EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'DOCUMENT_HARD_DELETE_AFTER_HOLD_RELEASE'; END IF;
END $t$;
-- Tenant C's earlier v3 mutation is SETUP_PENDING version 2.
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa',
 'SETUP_PENDING','ACTIVE',2,'22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'TENANT_ACTOR_SPOOFING_ALLOWED'; END IF;
 IF NOT tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa',
 'SETUP_PENDING','ACTIVE',2,'11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'LEGAL_TENANT_ACTIVATION_FAILED'; END IF;
 IF tto.transition_tenant('cccccccc-cccc-4ccc-8ccc-aaaaaaaaaaaa',
 'SETUP_PENDING','ACTIVE',2,'11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'REPLAYED_TENANT_TRANSITION_ALLOWED'; END IF;
END $t$;
COMMIT;
RESET ROLE;
-- New Party alias must preserve originals and reject wrong signed actor.
INSERT INTO tto.parties(party_id,party_kind,display_label) VALUES
('bbbb1111-1111-4111-8111-bbbbbbbbbbbb','PERSON','Synthetic Alias Old'),
('bbbb2222-2222-4222-8222-bbbbbbbbbbbb','PERSON','Synthetic Alias Current');
SET ROLE tto_app;
BEGIN;
SELECT set_config('tto.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('tto.tenant_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $t$ BEGIN
 IF tto.merge_party_alias('bbbb1111-1111-4111-8111-bbbbbbbbbbbb','bbbb2222-2222-4222-8222-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'PARTY_ACTOR_SPOOFING_ALLOWED'; END IF;
 IF NOT tto.merge_party_alias('bbbb1111-1111-4111-8111-bbbbbbbbbbbb','bbbb2222-2222-4222-8222-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'VERIFIED_PARTY_ALIAS_DENIED'; END IF;
END $t$;
COMMIT;
RESET ROLE;
DO $t$ BEGIN
 IF (SELECT count(*) FROM tto.parties WHERE party_id IN
 ('bbbb1111-1111-4111-8111-bbbbbbbbbbbb','bbbb2222-2222-4222-8222-bbbbbbbbbbbb'))<>2
 THEN RAISE EXCEPTION 'HISTORICAL_PARTY_ERASED'; END IF;
END $t$;
SELECT 'TTO_CF02_03_LIFECYCLE_HOLD_RELEASE_PASS' AS result;
