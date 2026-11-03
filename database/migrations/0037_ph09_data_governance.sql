BEGIN;
CREATE TABLE tto.ph09_retention_policies(
 policy_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 policy_code text NOT NULL,version int NOT NULL CHECK(version>0),
 source_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 UNIQUE(tenant_id,policy_code,version));
CREATE TABLE tto.ph09_retention_records(
 record_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 classification text NOT NULL CHECK(classification IN('PUBLIC','INTERNAL','SENSITIVE','FINAL_MATERIAL','UNCLASSIFIED')),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','ARCHIVED','DISPOSED')),
 policy_id uuid NOT NULL REFERENCES tto.ph09_retention_policies(policy_id),
 disposition_policy_id uuid REFERENCES tto.ph09_retention_policies(policy_id));
CREATE TABLE tto.ph09_legal_holds(
 hold_id uuid PRIMARY KEY,record_id uuid NOT NULL REFERENCES tto.ph09_retention_records(record_id),
 active boolean NOT NULL DEFAULT true,
 reason_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 released_at timestamptz);
CREATE FUNCTION tto.ph09_dispose_record(p_record uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE r tto.ph09_retention_records%ROWTYPE;
BEGIN
SELECT * INTO r FROM tto.ph09_retention_records WHERE record_id=p_record FOR UPDATE;
IF NOT FOUND OR r.tenant_id IS DISTINCT FROM tto.context_tenant_id()
OR NOT tto.has_tenant_role(r.tenant_id,'COOPERATIVE_MANAGER')
OR r.classification IN('FINAL_MATERIAL','UNCLASSIFIED') OR r.state='DISPOSED'
OR EXISTS(SELECT 1 FROM tto.ph09_legal_holds h WHERE h.record_id=p_record AND h.active)
THEN RETURN false;END IF;
UPDATE tto.ph09_retention_records SET state='DISPOSED',disposition_policy_id=r.policy_id
WHERE record_id=p_record;
PERFORM tto.append_actor_audit(r.tenant_id,'PH09_DISPOSITION',p_record);
RETURN true;
END $f$;
CREATE FUNCTION tto.ph09_can_export(p_record uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT EXISTS(SELECT 1 FROM tto.ph09_retention_records r WHERE r.record_id=p_record
AND r.tenant_id=tto.context_tenant_id() AND r.classification IN('PUBLIC','INTERNAL')
AND tto.has_tenant_role(r.tenant_id,'COOPERATIVE_MANAGER'));
$f$;
CREATE FUNCTION tto.ph09_block_material_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
BEGIN IF OLD.classification='FINAL_MATERIAL' THEN RAISE EXCEPTION 'PH09_MATERIAL_HARD_DELETE_FORBIDDEN';END IF;RETURN OLD;END $f$;
CREATE TRIGGER ph09_material_delete BEFORE DELETE ON tto.ph09_retention_records FOR EACH ROW EXECUTE FUNCTION tto.ph09_block_material_delete();
CREATE TRIGGER ph09_policy_immutable BEFORE UPDATE OR DELETE ON tto.ph09_retention_policies FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $x$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ph09_retention_policies','ph09_retention_records','ph09_legal_holds']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);END LOOP;END $x$;
REVOKE ALL ON FUNCTION tto.ph09_dispose_record(uuid),tto.ph09_can_export(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_dispose_record(uuid),tto.ph09_can_export(uuid) TO tto_app;
COMMIT;