BEGIN;
CREATE TABLE tto.ph08_projects(
project_id uuid PRIMARY KEY,
tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
name text NOT NULL,county_code text NOT NULL,
status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','SUSPENDED')),
required_permit boolean NOT NULL DEFAULT true,
permit_ref text, permit_valid_until timestamptz,
version bigint NOT NULL DEFAULT 1 CHECK(version>0),
created_at timestamptz NOT NULL DEFAULT now(),
CHECK(status<>'ACTIVE' OR (NOT required_permit OR
(length(coalesce(permit_ref,''))>8 AND permit_valid_until>created_at))));
CREATE TABLE tto.ph08_branches(
branch_id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES tto.ph08_projects(project_id),
county_code text NOT NULL,independent_activity_approved boolean NOT NULL DEFAULT false,
authority_evidence uuid REFERENCES tto.evidence_references(evidence_id),
CHECK(NOT independent_activity_approved OR authority_evidence IS NOT NULL));
CREATE TABLE tto.ph08_milestones(
milestone_id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES tto.ph08_projects(project_id),
label text NOT NULL,completed_at timestamptz,
completion_evidence uuid REFERENCES tto.evidence_references(evidence_id));
CREATE TABLE tto.ph08_project_events(
event_id uuid PRIMARY KEY,milestone_id uuid NOT NULL UNIQUE REFERENCES tto.ph08_milestones(milestone_id),
kind text NOT NULL CHECK(kind='MILESTONE_COMPLETED'),recorded_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION tto.ph08_complete_milestone(p_id uuid,p_evidence uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE m tto.ph08_milestones%ROWTYPE;tid uuid;
BEGIN
SELECT * INTO m FROM tto.ph08_milestones WHERE milestone_id=p_id FOR UPDATE;
IF NOT FOUND OR m.completed_at IS NOT NULL THEN RETURN false;END IF;
SELECT tenant_id INTO tid FROM tto.ph08_projects WHERE project_id=m.project_id;
IF tid IS DISTINCT FROM tto.context_tenant_id() OR
NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER') OR
NOT EXISTS(SELECT 1 FROM tto.evidence_references e WHERE e.evidence_id=p_evidence AND e.tenant_id=tid)
THEN RETURN false;END IF;
UPDATE tto.ph08_milestones SET completed_at=now(),completion_evidence=p_evidence WHERE milestone_id=p_id;
INSERT INTO tto.ph08_project_events(event_id,milestone_id,kind)
VALUES(gen_random_uuid(),p_id,'MILESTONE_COMPLETED');
PERFORM tto.append_actor_audit(tid,'PH08_MILESTONE_COMPLETED',p_id);
RETURN true;
END $f$;
CREATE FUNCTION tto.ph08_cas_project(p_id uuid,p_version bigint)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE tid uuid;
BEGIN
SELECT tenant_id INTO tid FROM tto.ph08_projects WHERE project_id=p_id FOR UPDATE;
IF tid IS DISTINCT FROM tto.context_tenant_id() OR NOT tto.has_tenant_role(tid,'COOPERATIVE_MANAGER')
THEN RETURN false;END IF;
UPDATE tto.ph08_projects SET version=version+1 WHERE project_id=p_id AND version=p_version;
RETURN FOUND;
END $f$;
CREATE TABLE tto.ph08_project_disclosures(
project_id uuid PRIMARY KEY REFERENCES tto.ph08_projects(project_id),
disclosure_version_id uuid NOT NULL REFERENCES tto.ph07_disclosure_versions(version_id));
CREATE FUNCTION tto.ph08_my_project_disclosures()
RETURNS TABLE(project_id uuid,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT p.project_id,p.name FROM tto.ph08_projects p
JOIN tto.ph08_project_disclosures d ON d.project_id=p.project_id
JOIN tto.ph07_disclosure_versions v ON v.version_id=d.disclosure_version_id
JOIN tto.ph07_disclosure_packages pk ON pk.package_id=v.package_id
WHERE p.tenant_id=tto.context_tenant_id() AND pk.tenant_id=p.tenant_id AND
v.status='PUBLISHED' AND tto.has_tenant_role(p.tenant_id,'MEMBER');
$f$;
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph08_projects','ph08_branches','ph08_milestones','ph08_project_events','ph08_project_disclosures']
LOOP
EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);
END LOOP;
END $p$;
CREATE TRIGGER ph08_project_event_immutable BEFORE UPDATE OR DELETE ON tto.ph08_project_events
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
REVOKE ALL ON FUNCTION tto.ph08_complete_milestone(uuid,uuid),
tto.ph08_cas_project(uuid,bigint),tto.ph08_my_project_disclosures() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph08_complete_milestone(uuid,uuid),
tto.ph08_cas_project(uuid,bigint),tto.ph08_my_project_disclosures() TO tto_app;
COMMIT;