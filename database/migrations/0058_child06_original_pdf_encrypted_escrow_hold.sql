-- CHILD-06 / PH12: encrypted original PDF escrow, not official authentication.
-- Only user-submitted encrypted bytes; no source trust, authority, tariff or shares.
BEGIN;
CREATE TABLE tto.cooperative_governance_source_files (
 file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL REFERENCES tto.cooperative_governance_conflict_cases(case_id),
 evidence_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_governance_conflict_evidence(evidence_id),
 issuer_candidate_id uuid NOT NULL REFERENCES tto.ph12_cooperative_source_issuer_candidates(candidate_id),
 media_type text NOT NULL DEFAULT 'application/pdf' CHECK(media_type='application/pdf'),
 filename text NOT NULL DEFAULT 'original.pdf' CHECK(filename='original.pdf'),
 file_size integer NOT NULL CHECK(file_size BETWEEN 8 AND 524288),
 plaintext_sha256 bytea NOT NULL CHECK(octet_length(plaintext_sha256)=32),
 aes_gcm_iv bytea NOT NULL CHECK(octet_length(aes_gcm_iv)=12),
 aes_gcm_tag bytea NOT NULL CHECK(octet_length(aes_gcm_tag)=16),
 encrypted_body bytea NOT NULL CHECK(octet_length(encrypted_body)=file_size),
 encryption_version text NOT NULL DEFAULT 'child06-lab-v1' CHECK(encryption_version='child06-lab-v1'),
 source_state text NOT NULL DEFAULT 'ENCRYPTED_QUARANTINED_UNAUTHENTICATED'
    CHECK(source_state='ENCRYPTED_QUARANTINED_UNAUTHENTICATED'),
 official_source_authenticated boolean NOT NULL DEFAULT false CHECK(official_source_authenticated=false),
 legal_authority_granted boolean NOT NULL DEFAULT false CHECK(legal_authority_granted=false),
 tariff_activated boolean NOT NULL DEFAULT false CHECK(tariff_activated=false),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,submitted_by,request_key)
);
CREATE INDEX cooperative_governance_source_files_tenant_case
 ON tto.cooperative_governance_source_files(tenant_id,case_id);
ALTER TABLE tto.cooperative_governance_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_governance_source_files FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_governance_source_files FROM PUBLIC,tto_app;
CREATE TRIGGER cooperative_governance_source_file_immutable
 BEFORE UPDATE OR DELETE ON tto.cooperative_governance_source_files
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.cooperative_store_governance_source_file(
 p_evidence uuid,p_candidate uuid,p_size integer,p_sha bytea,
 p_iv bytea,p_tag bytea,p_encrypted bytea,p_request uuid)
RETURNS TABLE(file_id uuid,source_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 ev record; cand record; oldrow record; new_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_evidence IS NULL OR p_candidate IS NULL OR p_request IS NULL OR
    p_size NOT BETWEEN 8 AND 524288 OR octet_length(p_sha)<>32 OR
    octet_length(p_iv)<>12 OR octet_length(p_tag)<>16 OR
    octet_length(p_encrypted)<>p_size
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_INVALID_ENVELOPE' USING ERRCODE='22023';END IF;
 SELECT e.*,c.opened_by INTO ev
 FROM tto.cooperative_governance_conflict_evidence e
 JOIN tto.cooperative_governance_conflict_cases c
  ON c.case_id=e.case_id AND c.tenant_id=e.tenant_id
 WHERE e.evidence_id=p_evidence AND e.tenant_id=tid;
 IF NOT FOUND OR ev.opened_by<>actor OR ev.recorded_by<>actor
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_EVIDENCE_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 SELECT * INTO cand FROM tto.ph12_cooperative_source_issuer_candidates
 WHERE candidate_id=p_candidate AND tenant_id=tid
  AND candidate_state='PENDING_ISSUER_AUTHENTICATION'
  AND issuer_kind IN ('OFFICIAL_GAZETTE','COMPANY_REGISTRAR')
  AND source_purpose IN ('REGISTERED_BOARD_CHANGES','AUTHORISED_SIGNATORIES');
 IF NOT FOUND THEN RAISE EXCEPTION 'CHILD06_ESCROW_ISSUER_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 IF ev.claimed_attachment_sha256 IS NOT NULL AND
    decode(ev.claimed_attachment_sha256,'hex')<>p_sha
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_CLAIMED_HASH_MISMATCH' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
   tid::text||':child06-escrow:'||actor::text||':'||p_request::text,0));
 SELECT * INTO oldrow FROM tto.cooperative_governance_source_files
 WHERE tenant_id=tid AND submitted_by=actor AND request_key=p_request;
 IF FOUND THEN
  IF oldrow.evidence_id<>p_evidence OR oldrow.issuer_candidate_id<>p_candidate
      OR oldrow.file_size<>p_size OR oldrow.plaintext_sha256<>p_sha
  THEN RAISE EXCEPTION 'CHILD06_ESCROW_REPLAY_DIFFERENT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT oldrow.file_id,oldrow.source_state,true;RETURN;
 END IF;
 -- Serialize file intake with the existing independent-review advisory lock.
 -- The review cannot commit between this check and the encrypted insert.
 PERFORM pg_advisory_xact_lock(hashtextextended(
   tid::text||':conflict-review:'||ev.case_id::text,0));
 IF EXISTS(SELECT 1 FROM tto.cooperative_governance_conflict_dispositions
    WHERE tenant_id=tid AND case_id=ev.case_id)
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_REVIEW_ALREADY_FINAL' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM tto.cooperative_governance_source_files
    WHERE evidence_id=p_evidence)
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_EVIDENCE_ALREADY_BOUND' USING ERRCODE='23505';END IF;
 INSERT INTO tto.cooperative_governance_source_files AS f
 (tenant_id,case_id,evidence_id,issuer_candidate_id,file_size,plaintext_sha256,
  aes_gcm_iv,aes_gcm_tag,encrypted_body,submitted_by,request_key)
 VALUES(tid,ev.case_id,p_evidence,p_candidate,p_size,p_sha,p_iv,p_tag,
        p_encrypted,actor,p_request)
 RETURNING f.file_id INTO new_id;
 RETURN QUERY SELECT new_id,'ENCRYPTED_QUARANTINED_UNAUTHENTICATED'::text,false;
END $fn$;

-- Encrypted packets can be fetched only in tenant-scoped API transactions,
-- by manager or legal reviewer; no plaintext or approval is returned by SQL.
CREATE FUNCTION tto.cooperative_governance_source_integrity_packet(p_file uuid)
RETURNS TABLE(evidence_id uuid,issuer_candidate_id uuid,file_size integer,
 plaintext_sha256 bytea,aes_gcm_iv bytea,aes_gcm_tag bytea,
 encrypted_body bytea,encryption_version text,source_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT
   (tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    tto.has_tenant_role(tid,'LEGAL_REVIEWER'))
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_PACKET_ROLE_DENIED' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT f.evidence_id,f.issuer_candidate_id,f.file_size,
  f.plaintext_sha256,f.aes_gcm_iv,f.aes_gcm_tag,f.encrypted_body,
  f.encryption_version,f.source_state
 FROM tto.cooperative_governance_source_files f
 WHERE f.file_id=p_file AND f.tenant_id=tid;
END $fn$;
REVOKE ALL ON FUNCTION
 tto.cooperative_store_governance_source_file(uuid,uuid,integer,bytea,bytea,bytea,bytea,uuid),
 tto.cooperative_governance_source_integrity_packet(uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION
 tto.cooperative_store_governance_source_file(uuid,uuid,integer,bytea,bytea,bytea,bytea,uuid),
 tto.cooperative_governance_source_integrity_packet(uuid) TO tto_app;
COMMENT ON TABLE tto.cooperative_governance_source_files IS
 'AES-256-GCM quarantined PDF; issuer candidate is a CLAIM, not authenticated. No legal authority, tariff, or share operation.';
COMMIT;
