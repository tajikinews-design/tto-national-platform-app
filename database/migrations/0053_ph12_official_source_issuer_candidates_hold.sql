-- PH12 #171 / 0053: proposed official-source issuer map per cooperative (HOLD).
-- Cataloging public candidate registries NEVER proves official issuer identity,
-- possession of source credentials, valid signatory authority, or board approval.
-- No external network, no registry credential storage, no tariff mutation.
BEGIN;
CREATE TABLE tto.ph12_cooperative_source_issuer_candidates (
 candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 source_purpose text NOT NULL CHECK (source_purpose IN (
  'LEGAL_ENTITY_IDENTITY','REGISTERED_BOARD_CHANGES',
  'AUTHORISED_SIGNATORIES','COOPERATIVE_OVERSIGHT',
  'BOARD_MINUTES_QUORUM','SOURCE_REVOCATION_HISTORY')),
 issuer_kind text NOT NULL CHECK (issuer_kind IN (
  'LEGAL_ENTITY_REGISTRY','COMPANY_REGISTRAR','OFFICIAL_GAZETTE',
  'COOPERATIVE_REGULATOR','COOPERATIVE_RECORD_CUSTODIAN')),
 issuer_label text NOT NULL CHECK (length(issuer_label) BETWEEN 8 AND 160),
 public_reference text NOT NULL CHECK (length(public_reference) BETWEEN 8 AND 240),
 legal_basis_reference text NOT NULL CHECK (length(legal_basis_reference) BETWEEN 8 AND 240),
 candidate_state text NOT NULL DEFAULT 'PENDING_ISSUER_AUTHENTICATION'
    CHECK (candidate_state='PENDING_ISSUER_AUTHENTICATION'),
 proposed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_key uuid NOT NULL,
 proposed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (tenant_id,proposed_by,request_key)
);
CREATE INDEX ph12_issuer_candidates_tenant_purpose_idx
 ON tto.ph12_cooperative_source_issuer_candidates
 (tenant_id,source_purpose,proposed_at DESC);
ALTER TABLE tto.ph12_cooperative_source_issuer_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_cooperative_source_issuer_candidates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_cooperative_source_issuer_candidates FROM PUBLIC,tto_app;
CREATE TRIGGER ph12_source_issuer_candidate_immutable
 BEFORE UPDATE OR DELETE ON tto.ph12_cooperative_source_issuer_candidates
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();

CREATE FUNCTION tto.ph12_propose_cooperative_source_issuer(
 p_purpose text,p_kind text,p_label text,p_reference text,
 p_legal_basis text,p_request_key uuid)
RETURNS TABLE(candidate_id uuid,candidate_state text,replayed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
 prior record; created record;
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_ISSUER_PROPOSER_ROLE_DENIED' USING ERRCODE='42501'; END IF;
 IF p_purpose IS NULL OR p_purpose NOT IN (
   'LEGAL_ENTITY_IDENTITY','REGISTERED_BOARD_CHANGES',
   'AUTHORISED_SIGNATORIES','COOPERATIVE_OVERSIGHT',
   'BOARD_MINUTES_QUORUM','SOURCE_REVOCATION_HISTORY') OR
   p_kind IS NULL OR p_kind NOT IN (
   'LEGAL_ENTITY_REGISTRY','COMPANY_REGISTRAR','OFFICIAL_GAZETTE',
   'COOPERATIVE_REGULATOR','COOPERATIVE_RECORD_CUSTODIAN') OR
   p_label IS NULL OR length(p_label) NOT BETWEEN 8 AND 160 OR
   p_reference IS NULL OR length(p_reference) NOT BETWEEN 8 AND 240 OR
   p_legal_basis IS NULL OR length(p_legal_basis) NOT BETWEEN 8 AND 240 OR
   p_request_key IS NULL
 THEN RAISE EXCEPTION 'PH12_ISSUER_PROPOSAL_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
  tid::text||':issuer-candidate:'||actor::text||':'||p_request_key::text,0));
 SELECT c.* INTO prior FROM tto.ph12_cooperative_source_issuer_candidates c
 WHERE c.tenant_id=tid AND c.proposed_by=actor AND c.request_key=p_request_key;
 IF FOUND THEN
  IF prior.source_purpose<>p_purpose OR prior.issuer_kind<>p_kind OR
     prior.issuer_label<>p_label OR prior.public_reference<>p_reference OR
     prior.legal_basis_reference<>p_legal_basis
  THEN RAISE EXCEPTION 'PH12_ISSUER_PROPOSAL_REPLAY_CONFLICT' USING ERRCODE='23505';END IF;
  RETURN QUERY SELECT prior.candidate_id,prior.candidate_state,true;RETURN;
 END IF;
 INSERT INTO tto.ph12_cooperative_source_issuer_candidates AS c
 (tenant_id,source_purpose,issuer_kind,issuer_label,public_reference,
  legal_basis_reference,proposed_by,request_key)
 VALUES(tid,p_purpose,p_kind,p_label,p_reference,p_legal_basis,actor,p_request_key)
 RETURNING c.candidate_id,c.candidate_state INTO created;
 RETURN QUERY SELECT created.candidate_id,created.candidate_state,false;
END $fn$;

CREATE FUNCTION tto.ph12_list_cooperative_source_issuer_candidates()
RETURNS TABLE(candidate_id uuid,source_purpose text,issuer_kind text,
 issuer_label text,public_reference text,legal_basis_reference text,
 candidate_state text,proposed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE tid uuid:=tto.context_tenant_id(); actor uuid:=tto.context_actor_id();
BEGIN
 IF tid IS NULL OR actor IS NULL OR NOT tto.has_tenant_role(tid,'LEGAL_REVIEWER')
 THEN RAISE EXCEPTION 'PH12_ISSUER_LIST_ROLE_DENIED' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT c.candidate_id,c.source_purpose,c.issuer_kind,
   c.issuer_label,c.public_reference,c.legal_basis_reference,
   c.candidate_state,c.proposed_at
 FROM tto.ph12_cooperative_source_issuer_candidates c WHERE c.tenant_id=tid
 ORDER BY c.proposed_at DESC,c.candidate_id DESC LIMIT 100;
END $fn$;
REVOKE ALL ON FUNCTION tto.ph12_propose_cooperative_source_issuer(
 text,text,text,text,text,uuid),tto.ph12_list_cooperative_source_issuer_candidates()
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph12_propose_cooperative_source_issuer(
 text,text,text,text,text,uuid),tto.ph12_list_cooperative_source_issuer_candidates() TO tto_app;
COMMENT ON TABLE tto.ph12_cooperative_source_issuer_candidates IS
 'A proposed issuer is NOT authenticated: no automatic legal validation, no source credentials, no approval or tariff activation.';
COMMIT;
