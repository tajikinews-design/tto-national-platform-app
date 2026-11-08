-- PH12 #171: fail-closed source invalidation/recheck catalog checks.
-- Disposable PostgreSQL17 only after migration 0052. No fixture data.
BEGIN;
DO $checks$
DECLARE fn regprocedure;
BEGIN
 IF to_regclass('tto.ph12_tariff_board_source_invalidations') IS NULL
 THEN RAISE EXCEPTION 'PH12_0052_INVALIDATIONS_MISSING';END IF;
 fn:=to_regprocedure('tto.ph12_invalidate_tariff_board_source_check(uuid,uuid,text,text,uuid)');
 IF fn IS NULL OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'PH12_SOURCE_INVALIDATION_FUNCTION_MISSING';END IF;
 fn:=to_regprocedure('tto.ph12_tariff_board_source_recheck(uuid)');
 IF fn IS NULL OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'PH12_SOURCE_RECHECK_FUNCTION_MISSING';END IF;
 IF has_table_privilege('tto_app','tto.ph12_tariff_board_source_invalidations','SELECT') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_source_invalidations','INSERT') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_source_invalidations','UPDATE') OR
    has_table_privilege('tto_app','tto.ph12_tariff_board_source_invalidations','DELETE')
 THEN RAISE EXCEPTION 'PH12_SOURCE_INVALIDATION_RAW_ACCESS_EXPOSED';END IF;
 IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid='tto.ph12_tariff_board_source_invalidations'::regclass)
 THEN RAISE EXCEPTION 'PH12_SOURCE_INVALIDATION_RLS_MISSING';END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger
   WHERE tgrelid='tto.ph12_tariff_board_source_invalidations'::regclass
     AND tgname='ph12_board_source_invalidations_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'PH12_SOURCE_INVALIDATION_IMMUTABILITY_MISSING';END IF;
END $checks$;
SAVEPOINT no_actor;
SET LOCAL ROLE tto_app;
DO $deny$
BEGIN
 BEGIN
  PERFORM * FROM tto.ph12_invalidate_tariff_board_source_check(
   gen_random_uuid(),gen_random_uuid(),'SOURCE_WITHDRAWN','CI-SOURCE-WITHDRAWN-001',gen_random_uuid());
  RAISE EXCEPTION 'PH12_SOURCE_NO_ACTOR_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='PH12_SOURCE_NO_ACTOR_ALLOWED' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM * FROM tto.ph12_tariff_board_source_recheck(gen_random_uuid());
  RAISE EXCEPTION 'PH12_RECHECK_NO_ACTOR_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='PH12_RECHECK_NO_ACTOR_ALLOWED' THEN RAISE;END IF;
 END;
END $deny$;
ROLLBACK TO SAVEPOINT no_actor;
ROLLBACK;
