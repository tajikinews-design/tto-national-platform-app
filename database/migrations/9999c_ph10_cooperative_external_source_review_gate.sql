-- PH10.5: independent external legal reviewer appointment and recorded source-check evidence.
-- No document authenticity is automatically proven. No legal approval, Tenant or manager role.
-- App role CANNOT appoint/revoke mandates, mutate source check history or see document ciphertext.
CREATE TABLE tto.cooperative_external_legal_review_mandates (
 reviewer_id uuid PRIMARY KEY REFERENCES tto.user_accounts(user_id),
 appointed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 authority_name text NOT NULL CHECK (length(btrim(authority_name)) BETWEEN 8 AND 180),
 appointment_reference text NOT NULL CHECK (length(btrim(appointment_reference)) BETWEEN 8 AND 240),
 appointment_evidence_sha256 bytea NOT NULL CHECK (octet_length(appointment_evidence_sha256)=32),
 valid_from timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (reviewer_id<>appointed_by),
 CHECK (expires_at>valid_from),
 CHECK (expires_at<=valid_from+interval '366 days')
);
CREATE TABLE tto.cooperative_external_source_check_records (
 check_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 dossier_id uuid NOT NULL REFERENCES tto.cooperative_onboarding_dossiers(dossier_id),
 evidence_id uuid NOT NULL REFERENCES tto.cooperative_onboarding_evidence_quarantine(evidence_id),
 reviewer_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 source_kind text NOT NULL CHECK(source_kind IN
  ('NATIONAL_REGISTRY','OFFICIAL_GAZETTE','COOPERATIVE_AUTHORITY')),
 external_reference text NOT NULL CHECK(length(btrim(external_reference)) BETWEEN 8 AND 240),
 source_document_sha256 bytea NOT NULL CHECK(octet_length(source_document_sha256)=32),
 finding text NOT NULL CHECK(finding IN
  ('MATCH_REPORTED_UNVERIFIED','MISMATCH_REPORTED','INCONCLUSIVE')),
 rationale text NOT NULL CHECK(length(btrim(rationale)) BETWEEN 10 AND 1500),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX cooperative_external_source_checks_dossier_idx
 ON tto.cooperative_external_source_check_records(dossier_id,occurred_at DESC);
CREATE INDEX cooperative_external_source_checks_evidence_idx
 ON tto.cooperative_external_source_check_records(evidence_id,occurred_at DESC);
ALTER TABLE tto.cooperative_external_legal_review_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_external_legal_review_mandates FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_external_source_check_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_external_source_check_records FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_external_legal_review_mandates FROM PUBLIC,tto_app;
REVOKE ALL ON tto.cooperative_external_source_check_records FROM PUBLIC,tto_app;

CREATE OR REPLACE FUNCTION tto.record_independent_cooperative_source_check(
 p_dossier_id uuid,p_evidence_id uuid,p_request_key uuid,
 p_source_kind text,p_external_reference text,p_source_sha256 bytea,
 p_finding text,p_rationale text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid; v_dossier tto.cooperative_onboarding_dossiers%ROWTYPE;
 v_previous tto.cooperative_external_source_check_records%ROWTYPE;v_id uuid;
BEGIN
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM tto.cooperative_external_legal_review_mandates m
   JOIN tto.national_root_accounts r ON r.user_id=m.appointed_by
   JOIN tto.user_accounts a ON a.user_id=m.reviewer_id
   WHERE m.reviewer_id=v_actor
     AND a.status='ACTIVE'
     AND r.singleton AND r.revoked_at IS NULL
     AND m.revoked_at IS NULL AND m.valid_from<=clock_timestamp()
     AND m.expires_at>clock_timestamp() AND m.reviewer_id<>m.appointed_by
     AND m.appointment_evidence_sha256 IS NOT NULL
 ) OR tto.has_national_root() THEN
    RAISE EXCEPTION 'INDEPENDENT_EXTERNAL_REVIEWER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_request_key IS NULL OR p_dossier_id IS NULL OR p_evidence_id IS NULL OR
    p_source_kind IS NULL OR p_source_kind NOT IN
     ('NATIONAL_REGISTRY','OFFICIAL_GAZETTE','COOPERATIVE_AUTHORITY') OR
    p_external_reference IS NULL OR
    length(btrim(p_external_reference)) NOT BETWEEN 8 AND 240 OR
    p_source_sha256 IS NULL OR octet_length(p_source_sha256)<>32 OR
    p_finding IS NULL OR p_finding NOT IN
     ('MATCH_REPORTED_UNVERIFIED','MISMATCH_REPORTED','INCONCLUSIVE') OR
    p_rationale IS NULL OR length(btrim(p_rationale)) NOT BETWEEN 10 AND 1500 THEN
   RAISE EXCEPTION 'INVALID_EXTERNAL_SOURCE_CHECK' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_dossier FROM tto.cooperative_onboarding_dossiers
 WHERE dossier_id=p_dossier_id FOR SHARE;
 IF NOT FOUND OR v_dossier.state<>'EXTERNAL_APPROVAL_REQUIRED' OR
   v_dossier.created_by=v_actor THEN
   RAISE EXCEPTION 'DOSSIER_NOT_REFERRED_OR_SELF_REVIEW' USING ERRCODE='42501';
 END IF;
 IF v_dossier.evidence_reference IS DISTINCT FROM p_evidence_id::text OR
    NOT EXISTS (SELECT 1 FROM tto.cooperative_onboarding_evidence_quarantine e
      WHERE e.evidence_id=p_evidence_id AND e.workspace_id=v_dossier.workspace_id
        AND e.authenticity_status='NOT_VERIFIED' AND e.scan_status='QUARANTINED') THEN
    RAISE EXCEPTION 'EVIDENCE_NOT_QUARANTINED_OR_WRONG_WORKSPACE' USING ERRCODE='42501';
 END IF;
 -- Serialize concurrent retries without locking the immutable receipt itself.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text,91));
 SELECT * INTO v_previous FROM tto.cooperative_external_source_check_records
 WHERE request_key=p_request_key;
 IF FOUND THEN
   IF v_previous.reviewer_id=v_actor AND v_previous.dossier_id=p_dossier_id
      AND v_previous.evidence_id=p_evidence_id AND v_previous.source_kind=p_source_kind
      AND v_previous.external_reference=btrim(p_external_reference)
      AND v_previous.source_document_sha256=p_source_sha256
      AND v_previous.finding=p_finding AND v_previous.rationale=btrim(p_rationale) THEN
      RETURN jsonb_build_object('checkId',v_previous.check_id,'recorded',true,
       'replayed',true,'authenticity','NOT_VERIFIED','legalApproval',false,
       'tenantCreated',false,'managerRoleGranted',false);
   END IF;
   RAISE EXCEPTION 'SOURCE_CHECK_KEY_REUSED' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_external_source_check_records(
  request_key,dossier_id,evidence_id,reviewer_id,source_kind,external_reference,
  source_document_sha256,finding,rationale
 ) VALUES(
  p_request_key,p_dossier_id,p_evidence_id,v_actor,p_source_kind,btrim(p_external_reference),
  p_source_sha256,p_finding,btrim(p_rationale)
 ) RETURNING check_id INTO v_id;
 RETURN jsonb_build_object('checkId',v_id,'recorded',true,
  'replayed',false,'authenticity','NOT_VERIFIED','legalApproval',false,
  'tenantCreated',false,'managerRoleGranted',false);
END $f$;
REVOKE ALL ON FUNCTION tto.record_independent_cooperative_source_check(
 uuid,uuid,uuid,text,text,bytea,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.record_independent_cooperative_source_check(
 uuid,uuid,uuid,text,text,bytea,text,text) TO tto_app;

-- Server-only cryptographic integrity check. It does NOT attest an official source
-- or permit a caller to access plaintext. tto_app receives bytes only through this
-- privileged function, for the authenticated national root within a DB transaction.
CREATE OR REPLACE FUNCTION tto.cooperative_evidence_integrity_packet(p_id uuid)
RETURNS TABLE(ciphertext bytea, iv bytea, tag bytea, content_sha256 bytea,
  key_version text, scan_status text, authenticity_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,tto AS $f$
 SELECT e.ciphertext,e.iv,e.tag,e.content_sha256,e.key_version,
        e.scan_status,e.authenticity_status
 FROM tto.cooperative_onboarding_evidence_quarantine e
 WHERE e.evidence_id=p_id AND tto.has_national_root()
   AND e.scan_status='QUARANTINED' AND e.authenticity_status='NOT_VERIFIED'
$f$;
REVOKE ALL ON FUNCTION tto.cooperative_evidence_integrity_packet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.cooperative_evidence_integrity_packet(uuid) TO tto_app;
COMMENT ON TABLE tto.cooperative_external_source_check_records IS
 'Reviewer-reported external source comparison; no official data provider verification or legal approval is asserted.';
COMMENT ON TABLE tto.cooperative_external_legal_review_mandates IS
 'Owner-provisioned authorization only; tto_app cannot appoint/revoke or self-authorize external legal reviewers.';
