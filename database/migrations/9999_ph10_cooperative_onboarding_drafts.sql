-- PH10.3 (isolated only): tenantless, pre-submission cooperative dossier drafts.
-- Not a legal approval, official company, role grant, tenant, or document upload.
-- Depends on PH10 preview migrations 9992, 9994-9998.
CREATE TABLE tto.cooperative_onboarding_drafts (
 workspace_id uuid PRIMARY KEY REFERENCES tto.cooperative_workspace_addresses(workspace_id),
 created_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=4096),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.cooperative_onboarding_draft_revisions (
 request_key uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES tto.cooperative_onboarding_drafts(workspace_id),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 expected_version integer NOT NULL CHECK(expected_version>=0),
 applied_version integer NOT NULL CHECK(applied_version>0),
 payload jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,applied_version)
);
CREATE INDEX cooperative_onboarding_draft_revisions_workspace_time_idx
 ON tto.cooperative_onboarding_draft_revisions(workspace_id,occurred_at DESC);
ALTER TABLE tto.cooperative_onboarding_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_draft_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_draft_revisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_onboarding_drafts FROM PUBLIC;
REVOKE ALL ON tto.cooperative_onboarding_draft_revisions FROM PUBLIC;
CREATE POLICY national_own_draft_read ON tto.cooperative_onboarding_drafts FOR SELECT TO tto_app
 USING (tto.has_national_root() AND created_by=tto.context_actor_id());
-- Direct draft mutation is forbidden: only the locked function below may write.
GRANT SELECT ON tto.cooperative_onboarding_drafts TO tto_app;
CREATE OR REPLACE FUNCTION tto.save_cooperative_onboarding_draft(
 p_slug text,p_payload jsonb,p_expected_version integer,p_request_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $fn$
DECLARE v_actor uuid; v_workspace uuid; v_draft tto.cooperative_onboarding_drafts%ROWTYPE;
 v_prior tto.cooperative_onboarding_draft_revisions%ROWTYPE;
BEGIN
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR NOT tto.has_national_root() THEN
   RAISE EXCEPTION 'NATIONAL_ROOT_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR
    p_request_key IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR
    p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR
    octet_length(p_payload::text)>4096 OR
    EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) AS k(name)
      WHERE k.name NOT IN ('legalName','nationalId','registrationNumber','province',
       'county','legalAddress','representativeName','candidateManagerName',
       'candidateManagerMobile','evidenceReference')) OR
    EXISTS(SELECT 1 FROM jsonb_each(p_payload) AS f(k,v)
      WHERE jsonb_typeof(f.v)<>'string' OR length(f.v #>> '{}')>300) THEN
    RAISE EXCEPTION 'INVALID_DRAFT' USING ERRCODE='22023';
 END IF;
 SELECT workspace_id INTO v_workspace FROM tto.cooperative_workspace_addresses
  WHERE slug=p_slug AND state='RESERVED' FOR SHARE;
 IF v_workspace IS NULL THEN RAISE EXCEPTION 'WORKSPACE_NOT_RESERVED' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM tto.tenants WHERE slug=p_slug)
    OR EXISTS(SELECT 1 FROM tto.cooperative_onboarding_dossiers WHERE workspace_id=v_workspace)
 THEN RAISE EXCEPTION 'DOSSIER_ALREADY_SUBMITTED' USING ERRCODE='23505'; END IF;
 INSERT INTO tto.cooperative_onboarding_drafts(workspace_id,created_by)
 VALUES(v_workspace,v_actor) ON CONFLICT(workspace_id) DO NOTHING;
 SELECT * INTO v_draft FROM tto.cooperative_onboarding_drafts
 WHERE workspace_id=v_workspace FOR UPDATE;
 IF v_draft.created_by<>v_actor THEN
   RAISE EXCEPTION 'DRAFT_OWNER_MISMATCH' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_prior FROM tto.cooperative_onboarding_draft_revisions
 WHERE request_key=p_request_key;
 IF FOUND THEN
   IF v_prior.workspace_id=v_workspace AND v_prior.submitted_by=v_actor AND
      v_prior.expected_version=p_expected_version AND v_prior.payload=p_payload THEN
      RETURN jsonb_build_object('slug',p_slug,'version',v_prior.applied_version,
       'replayed',true,'submitted',false,'tenantCreated',false);
   END IF;
   RAISE EXCEPTION 'DRAFT_REQUEST_KEY_REUSED' USING ERRCODE='23505';
 END IF;
 IF v_draft.version<>p_expected_version THEN
   RAISE EXCEPTION 'STALE_DRAFT_VERSION' USING ERRCODE='40001';
 END IF;
 UPDATE tto.cooperative_onboarding_drafts SET payload=p_payload,version=version+1,
   updated_at=clock_timestamp() WHERE workspace_id=v_workspace;
 INSERT INTO tto.cooperative_onboarding_draft_revisions(
  request_key,workspace_id,submitted_by,expected_version,applied_version,payload)
 VALUES(p_request_key,v_workspace,v_actor,p_expected_version,p_expected_version+1,p_payload);
 RETURN jsonb_build_object('slug',p_slug,'version',p_expected_version+1,
  'replayed',false,'submitted',false,'tenantCreated',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.save_cooperative_onboarding_draft(text,jsonb,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.save_cooperative_onboarding_draft(text,jsonb,integer,uuid) TO tto_app;
COMMENT ON TABLE tto.cooperative_onboarding_drafts IS
 'Pre-submission claims only. Not identity/registration verification, file upload, tenant or role authority.';
