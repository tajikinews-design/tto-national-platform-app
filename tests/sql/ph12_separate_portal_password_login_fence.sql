BEGIN;
DO $security$
DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY['portal_password_credentials','portal_password_attempts','portal_password_session_bindings'] LOOP
  IF to_regclass('tto.'||target) IS NULL THEN RAISE EXCEPTION 'PH12_PASSWORD_TABLE_MISSING %',target;END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('tto.'||target)
    AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'PH12_PASSWORD_RLS_NOT_FORCED %',target;END IF;
  IF has_table_privilege('tto_app','tto.'||target,'SELECT') OR
     has_table_privilege('tto_app','tto.'||target,'INSERT') OR
     has_table_privilege('tto_app','tto.'||target,'UPDATE') OR
     has_table_privilege('tto_app','tto.'||target,'DELETE')
  THEN RAISE EXCEPTION 'PH12_PASSWORD_RAW_CREDENTIAL_ACCESS %',target;END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='tto.portal_password_session_identity(bytea,text)'::regprocedure AND prosecdef)
 THEN RAISE EXCEPTION 'PH12_PASSWORD_PROVENANCE_DEF_MISSING';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='tto.issue_portal_password_session(text,text,uuid,uuid,bytea)'::regprocedure AND prosecdef)
 THEN RAISE EXCEPTION 'PH12_PASSWORD_ISSUER_DEF_MISSING';END IF;
END $security$;
SET LOCAL ROLE tto_app;
DO $anonymous$
DECLARE unverified record; allowed boolean;
BEGIN
 SELECT * INTO unverified FROM tto.portal_password_credential_lookup('cooperative','nonexistent-username');
 IF FOUND THEN RAISE EXCEPTION 'PH12_ANONYMOUS_PASSWORD_IDENTITY_MINTED';END IF;
 SELECT * INTO unverified FROM tto.portal_password_session_identity(
   decode(repeat('cc',32),'hex'),'cooperative');
 IF FOUND THEN RAISE EXCEPTION 'PH12_FAKE_PORTAL_PASSWORD_SESSION';END IF;
 SELECT tto.issue_portal_password_session('cooperative','fake',
   gen_random_uuid(),gen_random_uuid(),decode(repeat('cc',32),'hex')) INTO allowed;
 IF allowed THEN RAISE EXCEPTION 'PH12_FAKE_PORTAL_PASSWORD_AUTHORIZED';END IF;
END $anonymous$;
ROLLBACK;
