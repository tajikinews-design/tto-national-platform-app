-- Independent external Vault Transit envelope; only ciphertext / wrapped DEK persisted.
-- Strict quarantine and negative official/legal/financial state remain unchanged.
BEGIN;
ALTER TABLE tto.cooperative_governance_source_files
 DROP CONSTRAINT cooperative_governance_source_files_encryption_version_check;
ALTER TABLE tto.cooperative_governance_source_files
 ADD COLUMN wrapped_data_key text,
 ADD CONSTRAINT cooperative_governance_source_files_encryption_version_check
 CHECK(encryption_version IN ('child06-lab-v1','child06-lab-v2','child06-kms-v1')),
 ADD CONSTRAINT cooperative_governance_source_files_kms_dek_check CHECK(
 (encryption_version='child06-kms-v1' AND wrapped_data_key IS NOT NULL
  AND wrapped_data_key ~ '^vault:v[1-9][0-9]*:[A-Za-z0-9+/=]+$'
  AND length(wrapped_data_key)<=2048) OR
 (encryption_version<>'child06-kms-v1' AND wrapped_data_key IS NULL)
 );
-- KMS records are append-only: no rekey by mutation; wrap rotates via KMS.
CREATE FUNCTION tto.cooperative_store_governance_source_file_kms(
 p_evidence uuid,p_candidate uuid,p_size integer,p_sha bytea,
 p_iv bytea,p_tag bytea,p_encrypted bytea,p_key_version text,p_wrapped_data_key text,p_request uuid)
RETURNS TABLE(file_id uuid,source_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 ev record; cand record; oldrow record; new_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_evidence IS NULL OR p_candidate IS NULL OR p_request IS NULL OR
    p_key_version<>'child06-kms-v1' OR p_wrapped_data_key IS NULL OR
    p_wrapped_data_key !~ '^vault:v[1-9][0-9]*:[A-Za-z0-9+/=]+ OR
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
  aes_gcm_iv,aes_gcm_tag,encrypted_body,encryption_version,wrapped_data_key,submitted_by,request_key)
 VALUES(tid,ev.case_id,p_evidence,p_candidate,p_size,p_sha,p_iv,p_tag,
        p_encrypted,p_key_version,p_wrapped_data_key,actor,p_request)
 RETURNING f.file_id INTO new_id;
 RETURN QUERY SELECT new_id,'ENCRYPTED_QUARANTINED_UNAUTHENTICATED'::text,false;
END $fn$; OR length(p_wrapped_data_key)>2048 OR
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
  aes_gcm_iv,aes_gcm_tag,encrypted_body,encryption_version,submitted_by,request_key)
 VALUES(tid,ev.case_id,p_evidence,p_candidate,p_size,p_sha,p_iv,p_tag,
        p_encrypted,p_key_version,actor,p_request)
 RETURNING f.file_id INTO new_id;
 RETURN QUERY SELECT new_id,'ENCRYPTED_QUARANTINED_UNAUTHENTICATED'::text,false;
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_store_governance_source_file_kms(
 uuid,uuid,integer,bytea,bytea,bytea,bytea,text,text,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_store_governance_source_file_kms(
 uuid,uuid,integer,bytea,bytea,bytea,bytea,text,text,uuid) TO tto_app;
-- New packet function retains old one for prior compatibility.
CREATE FUNCTION tto.cooperative_governance_source_kms_packet(p_file uuid)
RETURNS TABLE(evidence_id uuid,issuer_candidate_id uuid,file_size integer,
 plaintext_sha256 bytea,aes_gcm_iv bytea,aes_gcm_tag bytea,
 encrypted_body bytea,encryption_version text,source_state text,wrapped_data_key text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT
   (tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
    tto.has_tenant_role(tid,'LEGAL_REVIEWER') OR
    tto.has_tenant_role(tid,'DOCUMENT_REVIEWER'))
 THEN RAISE EXCEPTION 'CHILD06_KMS_PACKET_ROLE_DENIED' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT f.evidence_id,f.issuer_candidate_id,f.file_size,
  f.plaintext_sha256,f.aes_gcm_iv,f.aes_gcm_tag,f.encrypted_body,
  f.encryption_version,f.source_state,f.wrapped_data_key
 FROM tto.cooperative_governance_source_files f
 WHERE f.file_id=p_file AND f.tenant_id=tid;
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_governance_source_kms_packet(uuid)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_governance_source_kms_packet(uuid) TO tto_app;
COMMENT ON COLUMN tto.cooperative_governance_source_files.wrapped_data_key IS
 'Vault Transit-wrapped per-file DEK; never persisted plaintext key; issuer not authenticated.';
COMMIT;
