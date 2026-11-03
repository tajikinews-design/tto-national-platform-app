-- TTO Child06 first SOURCE-LOCKED member application / decision commands.
-- DEV and disposable PG17 ONLY. This does NOT activate membership, CF02 projection,
-- MEMBER role, ShareholderAccount, share ownership, or any outside-party authority.
BEGIN;
CREATE TABLE tto.membership_applications (
 application_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 submitted_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED')),
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 evidence_refs uuid[] NOT NULL CHECK(cardinality(evidence_refs)=1),
 decision_ref uuid REFERENCES tto.evidence_references(evidence_id),
 decided_by uuid REFERENCES tto.user_accounts(user_id),
 decided_at timestamptz,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK ((status='PENDING' AND decision_ref IS NULL AND decided_by IS NULL AND decided_at IS NULL)
     OR (status<>'PENDING' AND decision_ref IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL
         AND decided_by<>submitted_by))
);
CREATE UNIQUE INDEX membership_one_pending_per_tenant_party
 ON tto.membership_applications(tenant_id,party_id) WHERE status='PENDING';
-- A manager's ROLE alone is insufficient. Privileged authority must be independently
-- granted, current, same tenant and grounded in published evidence.
CREATE TABLE tto.membership_review_authorizations (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 reviewer_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 PRIMARY KEY(tenant_id,reviewer_id),
 CHECK(reviewer_id<>approved_by)
);
-- CF04 legal/rule snapshot remains a required *external* source boundary.
-- This disabled-by-default lab gate is not a real CF04 rule activation.
CREATE TABLE tto.membership_review_rule_gates (
 tenant_id uuid PRIMARY KEY REFERENCES tto.tenants(tenant_id),
 rule_snapshot_ref uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 valid_until timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
-- Transactional, immutable local outbox. No dispatch/consumer is enabled.
CREATE TABLE tto.membership_application_outbox (
 event_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 application_id uuid NOT NULL REFERENCES tto.membership_applications(application_id),
 event_name text NOT NULL CHECK(event_name IN(
  'MEMBERSHIP_APPLICATION_SUBMITTED','MEMBERSHIP_DECISION_RECORDED')),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 payload_version bigint NOT NULL CHECK(payload_version>0),
 UNIQUE(application_id,payload_version)
);
DO $lock$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['membership_applications','membership_review_authorizations',
   'membership_review_rule_gates','membership_application_outbox'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
 END LOOP;
END $lock$;
CREATE TRIGGER membership_workflow_outbox_immutable
 BEFORE UPDATE OR DELETE ON tto.membership_application_outbox
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

CREATE FUNCTION tto.child06_review_authorized(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(p_tenant=tto.context_tenant_id()
 AND tto.context_actor_id() IS NOT NULL
 AND tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 AND EXISTS(SELECT 1 FROM tto.membership_review_authorizations a
   WHERE a.tenant_id=p_tenant AND a.reviewer_id=tto.context_actor_id()
     AND a.approved_by<>a.reviewer_id AND a.revoked_at IS NULL
     AND a.valid_until>clock_timestamp()
     AND tto.valid_identity_evidence(p_tenant,a.evidence_id))
 AND EXISTS(SELECT 1 FROM tto.membership_review_rule_gates g
   WHERE g.tenant_id=p_tenant AND g.enabled AND g.valid_until>clock_timestamp()
     AND g.rule_snapshot_ref IS NOT NULL
     AND tto.valid_identity_evidence(p_tenant,g.evidence_id)),false) $f$;

CREATE FUNCTION tto.submit_membership_application(p_tenant uuid,p_party uuid,p_evidence uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE actor uuid:=tto.context_actor_id(); app uuid:=gen_random_uuid();
 BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
  OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
  OR NOT tto.valid_identity_evidence(p_tenant,p_evidence)
  OR NOT EXISTS(SELECT 1 FROM tto.user_party_links l
      JOIN tto.identity_link_cases c ON c.tenant_id=p_tenant
       AND c.party_id=l.party_id AND c.user_id=l.user_id
      WHERE l.user_id=actor AND l.party_id=p_party AND l.verified_at IS NOT NULL
       AND c.status='APPROVED' AND c.decided_by<>c.requested_by
       AND c.decision_evidence_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM tto.relationship_projections r
      WHERE r.tenant_id=p_tenant AND r.party_id=p_party AND r.membership_status='ACTIVE')
  OR EXISTS(SELECT 1 FROM tto.member_source_snapshots m
      WHERE m.tenant_id=p_tenant AND m.party_id=p_party AND m.membership_status='ACTIVE')
 THEN RETURN NULL; END IF;
 INSERT INTO tto.membership_applications(application_id,tenant_id,party_id,submitted_by,evidence_refs)
 VALUES(app,p_tenant,p_party,actor,ARRAY[p_evidence]) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO tto.membership_application_outbox(event_id,tenant_id,application_id,event_name,actor_id,payload_version)
 VALUES(gen_random_uuid(),p_tenant,app,'MEMBERSHIP_APPLICATION_SUBMITTED',actor,1);
 PERFORM tto.append_actor_audit(p_tenant,'MEMBERSHIP_APPLICATION_SUBMITTED',app);
 RETURN app;
 END $f$;

CREATE FUNCTION tto.record_membership_decision(
 p_tenant uuid,p_application uuid,p_evidence uuid,p_approve boolean,p_expected_version bigint)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE actor uuid:=tto.context_actor_id(); rec tto.membership_applications%ROWTYPE;
        desired text;
 BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
  OR p_approve IS NULL OR p_expected_version IS NULL OR p_expected_version<1
  OR NOT tto.child06_review_authorized(p_tenant)
  OR NOT tto.valid_identity_evidence(p_tenant,p_evidence)
 THEN RETURN 'DENIED'; END IF;
 SELECT * INTO rec FROM tto.membership_applications
 WHERE application_id=p_application AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND OR actor=rec.submitted_by OR p_evidence=ANY(rec.evidence_refs)
 THEN RETURN 'DENIED'; END IF;
 desired:=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END;
 -- Identical retry on the original expected version is idempotent.
 IF rec.status=desired AND rec.version=p_expected_version+1
   AND rec.decision_ref=p_evidence AND rec.decided_by=actor
 THEN RETURN 'ALREADY_APPLIED'; END IF;
 IF rec.status<>'PENDING' OR rec.version<>p_expected_version THEN RETURN 'STALE_VERSION'; END IF;
 UPDATE tto.membership_applications SET status=desired,decision_ref=p_evidence,
   decided_by=actor,decided_at=clock_timestamp(),version=version+1
 WHERE application_id=p_application AND tenant_id=p_tenant;
 INSERT INTO tto.membership_application_outbox(event_id,tenant_id,application_id,event_name,actor_id,payload_version)
 VALUES(gen_random_uuid(),p_tenant,p_application,'MEMBERSHIP_DECISION_RECORDED',actor,p_expected_version+1);
 PERFORM tto.append_actor_audit(p_tenant,'MEMBERSHIP_DECISION_RECORDED',p_application);
 -- The separate ActivateRelationship contract owns materializing membership.
 -- NEVER create a role, relationship projection, source approval, shareholder account or shares.
 RETURN desired;
 END $f$;

CREATE FUNCTION tto.my_membership_application_status(p_tenant uuid,p_application uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT jsonb_build_object('applicationId',a.application_id,'status',a.status,
   'version',a.version,'submittedAt',a.submitted_at,'decidedAt',a.decided_at)
 FROM tto.membership_applications a
 WHERE a.tenant_id=p_tenant AND p_tenant=tto.context_tenant_id()
   AND a.application_id=p_application AND a.submitted_by=tto.context_actor_id()
 $f$;
CREATE FUNCTION tto.list_pending_membership_applications(p_tenant uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 WITH pending AS (
  SELECT a.application_id,a.party_id,a.version,a.submitted_at
  FROM tto.membership_applications a
  WHERE a.tenant_id=p_tenant AND a.status='PENDING'
    AND tto.child06_review_authorized(p_tenant)
  ORDER BY a.submitted_at,a.application_id LIMIT 30
 )
 SELECT CASE WHEN tto.child06_review_authorized(p_tenant)
 THEN COALESCE(jsonb_agg(jsonb_build_object('applicationId',application_id,
  'partyId',party_id,'version',version,'submittedAt',submitted_at)
  ORDER BY submitted_at,application_id),'[]'::jsonb)
 ELSE NULL END
 FROM pending $f$;

REVOKE ALL ON FUNCTION tto.child06_review_authorized(uuid),
 tto.submit_membership_application(uuid,uuid,uuid),
 tto.record_membership_decision(uuid,uuid,uuid,boolean,bigint),
 tto.my_membership_application_status(uuid,uuid),
 tto.list_pending_membership_applications(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.submit_membership_application(uuid,uuid,uuid),
 tto.record_membership_decision(uuid,uuid,uuid,boolean,bigint),
 tto.my_membership_application_status(uuid,uuid),
 tto.list_pending_membership_applications(uuid) TO tto_app;
COMMIT;
