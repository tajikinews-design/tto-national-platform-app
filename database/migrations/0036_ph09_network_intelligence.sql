BEGIN;
CREATE TABLE tto.ph09_metric_definitions(
 metric_id uuid PRIMARY KEY,code text NOT NULL,version int NOT NULL CHECK(version>0),
 source_evidence uuid NOT NULL REFERENCES tto.evidence_references(evidence_id),
 UNIQUE(code,version));
CREATE TABLE tto.ph09_metric_snapshots(
 snapshot_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 metric_id uuid NOT NULL REFERENCES tto.ph09_metric_definitions(metric_id),
 snapshot_version int NOT NULL CHECK(snapshot_version>0),
 value numeric,cohort_count int NOT NULL CHECK(cohort_count>=0),
 estimated boolean NOT NULL DEFAULT false,
 measured_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,metric_id,snapshot_version));
CREATE FUNCTION tto.ph09_metric_display(p_snapshot uuid,p_min_cohort integer DEFAULT 5)
RETURNS TABLE(display_value numeric,display_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT CASE WHEN s.cohort_count<p_min_cohort THEN NULL ELSE s.value END,
 CASE WHEN s.cohort_count<p_min_cohort THEN 'SUPPRESSED'
 WHEN s.value IS NULL THEN 'NO_DATA'
 WHEN s.estimated THEN 'ESTIMATED' ELSE 'MEASURED' END
FROM tto.ph09_metric_snapshots s WHERE s.snapshot_id=p_snapshot
AND s.tenant_id=tto.context_tenant_id()
AND tto.has_tenant_role(s.tenant_id,'COOPERATIVE_MANAGER');
$f$;
CREATE FUNCTION tto.ph09_metrics_comparable(p_a uuid,p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT EXISTS(SELECT 1 FROM tto.ph09_metric_snapshots a
JOIN tto.ph09_metric_snapshots b ON a.metric_id=b.metric_id
AND b.snapshot_id=p_b WHERE a.snapshot_id=p_a AND
a.tenant_id=tto.context_tenant_id() AND b.tenant_id=tto.context_tenant_id()
AND tto.has_tenant_role(a.tenant_id,'COOPERATIVE_MANAGER'));
$f$;
CREATE TRIGGER ph09_snapshots_immutable BEFORE UPDATE OR DELETE ON tto.ph09_metric_snapshots
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
DO $x$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ph09_metric_definitions','ph09_metric_snapshots']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',t);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',t);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',t);END LOOP;END $x$;
REVOKE ALL ON FUNCTION tto.ph09_metric_display(uuid,integer),tto.ph09_metrics_comparable(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_metric_display(uuid,integer),tto.ph09_metrics_comparable(uuid,uuid) TO tto_app;
COMMIT;