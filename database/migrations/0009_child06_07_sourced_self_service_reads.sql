-- TTO Child06/Child07: source-mapped read-only self service, CI PG17 ONLY.
-- No new membership decisions, ledger writes, payments, wallet or automatic source approval.
BEGIN;
CREATE TABLE tto.source_contract_approvals(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 domain text NOT NULL CHECK(domain IN('CHILD06_MEMBERSHIP','CHILD07_HOLDINGS')),
 source_ref text NOT NULL CHECK(length(trim(source_ref)) BETWEEN 8 AND 160),
 rule_snapshot_ref uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_at timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,domain),
 CHECK(valid_until>approved_at)
);
-- A source-mapped Member Master relationship must match CF02's versioned projection.
CREATE TABLE tto.member_source_snapshots(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 source_ref text NOT NULL,
 source_event_id uuid NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 membership_status text NOT NULL CHECK(membership_status IN('ACTIVE','ENDED','SUSPENDED')),
 source_as_of timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,party_id),
 FOREIGN KEY(tenant_id,party_id) REFERENCES tto.relationship_projections(tenant_id,party_id)
);
-- Shareholder Account (Child06) and shareholding snapshot (Child07) remain separate.
CREATE TABLE tto.shareholder_source_accounts(
 tenant_id uuid NOT NULL, party_id uuid NOT NULL,
 shareholder_account_id uuid NOT NULL,
 source_ref text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 account_status text NOT NULL CHECK(account_status IN('ACTIVE','CLOSED')),
 PRIMARY KEY(tenant_id,party_id),
 UNIQUE(tenant_id,shareholder_account_id),
 FOREIGN KEY(tenant_id,party_id) REFERENCES tto.member_source_snapshots(tenant_id,party_id)
);
CREATE TABLE tto.shareholding_source_snapshots(
 snapshot_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 shareholder_account_id uuid NOT NULL,
 source_ref text NOT NULL,
 ledger_entry_ref uuid NOT NULL,
 ledger_version bigint NOT NULL CHECK(ledger_version>0),
 share_quantity bigint NOT NULL CHECK(share_quantity>=0),
 ledger_as_of timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,shareholder_account_id)
   REFERENCES tto.shareholder_source_accounts(tenant_id,shareholder_account_id),
 UNIQUE(tenant_id,shareholder_account_id,ledger_version),
 UNIQUE(tenant_id,ledger_entry_ref)
);
-- Read projections are controlled by separate source/contract governance, never tto_app CRUD.
DO $x$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['source_contract_approvals','member_source_snapshots',
 'shareholder_source_accounts','shareholding_source_snapshots'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tbl);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tbl);
 END LOOP;
END $x$;
-- Source approvals must reference a published same-tenant document/evidence.
CREATE FUNCTION tto.valid_read_source(p_tenant uuid,p_domain text,p_ref text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(EXISTS(
  SELECT 1 FROM tto.source_contract_approvals g
  WHERE g.tenant_id=p_tenant AND g.domain=p_domain AND g.source_ref=p_ref
   AND g.enabled AND g.valid_until>now() AND g.rule_snapshot_ref IS NOT NULL
   AND tto.valid_identity_evidence(p_tenant,g.evidence_id)
 ),false) $f$;
-- No approved identity decision -> no personal profile, even if user_party_links has a verified_at.
CREATE FUNCTION tto.my_member_profile_from_source(p_tenant uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 WITH allowed AS(
  SELECT p.party_kind,m.membership_status,m.source_version,m.source_as_of
  FROM tto.member_source_snapshots m
  JOIN tto.parties p ON p.party_id=m.party_id
  JOIN tto.relationship_projections r ON r.tenant_id=m.tenant_id AND r.party_id=m.party_id
  JOIN tto.user_party_links l ON l.party_id=m.party_id AND l.user_id=tto.context_actor_id()
  JOIN tto.tenants t ON t.tenant_id=m.tenant_id
  WHERE m.tenant_id=p_tenant AND p_tenant=tto.context_tenant_id()
   AND tto.context_actor_id() IS NOT NULL
   AND t.status='ACTIVE' AND tto.has_tenant_role(p_tenant,'MEMBER')
   AND l.verified_at IS NOT NULL
   AND EXISTS(SELECT 1 FROM tto.identity_link_cases c
       WHERE c.tenant_id=p_tenant AND c.party_id=m.party_id AND c.user_id=l.user_id
       AND c.status='APPROVED' AND c.decided_by<>c.requested_by
       AND c.decision_evidence_id IS NOT NULL)
   AND m.membership_status='ACTIVE' AND r.membership_status='ACTIVE'
   AND m.source_event_id=r.source_event_id AND m.source_version=r.source_version
   AND m.source_as_of<=now()
   AND tto.valid_read_source(p_tenant,'CHILD06_MEMBERSHIP',m.source_ref)
 )
 SELECT CASE WHEN count(*)=1 THEN
  jsonb_agg(jsonb_build_object('membershipStatus',membership_status,
  'partyKind',party_kind,'sourceVersion',source_version,'sourceAsOf',source_as_of))->0
 ELSE NULL END FROM allowed $f$;
CREATE FUNCTION tto.my_shareholding_from_source(p_tenant uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 WITH allowed AS(
  SELECT s.share_quantity,s.ledger_version,s.ledger_as_of
  FROM tto.shareholding_source_snapshots s
  JOIN tto.shareholder_source_accounts a ON a.tenant_id=s.tenant_id
       AND a.shareholder_account_id=s.shareholder_account_id
  JOIN tto.member_source_snapshots m ON m.tenant_id=a.tenant_id AND m.party_id=a.party_id
  JOIN tto.relationship_projections r ON r.tenant_id=m.tenant_id AND r.party_id=m.party_id
  JOIN tto.user_party_links l ON l.party_id=m.party_id AND l.user_id=tto.context_actor_id()
  JOIN tto.tenants t ON t.tenant_id=a.tenant_id
  WHERE a.tenant_id=p_tenant AND p_tenant=tto.context_tenant_id()
   AND tto.context_actor_id() IS NOT NULL
   AND t.status='ACTIVE' AND tto.has_tenant_role(p_tenant,'MEMBER')
   AND l.verified_at IS NOT NULL AND m.membership_status='ACTIVE'
   AND r.membership_status='ACTIVE' AND r.source_event_id=m.source_event_id
   AND r.source_version=m.source_version
   AND a.account_status='ACTIVE' AND a.source_ref=m.source_ref
   AND s.ledger_as_of<=now()
   AND tto.valid_read_source(p_tenant,'CHILD06_MEMBERSHIP',m.source_ref)
   AND tto.valid_read_source(p_tenant,'CHILD07_HOLDINGS',s.source_ref)
   AND EXISTS(SELECT 1 FROM tto.identity_link_cases c
       WHERE c.tenant_id=p_tenant AND c.party_id=a.party_id AND c.user_id=l.user_id
       AND c.status='APPROVED' AND c.decided_by<>c.requested_by
       AND c.decision_evidence_id IS NOT NULL)
   AND s.ledger_version=(SELECT max(s2.ledger_version)
       FROM tto.shareholding_source_snapshots s2
       WHERE s2.tenant_id=s.tenant_id AND s2.shareholder_account_id=s.shareholder_account_id)
 )
 SELECT CASE WHEN count(*)=1 THEN
  jsonb_agg(jsonb_build_object('shareQuantity',share_quantity::text,
  'ledgerVersion',ledger_version,'ledgerAsOf',ledger_as_of))->0
 ELSE NULL END FROM allowed $f$;
REVOKE ALL ON FUNCTION tto.valid_read_source(uuid,text,text),
 tto.my_member_profile_from_source(uuid),tto.my_shareholding_from_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.my_member_profile_from_source(uuid),
 tto.my_shareholding_from_source(uuid) TO tto_app;
COMMIT;
