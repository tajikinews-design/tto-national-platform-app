-- CHILD06 original encrypted PDF escrow structural and fail-closed security fence.
-- Disposable PG17 only; no production documents or legal source identities.
BEGIN;
DO $check$
DECLARE func regprocedure; i text;
BEGIN
 IF to_regclass('tto.cooperative_governance_source_files') IS NULL
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_TABLE_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class
   WHERE oid='tto.cooperative_governance_source_files'::regclass
    AND relrowsecurity AND relforcerowsecurity)
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_FORCE_RLS_MISSING';END IF;
 FOREACH i IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
  IF has_table_privilege('tto_app','tto.cooperative_governance_source_files',i)
  THEN RAISE EXCEPTION 'CHILD06_ESCROW_RAW_TABLE_PRIVILEGE_%',i;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='tto.cooperative_governance_source_files'::regclass
    AND NOT tgisinternal AND tgname='cooperative_governance_source_file_immutable')
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_IMMUTABILITY_MISSING';END IF;
 FOREACH func IN ARRAY ARRAY[
  to_regprocedure('tto.cooperative_store_governance_source_file(uuid,uuid,integer,bytea,bytea,bytea,bytea,uuid)'),
  to_regprocedure('tto.cooperative_governance_source_integrity_packet(uuid)')]
 LOOP
  IF func IS NULL OR NOT has_function_privilege('tto_app',func,'EXECUTE') OR
     NOT (SELECT prosecdef FROM pg_proc WHERE oid=func)
  THEN RAISE EXCEPTION 'CHILD06_ESCROW_GUARDED_FUNCTION_MISSING';END IF;
 END LOOP;
 IF position(':conflict-review:' in pg_get_functiondef(
      'tto.cooperative_store_governance_source_file(uuid,uuid,integer,bytea,bytea,bytea,bytea,uuid)'::regprocedure))=0
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_REVIEW_RACE_FENCE_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
    conrelid='tto.cooperative_governance_source_files'::regclass AND
    pg_get_constraintdef(oid) LIKE '%ENCRYPTED_QUARANTINED_UNAUTHENTICATED%')
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_MUST_REMAIN_QUARANTINED';END IF;
 IF (SELECT count(*) FROM pg_constraint
     WHERE conrelid='tto.cooperative_governance_source_files'::regclass
       AND pg_get_constraintdef(oid) LIKE '%= false%') < 3
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_POSITIVE_AUTHORITY_FENCE_MISSING';END IF;
END $check$;
SAVEPOINT anonymous_scope;
SET LOCAL ROLE tto_app;
DO $deny$
BEGIN
 BEGIN
  PERFORM tto.cooperative_governance_source_integrity_packet(gen_random_uuid());
  RAISE EXCEPTION 'CHILD06_ESCROW_ANONYMOUS_READ_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_ESCROW_ANONYMOUS_READ_LEAK' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM 1 FROM tto.cooperative_governance_source_files LIMIT 1;
  RAISE EXCEPTION 'CHILD06_ESCROW_DIRECT_TABLE_READ_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_ESCROW_DIRECT_TABLE_READ_LEAK' THEN RAISE;END IF;
 END;
END $deny$;
ROLLBACK TO SAVEPOINT anonymous_scope;
ROLLBACK;
