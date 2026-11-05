-- PH06 Child06 Member Master and Child07 ownership source boundary.
-- This additive schema is for isolated acceptance; no production migration authorization.
-- No general accounting, wallet, cash reserves or payment integration.
BEGIN;
CREATE TABLE tto.ph06_membership_applications(
 application_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL DEFAULT 'SUBMITTED'
 CHECK(status IN('SUBMITTED','APPROVED','REJECTED')),
 decided_by uuid REFERENCES tto.user_accounts(user_id),
 decision_evidence uuid REFERENCES tto.evidence_references(evidence_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(application_id,tenant_id),
 CHECK(status='SUBMITTED' OR (decided_by IS NOT NULL AND decision_evidence IS NOT NULL))
);
CREATE TABLE tto.ph06_membership_events(
 event_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 application_id uuid NOT NULL REFERENCES tto.ph06_membership_applications(application_id),
 source_version bigint NOT NULL CHECK(source_version>0),
 relationship_status text NOT NULL CHECK(relationship_status IN('ACTIVE','ENDED','SUSPENDED')),
 source_event_ref text NOT NULL CHECK(length(source_event_ref)>=8),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,party_id,source_version),
 UNIQUE(application_id,source_version)
);
CREATE TABLE tto.ph06_membership_current (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 current_status text NOT NULL CHECK(current_status IN('ACTIVE','ENDED','SUSPENDED')),
 source_version bigint NOT NULL CHECK(source_version>0),
 event_id uuid NOT NULL REFERENCES tto.ph06_membership_events(event_id),
 PRIMARY KEY(tenant_id,party_id)
);
CREATE TABLE tto.ph06_shareholder_accounts(
 account_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED','CLOSED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,party_id), UNIQUE(account_id,tenant_id)
);
CREATE TABLE tto.ph06_transfer_cases(
 case_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 seller_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 buyer_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 requested_quantity bigint NOT NULL CHECK(requested_quantity>0),
 state text NOT NULL DEFAULT 'REQUESTED'
 CHECK(state IN('REQUESTED','LOCKED','PAYMENT_REPORTED','PAYMENT_VERIFIED','ELIGIBILITY_BLOCKED','TRANSFERRED')),
 valuation_source_ref text,
 legal_rule_version_id uuid REFERENCES tto.ph05_rule_versions(version_id),
 privileged_actor_id uuid REFERENCES tto.user_accounts(user_id),
 legal_approver_id uuid REFERENCES tto.user_accounts(user_id),
 source_payment_receipt uuid REFERENCES tto.ph05_webhook_receipts(receipt_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(seller_party_id<>buyer_party_id),
 CHECK(state<>'TRANSFERRED') -- legal authorization/SoD and source ledgers not yet approved
);
CREATE TABLE tto.ph06_ownership_ledger (
 ledger_id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 delta_shares bigint NOT NULL CHECK(delta_shares<>0),
 source_kind text NOT NULL CHECK(source_kind IN('OPENING_VERIFIED','LEGAL_TRANSFER')),
 source_reference uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,source_kind,source_reference,party_id)
);
CREATE TABLE tto.ph06_share_locks(
 lock_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 case_id uuid NOT NULL UNIQUE REFERENCES tto.ph06_transfer_cases(case_id),
 quantity bigint NOT NULL CHECK(quantity>0),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','RELEASED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Source events and legal share evidence never silently disappear.
CREATE TRIGGER ph06_membership_event_immutable BEFORE UPDATE OR DELETE ON tto.ph06_membership_events
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph06_ownership_ledger_immutable BEFORE UPDATE OR DELETE ON tto.ph06_ownership_ledger
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER ph06_transfer_case_no_delete BEFORE DELETE ON tto.ph06_transfer_cases
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

-- Source-owner-only membership decision, not exposed to ordinary application roles.
CREATE FUNCTION tto.ph06_decide_membership(p_application uuid,p_expected_version bigint,
 p_approve boolean,p_actor uuid,p_evidence uuid,p_source_ref text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
DECLARE a tto.ph06_membership_applications%ROWTYPE;old_version bigint;
BEGIN
 IF p_application IS NULL OR p_expected_version IS NULL OR p_expected_version<1
 OR p_actor IS NULL OR p_evidence IS NULL OR length(coalesce(p_source_ref,''))<8
 THEN RETURN false;END IF;
 SELECT * INTO a FROM tto.ph06_membership_applications
 WHERE application_id=p_application FOR UPDATE;
 IF NOT FOUND OR a.version<>p_expected_version OR a.status<>'SUBMITTED'
 OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=a.tenant_id AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references WHERE evidence_id=p_evidence AND tenant_id=a.tenant_id)
 THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM tto.ph06_membership_current m
 WHERE m.tenant_id=a.tenant_id AND m.party_id=a.party_id AND m.current_status='ACTIVE')
 THEN RETURN false;END IF;
 SELECT source_version INTO old_version FROM tto.ph06_membership_current
 WHERE tenant_id=a.tenant_id AND party_id=a.party_id;
 UPDATE tto.ph06_membership_applications SET
 status=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
 decided_by=p_actor,decision_evidence=p_evidence,version=version+1
 WHERE application_id=p_application;
 IF p_approve THEN
  INSERT INTO tto.ph06_membership_events
    (event_id,tenant_id,party_id,application_id,source_version,relationship_status,source_event_ref)
  VALUES(gen_random_uuid(),a.tenant_id,a.party_id,a.application_id,coalesce(old_version,0)+1,'ACTIVE',p_source_ref);
  INSERT INTO tto.ph06_membership_current(tenant_id,party_id,current_status,source_version,event_id)
  SELECT tenant_id,party_id,relationship_status,source_version,event_id
  FROM tto.ph06_membership_events WHERE application_id=a.application_id
  ON CONFLICT(tenant_id,party_id) DO UPDATE
  SET current_status=EXCLUDED.current_status,source_version=EXCLUDED.source_version,event_id=EXCLUDED.event_id
  WHERE tto.ph06_membership_current.source_version<EXCLUDED.source_version;
 END IF;
 RETURN true;
END $f$;
-- Concurrency: lock tenant+party key, account all locks atomically.
CREATE FUNCTION tto.ph06_try_lock_shares(p_case uuid,p_lock uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
DECLARE c tto.ph06_transfer_cases%ROWTYPE;owned bigint;locked bigint;
BEGIN
 IF p_case IS NULL OR p_lock IS NULL THEN RETURN false;END IF;
 SELECT * INTO c FROM tto.ph06_transfer_cases WHERE case_id=p_case FOR UPDATE;
 IF NOT FOUND OR c.state<>'REQUESTED'
 OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=c.tenant_id AND status='ACTIVE')
 THEN RETURN false;END IF;
 -- serialize different case rows competing for the same seller inventory.
 PERFORM pg_advisory_xact_lock(hashtextextended(c.tenant_id::text||':'||c.seller_party_id::text,0));
 SELECT coalesce(sum(delta_shares),0) INTO owned FROM tto.ph06_ownership_ledger
 WHERE tenant_id=c.tenant_id AND party_id=c.seller_party_id;
 SELECT coalesce(sum(quantity),0) INTO locked FROM tto.ph06_share_locks
 WHERE tenant_id=c.tenant_id AND party_id=c.seller_party_id AND state='ACTIVE';
 IF owned-locked<c.requested_quantity THEN RETURN false;END IF;
 INSERT INTO tto.ph06_share_locks(lock_id,tenant_id,party_id,case_id,quantity)
 VALUES(p_lock,c.tenant_id,c.seller_party_id,p_case,c.requested_quantity);
 UPDATE tto.ph06_transfer_cases SET state='LOCKED' WHERE case_id=p_case;
 RETURN true;
END $f$;
-- Finalization ALWAYS fails closed until real valuation, legal rules,
-- authority, payment verification and ownership-cap source are accepted.
CREATE FUNCTION tto.ph06_try_finalize_transfer(p_case uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
 SELECT false;
$f$;
-- Self-service returns only linked Party account for active current tenant.
CREATE FUNCTION tto.ph06_own_shareholder_accounts()
RETURNS TABLE(account_id uuid,tenant_id uuid,party_id uuid,status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT a.account_id,a.tenant_id,a.party_id,a.status
 FROM tto.ph06_shareholder_accounts a
 JOIN tto.user_party_links u ON u.party_id=a.party_id
 WHERE u.user_id=tto.context_actor_id() AND u.verified_at IS NOT NULL
 AND a.tenant_id=tto.context_tenant_id();
$f$;
-- Buyer/seller only: no party list, no manager-wide transaction enumeration.
CREATE FUNCTION tto.ph06_my_transfer_cases()
RETURNS TABLE(case_id uuid,tenant_id uuid,requested_quantity bigint,state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT c.case_id,c.tenant_id,c.requested_quantity,c.state
 FROM tto.ph06_transfer_cases c
 WHERE c.tenant_id=tto.context_tenant_id()
 AND EXISTS(SELECT 1 FROM tto.user_party_links u
  WHERE u.user_id=tto.context_actor_id() AND u.verified_at IS NOT NULL
  AND u.party_id IN (c.seller_party_id,c.buyer_party_id));
$f$;
DO $roles$ DECLARE tab text;BEGIN
 FOREACH tab IN ARRAY ARRAY[
 'ph06_membership_applications','ph06_membership_events','ph06_membership_current',
 'ph06_shareholder_accounts','ph06_transfer_cases','ph06_ownership_ledger','ph06_share_locks'] LOOP
 EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tab);
 END LOOP;
END $roles$;
REVOKE ALL ON FUNCTION tto.ph06_decide_membership(uuid,bigint,boolean,uuid,uuid,text),
 tto.ph06_try_lock_shares(uuid,uuid),tto.ph06_try_finalize_transfer(uuid,uuid)
 FROM PUBLIC,tto_app;
REVOKE ALL ON FUNCTION tto.ph06_own_shareholder_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.ph06_my_transfer_cases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph06_own_shareholder_accounts(),
 tto.ph06_my_transfer_cases() TO tto_app;
COMMIT;
