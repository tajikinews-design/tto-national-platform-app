-- PH10.7 MANUAL official gazette citation registry (self-reported / unverified only).
-- No Rasmio API or automatic company/person role synchronization.
-- The actual cooperative manager must already hold independent verified authority.
CREATE TABLE tto.cooperative_manual_official_governance_claims (
 claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 request_key uuid NOT NULL UNIQUE,
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 person_full_name text NOT NULL CHECK(length(btrim(person_full_name)) BETWEEN 3 AND 160),
 office_type text NOT NULL CHECK(office_type IN
   ('BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_MEMBER','CEO','AUTHORIZED_SIGNATORY','INSPECTOR','OTHER')),
 signing_mode text NOT NULL CHECK(signing_mode IN
   ('NONE','INDIVIDUAL','JOINT','BOARD_RESOLUTION','OTHER_SPECIFIED')),
 authority_scope text NOT NULL CHECK(length(btrim(authority_scope)) BETWEEN 10 AND 1500),
 official_issue_number text NOT NULL CHECK(official_issue_number ~ '^[0-9]{1,20}$'),
 official_publication_date date NOT NULL CHECK(
   official_publication_date BETWEEN DATE '1950-01-01' AND CURRENT_DATE),
 official_announcement_number text NOT NULL CHECK(
   official_announcement_number ~ '^[0-9A-Za-z-]{1,40}$'),
 effective_from date,
 effective_until date,
 official_reference_url text CHECK(
   official_reference_url IS NULL OR
   (length(official_reference_url)<=400 AND
    official_reference_url LIKE 'https://%')),
 supersedes_claim_id uuid REFERENCES tto.cooperative_manual_official_governance_claims(claim_id),
 verification_status text NOT NULL DEFAULT 'SELF_REPORTED_PENDING_REVIEW'
    CHECK(verification_status='SELF_REPORTED_PENDING_REVIEW'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(effective_until IS NULL OR
  (effective_from IS NOT NULL AND effective_until>=effective_from)),
 CHECK(signing_mode<>'JOINT' OR length(btrim(authority_scope))>=15),
 UNIQUE(claim_id,tenant_id)
);
CREATE INDEX manual_official_governance_by_tenant
 ON tto.cooperative_manual_official_governance_claims(tenant_id,created_at DESC);
CREATE INDEX manual_official_governance_by_reference
 ON tto.cooperative_manual_official_governance_claims(
  tenant_id,official_issue_number,official_announcement_number);
ALTER TABLE tto.cooperative_manual_official_governance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.cooperative_manual_official_governance_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.cooperative_manual_official_governance_claims FROM PUBLIC,tto_app;

CREATE OR REPLACE FUNCTION tto.submit_manual_official_governance_claim(
 p_tenant uuid,p_request_key uuid,p_person_name text,p_office text,
 p_signing_mode text,p_scope text,p_issue_no text,p_publication_date date,
 p_announcement_no text,p_effective_from date,p_effective_until date,
 p_source_url text,p_supersedes uuid,p_session_digest bytea
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $f$
DECLARE v_actor uuid;v_session_actor uuid;
 v_tenant_status text;v_previous tto.cooperative_manual_official_governance_claims%ROWTYPE;
 v_id uuid;v_parent_tenant uuid;
BEGIN
 v_actor:=tto.context_actor_id();
 IF p_session_digest IS NULL OR octet_length(p_session_digest)<>32 THEN
  RAISE EXCEPTION 'VERIFIED_MANAGER_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT user_id INTO v_session_actor FROM tto.resolve_session(p_session_digest);
 IF v_actor IS NULL OR v_session_actor IS DISTINCT FROM v_actor OR
    p_tenant IS DISTINCT FROM tto.context_tenant_id() OR
    NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER') OR
    NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT') THEN
  RAISE EXCEPTION 'AUTHORIZED_COOPERATIVE_MANAGER_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT status INTO v_tenant_status FROM tto.tenants WHERE tenant_id=p_tenant;
 IF v_tenant_status IS DISTINCT FROM 'ACTIVE' THEN
  RAISE EXCEPTION 'ACTIVE_COOPERATIVE_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_request_key IS NULL OR p_person_name IS NULL OR
    length(btrim(p_person_name)) NOT BETWEEN 3 AND 160 OR
    p_office IS NULL OR p_office NOT IN
     ('BOARD_CHAIR','BOARD_VICE_CHAIR','BOARD_MEMBER','CEO','AUTHORIZED_SIGNATORY','INSPECTOR','OTHER') OR
    p_signing_mode IS NULL OR p_signing_mode NOT IN
     ('NONE','INDIVIDUAL','JOINT','BOARD_RESOLUTION','OTHER_SPECIFIED') OR
    p_scope IS NULL OR length(btrim(p_scope)) NOT BETWEEN 10 AND 1500 OR
    p_issue_no IS NULL OR p_issue_no !~ '^[0-9]{1,20}$' OR
    p_publication_date IS NULL OR p_publication_date<DATE '1950-01-01' OR
    p_publication_date>CURRENT_DATE OR
    p_announcement_no IS NULL OR p_announcement_no !~ '^[0-9A-Za-z-]{1,40}$' OR
    (p_effective_until IS NOT NULL AND
      (p_effective_from IS NULL OR p_effective_until<p_effective_from)) OR
    (p_source_url IS NOT NULL AND
      (length(p_source_url)>400 OR p_source_url NOT LIKE 'https://%')) THEN
  RAISE EXCEPTION 'INVALID_OFFICIAL_GAZETTE_CITATION' USING ERRCODE='22023';
 END IF;
 IF p_supersedes IS NOT NULL THEN
   SELECT tenant_id INTO v_parent_tenant
     FROM tto.cooperative_manual_official_governance_claims
    WHERE claim_id=p_supersedes;
   IF v_parent_tenant IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION 'CROSS_TENANT_CLAIM_REVISION_DENIED' USING ERRCODE='42501';
   END IF;
 END IF;
 -- Idempotent but append-only: correction creates a new row referencing the old.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text,149));
 SELECT * INTO v_previous FROM tto.cooperative_manual_official_governance_claims
  WHERE request_key=p_request_key;
 IF FOUND THEN
  IF v_previous.tenant_id=p_tenant AND v_previous.submitted_by=v_actor AND
   v_previous.person_full_name=btrim(p_person_name) AND v_previous.office_type=p_office AND
   v_previous.signing_mode=p_signing_mode AND
   v_previous.authority_scope=btrim(p_scope) AND
   v_previous.official_issue_number=p_issue_no AND
   v_previous.official_publication_date=p_publication_date AND
   v_previous.official_announcement_number=p_announcement_no AND
   v_previous.effective_from IS NOT DISTINCT FROM p_effective_from AND
   v_previous.effective_until IS NOT DISTINCT FROM p_effective_until AND
   v_previous.official_reference_url IS NOT DISTINCT FROM p_source_url AND
   v_previous.supersedes_claim_id IS NOT DISTINCT FROM p_supersedes THEN
    RETURN jsonb_build_object('claimId',v_previous.claim_id,
      'replayed',true,'status','SELF_REPORTED_PENDING_REVIEW',
      'roleGranted',false,'officiallyVerified',false,'legalApproval',false);
  END IF;
  RAISE EXCEPTION 'OFFICIAL_NOTICE_REQUEST_KEY_REUSED' USING ERRCODE='23505';
 END IF;
 INSERT INTO tto.cooperative_manual_official_governance_claims(
  tenant_id,request_key,submitted_by,person_full_name,office_type,signing_mode,
  authority_scope,official_issue_number,official_publication_date,
  official_announcement_number,effective_from,effective_until,
  official_reference_url,supersedes_claim_id)
 VALUES(p_tenant,p_request_key,v_actor,btrim(p_person_name),p_office,p_signing_mode,
  btrim(p_scope),p_issue_no,p_publication_date,p_announcement_no,
  p_effective_from,p_effective_until,p_source_url,p_supersedes)
 RETURNING claim_id INTO v_id;
 RETURN jsonb_build_object('claimId',v_id,'replayed',false,
  'status','SELF_REPORTED_PENDING_REVIEW',
  'roleGranted',false,'officiallyVerified',false,'legalApproval',false);
END $f$;
REVOKE ALL ON FUNCTION tto.submit_manual_official_governance_claim(
 uuid,uuid,text,text,text,text,text,date,text,date,date,text,uuid,bytea)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.submit_manual_official_governance_claim(
 uuid,uuid,text,text,text,text,text,date,text,date,date,text,uuid,bytea)
 TO tto_app;
COMMENT ON TABLE tto.cooperative_manual_official_governance_claims IS
 'Manual cooperative-manager statement with precise Official Gazette issue/date/announcement citation per office and signing scope; never a legally verified identity, role, signer authorization or official registry API attestation.';
