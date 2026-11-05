-- PH10.4: encrypted evidence quarantine for pre-tenant reserved workspace.
-- No bytes are exposed to app role, the browser, reviewers, or public URLs.
-- NOT an authenticity check, virus scan, legal signoff, legal registration or tenant.
CREATE TABLE tto.cooperative_onboarding_evidence_quarantine (
 evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES tto.cooperative_workspace_addresses(workspace_id),
 upload_key uuid NOT NULL UNIQUE,
 uploaded_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 original_filename text NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 120),
 mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg')),
 content_sha256 bytea NOT NULL CHECK (octet_length(content_sha256)=32),
 iv bytea NOT NULL CHECK (octet_length(iv)=12),
 tag bytea NOT NULL CHECK (octet_length(tag)=16),
 ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 524288),
 scan_status text NOT NULL DEFAULT 'QUARANTINED' CHECK(scan_status='QUARANTINED'),
 authenticity_status text NOT NULL DEFAULT 'NOT_VERIFIED' CHECK(authenticity_status='NOT_VERIFIED'),
 key_version text NOT NULL DEFAULT 'isolated-v1' CHECK(key_version='isolated-v1'),
 uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX cooperative_evidence_workspace_time_idx
 ON tto.cooperative_onboarding_evidence_quarantine(workspace_id,uploaded_at DESC);
ALTER TABLE tto.cooperative_onboarding_evidence_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_onboarding_evidence_quarantine FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_onboarding_evidence_quarantine FROM PUBLIC;
-- Not even SELECT is granted to tto_app; internal response must be metadata only.
CREATE OR REPLACE FUNCTION tto.store_quarantined_cooperative_evidence(
 p_slug text,p_upload_key uuid,p_filename text,p_mime text,
 p_sha bytea,p_iv bytea,p_tag bytea,p_ciphertext bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $fn$
DECLARE v_actor uuid; v_workspace uuid; v_existing tto.cooperative_onboarding_evidence_quarantine%ROWTYPE;
 v_evidence uuid;
BEGIN
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR NOT tto.has_national_root() THEN
    RAISE EXCEPTION 'NATIONAL_ROOT_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR
   p_upload_key IS NULL OR p_filename IS NULL OR p_filename !~ '^[a-zA-Z0-9._ -]{1,120}$' OR
   p_mime NOT IN ('application/pdf','image/png','image/jpeg') OR
   p_sha IS NULL OR octet_length(p_sha)<>32 OR
   p_iv IS NULL OR octet_length(p_iv)<>12 OR p_tag IS NULL OR
   octet_length(p_tag)<>16 OR p_ciphertext IS NULL OR
   octet_length(p_ciphertext) NOT BETWEEN 1 AND 524288 THEN
     RAISE EXCEPTION 'INVALID_EVIDENCE' USING ERRCODE='22023';
 END IF;
 -- Serialize with dossier submission and avoid an upload racing after submission.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_slug,42));
 SELECT workspace_id INTO v_workspace FROM tto.cooperative_workspace_addresses
 WHERE slug=p_slug AND state='RESERVED' FOR SHARE;
 IF v_workspace IS NULL OR EXISTS(SELECT 1 FROM tto.tenants WHERE slug=p_slug)
 THEN RAISE EXCEPTION 'NOT_RESERVED_OR_ACTIVATED' USING ERRCODE='22023'; END IF;
 -- New uploads after submission are permitted only for a requested correction.
 IF EXISTS (
  SELECT 1 FROM tto.cooperative_onboarding_dossiers d
  WHERE d.workspace_id=v_workspace AND d.state<>'CHANGES_REQUESTED'
 ) THEN
  RAISE EXCEPTION 'EVIDENCE_UPLOAD_WINDOW_CLOSED' USING ERRCODE='22023';
 END IF;
 -- Equal upload keys are serialized to return the original result on exact replay.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_upload_key::text,57));
 SELECT * INTO v_existing FROM tto.cooperative_onboarding_evidence_quarantine
 WHERE upload_key=p_upload_key;
 IF FOUND THEN
   IF v_existing.workspace_id=v_workspace AND v_existing.uploaded_by=v_actor
      AND v_existing.content_sha256=p_sha AND v_existing.original_filename=p_filename
      AND v_existing.mime_type=p_mime THEN
      RETURN jsonb_build_object('evidenceId',v_existing.evidence_id,
        'scanStatus','QUARANTINED','authenticity','NOT_VERIFIED',
        'replayed',true,'tenantCreated',false,'managerRoleGranted',false);
   END IF;
   RAISE EXCEPTION 'UPLOAD_KEY_CONFLICT' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_onboarding_evidence_quarantine(
 workspace_id,upload_key,uploaded_by,original_filename,mime_type,
 content_sha256,iv,tag,ciphertext)
 VALUES(v_workspace,p_upload_key,v_actor,p_filename,p_mime,p_sha,p_iv,p_tag,p_ciphertext)
 RETURNING evidence_id INTO v_evidence;
 RETURN jsonb_build_object('evidenceId',v_evidence,'scanStatus','QUARANTINED',
  'authenticity','NOT_VERIFIED','replayed',false,
  'tenantCreated',false,'managerRoleGranted',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.store_quarantined_cooperative_evidence(
 text,uuid,text,text,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.store_quarantined_cooperative_evidence(
 text,uuid,text,text,bytea,bytea,bytea,bytea) TO tto_app;
COMMENT ON TABLE tto.cooperative_onboarding_evidence_quarantine IS
 'Encrypted pre-tenant quarantine; no release until approved scanner and independent legal verifier.';
