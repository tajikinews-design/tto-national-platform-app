-- CHILD06: owner-approved two-NATURAL-person attestation of supplied legal notice PDF.
-- Cooperative INTERNAL evidence only; never official issuer authenticity or tariff ACTIVE.
-- Trust anchors are seeded ONLY by independently authorized migration/platform owner
-- after out-of-band identity and signatory review; tto_app has NO provisioning API.
BEGIN;
CREATE TABLE tto.cooperative_notice_attestation_policies (
 policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL UNIQUE REFERENCES tto.tenants(tenant_id),
 combination text NOT NULL CHECK (combination IN ('CEO_AND_CHAIR','REGISTERED_SIGNATORY_PAIR')),
 bootstrap_reference text NOT NULL CHECK(length(bootstrap_reference) BETWEEN 24 AND 350),
 bootstrap_digest bytea NOT NULL CHECK(octet_length(bootstrap_digest)=32),
 independently_verified_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(valid_until>valid_from)
);
CREATE TABLE tto.cooperative_notice_trusted_signatories (
 trust_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 policy_id uuid NOT NULL REFERENCES tto.cooperative_notice_attestation_policies(policy_id),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 capacity text NOT NULL CHECK(capacity IN ('CEO','BOARD_CHAIR','REGISTERED_SIGNATORY')),
 independent_identity_ref text NOT NULL CHECK(length(independent_identity_ref) BETWEEN 24 AND 350),
 authority_evidence_digest bytea NOT NULL CHECK(octet_length(authority_evidence_digest)=32),
 independently_checked_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(valid_until>valid_from),
 CHECK(independently_checked_by<>user_id),
 UNIQUE(policy_id,party_id),
 UNIQUE(policy_id,user_id)
);
-- Revocation is append-only; trusted signatory/policy records are never edited.
-- Only independent offline platform owner can seed these revocation events.
CREATE TABLE tto.cooperative_notice_trust_revocations (
 revocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trust_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_notice_trusted_signatories(trust_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 revoked_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 independent_revocation_reference text NOT NULL
  CHECK(length(independent_revocation_reference) BETWEEN 24 AND 350),
 revoked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.cooperative_notice_policy_revocations (
 revocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 policy_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_notice_attestation_policies(policy_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 revoked_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 independent_revocation_reference text NOT NULL
  CHECK(length(independent_revocation_reference) BETWEEN 24 AND 350),
 revoked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.cooperative_notice_internal_attestations (
 attestation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 file_id uuid NOT NULL REFERENCES tto.cooperative_governance_source_files(file_id),
 policy_id uuid NOT NULL REFERENCES tto.cooperative_notice_attestation_policies(policy_id),
 trust_id uuid NOT NULL REFERENCES tto.cooperative_notice_trusted_signatories(trust_id),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 pdf_sha256 bytea NOT NULL CHECK(octet_length(pdf_sha256)=32),
 confirmation text NOT NULL CHECK(confirmation='I_CONFIRM_DOCUMENT_ACCURACY_AND_PERSONAL_RESPONSIBILITY'),
 request_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 official_issuer_authenticated boolean NOT NULL DEFAULT false CHECK(official_issuer_authenticated=false),
 legally_binding_signatory_action boolean NOT NULL DEFAULT false CHECK(legally_binding_signatory_action=false),
 tariff_activated boolean NOT NULL DEFAULT false CHECK(tariff_activated=false),
 UNIQUE(file_id,user_id),
 UNIQUE(file_id,party_id),
 UNIQUE(tenant_id,user_id,request_key)
);
CREATE TABLE tto.cooperative_notice_internal_attestation_holds (
 hold_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 file_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_governance_source_files(file_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 hold_reason text NOT NULL CHECK(hold_reason IN
  ('DISPUTED','SUPERSEDED','SIGNATORY_REVOKED','IDENTITY_COMPROMISED','INCORRECT_NOTICE')),
 request_key uuid NOT NULL,
 held_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,actor_id,request_key)
);
CREATE INDEX notice_internal_attestations_scope
 ON tto.cooperative_notice_internal_attestations(tenant_id,file_id);
DO $ddl$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY[
  'cooperative_notice_attestation_policies','cooperative_notice_trusted_signatories',
  'cooperative_notice_trust_revocations','cooperative_notice_policy_revocations',
  'cooperative_notice_internal_attestations','cooperative_notice_internal_attestation_holds'
 ] LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON TABLE tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON tto.%I FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes()',tab||'_immutable',tab);
 END LOOP;
END $ddl$;

-- Derive internal state dynamically, including later revoked/expired roster entries.
-- The original source remains officially unauthenticated in all outcomes.
CREATE FUNCTION tto.cooperative_notice_internal_attestation_state(p_file uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 src record;pol record;total int:=0;ceos int:=0;chairs int:=0;registered int:=0;
 held boolean;state text;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid)
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_SCOPE_DENIED' USING ERRCODE='42501';END IF;
 SELECT * INTO src FROM tto.cooperative_governance_source_files
 WHERE file_id=p_file AND tenant_id=tid;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_FILE_DENIED' USING ERRCODE='42501';END IF;
 SELECT * INTO pol FROM tto.cooperative_notice_attestation_policies p
 WHERE tenant_id=tid AND now() BETWEEN valid_from AND valid_until
 AND NOT EXISTS(SELECT 1 FROM tto.cooperative_notice_policy_revocations rv
 WHERE rv.policy_id=p.policy_id AND rv.tenant_id=tid);
 SELECT EXISTS(SELECT 1 FROM tto.cooperative_notice_internal_attestation_holds
    WHERE tenant_id=tid AND file_id=p_file) INTO held;
 SELECT count(*)::int,
  count(*) FILTER(WHERE t.capacity='CEO')::int,
  count(*) FILTER(WHERE t.capacity='BOARD_CHAIR')::int,
  count(*) FILTER(WHERE t.capacity='REGISTERED_SIGNATORY')::int
 INTO total,ceos,chairs,registered
 FROM tto.cooperative_notice_internal_attestations a
 JOIN tto.cooperative_notice_trusted_signatories t ON t.trust_id=a.trust_id
 JOIN tto.user_accounts u ON u.user_id=a.user_id AND u.status='ACTIVE'
 JOIN tto.user_party_links l ON l.user_id=a.user_id AND l.party_id=a.party_id
 JOIN tto.parties party ON party.party_id=a.party_id AND party.party_kind='PERSON'
 WHERE a.tenant_id=tid AND a.file_id=p_file AND a.pdf_sha256=src.plaintext_sha256
   AND pol.policy_id IS NOT NULL AND a.policy_id=pol.policy_id
   AND t.policy_id=pol.policy_id AND t.tenant_id=tid
   AND t.user_id=a.user_id AND t.party_id=a.party_id
   AND l.verified_at IS NOT NULL AND t.revoked_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM tto.cooperative_notice_trust_revocations rv
     WHERE rv.trust_id=t.trust_id AND rv.tenant_id=tid)
   AND now() BETWEEN t.valid_from AND t.valid_until;
 IF held THEN state:='HOLD_DISPUTED_OR_SUPERSEDED';
 ELSIF pol.policy_id IS NULL THEN state:='HOLD_TRUST_BOOTSTRAP_REQUIRED';
 ELSIF NOT EXISTS(SELECT 1 FROM tto.cooperative_governance_pdf_scan_events s
            WHERE s.file_id=p_file AND s.tenant_id=tid AND s.verdict='CLEAN')
 THEN state:='HOLD_SCAN_CLEAN_REQUIRED';
 ELSIF (pol.combination='CEO_AND_CHAIR' AND ceos>=1 AND chairs>=1)
   OR (pol.combination='REGISTERED_SIGNATORY_PAIR' AND registered>=2)
 THEN state:='COOPERATIVE_DUAL_ATTESTED_INTERNAL_ONLY';
 ELSIF total=1 THEN state:='FIRST_INTERNAL_ATTESTATION_RECORDED';
 ELSE state:='HOLD_TWO_AUTHORIZED_PERSONS_REQUIRED';END IF;
 RETURN jsonb_build_object('fileId',p_file,'status',state,
    'validSignerCount',total,'officialIssuerAuthenticated',false,
    'legalAuthorityVerified',false,'tariffActivated',false,
    'bindingSignatureAuthorized',false);
END $fn$;

CREATE FUNCTION tto.cooperative_record_notice_internal_attestation(
 p_file uuid,p_digest bytea,p_confirmation text,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 src record;pol record;trusted record;prior record;person_count int;
 audit_id uuid;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid)
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF p_file IS NULL OR p_request IS NULL OR octet_length(p_digest)<>32 OR
   p_confirmation IS DISTINCT FROM 'I_CONFIRM_DOCUMENT_ACCURACY_AND_PERSONAL_RESPONSIBILITY'
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_BAD_CONFIRMATION' USING ERRCODE='22023';END IF;
 -- Serializes two simultaneous votes, a dispute and scanner/record checks.
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':child06-attest:'||p_file::text,0));
 SELECT * INTO src FROM tto.cooperative_governance_source_files
   WHERE tenant_id=tid AND file_id=p_file;
 IF NOT FOUND OR src.submitted_by=actor OR src.plaintext_sha256<>p_digest
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_SOURCE_DENIED' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM tto.cooperative_notice_internal_attestation_holds
     WHERE tenant_id=tid AND file_id=p_file)
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_HELD' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.cooperative_governance_pdf_scan_events
     WHERE tenant_id=tid AND file_id=p_file AND verdict='CLEAN')
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_SCAN_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO pol FROM tto.cooperative_notice_attestation_policies p
    WHERE tenant_id=tid AND now() BETWEEN valid_from AND valid_until
 AND NOT EXISTS(SELECT 1 FROM tto.cooperative_notice_policy_revocations rv
 WHERE rv.policy_id=p.policy_id AND rv.tenant_id=tid);
 IF NOT FOUND OR pol.bootstrap_digest=src.plaintext_sha256
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_INDEPENDENT_BOOTSTRAP_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT t.* INTO trusted FROM tto.cooperative_notice_trusted_signatories t
 JOIN tto.user_accounts u ON u.user_id=t.user_id AND u.status='ACTIVE'
 JOIN tto.parties person ON person.party_id=t.party_id AND person.party_kind='PERSON'
 JOIN tto.user_party_links l ON l.user_id=t.user_id AND l.party_id=t.party_id
 WHERE t.policy_id=pol.policy_id AND t.tenant_id=tid AND t.user_id=actor
  AND t.revoked_at IS NULL AND now() BETWEEN t.valid_from AND t.valid_until
  AND NOT EXISTS(SELECT 1 FROM tto.cooperative_notice_trust_revocations rv
     WHERE rv.trust_id=t.trust_id AND rv.tenant_id=tid)
  AND l.verified_at IS NOT NULL AND t.authority_evidence_digest<>src.plaintext_sha256
  AND ((pol.combination='CEO_AND_CHAIR' AND t.capacity IN ('CEO','BOARD_CHAIR'))
   OR(pol.combination='REGISTERED_SIGNATORY_PAIR' AND t.capacity='REGISTERED_SIGNATORY'));
 IF NOT FOUND THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_TRUSTED_SIGNATORY_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT count(*)::int INTO person_count FROM tto.user_party_links l
 JOIN tto.parties p ON p.party_id=l.party_id AND p.party_kind='PERSON'
 WHERE l.user_id=actor AND l.verified_at IS NOT NULL;
 IF person_count<>1
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_IDENTITY_AMBIGUOUS' USING ERRCODE='42501';END IF;
 SELECT * INTO prior FROM tto.cooperative_notice_internal_attestations
 WHERE tenant_id=tid AND file_id=p_file AND user_id=actor;
 IF FOUND THEN
  IF prior.request_key<>p_request OR prior.pdf_sha256<>p_digest
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_IMMUTABLE_REPLAY' USING ERRCODE='23505';END IF;
  RETURN tto.cooperative_notice_internal_attestation_state(p_file)
   || jsonb_build_object('attestationId',prior.attestation_id,'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM tto.cooperative_notice_internal_attestations
    WHERE tenant_id=tid AND file_id=p_file AND party_id=trusted.party_id)
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_SAME_PERSON_DIFFERENT_ACCOUNTS' USING ERRCODE='42501';END IF;
 INSERT INTO tto.cooperative_notice_internal_attestations
 (tenant_id,file_id,policy_id,trust_id,user_id,party_id,pdf_sha256,confirmation,request_key)
 VALUES(tid,p_file,pol.policy_id,trusted.trust_id,actor,trusted.party_id,
        p_digest,p_confirmation,p_request)
 RETURNING attestation_id INTO audit_id;
 RETURN tto.cooperative_notice_internal_attestation_state(p_file)
  || jsonb_build_object('attestationId',audit_id,'replayed',false);
END $fn$;
CREATE FUNCTION tto.cooperative_hold_notice_internal_attestation(
 p_file uuid,p_reason text,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();
 rowid uuid;old record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT
  (tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR tto.has_tenant_role(tid,'LEGAL_REVIEWER'))
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_HOLD_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF p_file IS NULL OR p_request IS NULL OR p_reason NOT IN
  ('DISPUTED','SUPERSEDED','SIGNATORY_REVOKED','IDENTITY_COMPROMISED','INCORRECT_NOTICE')
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_HOLD_INPUT' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text||':child06-attest:'||p_file::text,0));
 IF NOT EXISTS(SELECT 1 FROM tto.cooperative_governance_source_files WHERE tenant_id=tid AND file_id=p_file)
 THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_HOLD_FILE_DENIED' USING ERRCODE='42501';END IF;
 SELECT * INTO old FROM tto.cooperative_notice_internal_attestation_holds
 WHERE tenant_id=tid AND file_id=p_file;
 IF FOUND THEN
  IF old.actor_id<>actor OR old.hold_reason<>p_reason OR old.request_key<>p_request
  THEN RAISE EXCEPTION 'CHILD06_DUAL_ATTESTATION_HOLD_IMMUTABLE' USING ERRCODE='23505';END IF;
  RETURN tto.cooperative_notice_internal_attestation_state(p_file);
 END IF;
 INSERT INTO tto.cooperative_notice_internal_attestation_holds
   (tenant_id,file_id,actor_id,hold_reason,request_key)
 VALUES(tid,p_file,actor,p_reason,p_request) RETURNING hold_id INTO rowid;
 RETURN tto.cooperative_notice_internal_attestation_state(p_file)
  || jsonb_build_object('holdId',rowid);
END $fn$;
REVOKE ALL ON FUNCTION tto.cooperative_notice_internal_attestation_state(uuid),
 tto.cooperative_record_notice_internal_attestation(uuid,bytea,text,uuid),
 tto.cooperative_hold_notice_internal_attestation(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.cooperative_notice_internal_attestation_state(uuid),
 tto.cooperative_record_notice_internal_attestation(uuid,bytea,text,uuid),
 tto.cooperative_hold_notice_internal_attestation(uuid,text,uuid) TO tto_app;
COMMENT ON TABLE tto.cooperative_notice_attestation_policies IS
 'Offline independently provisioned cooperative attestation rules; NOT proof from Gazette.';
COMMENT ON TABLE tto.cooperative_notice_trusted_signatories IS
 'Offline verified distinct PERSON identity and signatory capacity, never bootstrap from the target notice.';
COMMENT ON TABLE tto.cooperative_notice_internal_attestations IS
 'Two-person statement of supplied PDF accuracy; no official issuer attestation, legally binding signature or tariff activation.';
COMMIT;
