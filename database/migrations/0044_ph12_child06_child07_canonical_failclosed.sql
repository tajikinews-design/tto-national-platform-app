-- PH12 CHILD06/07 forward-only canonical candidate, isolated PG17 verification only.
-- No production authorization, no live source import, no runtime market/transfer grants.
-- The pre-existing ph06_* membership/transfer/ledger tables remain legacy synthetic
-- boundaries; CF02 relationship_projections and source *_snapshots remain read models.
BEGIN;

-- Secure tenant-scoped FKs to references without modifying source records.
CREATE UNIQUE INDEX ph12_evidence_tenant_reference_key
 ON tto.evidence_references(tenant_id,evidence_id);
CREATE UNIQUE INDEX ph12_document_tenant_reference_key
 ON tto.documents(tenant_id,document_id);

-- Existing Child06 ShareholderAccount remains the identity master.
-- Unclassified legacy rows stay NULL/unentitled until independent sourced review.
ALTER TABLE tto.ph06_shareholder_accounts
 ADD COLUMN shareholder_type text,
 ADD COLUMN classification_evidence_id uuid,
 ADD COLUMN classification_rule_version_id uuid,
 ADD COLUMN classification_source_ref text,
 ADD CONSTRAINT ph12_shareholder_type_check
 CHECK(shareholder_type IS NULL OR shareholder_type IN('MEMBER','NON_MEMBER')),
 ADD CONSTRAINT ph12_classification_attested
 CHECK(
  (shareholder_type IS NULL AND classification_evidence_id IS NULL
   AND classification_rule_version_id IS NULL AND classification_source_ref IS NULL)
  OR
  (shareholder_type IS NOT NULL AND classification_evidence_id IS NOT NULL
   AND classification_rule_version_id IS NOT NULL
   AND classification_source_ref IS NOT NULL
   AND length(trim(classification_source_ref))>=8)),
 ADD CONSTRAINT ph12_account_evidence_tenant
 FOREIGN KEY(tenant_id,classification_evidence_id)
 REFERENCES tto.evidence_references(tenant_id,evidence_id),
 ADD CONSTRAINT ph12_account_classification_rule
 FOREIGN KEY(classification_rule_version_id) REFERENCES tto.ph05_rule_versions(version_id);

-- Child06 relationship truth: independent from CF02 projection and identity links.
-- Relationship versions are append-only. No runtime API or account role can write here.
CREATE TABLE tto.child06_cooperative_relationships(
 relationship_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 relationship_type text NOT NULL CHECK(relationship_type IN('MEMBER')),
 status text NOT NULL CHECK(status IN('ACTIVE','SUSPENDED','ENDED')),
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 basis_ref uuid NOT NULL,
 source_event_id uuid NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 UNIQUE(tenant_id,party_id,source_version),
 UNIQUE(tenant_id,relationship_id),
 FOREIGN KEY(tenant_id,basis_ref) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);
-- A relationship is an immutable sequence of explicit source versions. The
-- latest version is current truth; older ACTIVE history must not block SUSPENDED/ENDED.
CREATE FUNCTION tto.ph12_child06_check_relationship_version() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE latest_version bigint; latest_valid_from timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(
   'CHILD06:'||NEW.tenant_id::text||':'||NEW.party_id::text,0));
 SELECT source_version,valid_from INTO latest_version,latest_valid_from
 FROM tto.child06_cooperative_relationships
 WHERE tenant_id=NEW.tenant_id AND party_id=NEW.party_id
 ORDER BY source_version DESC LIMIT 1;
 IF NEW.source_version<>coalesce(latest_version,0)+1
    OR (latest_valid_from IS NOT NULL AND NEW.valid_from<latest_valid_from)
 THEN RAISE EXCEPTION 'CHILD06_STALE_OR_GAPPED_SOURCE_VERSION';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child06_relationship_version_guard BEFORE INSERT
 ON tto.child06_cooperative_relationships FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_child06_check_relationship_version();

CREATE TABLE tto.child06_relationship_decisions(
 decision_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 application_id uuid,
 relationship_id uuid,
 outcome text NOT NULL CHECK(outcome IN('APPROVED','REJECTED','SUSPENDED','ENDED')),
 authority_ref text NOT NULL CHECK(length(trim(authority_ref))>=8),
 reason text NOT NULL CHECK(length(trim(reason))>=3),
 decided_at timestamptz NOT NULL,
 decided_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL,
 CHECK(num_nonnulls(application_id,relationship_id)=1),
 FOREIGN KEY(application_id,tenant_id) REFERENCES tto.ph06_membership_applications(application_id,tenant_id),
 FOREIGN KEY(tenant_id,relationship_id) REFERENCES tto.child06_cooperative_relationships(tenant_id,relationship_id),
 FOREIGN KEY(tenant_id,evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);
CREATE TABLE tto.child06_member_profiles(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 member_no text,
 contact_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(contact_refs)='array'),
 preference_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(preference_refs)='array'),
 classification text NOT NULL CHECK(classification IN('MEMBER','RESTRICTED')),
 source_evidence_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,party_id),
 UNIQUE(tenant_id,member_no),
 FOREIGN KEY(tenant_id,source_evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);

-- Child07 canonical ledger identity is an explicit Child06 shareholder account.
-- Stored read snapshots do not authorize or become an official ledger.
CREATE TABLE tto.child07_valuation_reports(
 valuation_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 document_ref uuid NOT NULL,
 expert_ref text NOT NULL CHECK(length(trim(expert_ref))>=8),
 value_amount bigint NOT NULL CHECK(value_amount>=0),
 valid_from timestamptz NOT NULL,
 valid_to timestamptz,
 status text NOT NULL CHECK(status IN('DRAFT','VERIFIED','EXPIRED','SUPERSEDED')),
 evidence_id uuid NOT NULL,
 CHECK(valid_to IS NULL OR valid_to>valid_from),
 UNIQUE(tenant_id,valuation_id),
 FOREIGN KEY(tenant_id,document_ref) REFERENCES tto.documents(tenant_id,document_id),
 FOREIGN KEY(tenant_id,evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);
CREATE TABLE tto.child07_capital_offers(
 offer_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 resolution_ref text NOT NULL CHECK(length(trim(resolution_ref))>=8),
 resolution_evidence_id uuid NOT NULL,
 terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object'),
 eligibility_rule_snapshot uuid NOT NULL REFERENCES tto.ph05_rule_versions(version_id),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','BLOCKED')),
 UNIQUE(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,resolution_evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);
CREATE TABLE tto.child07_sell_orders(
 sell_order_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 seller_account_id uuid NOT NULL,
 qty bigint NOT NULL CHECK(qty>0),
 valuation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','BLOCKED')),
 UNIQUE(tenant_id,sell_order_id),
 FOREIGN KEY(tenant_id,seller_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,valuation_id) REFERENCES tto.child07_valuation_reports(tenant_id,valuation_id)
);
CREATE TABLE tto.child07_buy_requests(
 buy_request_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 buyer_account_id uuid NOT NULL,
 sell_order_id uuid NOT NULL,
 qty bigint NOT NULL CHECK(qty>0),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','BLOCKED')),
 UNIQUE(tenant_id,buy_request_id),
 FOREIGN KEY(tenant_id,buyer_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,sell_order_id) REFERENCES tto.child07_sell_orders(tenant_id,sell_order_id)
);
CREATE TABLE tto.child07_transfer_cases(
 case_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 seller_account_id uuid NOT NULL,
 buyer_account_id uuid NOT NULL,
 qty bigint NOT NULL CHECK(qty>0),
 sell_order_id uuid,
 buy_request_id uuid,
 valuation_id uuid,
 payment_evidence_id uuid,
 fee_evidence_id uuid,
 approval_evidence_id uuid,
 authority_ref text,
 status text NOT NULL DEFAULT 'REQUESTED'
  CHECK(status IN('REQUESTED','LOCKED','PAYMENT_REPORTED','PAYMENT_VERIFIED','BLOCKED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(seller_account_id<>buyer_account_id),
 UNIQUE(tenant_id,case_id),
 FOREIGN KEY(tenant_id,seller_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,buyer_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,sell_order_id) REFERENCES tto.child07_sell_orders(tenant_id,sell_order_id),
 FOREIGN KEY(tenant_id,buy_request_id) REFERENCES tto.child07_buy_requests(tenant_id,buy_request_id),
 FOREIGN KEY(tenant_id,valuation_id) REFERENCES tto.child07_valuation_reports(tenant_id,valuation_id),
 FOREIGN KEY(tenant_id,payment_evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id),
 FOREIGN KEY(tenant_id,fee_evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id),
 FOREIGN KEY(tenant_id,approval_evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);
CREATE TABLE tto.child07_share_locks(
 lock_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 owner_account_id uuid NOT NULL,
 qty bigint NOT NULL CHECK(qty>0),
 source_case_ref uuid NOT NULL,
 status text NOT NULL DEFAULT 'STAGED' CHECK(status IN('STAGED','RELEASED','CANCELLED')),
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,source_case_ref),
 FOREIGN KEY(tenant_id,owner_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,source_case_ref) REFERENCES tto.child07_transfer_cases(tenant_id,case_id)
);
CREATE TABLE tto.child07_ownership_ledger_entries(
 entry_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 shareholder_account_id uuid NOT NULL,
 share_qty bigint NOT NULL CHECK(share_qty>0),
 direction text NOT NULL CHECK(direction IN('CREDIT','DEBIT')),
 source_kind text NOT NULL CHECK(source_kind IN('OPENING_VERIFIED','LEGAL_TRANSFER')),
 source_reference uuid NOT NULL,
 source_case_ref uuid,
 effective_at timestamptz NOT NULL,
 previous_owner_ref uuid,
 evidence_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 -- Deliberately block ANY legal-transfer ledger write before sourced approvals.
 CHECK(source_kind='OPENING_VERIFIED' AND source_case_ref IS NULL AND direction='CREDIT'),
 UNIQUE(tenant_id,source_reference,shareholder_account_id,direction),
 FOREIGN KEY(tenant_id,shareholder_account_id) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,previous_owner_ref) REFERENCES tto.ph06_shareholder_accounts(tenant_id,account_id),
 FOREIGN KEY(tenant_id,source_case_ref) REFERENCES tto.child07_transfer_cases(tenant_id,case_id),
 FOREIGN KEY(tenant_id,evidence_id) REFERENCES tto.evidence_references(tenant_id,evidence_id)
);

-- No account not explicitly classified with source+evidence+rule may enter ledger.
CREATE FUNCTION tto.ph12_child07_gate_ledger_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM tto.ph06_shareholder_accounts a
   WHERE a.tenant_id=NEW.tenant_id AND a.account_id=NEW.shareholder_account_id
   AND a.status='ACTIVE' AND a.shareholder_type IN('MEMBER','NON_MEMBER')
   AND a.classification_evidence_id IS NOT NULL
   AND a.classification_rule_version_id IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'CHILD07_UNCLASSIFIED_OR_INACTIVE_ACCOUNT';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER ph12_child07_ledger_admission BEFORE INSERT
 ON tto.child07_ownership_ledger_entries FOR EACH ROW
 EXECUTE FUNCTION tto.ph12_child07_gate_ledger_insert();
CREATE TRIGGER ph12_child07_ledger_immutable BEFORE UPDATE OR DELETE
 ON tto.child07_ownership_ledger_entries FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph12_child06_relationship_immutable BEFORE UPDATE OR DELETE
 ON tto.child06_cooperative_relationships FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph12_child06_decision_immutable BEFORE UPDATE OR DELETE
 ON tto.child06_relationship_decisions FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

-- Explicitly closed to app and public. The migration adds no business RPC, grants,
-- source approval, payment verification or ability to finalize transfers.
DO $guard$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY[
 'child06_cooperative_relationships','child06_relationship_decisions','child06_member_profiles',
 'child07_valuation_reports','child07_capital_offers','child07_sell_orders',
 'child07_buy_requests','child07_transfer_cases','child07_share_locks',
 'child07_ownership_ledger_entries'] LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tbl);
 END LOOP;
END $guard$;
REVOKE ALL ON FUNCTION tto.ph12_child07_gate_ledger_insert(),
 tto.ph12_child06_check_relationship_version() FROM PUBLIC,tto_app;
COMMENT ON TABLE tto.child07_ownership_ledger_entries IS
 'PH12 candidate official account-linked ledger, private and staged; live transfers prohibited, formal source acceptance HOLD';
COMMIT;
