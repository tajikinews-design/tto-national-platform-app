BEGIN;
-- All served PH09 read models remain tenant filtered at DB owner boundary.
CREATE FUNCTION tto.ph09_my_open_opportunities()
RETURNS TABLE(opportunity_id uuid,title text,deadline timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT o.opportunity_id,o.title,o.deadline FROM tto.ph09_opportunities o
WHERE o.tenant_id=tto.context_tenant_id() AND o.status='OPEN'
AND tto.has_tenant_role(o.tenant_id,'MEMBER')
ORDER BY o.deadline LIMIT 100;
$f$;
CREATE FUNCTION tto.ph09_my_approved_impact()
RETURNS TABLE(claim_id uuid,measurement_id uuid,amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT c.claim_id,m.measurement_id,m.amount
FROM tto.ph09_public_impact_claims c
JOIN tto.ph09_impact_measurements m ON m.measurement_id=c.measurement_id
WHERE m.tenant_id=tto.context_tenant_id() AND m.status='APPROVED'
AND tto.has_tenant_role(m.tenant_id,'MEMBER')
ORDER BY c.published_at DESC LIMIT 100;
$f$;
CREATE FUNCTION tto.ph09_my_grc_case_summary()
RETURNS TABLE(case_id uuid,kind text,status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT g.case_id,g.kind,g.status FROM tto.ph09_grc_cases g
WHERE g.tenant_id=tto.context_tenant_id()
AND tto.has_tenant_role(g.tenant_id,'COOPERATIVE_MANAGER')
AND g.kind<>'WHISTLEBLOWER' ORDER BY g.case_id LIMIT 100;
$f$;
CREATE FUNCTION tto.ph09_my_retention_summary()
RETURNS TABLE(record_id uuid,classification text,state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT r.record_id,r.classification,r.state
FROM tto.ph09_retention_records r WHERE r.tenant_id=tto.context_tenant_id()
AND tto.has_tenant_role(r.tenant_id,'COOPERATIVE_MANAGER') LIMIT 100;
$f$;
-- PH09 membership authorization is checked inside the source-of-truth function,
-- not only by a controller.
CREATE OR REPLACE FUNCTION tto.ph09_apply(p_opportunity uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE o tto.ph09_opportunities%ROWTYPE;actor uuid:=tto.context_actor_id();
BEGIN
SELECT * INTO o FROM tto.ph09_opportunities WHERE opportunity_id=p_opportunity FOR UPDATE;
IF NOT FOUND OR o.tenant_id IS DISTINCT FROM tto.context_tenant_id()
OR NOT tto.has_tenant_role(o.tenant_id,'MEMBER')
OR o.status<>'OPEN' OR o.deadline<=clock_timestamp() OR actor IS NULL
THEN RETURN false;END IF;
INSERT INTO tto.ph09_applications(application_id,opportunity_id,applicant_id)
VALUES(gen_random_uuid(),p_opportunity,actor)
ON CONFLICT(opportunity_id,applicant_id) DO NOTHING;
RETURN FOUND;
END $f$;
-- Caller must never lower the system's minimum safe cohort threshold.
CREATE OR REPLACE FUNCTION tto.ph09_metric_display(p_snapshot uuid,p_min_cohort integer DEFAULT 5)
RETURNS TABLE(display_value numeric,display_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT CASE WHEN s.cohort_count<greatest(5,coalesce(p_min_cohort,5)) THEN NULL ELSE s.value END,
 CASE WHEN s.cohort_count<greatest(5,coalesce(p_min_cohort,5)) THEN 'SUPPRESSED'
 WHEN s.value IS NULL THEN 'NO_DATA'
 WHEN s.estimated THEN 'ESTIMATED' ELSE 'MEASURED' END
FROM tto.ph09_metric_snapshots s WHERE s.snapshot_id=p_snapshot
AND s.tenant_id=tto.context_tenant_id()
AND tto.has_tenant_role(s.tenant_id,'COOPERATIVE_MANAGER');
$f$;
CREATE OR REPLACE FUNCTION tto.ph09_legal_hold_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE tid uuid;record_state text;
BEGIN SELECT tenant_id,state INTO tid,record_state FROM tto.ph09_retention_records
WHERE record_id=NEW.record_id FOR UPDATE;
IF record_state IS NULL OR record_state='DISPOSED'
 OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e
 WHERE e.evidence_id=NEW.reason_evidence AND e.tenant_id=tid)
THEN RAISE EXCEPTION 'PH09_HOLD_SOURCE_INVALID_OR_DISPOSED';END IF;
RETURN NEW;END $f$;
CREATE FUNCTION tto.ph09_impact_tenant_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
BEGIN
IF NOT EXISTS(SELECT 1 FROM tto.ph09_impact_methods d WHERE d.method_id=NEW.method_id
AND d.tenant_id=NEW.tenant_id)
 OR (NEW.source_evidence IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM tto.evidence_references e WHERE e.evidence_id=NEW.source_evidence
 AND e.tenant_id=NEW.tenant_id))
THEN RAISE EXCEPTION 'PH09_IMPACT_TENANT_SOURCE_DENIED';END IF;
RETURN NEW;END $f$;
CREATE TRIGGER ph09_impact_tenant_source BEFORE INSERT OR UPDATE ON tto.ph09_impact_measurements
FOR EACH ROW EXECUTE FUNCTION tto.ph09_impact_tenant_guard();
REVOKE ALL ON FUNCTION tto.ph09_my_open_opportunities(),tto.ph09_my_approved_impact(),
 tto.ph09_my_grc_case_summary(),tto.ph09_my_retention_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_my_open_opportunities(),tto.ph09_my_approved_impact(),
 tto.ph09_my_grc_case_summary(),tto.ph09_my_retention_summary() TO tto_app;
COMMIT;