-- No mutations: invalid or missing session must never disclose any phone number.
BEGIN;
SET LOCAL ROLE tto_app;
DO $test$
DECLARE mobile text;
BEGIN
 IF has_table_privilege('tto_app','tto.verified_mobile_identifiers','SELECT')
 THEN RAISE EXCEPTION 'RAW_VERIFIED_MOBILE_SELECT_EXPOSED'; END IF;
 IF NOT has_function_privilege('tto_app','tto.commerce_demo_verified_mobile_from_session(bytea)','EXECUTE')
 THEN RAISE EXCEPTION 'SAFE_MOBILE_LOOKUP_UNAVAILABLE'; END IF;
 SELECT tto.commerce_demo_verified_mobile_from_session(decode(repeat('00',32),'hex')) INTO mobile;
 IF mobile IS NOT NULL THEN RAISE EXCEPTION 'INVALID_SESSION_MOBILE_LEAK'; END IF;
 SELECT tto.commerce_demo_verified_mobile_from_session(NULL::bytea) INTO mobile;
 IF mobile IS NOT NULL THEN RAISE EXCEPTION 'NULL_SESSION_MOBILE_LEAK'; END IF;
END $test$;
ROLLBACK;
