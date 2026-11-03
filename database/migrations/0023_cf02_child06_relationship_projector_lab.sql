-- CF02 consumes ONLY source-owned Child06 events after independent approval.
-- Synthetic PostgreSQL17 contract laboratory; no consumer, live sources or role grants.
-- Never treat CF02 projection as legal membership truth or ownership ledger.
BEGIN;
CREATE TABLE tto.cf02_relationship_projection_authorizations (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 projector_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approval_evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 PRIMARY KEY (tenant_id,projector_id),
 CHECK (projector_id<>approved_by)
);
CREATE TABLE tto.cf02_relationship_projection_rule_gates (
 tenant_id uuid PRIMARY KEY REFERENCES tto.tenants(tenant_id),
 rule_snapshot_ref uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 valid_until timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE tto.cf02_relationship_projection_receipts (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 source_event_id uuid PRIMARY KEY REFERENCES tto.cooperative_relationship_outbox(event_id),
 source_version bigint NOT NULL CHECK (source_version>0),
 projected_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 projected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,party_id,source_version)
);
DO $guard$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['cf02_relationship_projection_authorizations',
  'cf02_relationship_projection_rule_gates','cf02_relationship_projection_receipts'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
 END LOOP;
END $guard$;
CREATE TRIGGER cf02_relationship_projection_receipts_immutable
 BEFORE UPDATE OR DELETE ON tto.cf02_relationship_projection_receipts
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

CREATE FUNCTION tto.cf02_relationship_projector_authorized(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(p_tenant=tto.context_tenant_id()
   AND tto.context_actor_id() IS NOT NULL
   AND tto.has_tenant_role(p_tenant,'DOCUMENT_REVIEWER')
   AND EXISTS(SELECT 1 FROM tto.cf02_relationship_projection_authorizations a
     WHERE a.tenant_id=p_tenant AND a.projector_id=tto.context_actor_id()
       AND a.approved_by<>a.projector_id AND a.valid_until>clock_timestamp()
       AND a.revoked_at IS NULL
       AND tto.valid_identity_evidence(p_tenant,a.approval_evidence_id))
   AND EXISTS(SELECT 1 FROM tto.cf02_relationship_projection_rule_gates g
     WHERE g.tenant_id=p_tenant AND g.enabled
       AND g.valid_until>clock_timestamp() AND g.rule_snapshot_ref IS NOT NULL
       AND tto.valid_identity_evidence(p_tenant,g.evidence_id)),false) $f$;

-- No application-user EXECUTE grant: separate CF02 event-consumer authorization is required.
-- The current function can ONLY run as migration owner in disposable test transactions.
-- This intentionally does NOT start event delivery.
CREATE FUNCTION tto.cf02_project_child06_relationship_event(
 p_tenant uuid,p_event uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE actor uuid:=tto.context_actor_id();
 ev tto.cooperative_relationship_outbox%ROWTYPE;
 rel tto.cooperative_relationships%ROWTYPE;
 app tto.membership_applications%ROWTYPE;
 current_projection tto.relationship_projections%ROWTYPE;
 had_projection boolean:=false;
BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
   OR NOT tto.cf02_relationship_projector_authorized(p_tenant)
   OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 THEN RETURN 'DENIED'; END IF;

 SELECT * INTO ev FROM tto.cooperative_relationship_outbox
 WHERE event_id=p_event AND tenant_id=p_tenant AND event_name='MEMBERSHIP_APPROVED';
 IF NOT FOUND THEN RETURN 'UNKNOWN_SOURCE_EVENT'; END IF;
 SELECT * INTO rel FROM tto.cooperative_relationships
 WHERE relationship_id=ev.relationship_id AND tenant_id=ev.tenant_id
   AND party_id=ev.party_id AND relationship_status='ACTIVE'
   AND source_version=ev.source_version;
 IF NOT FOUND OR rel.activated_by=actor
   OR NOT tto.valid_identity_evidence(p_tenant,rel.activation_evidence_id)
 THEN RETURN 'SOURCE_RELATIONSHIP_INVALID'; END IF;
 SELECT * INTO app FROM tto.membership_applications
 WHERE application_id=rel.application_id AND tenant_id=p_tenant AND party_id=ev.party_id;
 IF NOT FOUND OR app.status<>'APPROVED' OR app.decision_ref IS NULL
   OR app.decided_by=actor OR app.submitted_by=actor
   OR NOT tto.valid_identity_evidence(p_tenant,app.decision_ref)
 THEN RETURN 'SOURCE_DECISION_INVALID'; END IF;

 -- Same Party lock order as ActivateRelationship; prevents competing writes.
 PERFORM 1 FROM tto.parties WHERE party_id=ev.party_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'DENIED'; END IF;
 SELECT * INTO current_projection FROM tto.relationship_projections
 WHERE tenant_id=p_tenant AND party_id=ev.party_id FOR UPDATE;
 had_projection:=FOUND;
 IF had_projection THEN
   IF current_projection.source_event_id=p_event AND
      current_projection.source_version=ev.source_version AND
      current_projection.membership_status='ACTIVE' AND
      EXISTS(SELECT 1 FROM tto.cf02_relationship_projection_receipts rr
       WHERE rr.source_event_id=p_event AND rr.tenant_id=p_tenant
         AND rr.party_id=ev.party_id AND rr.source_version=ev.source_version)
   THEN RETURN 'ALREADY_PROJECTED'; END IF;
   IF current_projection.source_version>=ev.source_version
   THEN RETURN 'STALE_OR_CONFLICTING_SOURCE_VERSION'; END IF;
   IF ev.source_version<>current_projection.source_version+1
   THEN RETURN 'SOURCE_VERSION_GAP'; END IF;
   -- Imported legacy source/member snapshots and existing active memberships
   -- are NEVER silently overwritten by a new local event consumer.
   IF EXISTS(SELECT 1 FROM tto.member_source_snapshots m
      WHERE m.tenant_id=p_tenant AND m.party_id=ev.party_id)
     OR current_projection.membership_status='ACTIVE'
   THEN RETURN 'LEGACY_OR_ACTIVE_PROJECTION_CONFLICT'; END IF;
 ELSE
   IF ev.source_version<>1 THEN RETURN 'SOURCE_VERSION_GAP'; END IF;
   IF EXISTS(SELECT 1 FROM tto.member_source_snapshots m
     WHERE m.tenant_id=p_tenant AND m.party_id=ev.party_id)
   THEN RETURN 'LEGACY_OR_ACTIVE_PROJECTION_CONFLICT'; END IF;
 END IF;
 -- No blind upsert: only a source event with a proved exact consecutive version.
 IF had_projection THEN
   UPDATE tto.relationship_projections
   SET membership_status='ACTIVE',source_event_id=p_event,source_version=ev.source_version
   WHERE tenant_id=p_tenant AND party_id=ev.party_id;
 ELSE
   INSERT INTO tto.relationship_projections(tenant_id,party_id,membership_status,source_event_id,source_version)
   VALUES(p_tenant,ev.party_id,'ACTIVE',p_event,ev.source_version);
 END IF;
 INSERT INTO tto.cf02_relationship_projection_receipts(
  tenant_id,party_id,source_event_id,source_version,projected_by)
 VALUES(p_tenant,ev.party_id,p_event,ev.source_version,actor);
 PERFORM tto.append_actor_audit(p_tenant,'COOPERATIVE_RELATIONSHIP_PROJECTED',ev.party_id);
 -- No Child06 MEMBER role, shareholder account or holdings. No external publisher.
 RETURN 'PROJECTED';
END $f$;

REVOKE ALL ON FUNCTION tto.cf02_relationship_projector_authorized(uuid),
 tto.cf02_project_child06_relationship_event(uuid,uuid) FROM PUBLIC,tto_app;
COMMENT ON FUNCTION tto.cf02_project_child06_relationship_event(uuid,uuid) IS
 'DISPOSABLE LAB ONLY: no tto_app execute; no automatic consumer, MEMBER role or live promotion';
COMMIT;
