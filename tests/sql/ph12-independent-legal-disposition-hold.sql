-- PH12 #171 / PG17 catalog acceptance: source, document, legal review remain separate.
-- Must run on disposable PostgreSQL17 after migration 0051.
BEGIN;
DO $checks$
DECLARE fn regprocedure;
BEGIN
 IF to_regclass('tto.ph12_tariff_board_legal_dispositions') IS NULL
 THEN RAISE EXCEPTION 'PH12_0051_DISPOSITIONS_MISSING'; END IF;
 fn:=to_regprocedure('tto.ph12_record_tariff_board_legal_disposition(uuid,uuid,uuid[],text,text,uuid)');
 IF fn IS NULL OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'PH12_LEGAL_FUNCTION_NOT_GRANTED'; END IF;
 IF has_table_privilege('tto_app','tto.ph12_tariff_board_legal_dispositions','INSERT') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_legal_dispositions','UPDATE') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_legal_dispositions','DELETE') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_legal_dispositions','SELECT')
 THEN RAISE EXCEPTION 'PH12_LEGAL_DIRECT_TABLE_ACCESS_EXPOSED'; END IF;
 IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
         WHERE oid='tto.ph12_tariff_board_legal_dispositions'::regclass)
 THEN RAISE EXCEPTION 'PH12_LEGAL_RLS_NOT_FORCED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
   WHERE tgrelid='tto.ph12_tariff_board_legal_dispositions'::regclass
   AND tgname='ph12_board_legal_dispositions_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'PH12_LEGAL_IMMUTABLE_TRIGGER_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid='tto.role_assignments'::regclass
       AND conname='role_assignments_role_code_check'
       AND pg_get_constraintdef(oid) LIKE '%LEGAL_REVIEWER%')
 THEN RAISE EXCEPTION 'PH12_LEGAL_REVIEWER_ROLE_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid='tto.ph12_tariff_board_legal_dispositions'::regclass
       AND contype='c' AND pg_get_constraintdef(oid) LIKE '%LEGAL_HOLD_SOURCE_UNVERIFIED%'
       AND pg_get_constraintdef(oid) LIKE '%LEGAL_REJECTED%')
 THEN RAISE EXCEPTION 'PH12_LEGAL_DISPOSITIONS_HOLD_ONLY_CHECK_MISSING'; END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid='tto.ph12_tariff_board_legal_dispositions'::regclass
       AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%APPROVED%')
 THEN RAISE EXCEPTION 'PH12_LEGAL_APPROVAL_FORBIDDEN'; END IF;
END $checks$;
SAVEPOINT unauthenticated;
SET LOCAL ROLE tto_app;
DO $deny$
BEGIN
 BEGIN
  PERFORM * FROM tto.ph12_record_tariff_board_legal_disposition(
   gen_random_uuid(),gen_random_uuid(),ARRAY[gen_random_uuid()],
   'LEGAL_HOLD_SOURCE_UNVERIFIED','CI-NON-AUTH-REVIEW-001',gen_random_uuid());
  RAISE EXCEPTION 'PH12_LEGAL_NO_ACTOR_WAS_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='PH12_LEGAL_NO_ACTOR_WAS_ALLOWED' THEN RAISE; END IF;
 END;
END $deny$;
ROLLBACK TO SAVEPOINT unauthenticated;
ROLLBACK;
