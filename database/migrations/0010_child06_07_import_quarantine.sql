-- CHILD06/07 provenance validation intake. DISPOSABLE CI ONLY; NOT a live importer.
-- Evidence/metadata validation here does NOT authenticate an external authority or approve a legal source.
BEGIN;
CREATE TABLE tto.source_import_batches(
 batch_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 domain text NOT NULL CHECK(domain IN('CHILD06_MEMBERSHIP','CHILD07_HOLDINGS')),
 source_ref text NOT NULL CHECK(length(trim(source_ref)) BETWEEN 8 AND 160),
 external_batch_ref text NOT NULL CHECK(length(trim(external_batch_ref)) BETWEEN 8 AND 160),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 artifact_sha256 bytea NOT NULL CHECK(octet_length(artifact_sha256)=32),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 attested_by uuid REFERENCES tto.user_accounts(user_id),
 attested_at timestamptz,
 attestation_evidence_id uuid REFERENCES tto.evidence_references(evidence_id),
 UNIQUE(tenant_id,domain,source_ref,external_batch_ref),
 CHECK((attested_by IS NULL AND attested_at IS NULL AND attestation_evidence_id IS NULL)
    OR (attested_by IS NOT NULL AND attested_at IS NOT NULL AND attestation_evidence_id IS NOT NULL))
);
CREATE TABLE tto.source_import_claims(
 claim_id uuid PRIMARY KEY,
 batch_id uuid NOT NULL REFERENCES tto.source_import_batches(batch_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 domain text NOT NULL CHECK(domain IN('CHILD06_MEMBERSHIP','CHILD07_HOLDINGS')),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 source_event_id uuid,
 source_version bigint,
 membership_status text,
 shareholder_account_id uuid,
 ledger_entry_ref uuid,
 ledger_version bigint,
 share_quantity bigint,
 effective_at timestamptz NOT NULL,
 claim_sha256 bytea NOT NULL CHECK(octet_length(claim_sha256)=32),
 CHECK(
  (domain='CHILD06_MEMBERSHIP' AND source_event_id IS NOT NULL
    AND source_version>0 AND membership_status IN('ACTIVE','ENDED','SUSPENDED')
    AND shareholder_account_id IS NULL AND ledger_entry_ref IS NULL
    AND ledger_version IS NULL AND share_quantity IS NULL)
  OR
  (domain='CHILD07_HOLDINGS' AND source_event_id IS NULL
    AND source_version IS NULL AND membership_status IS NULL
    AND shareholder_account_id IS NOT NULL AND ledger_entry_ref IS NOT NULL
    AND ledger_version>0 AND share_quantity>=0)
 ),
 UNIQUE(batch_id,party_id,source_event_id),
 UNIQUE(batch_id,party_id,ledger_entry_ref)
);
DO $lock$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['source_import_batches','source_import_claims'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tbl);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON tto.%I FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation()',tbl||'_immutable',tbl);
 END LOOP;
END $lock$;
-- This is a pure inspection verdict, not a promotion command. NO SQL function
-- in this migration can write to member/ownership projections or change approval gates.
CREATE FUNCTION tto.assess_source_import_claim(p_claim uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE b tto.source_import_batches%ROWTYPE;
 c tto.source_import_claims%ROWTYPE;
 r tto.relationship_projections%ROWTYPE;
 m tto.member_source_snapshots%ROWTYPE;
 a tto.shareholder_source_accounts%ROWTYPE;
 current_ledger tto.shareholding_source_snapshots%ROWTYPE;
BEGIN
 SELECT * INTO c FROM tto.source_import_claims WHERE claim_id=p_claim;
 IF NOT FOUND THEN RETURN 'UNKNOWN_CLAIM'; END IF;
 SELECT * INTO b FROM tto.source_import_batches WHERE batch_id=c.batch_id;
 IF NOT FOUND OR b.tenant_id<>c.tenant_id OR b.domain<>c.domain THEN
  RETURN 'CROSS_TENANT_OR_DOMAIN_MISMATCH';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=b.tenant_id AND status='ACTIVE')
 THEN RETURN 'INACTIVE_TENANT'; END IF;
 IF NOT tto.valid_read_source(b.tenant_id,b.domain,b.source_ref)
 THEN RETURN 'SOURCE_CONTRACT_NOT_APPROVED'; END IF;
 IF b.attested_by IS NULL THEN RETURN 'QUARANTINED_NO_INDEPENDENT_ATTESTATION'; END IF;
 IF b.attested_by=b.submitted_by THEN RETURN 'QUARANTINED_SOD_VIOLATION'; END IF;
 -- Independent review may legitimately occur days after intake.
 -- Deny only impossible early/future attestations (bounded clock skew).
 IF b.attested_at<b.received_at-interval '5 minutes'
   OR b.attested_at>now()+interval '5 minutes' THEN
  RETURN 'QUARANTINED_ATTESTATION_CLOCK_MISMATCH'; END IF;
 IF NOT tto.valid_identity_evidence(b.tenant_id,b.attestation_evidence_id)
 THEN RETURN 'QUARANTINED_ATTESTATION_EVIDENCE_INVALID'; END IF;
 IF c.effective_at>now() THEN RETURN 'FUTURE_EFFECTIVE_DATE'; END IF;
 IF c.domain='CHILD06_MEMBERSHIP' THEN
  SELECT * INTO r FROM tto.relationship_projections
   WHERE tenant_id=c.tenant_id AND party_id=c.party_id;
  IF NOT FOUND OR r.source_event_id<>c.source_event_id
     OR r.source_version<>c.source_version OR r.membership_status<>c.membership_status
  THEN RETURN 'MEMBER_MASTER_PROJECTION_MISMATCH'; END IF;
  SELECT * INTO m FROM tto.member_source_snapshots
   WHERE tenant_id=c.tenant_id AND party_id=c.party_id;
  IF NOT FOUND THEN RETURN 'READY_FOR_INDEPENDENT_REVIEW'; END IF;
  IF c.source_version<m.source_version THEN RETURN 'STALE_SOURCE_VERSION'; END IF;
  IF c.source_version=m.source_version THEN
   IF c.source_event_id=m.source_event_id AND c.membership_status=m.membership_status
   THEN RETURN 'REPLAY_IDENTICAL_REFERENCE'; END IF;
   RETURN 'CONFLICT_SAME_VERSION';
  END IF;
  IF c.source_version>m.source_version+1 THEN RETURN 'VERSION_GAP'; END IF;
  IF c.effective_at<m.source_as_of THEN RETURN 'EFFECTIVE_TIME_REGRESSION'; END IF;
  RETURN 'READY_FOR_INDEPENDENT_REVIEW';
 END IF;
 -- Child07: never conflate a member with a shareholder account, or a snapshot
 -- with a verified, append-only ownership ledger.
 SELECT * INTO a FROM tto.shareholder_source_accounts
  WHERE tenant_id=c.tenant_id AND party_id=c.party_id
     AND shareholder_account_id=c.shareholder_account_id AND account_status='ACTIVE';
 IF NOT FOUND THEN RETURN 'SHAREHOLDER_ACCOUNT_NOT_MAPPED'; END IF;
 IF NOT tto.valid_read_source(b.tenant_id,'CHILD06_MEMBERSHIP',a.source_ref)
 THEN RETURN 'MEMBERSHIP_SOURCE_NOT_APPROVED'; END IF;
 SELECT * INTO current_ledger FROM tto.shareholding_source_snapshots
 WHERE tenant_id=c.tenant_id AND shareholder_account_id=c.shareholder_account_id
 ORDER BY ledger_version DESC LIMIT 1;
 IF NOT FOUND THEN
  IF c.ledger_version=1 THEN RETURN 'READY_FOR_INDEPENDENT_REVIEW'; END IF;
  RETURN 'VERSION_GAP';
 END IF;
 IF c.ledger_version<current_ledger.ledger_version THEN RETURN 'STALE_SOURCE_VERSION'; END IF;
 IF c.ledger_version=current_ledger.ledger_version THEN
  IF c.ledger_entry_ref=current_ledger.ledger_entry_ref
   AND c.share_quantity=current_ledger.share_quantity
   AND b.source_ref=current_ledger.source_ref
  THEN RETURN 'REPLAY_IDENTICAL_REFERENCE'; END IF;
  RETURN 'CONFLICT_SAME_VERSION';
 END IF;
 IF c.ledger_version>current_ledger.ledger_version+1 THEN RETURN 'VERSION_GAP'; END IF;
 IF c.effective_at<current_ledger.ledger_as_of THEN RETURN 'EFFECTIVE_TIME_REGRESSION'; END IF;
 IF EXISTS(SELECT 1 FROM tto.shareholding_source_snapshots s
  WHERE s.tenant_id=c.tenant_id AND s.ledger_entry_ref=c.ledger_entry_ref)
 THEN RETURN 'REUSED_LEDGER_ENTRY_REF'; END IF;
 RETURN 'READY_FOR_INDEPENDENT_REVIEW';
END $f$;
REVOKE ALL ON FUNCTION tto.assess_source_import_claim(uuid) FROM PUBLIC,tto_app;
COMMENT ON FUNCTION tto.assess_source_import_claim(uuid) IS
 'CI-only staged deterministic consistency verdict; never promotes data or verifies external authenticity';
COMMIT;
