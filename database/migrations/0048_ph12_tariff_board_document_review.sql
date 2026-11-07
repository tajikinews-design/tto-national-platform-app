-- PH12 §§21-25: immutable board-resolution evidence INTAKE and reviewer findings.
-- No verified BOARD_SIGNATORY source exists in approved CF02 authority scope:
-- a matching CLEAN file hash is NOT legal authentication of signatures.
-- Never change tariff DRAFT_UNVERIFIED or publish an ACTIVE tariff.
BEGIN;
CREATE TABLE tto.ph12_tariff_board_evidence_cases(
 case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 draft_id uuid NOT NULL REFERENCES tto.ph12_tariff_drafts(draft_id),
 document_id uuid NOT NULL REFERENCES tto.documents(document_id),
 document_version integer NOT NULL CHECK(document_version>0),
 file_sha256 bytea NOT NULL CHECK(octet_length(file_sha256)=32),
 resolution_number text NOT NULL CHECK(length(resolution_number) BETWEEN 8 AND 120),
 resolution_date date NOT NULL,
 effective_from date NOT NULL,
 effective_until date NOT NULL,
 signer_claims jsonb NOT NULL CHECK(jsonb_typeof(signer_claims)='array' AND
   jsonb_array_length(signer_claims) BETWEEN 1 AND 15),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'DOCUMENT_INTAKE_AUTHORITY_UNVERIFIED'
   CHECK(status='DOCUMENT_INTAKE_AUTHORITY_UNVERIFIED'),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,draft_id),
 UNIQUE(tenant_id,submitted_by,request_key),
 CHECK(effective_until>effective_from),
 CHECK(effective_from>=resolution_date)
);
CREATE TABLE tto.ph12_tariff_board_review_events(
 review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL UNIQUE REFERENCES tto.ph12_tariff_board_evidence_cases(case_id),
 reviewed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 decision text NOT NULL CHECK(decision IN(
   'METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED','DOCUMENT_REJECTED')),
 finding_reference text NOT NULL CHECK(length(finding_reference) BETWEEN 8 AND 160),
 request_key uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,reviewed_by,request_key)
);
ALTER TABLE tto.ph12_tariff_board_evidence_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_evidence_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_review_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_tariff_board_evidence_cases,
 tto.ph12_tariff_board_review_events FROM PUBLIC,tto_app;
-- All access is through authenticated scoped SECURITY DEFINER functions, NOT raw tables.
CREATE FUNCTION tto.ph12_tariff_board_no_changes() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $fn$
BEGIN RAISE EXCEPTION 'PH12_BOARD_EVIDENCE_APPEND_ONLY'
 USING ERRCODE='42501';END $fn$;
CREATE TRIGGER ph12_board_evidence_immutable BEFORE UPDATE OR DELETE
 ON tto.ph12_tariff_board_evidence_cases FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();
CREATE TRIGGER ph12_board_reviews_immutable BEFORE UPDATE OR DELETE
 ON tto.ph12_tariff_board_review_events FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.ph12_submit_tariff_board_evidence(
 p_draft uuid,p_document uuid,p_document_version integer,
 p_resolution text,p_resolution_date date,
 p_effective_from date,p_effective_until date,
 p_signer_claims jsonb,p_request_key uuid)
RETURNS TABLE(case_id uuid,status text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 oldrow record; docrow record; draftrow record; entry record; item jsonb; ids text[]:='{}';
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
    OR NOT tto.has_verified_authority(tid,'ROLE_MANAGEMENT')
 THEN RAISE EXCEPTION 'PH12_BOARD_INTAKE_MANAGER_DENIED' USING ERRCODE='42501';END IF;
 IF p_draft IS NULL OR p_document IS NULL OR p_document_version IS NULL OR
    p_request_key IS NULL OR p_resolution !~ '^[A-Za-z0-9_.:/-]{8,120}$' OR
    p_resolution_date IS NULL OR p_effective_from IS NULL OR p_effective_until IS NULL OR
    p_effective_until<=p_effective_from OR p_effective_from<p_resolution_date OR
    p_signer_claims IS NULL OR jsonb_typeof(p_signer_claims)<>'array' OR
    jsonb_array_length(p_signer_claims) NOT BETWEEN 1 AND 15 OR
    length(p_signer_claims::text)>3600
 THEN RAISE EXCEPTION 'PH12_BOARD_DOCUMENT_INVALID' USING ERRCODE='22023';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_signer_claims) LOOP
   IF jsonb_typeof(item)<>'object' OR
      (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR
      NOT(item ? 'signerId' AND item ? 'claimedRole') OR
      (item->>'signerId') !~
        '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
      (item->>'claimedRole') NOT IN ('BOARD_MEMBER','BOARD_CHAIR','BOARD_SECRETARY')
   THEN RAISE EXCEPTION 'PH12_BOARD_SIGNER_CLAIMS_INVALID' USING ERRCODE='22023';END IF;
   IF (item->>'signerId')=ANY(ids) THEN
    RAISE EXCEPTION 'PH12_BOARD_SIGNER_DUPLICATE' USING ERRCODE='22023';END IF;
   ids:=array_append(ids,item->>'signerId');
 END LOOP;
 SELECT d.tenant_id,d.created_by,d.payload INTO draftrow
 FROM tto.ph12_tariff_drafts d WHERE d.draft_id=p_draft AND d.tenant_id=tid;
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_BOARD_DRAFT_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF p_effective_from IS DISTINCT FROM (draftrow.payload->>'validFrom')::date OR
    p_effective_until IS DISTINCT FROM (draftrow.payload->>'validUntil')::date OR
    p_resolution IS DISTINCT FROM draftrow.payload->>'boardResolutionReference'
 THEN RAISE EXCEPTION 'PH12_BOARD_DRAFT_RESOLUTION_MISMATCH' USING ERRCODE='22023';END IF;
 -- The source document must have the specified version, a same-tenant
 -- CLEAN scanned file, and a preserved SHA256 digest from trusted CF03 storage.
 SELECT f.sha256,d.status AS document_status,f.scan_status INTO docrow
 FROM tto.documents d JOIN tto.document_versions v
 ON v.document_id=d.document_id
 JOIN tto.file_objects f ON f.file_object_id=v.file_object_id
 WHERE d.document_id=p_document AND d.tenant_id=tid
 AND v.version_num=p_document_version AND v.tenant_id=tid
 AND f.tenant_id=tid AND d.status='PUBLISHED'
 AND f.scan_status='CLEAN';
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_BOARD_SOURCE_DOCUMENT_UNVERIFIED'
 USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
  tid::text||':tariff-board:'||p_draft::text,0));
 SELECT e.* INTO oldrow FROM tto.ph12_tariff_board_evidence_cases e
 WHERE e.tenant_id=tid AND e.submitted_by=actor AND e.request_key=p_request_key;
 IF FOUND THEN
  IF oldrow.draft_id<>p_draft OR oldrow.document_id<>p_document OR
     oldrow.document_version<>p_document_version OR
     oldrow.resolution_number<>p_resolution OR
     oldrow.signer_claims<>p_signer_claims OR
     oldrow.effective_from<>p_effective_from OR
     oldrow.effective_until<>p_effective_until OR
     oldrow.resolution_date<>p_resolution_date OR
     oldrow.file_sha256<>docrow.sha256
  THEN RAISE EXCEPTION 'PH12_BOARD_IDEMPOTENCY_MISMATCH'
   USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT oldrow.case_id,oldrow.status,true;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM tto.ph12_tariff_board_evidence_cases x
    WHERE x.tenant_id=tid AND x.draft_id=p_draft)
 THEN RAISE EXCEPTION 'PH12_BOARD_CASE_ALREADY_EXISTS'
 USING ERRCODE='23505';END IF;
 INSERT INTO tto.ph12_tariff_board_evidence_cases AS b (
   tenant_id,draft_id,document_id,document_version,file_sha256,
   resolution_number,resolution_date,effective_from,effective_until,
   signer_claims,submitted_by,request_key)
 VALUES(tid,p_draft,p_document,p_document_version,docrow.sha256,
   p_resolution,p_resolution_date,p_effective_from,p_effective_until,
   p_signer_claims,actor,p_request_key)
 RETURNING b.case_id,b.status INTO entry;
 RETURN QUERY SELECT entry.case_id,entry.status,false;
END $fn$;

CREATE FUNCTION tto.ph12_review_tariff_board_evidence(
 p_case uuid,p_decision text,p_reference text,p_request_key uuid)
RETURNS TABLE(review_id uuid,decision text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 c record;docrow record;prior record;answer record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR
    NOT tto.has_tenant_role(tid,'DOCUMENT_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_BOARD_REVIEW_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF p_case IS NULL OR p_request_key IS NULL OR
    p_decision NOT IN('METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED','DOCUMENT_REJECTED') OR
    p_reference !~ '^[A-Za-z0-9_.:/-]{8,160}$'
 THEN RAISE EXCEPTION 'PH12_BOARD_REVIEW_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':board-review:'||p_case::text,0));
 SELECT x.*,d.created_by AS draft_author INTO c
 FROM tto.ph12_tariff_board_evidence_cases x
 JOIN tto.ph12_tariff_drafts d ON d.draft_id=x.draft_id
 WHERE x.case_id=p_case AND x.tenant_id=tid;
 IF NOT FOUND THEN RAISE EXCEPTION 'PH12_BOARD_REVIEW_CASE_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF actor=c.submitted_by OR actor=c.draft_author THEN
    RAISE EXCEPTION 'PH12_BOARD_FOUR_EYES_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_decision='METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED' THEN
  SELECT f.sha256,d.status AS document_status,f.scan_status INTO docrow
  FROM tto.documents d JOIN tto.document_versions v ON v.document_id=d.document_id
  JOIN tto.file_objects f ON f.file_object_id=v.file_object_id
  WHERE d.document_id=c.document_id AND d.tenant_id=tid
   AND v.version_num=c.document_version AND v.tenant_id=tid
   AND f.tenant_id=tid AND d.status='PUBLISHED' AND f.scan_status='CLEAN';
  IF NOT FOUND OR docrow.sha256<>c.file_sha256
  THEN RAISE EXCEPTION 'PH12_BOARD_DOCUMENT_SOURCE_CHANGED'
       USING ERRCODE='42501';END IF;
 END IF;
 SELECT e.* INTO prior FROM tto.ph12_tariff_board_review_events e
 WHERE e.tenant_id=tid AND e.reviewed_by=actor AND e.request_key=p_request_key;
 IF FOUND THEN
  IF prior.case_id<>p_case OR prior.decision<>p_decision OR
     prior.finding_reference<>p_reference
  THEN RAISE EXCEPTION 'PH12_BOARD_REVIEW_IDEMPOTENCY_MISMATCH'
    USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT prior.review_id,prior.decision,true;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM tto.ph12_tariff_board_review_events e
  WHERE e.case_id=p_case) THEN RAISE EXCEPTION 'PH12_BOARD_REVIEW_ALREADY_DECIDED'
  USING ERRCODE='23505';END IF;
 INSERT INTO tto.ph12_tariff_board_review_events AS e
  (tenant_id,case_id,reviewed_by,decision,finding_reference,request_key)
 VALUES(tid,p_case,actor,p_decision,p_reference,p_request_key)
 RETURNING e.review_id,e.decision INTO answer;
 RETURN QUERY SELECT answer.review_id,answer.decision,false;
END $fn$;

CREATE FUNCTION tto.ph12_my_tariff_board_cases()
RETURNS TABLE(case_id uuid,draft_id uuid,document_id uuid,
 document_version integer,file_sha256 text,resolution_number text,
 resolution_date date,effective_from date,effective_until date,
 signer_claims jsonb,case_status text,review_decision text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT (
   (tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') AND
    tto.has_verified_authority(tid,'ROLE_MANAGEMENT')) OR
   tto.has_tenant_role(tid,'DOCUMENT_REVIEWER'))
 THEN RAISE EXCEPTION 'PH12_BOARD_CASE_READ_DENIED' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT c.case_id,c.draft_id,c.document_id,c.document_version,
   encode(c.file_sha256,'hex'),c.resolution_number,c.resolution_date,
   c.effective_from,c.effective_until,c.signer_claims,c.status,r.decision
 FROM tto.ph12_tariff_board_evidence_cases c
 LEFT JOIN tto.ph12_tariff_board_review_events r ON r.case_id=c.case_id
 WHERE c.tenant_id=tid ORDER BY c.submitted_at DESC LIMIT 50;
END $fn$;
REVOKE ALL ON FUNCTION tto.ph12_submit_tariff_board_evidence(uuid,uuid,integer,text,date,date,date,jsonb,uuid),
 tto.ph12_review_tariff_board_evidence(uuid,text,text,uuid),
 tto.ph12_my_tariff_board_cases(),tto.ph12_tariff_board_no_changes()
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_submit_tariff_board_evidence(uuid,uuid,integer,text,date,date,date,jsonb,uuid),
 tto.ph12_review_tariff_board_evidence(uuid,text,text,uuid),
 tto.ph12_my_tariff_board_cases() TO tto_app;
COMMENT ON TABLE tto.ph12_tariff_board_evidence_cases IS
 'Evidence metadata and signer claims are NOT verified board authority; cannot activate tariffs.';
COMMIT;
