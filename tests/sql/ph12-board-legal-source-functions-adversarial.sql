-- PH12 Issue 171 PG17 adversarial smoke (disposable DB after migration 0050).
-- No fixtures and no production writes. Session-local role test; rollback always.
BEGIN;
DO $$
DECLARE fn regprocedure;
BEGIN
 fn:=to_regprocedure('tto.ph12_record_board_legal_source_check(uuid,text,text,text,text,timestamptz,timestamptz,text,uuid)');
 IF fn IS NULL THEN RAISE EXCEPTION 'PH12_0050_FUNCTION_MISSING'; END IF;
 IF NOT has_function_privilege('tto_app',fn,'EXECUTE') THEN
   RAISE EXCEPTION 'PH12_APP_EXECUTE_MISSING'; END IF;
 IF has_table_privilege('tto_app','tto.ph12_tariff_board_legal_source_checks','INSERT') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_legal_source_checks','UPDATE')
 THEN RAISE EXCEPTION 'PH12_DIRECT_TABLE_WRITE_EXPOSED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn::oid AND NOT prosecdef)
 THEN RAISE EXCEPTION 'PH12_FUNCTION_NOT_DEFINER';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn::oid AND
           pg_get_functiondef(oid) ILIKE '%tariff_activated%')
 THEN RAISE EXCEPTION 'PH12_FUNCTION_LEAKS_ACTIVATION';END IF;
END $$;
SAVEPOINT no_context;
SET LOCAL ROLE tto_app;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM tto.ph12_record_board_legal_source_check(
   gen_random_uuid(),'BOARD_ROSTER','registry-ref-v1','v1',
   repeat('a',64),clock_timestamp()-interval '1 hour',
   clock_timestamp()+interval '1 day','PENDING_OFFICIAL_VERIFICATION',gen_random_uuid());
  RAISE EXCEPTION 'PH12_MISSING_CONTEXT_WAS_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM = 'PH12_MISSING_CONTEXT_WAS_ALLOWED' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK TO SAVEPOINT no_context;
DO $$
DECLARE c text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO c FROM pg_constraint
 WHERE conrelid='tto.ph12_tariff_board_legal_source_checks'::regclass
   AND contype='c' AND pg_get_constraintdef(oid) LIKE '%SOURCE_REJECTED%'
 LIMIT 1;
 IF c IS NULL OR c LIKE '%APPROVED%' OR c LIKE '%ACTIVE%'
 THEN RAISE EXCEPTION 'PH12_HOLD_STATES_BROKEN'; END IF;
END $$;
ROLLBACK;
