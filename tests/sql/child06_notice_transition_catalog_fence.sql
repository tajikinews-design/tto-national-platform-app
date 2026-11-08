-- Child06 manager catalog is not a raw-table bypass or legal attestation.
BEGIN;
DO $check$
DECLARE fn regprocedure;
BEGIN
 fn:=to_regprocedure('tto.cooperative_notice_transition_catalog()');
 IF fn IS NULL OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_FUNCTION_MISSING';END IF;
 IF has_table_privilege('tto_app','tto.cooperative_notice_transitions','SELECT') OR
    has_table_privilege('tto_app','tto.cooperative_legal_notice_archive','SELECT')
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_RAW_TABLE_LEAK';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=fn AND prosecdef)
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_NEEDS_DEFINER';END IF;
END $check$;
SAVEPOINT anon;
SET LOCAL ROLE tto_app;
DO $check$
BEGIN
 BEGIN
   PERFORM tto.cooperative_notice_transition_catalog();
   RAISE EXCEPTION 'CHILD06_TRANSITION_CATALOG_ANONYMOUS_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM='CHILD06_TRANSITION_CATALOG_ANONYMOUS_LEAK' THEN RAISE;END IF;
 END;
END $check$;
ROLLBACK TO SAVEPOINT anon;
ROLLBACK;
