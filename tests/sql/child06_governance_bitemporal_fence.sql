-- CHILD06/PH12 historical snapshot must not elevate provenance, leak
-- cross-tenant data, permit silent deletes or read unbounded partial history.
BEGIN;
DO $check$
DECLARE p regprocedure;q regprocedure;
BEGIN
 IF to_regclass('tto.cooperative_notice_transitions') IS NULL
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_TABLE_MISSING';END IF;
 p:=to_regprocedure('tto.cooperative_append_notice_transition(uuid,uuid,text,text,text,text,uuid)');
 q:=to_regprocedure('tto.cooperative_governance_temporal_facts(timestamptz)');
 IF p IS NULL OR q IS NULL OR
    NOT has_function_privilege('tto_app',p,'EXECUTE') OR
    NOT has_function_privilege('tto_app',q,'EXECUTE')
 THEN RAISE EXCEPTION 'CHILD06_TEMPORAL_FUNCTION_MISSING';END IF;
 IF has_table_privilege('tto_app','tto.cooperative_notice_transitions','SELECT') OR
    has_table_privilege('tto_app','tto.cooperative_notice_transitions','INSERT') OR
    has_table_privilege('tto_app','tto.cooperative_notice_transitions','UPDATE') OR
    has_table_privilege('tto_app','tto.cooperative_notice_transitions','DELETE')
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_PRIVILEGE_LEAK';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=
   'tto.cooperative_notice_transitions'::regclass
   AND relrowsecurity AND relforcerowsecurity)
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_RLS_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=
    'tto.cooperative_notice_transitions'::regclass
     AND tgname='cooperative_notice_transitions_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_IMMUTABILITY_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
    WHERE conrelid='tto.cooperative_notice_transitions'::regclass
      AND pg_get_constraintdef(oid) LIKE '%USER_SUPPLIED_SOURCE_NOT_AUTHENTICATED%')
 THEN RAISE EXCEPTION 'CHILD06_TRANSITION_UNVERIFIED_SOURCE_NOT_FIXED';END IF;
END $check$;
SAVEPOINT forbidden;
SET LOCAL ROLE tto_app;
DO $check$ BEGIN
 BEGIN
 PERFORM tto.cooperative_governance_temporal_facts(clock_timestamp());
 RAISE EXCEPTION 'CHILD06_UNAUTHORIZED_SOURCE_LEAK';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM='CHILD06_UNAUTHORIZED_SOURCE_LEAK' THEN RAISE;END IF;
 END;
END $check$;
ROLLBACK TO SAVEPOINT forbidden;
ROLLBACK;
