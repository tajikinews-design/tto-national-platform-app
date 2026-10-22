\set ON_ERROR_STOP on
-- Requires 0001-0005 and sample 0001 tenant fixture.
INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes) VALUES ('SESSION_CHALLENGE',3,15)
 ON CONFLICT (policy_key) DO NOTHING;
INSERT INTO tto.user_accounts(user_id) VALUES('99999999-9999-4999-8999-999999999999') ON CONFLICT DO NOTHING;
INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at)
 VALUES('09123456789','99999999-9999-4999-8999-999999999999',now());
SET ROLE tto_app;
-- Deny invalid and unknown identifier without leaking database records.
DO $t$ BEGIN
 IF tto.begin_smsotp_login('09123456780','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',decode(repeat('ab',32),'hex'),now()+interval '4 minutes')
 THEN RAISE EXCEPTION 'UNKNOWN_PHONE_CREATED_CHALLENGE'; END IF;
 IF NOT tto.begin_smsotp_login('09123456789','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',decode(repeat('ab',32),'hex'),now()+interval '4 minutes')
 THEN RAISE EXCEPTION 'VERIFIED_PHONE_NOT_ALLOWED'; END IF;
 -- Do not issue session until provider accepts delivery.
 IF (SELECT tto.consume_challenge('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',decode(repeat('ab',32),'hex'),decode(repeat('01',32),'hex')) IS NOT NULL
 THEN RAISE EXCEPTION 'SESSION_ISSUED_BEFORE_DELIVERY'; END IF;
 IF NOT tto.complete_smsotp_delivery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',true)
 THEN RAISE EXCEPTION 'DELIVERY_CONFIRMATION_REJECTED'; END IF;
 IF tto.complete_smsotp_delivery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',true)
 THEN RAISE EXCEPTION 'DOUBLE_DELIVERY_CONFIRMATION'; END IF;
 IF NOT tto.begin_smsotp_login('09123456789','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13',decode(repeat('ac',32),'hex'),now()+interval '4 minutes')
 THEN RAISE EXCEPTION 'SECOND_CHALLENGE_REJECTED'; END IF;
 IF NOT tto.complete_smsotp_delivery('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13',false)
 THEN RAISE EXCEPTION 'FAILURE_ATTESTATION_REJECTED'; END IF;
 IF (SELECT tto.consume_challenge('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13',decode(repeat('ac',32),'hex'),decode(repeat('02',32),'hex')) IS NOT NULL
 THEN RAISE EXCEPTION 'FAILED_DELIVERY_ISSUED_SESSION'; END IF;
 IF NOT tto.begin_smsotp_login('09123456789','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14',decode(repeat('ad',32),'hex'),now()+interval '4 minutes')
 THEN RAISE EXCEPTION 'THIRD_CHALLENGE_REJECTED'; END IF;
 IF tto.begin_smsotp_login('09123456789','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15',decode(repeat('ae',32),'hex'),now()+interval '4 minutes')
 THEN RAISE EXCEPTION 'RATE_LIMIT_BYPASS'; END IF;
 IF has_table_privilege('tto_app','tto.verified_mobile_identifiers','SELECT') OR
    has_table_privilege('tto_app','tto.smsotp_delivery_attempts','UPDATE')
 THEN RAISE EXCEPTION 'MOBILE_PII_OR_DELIVERY_TABLE_EXPOSED'; END IF;
END $t$;
RESET ROLE;
SELECT 'TTO_SMSOTP_DATABASE_GATE_PASS' AS result;
