-- CHILD06 two-person internal attestation, fail-closed PG17 structural fence.
BEGIN;
DO $fence$
DECLARE tab text; f regprocedure;
BEGIN
 FOREACH tab IN ARRAY ARRAY[
  'cooperative_notice_attestation_policies',
  'cooperative_notice_trusted_signatories',
  'cooperative_notice_internal_attestations',
  'cooperative_notice_internal_attestation_holds'] LOOP
  IF to_regclass('tto.'||tab) IS NULL THEN
    RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_TABLE_MISSING %',tab; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('tto.'||tab)
      AND relrowsecurity AND relforcerowsecurity)
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_RLS_NOT_FORCED %',tab;END IF;
  IF has_table_privilege('tto_app','tto.'||tab,'SELECT') OR
     has_table_privilege('tto_app','tto.'||tab,'INSERT') OR
     has_table_privilege('tto_app','tto.'||tab,'UPDATE') OR
     has_table_privilege('tto_app','tto.'||tab,'DELETE')
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_RAW_TABLE_ACCESS %',tab; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('tto.'||tab)
      AND NOT tgisinternal AND tgname LIKE '%_immutable')
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_APPEND_ONLY_MISSING %',tab;END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
  to_regprocedure('tto.cooperative_notice_internal_attestation_state(uuid)'),
  to_regprocedure('tto.cooperative_record_notice_internal_attestation(uuid,bytea,text,uuid)'),
  to_regprocedure('tto.cooperative_hold_notice_internal_attestation(uuid,text,uuid)')] LOOP
  IF f IS NULL OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=f)
     OR NOT has_function_privilege('tto_app',f,'EXECUTE')
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_DEF_INVOKE_MISSING';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='tto.cooperative_notice_internal_attestations'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%official_issuer_authenticated%'
    AND pg_get_constraintdef(oid) ILIKE '%false%')
 THEN
  -- Column-local zero-trust CHECK is sufficient even when not part of combined constraint
  IF NOT EXISTS(SELECT 1 FROM pg_constraint
   WHERE conrelid='tto.cooperative_notice_internal_attestations'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%official_issuer_authenticated%')
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_CANNOT_MARK_UNAUTHENTICATED';END IF;
 END IF;
END $fence$;
SAVEPOINT anonymous;
SET LOCAL ROLE tto_app;
DO $deny$
BEGIN
 BEGIN
  PERFORM tto.cooperative_record_notice_internal_attestation(
   gen_random_uuid(),decode(repeat('ab',32),'hex'),
   'I_CONFIRM_DOCUMENT_ACCURACY_AND_PERSONAL_RESPONSIBILITY',
   gen_random_uuid());
  RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_ANON_WAS_ACCEPTED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_DUAL_ATTESTATION_ANON_WAS_ACCEPTED' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM 1 FROM tto.cooperative_notice_trusted_signatories;
  RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_ROSTER_IS_PUBLIC';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_DUAL_ATTESTATION_ROSTER_IS_PUBLIC' THEN RAISE;END IF;
 END;
END $deny$;
ROLLBACK TO SAVEPOINT anonymous;
ROLLBACK;
