-- Child06 / PH12: source-declared company notices are never legal approval.
BEGIN;
DO $body$
DECLARE f regprocedure; g regprocedure;
BEGIN
 IF to_regclass('tto.cooperative_legal_notice_archive') IS NULL OR
    to_regclass('tto.cooperative_board_office_history') IS NULL OR
    to_regclass('tto.cooperative_signing_authority_history') IS NULL
 THEN RAISE EXCEPTION 'COOPERATIVE_LEGAL_NOTICE_SCHEMA_MISSING'; END IF;
 f:=to_regprocedure('tto.cooperative_append_legal_notice(text,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,uuid)');
 g:=to_regprocedure('tto.cooperative_shareholder_governance_history()');
 IF f IS NULL OR g IS NULL OR NOT has_function_privilege('tto_app',f,'EXECUTE') OR
    NOT has_function_privilege('tto_app',g,'EXECUTE')
 THEN RAISE EXCEPTION 'COOPERATIVE_LEGAL_NOTICE_API_MISSING';END IF;
 IF has_table_privilege('tto_app','tto.cooperative_legal_notice_archive','SELECT') OR
    has_table_privilege('tto_app','tto.cooperative_board_office_history','SELECT') OR
    has_table_privilege('tto_app','tto.cooperative_signing_authority_history','SELECT') OR
    has_table_privilege('tto_app','tto.cooperative_legal_notice_archive','INSERT')
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_RAW_GRANTS_LEAKED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN(
     'tto.cooperative_legal_notice_archive'::regclass,
     'tto.cooperative_board_office_history'::regclass,
     'tto.cooperative_signing_authority_history'::regclass)
    AND (NOT relrowsecurity OR NOT relforcerowsecurity))
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_FORCE_RLS_MISSING';END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
   AND tgrelid IN('tto.cooperative_legal_notice_archive'::regclass,
    'tto.cooperative_board_office_history'::regclass,
    'tto.cooperative_signing_authority_history'::regclass)
   AND tgname LIKE '%immutable')<>3
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_IMMUTABILITY_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
    conrelid='tto.cooperative_legal_notice_archive'::regclass AND
    pg_get_constraintdef(oid) LIKE '%USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED%')
 THEN RAISE EXCEPTION 'COOPERATIVE_NOTICE_SOURCE_NOT_FIXED_PENDING';END IF;
END $body$;
SAVEPOINT permission;
SET LOCAL ROLE tto_app;
DO $body$ BEGIN
 BEGIN
 PERFORM tto.cooperative_shareholder_governance_history();
 RAISE EXCEPTION 'COOPERATIVE_NOTICE_ANONYMOUS_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='COOPERATIVE_NOTICE_ANONYMOUS_LEAK' THEN RAISE;END IF;
 END;
END $body$;
ROLLBACK TO SAVEPOINT permission;
ROLLBACK;
