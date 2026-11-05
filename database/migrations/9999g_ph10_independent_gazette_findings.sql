-- PH10.9 independent review of manager's immutable self-reported Gazette claims.
-- NEVER promotes legal authority, role assignments, tenant activation or public disclosure.
CREATE TABLE tto.cooperative_manual_gazette_review_findings (
 finding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 claim_id uuid NOT NULL REFERENCES tto.cooperative_manual_official_governance_claims(claim_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 reviewer_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 mandate_appointment_reference text NOT NULL,
 source_reference text NOT NULL CHECK(length(btrim(source_reference)) BETWEEN 8 AND 240),
 source_sha256 bytea NOT NULL CHECK(octet_length(source_sha256)=32),
 outcome text NOT NULL CHECK(outcome IN ('MATCH_REPORTED_UNVERIFIED','MISMATCH_REPORTED','INCONCLUSIVE')),
 rationale text NOT NULL CHECK(length(btrim(rationale)) BETWEEN 10 AND 1500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ph10_9_gazette_review_claim_idx
 ON tto.cooperative_manual_gazette_review_findings(tenant_id,claim_id,created_at DESC,finding_id DESC);
ALTER TABLE tto.cooperative_manual_gazette_review_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_manual_gazette_review_findings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_manual_gazette_review_findings FROM PUBLIC,tto_app;

CREATE FUNCTION tto.ph10_9_gazette_finding_immutable() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO pg_catalog,tto AS $f$
BEGIN RAISE EXCEPTION 'GAZETTE_REVIEW_IMMUTABLE' USING ERRCODE='42501'; END $f$;
CREATE TRIGGER ph10_9_gazette_finding_immutable
 BEFORE UPDATE OR DELETE ON tto.cooperative_manual_gazette_review_findings
 FOR EACH ROW EXECUTE FUNCTION tto.ph10_9_gazette_finding_immutable();

CREATE FUNCTION tto.record_independent_gazette_finding(
 p_claim uuid,p_request uuid,p_source_reference text,p_source_sha256 bytea,
 p_outcome text,p_rationale text,p_session_digest bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;v_claim tto.cooperative_manual_official_governance_claims%ROWTYPE;
 v_mandate tto.cooperative_external_legal_review_mandates%ROWTYPE;
 v_prev tto.cooperative_manual_gazette_review_findings%ROWTYPE;v_id uuid;
BEGIN
 v_actor:=tto.context_actor_id();
 IF p_session_digest IS NULL OR octet_length(p_session_digest)<>32 THEN
  RAISE EXCEPTION 'REVIEWER_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT user_id INTO v_session_actor FROM tto.resolve_session(p_session_digest);
 IF v_actor IS NULL OR v_session_actor IS DISTINCT FROM v_actor OR tto.has_national_root() THEN
  RAISE EXCEPTION 'INDEPENDENT_REVIEWER_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT m.* INTO v_mandate FROM tto.cooperative_external_legal_review_mandates m
 JOIN tto.national_root_accounts r ON r.user_id=m.appointed_by
 JOIN tto.user_accounts u ON u.user_id=m.reviewer_id
 WHERE m.reviewer_id=v_actor AND u.status='ACTIVE'
  AND r.singleton AND r.revoked_at IS NULL
  AND m.revoked_at IS NULL AND m.valid_from<=clock_timestamp()
  AND m.expires_at>clock_timestamp() AND m.reviewer_id<>m.appointed_by;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'VALID_INDEPENDENT_REVIEW_MANDATE_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_claim FROM tto.cooperative_manual_official_governance_claims
 WHERE claim_id=p_claim;
 IF NOT FOUND OR v_claim.submitted_by=v_actor THEN
  RAISE EXCEPTION 'CLAIM_MISSING_OR_SELF_REVIEW' USING ERRCODE='42501';
 END IF;
 IF p_request IS NULL OR p_source_reference IS NULL OR
  length(btrim(p_source_reference)) NOT BETWEEN 8 AND 240 OR
  p_source_sha256 IS NULL OR octet_length(p_source_sha256)<>32 OR
  p_outcome IS NULL OR p_outcome NOT IN
   ('MATCH_REPORTED_UNVERIFIED','MISMATCH_REPORTED','INCONCLUSIVE') OR
  p_rationale IS NULL OR length(btrim(p_rationale)) NOT BETWEEN 10 AND 1500 THEN
  RAISE EXCEPTION 'INVALID_GAZETTE_REVIEW' USING ERRCODE='22023';
 END IF;
 -- A national-level reviewer is explicitly appointed independent of tenant manager.
 -- This does not create a tenant role or allow self-certification.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,219));
 SELECT * INTO v_prev FROM tto.cooperative_manual_gazette_review_findings
 WHERE request_key=p_request;
 IF FOUND THEN
  IF v_prev.reviewer_id=v_actor AND v_prev.claim_id=p_claim AND
   v_prev.tenant_id=v_claim.tenant_id AND
   v_prev.source_reference=btrim(p_source_reference) AND
   v_prev.source_sha256=p_source_sha256 AND v_prev.outcome=p_outcome AND
   v_prev.rationale=btrim(p_rationale) THEN
   RETURN jsonb_build_object('findingId',v_prev.finding_id,'replayed',true,
    'outcome',v_prev.outcome,'officiallyVerified',false,'legalApproval',false,'roleGranted',false);
  END IF;
  RAISE EXCEPTION 'GAZETTE_REVIEW_REQUEST_KEY_REUSED' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_manual_gazette_review_findings(
  request_key,claim_id,tenant_id,reviewer_id,mandate_appointment_reference,
  source_reference,source_sha256,outcome,rationale)
 VALUES(p_request,p_claim,v_claim.tenant_id,v_actor,v_mandate.appointment_reference,
  btrim(p_source_reference),p_source_sha256,p_outcome,btrim(p_rationale))
 RETURNING finding_id INTO v_id;
 RETURN jsonb_build_object('findingId',v_id,'replayed',false,
  'outcome',p_outcome,'officiallyVerified',false,'legalApproval',false,'roleGranted',false);
END $f$;
REVOKE ALL ON FUNCTION tto.record_independent_gazette_finding(uuid,uuid,text,bytea,text,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.record_independent_gazette_finding(uuid,uuid,text,bytea,text,text,bytea) TO tto_app;
COMMENT ON TABLE tto.cooperative_manual_gazette_review_findings IS
 'Independent reviewer self-reported citation comparison only, NOT formal legal authenticity or authority activation.';
