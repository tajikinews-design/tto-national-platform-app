-- Child06 source-owned activation. DEVELOPMENT PG17 FIXTURES ONLY.
-- Do not create MEMBER role, CF02 projection, shareholder account or ownership ledger.
BEGIN;
CREATE TABLE tto.cooperative_relationships (
 relationship_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 application_id uuid NOT NULL UNIQUE REFERENCES tto.membership_applications(application_id),
 relationship_status text NOT NULL CHECK (relationship_status IN('ACTIVE','ENDED')),
 source_version bigint NOT NULL CHECK(source_version>0),
 activation_evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 activated_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ended_at timestamptz,
 UNIQUE(tenant_id,party_id,source_version),
 CHECK ((relationship_status='ACTIVE' AND ended_at IS NULL) OR
 (relationship_status='ENDED' AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX child06_one_active_relationship ON tto.cooperative_relationships(tenant_id,party_id)
 WHERE relationship_status='ACTIVE';
CREATE TABLE tto.membership_activation_authorizations(
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 activator_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 PRIMARY KEY(tenant_id,activator_id),
 CHECK(activator_id<>approved_by)
);
CREATE TABLE tto.membership_activation_rule_gates(
 tenant_id uuid PRIMARY KEY REFERENCES tto.tenants(tenant_id),
 rule_snapshot_ref uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 valid_until timestamptz NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE tto.cooperative_relationship_outbox (
 event_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 relationship_id uuid NOT NULL REFERENCES tto.cooperative_relationships(relationship_id),
 event_name text NOT NULL CHECK(event_name='MEMBERSHIP_APPROVED'),
 source_version bigint NOT NULL CHECK(source_version>0),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,party_id,source_version)
);
DO $lock$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['cooperative_relationships','membership_activation_authorizations',
  'membership_activation_rule_gates','cooperative_relationship_outbox'] LOOP
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tab);
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tab);
 END LOOP;
END $lock$;
CREATE TRIGGER cooperative_relationship_events_immutable
 BEFORE UPDATE OR DELETE ON tto.cooperative_relationship_outbox
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();

CREATE FUNCTION tto.child06_activation_authorized(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(p_tenant=tto.context_tenant_id()
 AND tto.context_actor_id() IS NOT NULL
 AND tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 AND EXISTS(SELECT 1 FROM tto.membership_activation_authorizations a
  WHERE a.tenant_id=p_tenant AND a.activator_id=tto.context_actor_id()
  AND a.approved_by<>a.activator_id AND a.revoked_at IS NULL
  AND a.valid_until>clock_timestamp()
  AND tto.valid_identity_evidence(p_tenant,a.evidence_id))
 AND EXISTS(SELECT 1 FROM tto.membership_activation_rule_gates g
  WHERE g.tenant_id=p_tenant AND g.enabled AND g.valid_until>clock_timestamp()
  AND g.rule_snapshot_ref IS NOT NULL
  AND tto.valid_identity_evidence(p_tenant,g.evidence_id)),false) $f$;

CREATE FUNCTION tto.activate_relationship(
 p_tenant uuid,p_application uuid,p_evidence uuid,p_expected_version bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE actor uuid:=tto.context_actor_id();
 rec tto.membership_applications%ROWTYPE;
 active_rel tto.cooperative_relationships%ROWTYPE;
 new_version bigint; relationship uuid:=gen_random_uuid();
BEGIN
 IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR p_expected_version IS NULL OR p_expected_version<1
 OR NOT tto.child06_activation_authorized(p_tenant)
 OR NOT tto.valid_identity_evidence(p_tenant,p_evidence)
 OR NOT EXISTS(SELECT 1 FROM tto.tenants WHERE tenant_id=p_tenant AND status='ACTIVE')
 THEN RETURN 'DENIED'; END IF;
 SELECT * INTO rec FROM tto.membership_applications
 WHERE application_id=p_application AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND OR rec.status<>'APPROVED' OR rec.decision_ref IS NULL
 OR actor=rec.submitted_by OR actor=rec.decided_by
 OR p_evidence=rec.decision_ref OR p_evidence=ANY(rec.evidence_refs)
 THEN RETURN 'DENIED'; END IF;
 IF rec.version<>p_expected_version THEN RETURN 'STALE_VERSION'; END IF;
 -- Serialize competing APPROVED applications for this Party, across application rows.
 PERFORM 1 FROM tto.parties WHERE party_id=rec.party_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'DENIED'; END IF;
 SELECT * INTO active_rel FROM tto.cooperative_relationships
 WHERE tenant_id=p_tenant AND party_id=rec.party_id AND relationship_status='ACTIVE' FOR UPDATE;
 IF FOUND THEN
  IF active_rel.application_id=p_application
    AND active_rel.activated_by=actor AND active_rel.activation_evidence_id=p_evidence
  THEN RETURN 'ALREADY_ACTIVATED'; END IF;
  RETURN 'CONFLICT_ACTIVE_RELATIONSHIP';
 END IF;
 -- Existing CF02 projection and authoritative source record are NOT superseded by a new local command.
 IF EXISTS(SELECT 1 FROM tto.relationship_projections r
     WHERE r.tenant_id=p_tenant AND r.party_id=rec.party_id AND r.membership_status='ACTIVE')
 OR EXISTS(SELECT 1 FROM tto.member_source_snapshots m
     WHERE m.tenant_id=p_tenant AND m.party_id=rec.party_id AND m.membership_status='ACTIVE')
 THEN RETURN 'CONFLICT_ACTIVE_RELATIONSHIP'; END IF;
 SELECT COALESCE(MAX(r.source_version),0)+1 INTO new_version
 FROM tto.cooperative_relationships r WHERE r.tenant_id=p_tenant AND r.party_id=rec.party_id;
 INSERT INTO tto.cooperative_relationships(relationship_id,tenant_id,party_id,application_id,
  relationship_status,source_version,activation_evidence_id,activated_by)
 VALUES(relationship,p_tenant,rec.party_id,p_application,'ACTIVE',new_version,p_evidence,actor);
 INSERT INTO tto.cooperative_relationship_outbox(event_id,tenant_id,party_id,relationship_id,
  event_name,source_version,actor_id)
 VALUES(gen_random_uuid(),p_tenant,rec.party_id,relationship,'MEMBERSHIP_APPROVED',new_version,actor);
 PERFORM tto.append_actor_audit(p_tenant,'MEMBERSHIP_APPROVED',relationship);
 -- No CF02 projection update and no event consumer/dispatch in this slice.
 -- A future separately reviewed CF02 projector can consume monotonic source_version.
 RETURN 'ACTIVATED';
END $f$;

CREATE FUNCTION tto.my_activated_relationship_status(p_tenant uuid,p_application uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT jsonb_build_object('status',r.relationship_status,'sourceVersion',r.source_version,
    'activatedAt',r.activated_at,'applicationId',r.application_id)
 FROM tto.cooperative_relationships r
 JOIN tto.membership_applications a ON a.application_id=r.application_id
 WHERE p_tenant=tto.context_tenant_id() AND r.tenant_id=p_tenant
   AND a.application_id=p_application AND a.submitted_by=tto.context_actor_id()
 $f$;
REVOKE ALL ON FUNCTION tto.child06_activation_authorized(uuid),
 tto.activate_relationship(uuid,uuid,uuid,bigint),
 tto.my_activated_relationship_status(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.activate_relationship(uuid,uuid,uuid,bigint),
 tto.my_activated_relationship_status(uuid,uuid) TO tto_app;
COMMIT;
