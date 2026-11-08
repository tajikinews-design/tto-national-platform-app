-- Real PG17 structural gate for source-declared conflict cases.
BEGIN;
DO $check$
DECLARE table_name text;fn regprocedure;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['cooperative_governance_conflict_cases',
   'cooperative_governance_conflict_evidence','cooperative_governance_conflict_dispositions'] LOOP
   IF to_regclass('tto.'||table_name) IS NULL THEN
    RAISE EXCEPTION 'CHILD06_CONFLICT_TABLE_MISSING %',table_name;END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('tto.'||table_name)
     AND relrowsecurity AND relforcerowsecurity)
    THEN RAISE EXCEPTION 'CHILD06_CONFLICT_RLS_MISSING %',table_name;END IF;
   IF has_table_privilege('tto_app','tto.'||table_name,'SELECT') OR
      has_table_privilege('tto_app','tto.'||table_name,'INSERT') OR
      has_table_privilege('tto_app','tto.'||table_name,'UPDATE') OR
      has_table_privilege('tto_app','tto.'||table_name,'DELETE')
    THEN RAISE EXCEPTION 'CHILD06_CONFLICT_RAW_TABLE_LEAK %',table_name;END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('tto.'||table_name)
      AND NOT tgisinternal AND tgname LIKE '%_immutable')
    THEN RAISE EXCEPTION 'CHILD06_CONFLICT_IMMUTABLE_TRIGGER_MISSING %',table_name;END IF;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY[
  to_regprocedure('tto.cooperative_open_governance_conflict_case(text,text,text,jsonb,uuid)'),
  to_regprocedure('tto.cooperative_review_governance_conflict(uuid,text,uuid[],text,uuid)'),
  to_regprocedure('tto.cooperative_governance_conflict_audit()')] LOOP
  IF fn IS NULL OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
   THEN RAISE EXCEPTION 'CHILD06_CONFLICT_FUNCTION_NOT_GRANTED';END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND prosecdef)
   THEN RAISE EXCEPTION 'CHILD06_CONFLICT_FUNCTION_NOT_SECURE';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='tto.cooperative_governance_conflict_dispositions'::regclass
  AND pg_get_constraintdef(oid) LIKE '%tariff_activated%')
 THEN RAISE EXCEPTION 'CHILD06_CONFLICT_TARIFF_FENCE_MISSING';END IF;
END $check$;
SAVEPOINT anonymous;
SET LOCAL ROLE tto_app;
DO $deny$
BEGIN
 BEGIN
  PERFORM tto.cooperative_governance_conflict_audit();
  RAISE EXCEPTION 'CHILD06_CONFLICT_ANONYMOUS_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_CONFLICT_ANONYMOUS_LEAK' THEN RAISE;END IF;
 END;
END $deny$;
ROLLBACK TO SAVEPOINT anonymous;
ROLLBACK;
