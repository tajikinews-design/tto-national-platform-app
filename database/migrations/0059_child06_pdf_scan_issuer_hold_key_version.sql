-- CHILD-06 strict quarantine: versioned envelope, independent scanner receipt, issuer-claim HOLD.
-- No official registry connection exists; deliberately NO authenticated/ACTIVE state.
BEGIN;
ALTER TABLE tto.cooperative_governance_source_files
 DROP CONSTRAINT cooperative_governance_source_files_encryption_version_check;
ALTER TABLE tto.cooperative_governance_source_files
 ADD CONSTRAINT cooperative_governance_source_files_encryption_version_check
 CHECK(encryption_version IN ('child06-lab-v1','child06-lab-v2'));

CREATE FUNCTION tto.cooperative_store_governance_source_file_versioned(
 p_evidence uuid,p_candidate uuid,p_size integer,p_sha bytea,
 p_iv bytea,p_tag bytea,p_encrypted bytea,p_key_version text,p_request uuid)
RETURNS TABLE(file_id uuid,source_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 ev record; cand record; oldrow record; new_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
 THEN RAISE EXCEPTION 'CHILD06_ESCROW_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_evidence IS NULL OR p_candidate IS NULL OR p_request IS NULL OR
    p_key_version NOT IN ('child06-lab-v1','child06-lab-v2') OR
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
REVOKE ALL ON FUNCTION tto.cooperative_store_governance_source_file_versioned(
 uuid,uuid,integer,bytea,bytea,bytea,bytea,text,uuid) FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.cooperative_store_governance_source_file_versioned(
 uuid,uuid,integer,bytea,bytea,bytea,bytea,text,uuid) TO tto_app;

CREATE TABLE tto.cooperative_governance_pdf_scan_events (
 scan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 file_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_governance_source_files(file_id),
 verdict text NOT NULL CHECK(verdict IN ('CLEAN','MALWARE')),
 engine_label text NOT NULL CHECK(length(engine_label) BETWEEN 6 AND 160),
 signature_label text NOT NULL CHECK(length(signature_label) BETWEEN 2 AND 120),
 scanned_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 scanned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 file_released boolean NOT NULL DEFAULT false CHECK(file_released=false),
 official_source_authenticated boolean NOT NULL DEFAULT false CHECK(official_source_authenticated=false),
 UNIQUE(tenant_id,scanned_by,request_key)
);
CREATE TABLE tto.cooperative_governance_pdf_source_observations (
 observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 file_id uuid NOT NULL REFERENCES tto.cooperative_governance_source_files(file_id),
 candidate_id uuid NOT NULL REFERENCES tto.ph12_cooperative_source_issuer_candidates(candidate_id),
 outcome text NOT NULL CHECK(outcome IN ('NO_OFFICIAL_CONNECTOR','ISSUER_UNREACHABLE',
  'ISSUER_IDENTITY_UNTRUSTED','OFFICIAL_REFERENCE_UNMATCHED','SOURCE_VERSION_UNKNOWN')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 12 AND 240),
 observed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 official_authenticated boolean NOT NULL DEFAULT false CHECK(official_authenticated=false),
 signatory_authorized boolean NOT NULL DEFAULT false CHECK(signatory_authorized=false),
 tariff_activated boolean NOT NULL DEFAULT false CHECK(tariff_activated=false),
 UNIQUE(tenant_id,observed_by,request_key)
);
DO $ddl$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['cooperative_governance_pdf_scan_events',
 'cooperative_governance_pdf_source_observations'] LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON TABLE tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON tto.%I FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes()',tab||'_immutable',tab);
 END LOOP;
END $ddl$;

CREATE FUNCTION tto.cooperative_record_governance_pdf_scan(
 p_file uuid,p_verdict text,p_engine text,p_signature text,p_request uuid)
RETURNS TABLE(scan_id uuid,scan_verdict text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 source_file record;prior record;created uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'CHILD06_SCAN_INDEPENDENT_ROLE_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_file IS NULL OR p_request IS NULL OR p_verdict NOT IN('CLEAN','MALWARE')
    OR length(p_engine) NOT BETWEEN 6 AND 160
    OR length(p_signature) NOT BETWEEN 2 AND 120
 THEN RAISE EXCEPTION 'CHILD06_SCAN_INVALID_INPUT' USING ERRCODE='22023';END IF;
 SELECT * INTO source_file FROM tto.cooperative_governance_source_files
 WHERE file_id=p_file AND tenant_id=tid;
 IF NOT FOUND OR source_file.submitted_by=actor
 THEN RAISE EXCEPTION 'CHILD06_SCAN_INDEPENDENCE_DENIED' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':pdf-scan:'||p_file::text,0));
 SELECT * INTO prior FROM tto.cooperative_governance_pdf_scan_events WHERE file_id=p_file AND tenant_id=tid;
 IF FOUND THEN
  IF prior.scanned_by=actor AND prior.request_key=p_request AND
     prior.verdict=p_verdict AND prior.engine_label=p_engine AND prior.signature_label=p_signature
  THEN RETURN QUERY SELECT prior.scan_id,prior.verdict,true;RETURN;END IF;
  RAISE EXCEPTION 'CHILD06_SCAN_IMMUTABLE_DISPOSITION' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_governance_pdf_scan_events AS s
  (tenant_id,file_id,verdict,engine_label,signature_label,scanned_by,request_key)
 VALUES(tid,p_file,p_verdict,p_engine,p_signature,actor,p_request)
 RETURNING s.scan_id INTO created;
 RETURN QUERY SELECT created,p_verdict,false;
END $fn$;

CREATE FUNCTION tto.cooperative_record_governance_pdf_source_hold(
 p_file uuid,p_outcome text,p_ref text,p_request uuid)
RETURNS TABLE(observation_id uuid,state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 file_row record;existing record;new_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'CHILD06_PDF_PROVENANCE_REVIEWER_DENIED' USING ERRCODE='42501';END IF;
 IF p_file IS NULL OR p_request IS NULL OR p_outcome NOT IN
  ('NO_OFFICIAL_CONNECTOR','ISSUER_UNREACHABLE','ISSUER_IDENTITY_UNTRUSTED',
   'OFFICIAL_REFERENCE_UNMATCHED','SOURCE_VERSION_UNKNOWN')
  OR length(p_ref) NOT BETWEEN 12 AND 240
 THEN RAISE EXCEPTION 'CHILD06_PDF_PROVENANCE_INVALID_INPUT' USING ERRCODE='22023';END IF;
 SELECT * INTO file_row FROM tto.cooperative_governance_source_files
 WHERE file_id=p_file AND tenant_id=tid;
 IF NOT FOUND OR file_row.submitted_by=actor
 THEN RAISE EXCEPTION 'CHILD06_PDF_PROVENANCE_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':pdf-provenance:'||actor::text||':'||p_request::text,0));
 SELECT * INTO existing FROM tto.cooperative_governance_pdf_source_observations
 WHERE tenant_id=tid AND observed_by=actor AND request_key=p_request;
 IF FOUND THEN
  IF existing.file_id<>p_file OR existing.outcome<>p_outcome
   OR existing.source_reference<>p_ref THEN
   RAISE EXCEPTION 'CHILD06_PDF_PROVENANCE_REPLAY_CHANGED' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT existing.observation_id,existing.outcome,true;RETURN;
 END IF;
 INSERT INTO tto.cooperative_governance_pdf_source_observations AS x
  (tenant_id,file_id,candidate_id,outcome,source_reference,observed_by,request_key)
 VALUES(tid,p_file,file_row.issuer_candidate_id,p_outcome,p_ref,actor,p_request)
 RETURNING x.observation_id INTO new_id;
 RETURN QUERY SELECT new_id,p_outcome,false;
END $fn$;

REVOKE ALL ON FUNCTION
 tto.cooperative_record_governance_pdf_scan(uuid,text,text,text,uuid),
 tto.cooperative_record_governance_pdf_source_hold(uuid,text,text,uuid)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION
 tto.cooperative_record_governance_pdf_scan(uuid,text,text,text,uuid),
 tto.cooperative_record_governance_pdf_source_hold(uuid,text,text,uuid)
 TO tto_app;
COMMENT ON TABLE tto.cooperative_governance_pdf_scan_events IS
 'Independent ClamAV scan receipt, never legal authenticity or file release.';
COMMENT ON TABLE tto.cooperative_governance_pdf_source_observations IS
 'Official issuer trust absent: immutable negative-only source observations. No active/approved state.';
COMMIT;
