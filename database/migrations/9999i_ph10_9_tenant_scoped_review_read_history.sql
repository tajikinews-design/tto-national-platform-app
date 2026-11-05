-- PH10.9 follow-up: scope Gazette reviewers per cooperative; global appointment alone is insufficient.
-- Provision only by database owner after independent mandate evidence. No app role appointment path.
CREATE TABLE tto.cooperative_gazette_review_tenant_mandates(
 reviewer_id uuid NOT NULL REFERENCES tto.cooperative_external_legal_review_mandates(reviewer_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 appointed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 appointment_reference text NOT NULL CHECK(length(btrim(appointment_reference)) BETWEEN 8 AND 240),
 evidence_sha256 bytea NOT NULL CHECK(octet_length(evidence_sha256)=32),
 valid_from timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(reviewer_id,tenant_id),
 CHECK(reviewer_id<>appointed_by),
 CHECK(expires_at>valid_from),
 CHECK(expires_at<=valid_from+interval '366 days')
);
CREATE INDEX ph10_9_reviewer_grants_tenant_idx
 ON tto.cooperative_gazette_review_tenant_mandates(tenant_id,reviewer_id);
ALTER TABLE tto.cooperative_gazette_review_tenant_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_gazette_review_tenant_mandates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_gazette_review_tenant_mandates FROM PUBLIC,tto_app;

CREATE OR REPLACE FUNCTION tto.record_independent_gazette_finding(
 p_claim uuid,p_request uuid,p_source_reference text,p_source_sha256 bytea,
 p_outcome text,p_rationale text,p_session_digest bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;v_claim tto.cooperative_manual_official_governance_claims%ROWTYPE;
 v_tenant_appointment text;
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
 -- A global reviewer appointment alone is NOT authority over this tenant.
 -- A separate root-issued, valid, unrevoked tenant grant is mandatory.
 SELECT s.appointment_reference INTO v_tenant_appointment
 FROM tto.cooperative_gazette_review_tenant_mandates s
 JOIN tto.national_root_accounts nr ON nr.user_id=s.appointed_by
 WHERE s.reviewer_id=v_actor AND s.tenant_id=v_claim.tenant_id
  AND s.revoked_at IS NULL AND s.valid_from<=clock_timestamp()
  AND s.expires_at>clock_timestamp() AND nr.singleton AND nr.revoked_at IS NULL
 FOR SHARE OF s;
 IF v_tenant_appointment IS NULL OR
  NOT EXISTS(SELECT 1 FROM tto.tenants
             WHERE tenant_id=v_claim.tenant_id AND status='ACTIVE') OR
  EXISTS (
   SELECT 1 FROM tto.role_assignments ra
   WHERE ra.user_id=v_actor AND ra.tenant_id=v_claim.tenant_id
    AND ra.role_code='COOPERATIVE_MANAGER'
  ) THEN
  RAISE EXCEPTION 'TENANT_SCOPED_INDEPENDENT_REVIEW_MANDATE_REQUIRED' USING ERRCODE='42501';
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
 VALUES(p_request,p_claim,v_claim.tenant_id,v_actor,v_tenant_appointment,
  btrim(p_source_reference),p_source_sha256,p_outcome,btrim(p_rationale))
 RETURNING finding_id INTO v_id;
 RETURN jsonb_build_object('findingId',v_id,'replayed',false,
  'outcome',p_outcome,'officiallyVerified',false,'legalApproval',false,'roleGranted',false);
END $f$;

-- Private finding read: authenticated manager for precisely ONE active cooperative.
-- Each page rechecks session, tenant role and independently verified management authority.
CREATE FUNCTION tto.list_manual_gazette_review_findings_page(
 p_tenant uuid,p_session_digest bytea,p_before_created timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 50
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;v_items jsonb;v_more boolean;
BEGIN
 v_actor:=tto.context_actor_id();
 IF p_session_digest IS NULL OR octet_length(p_session_digest)<>32 THEN
  RAISE EXCEPTION 'REVIEW_HISTORY_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT user_id INTO v_session_actor FROM tto.resolve_session(p_session_digest);
 IF v_actor IS NULL OR v_session_actor IS DISTINCT FROM v_actor OR
  p_tenant IS DISTINCT FROM tto.context_tenant_id() OR
  NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER') OR
  NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT') OR
  NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 THEN RAISE EXCEPTION 'REVIEW_HISTORY_MANAGER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR
  (p_before_created IS NULL) <> (p_before_id IS NULL) THEN
  RAISE EXCEPTION 'INVALID_REVIEW_HISTORY_CURSOR' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'findingId',t.finding_id,'claimId',t.claim_id,'outcome',t.outcome,
   'sourceReference',t.source_reference,'rationale',t.rationale,
   'reviewerMandateReference',t.mandate_appointment_reference,
   'createdAt',t.created_at)
   ORDER BY t.created_at DESC,t.finding_id DESC),'[]'::jsonb)
 INTO v_items FROM (
  SELECT f.* FROM tto.cooperative_manual_gazette_review_findings f
  WHERE f.tenant_id=p_tenant AND
    (p_before_created IS NULL OR
     (f.created_at,f.finding_id)<(p_before_created,p_before_id))
  ORDER BY f.created_at DESC,f.finding_id DESC LIMIT p_limit
 ) t;
 SELECT EXISTS(
  SELECT 1 FROM tto.cooperative_manual_gazette_review_findings f
   WHERE f.tenant_id=p_tenant AND
    (p_before_created IS NULL OR (f.created_at,f.finding_id)<(p_before_created,p_before_id))
   ORDER BY f.created_at DESC,f.finding_id DESC OFFSET p_limit LIMIT 1
 ) INTO v_more;
 RETURN jsonb_build_object('tenantId',p_tenant,'items',v_items,'hasMore',v_more,
  'officiallyVerified',false,'legalApproval',false,'roleGranted',false,
  'sourceClassification','INDEPENDENT_REVIEWER_FINDINGS_NOT_OFFICIAL_VERIFICATION');
END $f$;
REVOKE ALL ON FUNCTION tto.list_manual_gazette_review_findings_page(uuid,bytea,timestamptz,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.list_manual_gazette_review_findings_page(uuid,bytea,timestamptz,uuid,integer) TO tto_app;
COMMENT ON TABLE tto.cooperative_gazette_review_tenant_mandates IS
 'DB-owner-issued reviewer tenant grant; a global reviewer mandate does not authorize any cooperative Gazette claim.';
