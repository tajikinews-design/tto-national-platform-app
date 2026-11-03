BEGIN;
CREATE TABLE tto.ph09_grc_cases(
 case_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 kind text NOT NULL CHECK(kind IN('ARTICLE129','ARTICLE132_DIRECTOR_LOAN','RELATED_PARTY','WHISTLEBLOWER','FINDING')),
 related_party boolean NOT NULL DEFAULT false,
 workflow_approved boolean NOT NULL DEFAULT false,
 verification_required boolean NOT NULL DEFAULT false,
 verification_evidence uuid REFERENCES tto.evidence_references(evidence_id),
 source_evidence uuid REFERENCES tto.evidence_references(evidence_id),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),
 CHECK(status<>'CLOSED' OR NOT verification_required OR verification_evidence IS NOT NULL));
CREATE TABLE tto.ph09_grc_identity_vault(
 case_id uuid PRIMARY KEY REFERENCES tto.ph09_grc_cases(case_id),
 encrypted_identity_ref text NOT NULL,
 assigned_investigator uuid NOT NULL REFERENCES tto.user_accounts(user_id));
CREATE TABLE tto.ph09_grc_control_evidence(
 control_id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES tto.ph09_grc_cases(case_id),
 evidence_id uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 attested_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION tto.ph09_grc_can_finalize(p_case uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT EXISTS(SELECT 1 FROM tto.ph09_grc_cases c
 WHERE c.case_id=p_case AND c.tenant_id=tto.context_tenant_id()
 AND tto.has_tenant_role(c.tenant_id,'COOPERATIVE_MANAGER')
 AND CASE WHEN c.kind='ARTICLE132_DIRECTOR_LOAN' THEN false
 WHEN c.kind='ARTICLE129' THEN c.workflow_approved AND c.source_evidence IS NOT NULL
 ELSE true END);
$f$;
CREATE FUNCTION tto.ph09_grc_my_investigator_identity(p_case uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT v.encrypted_identity_ref FROM tto.ph09_grc_identity_vault v
 JOIN tto.ph09_grc_cases c ON c.case_id=v.case_id
 WHERE v.case_id=p_case AND c.tenant_id=tto.context_tenant_id()
 AND v.assigned_investigator=tto.context_actor_id();
$f$;
CREATE TRIGGER ph09_grc_evidence_immutable BEFORE UPDATE OR DELETE ON tto.ph09_grc_control_evidence
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $x$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ph09_grc_cases','ph09_grc_identity_vault','ph09_grc_control_evidence']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);END LOOP;END $x$;
REVOKE ALL ON FUNCTION tto.ph09_grc_can_finalize(uuid),tto.ph09_grc_my_investigator_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_grc_can_finalize(uuid),tto.ph09_grc_my_investigator_identity(uuid) TO tto_app;
COMMIT;