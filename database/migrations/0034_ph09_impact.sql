BEGIN;
CREATE TABLE tto.ph09_impact_methods(
method_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
method_code text NOT NULL,version int NOT NULL CHECK(version>0),
source_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
UNIQUE(tenant_id,method_code,version));
CREATE TABLE tto.ph09_impact_measurements(
measurement_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
project_id uuid REFERENCES tto.ph08_projects(project_id),
method_id uuid NOT NULL REFERENCES tto.ph09_impact_methods(method_id),
source_evidence uuid REFERENCES tto.evidence_references(evidence_id),
amount numeric,status text NOT NULL DEFAULT 'DRAFT'
CHECK(status IN('DRAFT','QUALITY_REVIEW','APPROVED')),
CHECK(status<>'APPROVED' OR source_evidence IS NOT NULL));
CREATE TABLE tto.ph09_public_impact_claims(
claim_id uuid PRIMARY KEY,measurement_id uuid NOT NULL REFERENCES tto.ph09_impact_measurements(measurement_id),
approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
approval_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
published_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tto.ph09_beneficiary_records(
record_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
encrypted_ref text NOT NULL,
classification text NOT NULL DEFAULT 'RESTRICTED' CHECK(classification='RESTRICTED'));
CREATE TRIGGER ph09_impact_method_immutable BEFORE UPDATE OR DELETE ON tto.ph09_impact_methods
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph09_impact_methods','ph09_impact_measurements','ph09_public_impact_claims','ph09_beneficiary_records']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);END LOOP;END $p$;
COMMIT;