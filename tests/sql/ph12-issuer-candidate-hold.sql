-- PH12 issuer catalog candidate: 75-migration isolated PG17 acceptance.
BEGIN;
DO $$
DECLARE f regprocedure; g regprocedure;
BEGIN
 IF to_regclass('tto.ph12_cooperative_source_issuer_candidates') IS NULL
 THEN RAISE EXCEPTION 'PH12_0053_CATALOG_MISSING';END IF;
 f:=to_regprocedure('tto.ph12_propose_cooperative_source_issuer(text,text,text,text,text,uuid)');
 g:=to_regprocedure('tto.ph12_list_cooperative_source_issuer_candidates()');
 IF f IS NULL OR g IS NULL OR
    NOT has_function_privilege('tto_app',f,'EXECUTE') OR
    NOT has_function_privilege('tto_app',g,'EXECUTE')
 THEN RAISE EXCEPTION 'PH12_ISSUER_FUNCTION_PRIVILEGE_MISSING';END IF;
 IF has_table_privilege('tto_app','tto.ph12_cooperative_source_issuer_candidates','SELECT') OR
    has_table_privilege('tto_app','tto.ph12_cooperative_source_issuer_candidates','INSERT') OR
    has_table_privilege('tto_app','tto.ph12_cooperative_source_issuer_candidates','UPDATE') OR
    has_table_privilege('tto_app','tto.ph12_cooperative_source_issuer_candidates','DELETE')
 THEN RAISE EXCEPTION 'PH12_ISSUER_RAW_TABLE_EXPOSED';END IF;
 IF NOT(SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
   WHERE oid='tto.ph12_cooperative_source_issuer_candidates'::regclass)
 THEN RAISE EXCEPTION 'PH12_ISSUER_RLS_NOT_FORCED';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
 WHERE tgrelid='tto.ph12_cooperative_source_issuer_candidates'::regclass
 AND tgname='ph12_source_issuer_candidate_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'PH12_ISSUER_IMMUTABILITY_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
 WHERE conrelid='tto.ph12_cooperative_source_issuer_candidates'::regclass
 AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%PENDING_ISSUER_AUTHENTICATION%')
 THEN RAISE EXCEPTION 'PH12_ISSUER_PENDING_ONLY_MISSING';END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint
 WHERE conrelid='tto.ph12_cooperative_source_issuer_candidates'::regclass
 AND contype='c' AND pg_get_constraintdef(oid) LIKE '%APPROVED%')
 THEN RAISE EXCEPTION 'PH12_ISSUER_APPROVAL_LEAK';END IF;
END $$;
SAVEPOINT no_context;
SET LOCAL ROLE tto_app;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM tto.ph12_propose_cooperative_source_issuer(
   'LEGAL_ENTITY_IDENTITY','LEGAL_ENTITY_REGISTRY',
   'Candidate national registry','https://ilenc.ssaa.ir/',
   'Article 52 cooperative law',gen_random_uuid());
  RAISE EXCEPTION 'PH12_ISSUER_NO_CONTEXT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='PH12_ISSUER_NO_CONTEXT_ALLOWED' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM * FROM tto.ph12_list_cooperative_source_issuer_candidates();
  RAISE EXCEPTION 'PH12_ISSUER_NO_CONTEXT_READ_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='PH12_ISSUER_NO_CONTEXT_READ_ALLOWED' THEN RAISE;END IF;
 END;
END $$;
ROLLBACK TO SAVEPOINT no_context;
ROLLBACK;
