-- CHILD06 scanned PDF + source HOLD + keyring: disposable PG17 structural fence.
BEGIN;
DO $test$
DECLARE tab text; fn regprocedure;
BEGIN
 FOREACH tab IN ARRAY ARRAY['cooperative_governance_pdf_scan_events',
   'cooperative_governance_pdf_source_observations'] LOOP
  IF to_regclass('tto.'||tab) IS NULL
  THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_TABLE_MISSING %',tab;END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('tto.'||tab)
      AND relrowsecurity AND relforcerowsecurity)
  THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_RLS_MISSING %',tab;END IF;
  IF has_table_privilege('tto_app','tto.'||tab,'SELECT') OR
     has_table_privilege('tto_app','tto.'||tab,'INSERT') OR
     has_table_privilege('tto_app','tto.'||tab,'UPDATE') OR
     has_table_privilege('tto_app','tto.'||tab,'DELETE')
  THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_RAW_TABLE_GRANT %',tab;END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('tto.'||tab)
     AND NOT tgisinternal AND tgname LIKE '%_immutable')
  THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_APPEND_ONLY_MISSING %',tab;END IF;
 END LOOP;
 FOREACH fn IN ARRAY ARRAY[
  to_regprocedure('tto.cooperative_store_governance_source_file_versioned(uuid,uuid,integer,bytea,bytea,bytea,bytea,text,uuid)'),
  to_regprocedure('tto.cooperative_record_governance_pdf_scan(uuid,text,text,text,uuid)'),
  to_regprocedure('tto.cooperative_record_governance_pdf_source_hold(uuid,text,text,uuid)')] LOOP
  IF fn IS NULL OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn)
     OR NOT has_function_privilege('tto_app',fn,'EXECUTE')
  THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_SECURITY_DEFINER_OR_GRANT_MISSING';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='tto.cooperative_governance_source_files'::regclass
  AND pg_get_constraintdef(oid) LIKE '%child06-lab-v2%')
 THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_VERSIONED_KEY_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='tto.cooperative_governance_pdf_source_observations'::regclass
  AND pg_get_constraintdef(oid) LIKE '%NO_OFFICIAL_CONNECTOR%')
 THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_NO_OFFICIAL_CONNECTOR_HOLD_MISSING';END IF;
 IF (SELECT count(*) FROM pg_constraint
     WHERE conrelid='tto.cooperative_governance_pdf_source_observations'::regclass
       AND pg_get_constraintdef(oid) LIKE '%= false%')<3
 THEN RAISE EXCEPTION 'CHILD06_PDF_GATE_LEGAL_FENCE_MISSING';END IF;
END $test$;
SAVEPOINT anonymous;
SET LOCAL ROLE tto_app;
DO $test$
BEGIN
 BEGIN
  PERFORM tto.cooperative_record_governance_pdf_source_hold(
    gen_random_uuid(),'NO_OFFICIAL_CONNECTOR','CI-ANON-UNVERIFIED',gen_random_uuid());
  RAISE EXCEPTION 'CHILD06_PDF_ANONYMOUS_SOURCE_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_PDF_ANONYMOUS_SOURCE_LEAK' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM 1 FROM tto.cooperative_governance_pdf_scan_events;
  RAISE EXCEPTION 'CHILD06_PDF_SCAN_RAW_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_PDF_SCAN_RAW_LEAK' THEN RAISE;END IF;
 END;
END $test$;
ROLLBACK TO SAVEPOINT anonymous;
ROLLBACK;
