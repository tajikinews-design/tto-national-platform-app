-- PH10.2 — additive review lifecycle for previously submitted cooperative dossiers.
-- This migration does not create tenants, cooperatives, roles, or legal approvals.
-- This follows 9997; existing submitted dossier rows remain PENDING_LEGAL_REVIEW.
ALTER TABLE tto.cooperative_onboarding_dossiers
  DROP CONSTRAINT IF EXISTS cooperative_onboarding_dossiers_state_check;
ALTER TABLE tto.cooperative_onboarding_dossiers
  ADD CONSTRAINT cooperative_onboarding_dossiers_state_check
  CHECK (state IN ('PENDING_LEGAL_REVIEW','IN_REVIEW','CHANGES_REQUESTED',
                  'REJECTED','EXTERNAL_APPROVAL_REQUIRED'));
ALTER TABLE tto.cooperative_onboarding_dossiers
  ADD COLUMN review_version integer NOT NULL DEFAULT 1 CHECK (review_version >= 1),
  ADD COLUMN reviewed_by uuid REFERENCES tto.user_accounts(user_id),
  ADD COLUMN reviewed_at timestamptz;
ALTER TABLE tto.cooperative_onboarding_audit
  DROP CONSTRAINT IF EXISTS cooperative_onboarding_audit_action_check;
ALTER TABLE tto.cooperative_onboarding_audit
  ADD CONSTRAINT cooperative_onboarding_audit_action_check
  CHECK (action IN ('DOSSIER_SUBMITTED','START_REVIEW','REQUEST_CHANGES',
                   'REJECT','RESUBMIT','RECOMMEND_EXTERNAL_APPROVAL'));
ALTER TABLE tto.cooperative_onboarding_audit
  ADD COLUMN request_key uuid UNIQUE,
  ADD COLUMN prior_state text,
  ADD COLUMN resulting_state text,
  ADD COLUMN resulting_version integer,
  ADD COLUMN evidence_at_action text,
  ADD COLUMN reason text CHECK (reason IS NULL OR length(reason) BETWEEN 5 AND 1500);
CREATE INDEX cooperative_onboarding_audit_dossier_time_idx
 ON tto.cooperative_onboarding_audit(dossier_id,occurred_at DESC);
-- Audit rows stay append-only: no UPDATE/DELETE grants or policies.
-- All state writes go through one locked, replay-safe, privileged function.
CREATE OR REPLACE FUNCTION tto.review_cooperative_onboarding(
  p_dossier_id uuid, p_action text, p_expected_version integer,
  p_request_key uuid, p_reason text DEFAULT NULL, p_evidence_reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $$
DECLARE
  v_actor uuid;
  v_row tto.cooperative_onboarding_dossiers%ROWTYPE;
  v_old text;
  v_next text;
  v_prior tto.cooperative_onboarding_audit%ROWTYPE;
  v_reason text;
BEGIN
  v_actor := tto.context_actor_id();
  IF v_actor IS NULL OR NOT tto.has_national_root() THEN
    RAISE EXCEPTION 'NATIONAL_ROOT_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_dossier_id IS NULL OR p_request_key IS NULL OR
     p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'INVALID_REVIEW_REQUEST' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM tto.cooperative_onboarding_dossiers
   WHERE dossier_id = p_dossier_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOSSIER_NOT_FOUND' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_prior FROM tto.cooperative_onboarding_audit
   WHERE request_key = p_request_key;
  IF FOUND THEN
    IF v_prior.actor_id = v_actor AND v_prior.dossier_id = p_dossier_id
       AND v_prior.action = p_action AND
       v_prior.resulting_version = p_expected_version+1 AND
       v_prior.evidence_at_action IS NOT DISTINCT FROM nullif(btrim(p_evidence_reference),'') AND
       v_prior.reason IS NOT DISTINCT FROM nullif(btrim(p_reason),'') THEN
      RETURN jsonb_build_object('dossierId',p_dossier_id,
         'status',v_prior.resulting_state,'version',v_prior.resulting_version,
         'replayed',true,'tenantCreated',false,'managerRoleGranted',false);
    END IF;
    RAISE EXCEPTION 'REVIEW_IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE='23505';
  END IF;
  IF v_row.review_version <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_REVIEW_VERSION' USING ERRCODE='40001';
  END IF;
  v_old := v_row.state;
  v_reason := nullif(btrim(p_reason),'');
  IF p_action='START_REVIEW' AND v_old='PENDING_LEGAL_REVIEW' THEN
    v_next := 'IN_REVIEW';
  ELSIF p_action='REQUEST_CHANGES' AND v_old='IN_REVIEW' THEN
    v_next := 'CHANGES_REQUESTED';
  ELSIF p_action='REJECT' AND v_old='IN_REVIEW' THEN
    v_next := 'REJECTED';
  ELSIF p_action='RESUBMIT' AND v_old='CHANGES_REQUESTED' THEN
    v_next := 'PENDING_LEGAL_REVIEW';
  ELSIF p_action='RECOMMEND_EXTERNAL_APPROVAL' AND v_old='IN_REVIEW' THEN
    -- Only independent reviewers may recommend; not a legal approval.
    IF v_row.created_by=v_actor OR v_row.evidence_reference IS NULL THEN
      RAISE EXCEPTION 'INDEPENDENT_REVIEW_AND_EVIDENCE_REQUIRED' USING ERRCODE='42501';
    END IF;
    v_next := 'EXTERNAL_APPROVAL_REQUIRED';
  ELSE
    RAISE EXCEPTION 'INVALID_REVIEW_TRANSITION' USING ERRCODE='22023';
  END IF;
  IF p_action IN ('REQUEST_CHANGES','REJECT','RECOMMEND_EXTERNAL_APPROVAL') AND
      (v_reason IS NULL OR length(v_reason)<5 OR length(v_reason)>1500) THEN
    RAISE EXCEPTION 'REVIEW_REASON_REQUIRED' USING ERRCODE='22023';
  END IF;
  IF p_action='RESUBMIT' AND p_evidence_reference IS NULL THEN
    RAISE EXCEPTION 'CORRECTED_EVIDENCE_REFERENCE_REQUIRED' USING ERRCODE='22023';
  END IF;
  IF p_evidence_reference IS NOT NULL AND
     (p_action<>'RESUBMIT' OR length(btrim(p_evidence_reference)) NOT BETWEEN 5 AND 180) THEN
    RAISE EXCEPTION 'INVALID_EVIDENCE_REFERENCE' USING ERRCODE='22023';
  END IF;
  UPDATE tto.cooperative_onboarding_dossiers
    SET state=v_next, review_version=review_version+1,
        reviewed_by=v_actor, reviewed_at=clock_timestamp(),
        evidence_reference=CASE WHEN p_evidence_reference IS NOT NULL
             THEN btrim(p_evidence_reference) ELSE evidence_reference END
    WHERE dossier_id=p_dossier_id;
  INSERT INTO tto.cooperative_onboarding_audit(
    dossier_id,actor_id,action,request_key,prior_state,resulting_state,
    resulting_version,evidence_at_action,reason)
  VALUES (p_dossier_id,v_actor,p_action,p_request_key,v_old,v_next,
          p_expected_version+1,nullif(btrim(p_evidence_reference),''),v_reason);
  RETURN jsonb_build_object('dossierId',p_dossier_id,'status',v_next,
     'version',p_expected_version+1,'replayed',false,
     'tenantCreated',false,'managerRoleGranted',false);
END $$;
REVOKE ALL ON FUNCTION tto.review_cooperative_onboarding(
  uuid,text,integer,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.review_cooperative_onboarding(
  uuid,text,integer,uuid,text,text) TO tto_app;
COMMENT ON FUNCTION tto.review_cooperative_onboarding(uuid,text,integer,uuid,text,text)
 IS 'Workflow review only; external legal signoff and tenant activation are separately blocked.';
