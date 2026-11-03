BEGIN;
-- OPP: no cross-tenant reviewer; explicit domain handoff and immutable status history.
CREATE FUNCTION tto.ph09_can_review_application(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT EXISTS(SELECT 1 FROM tto.ph09_applications a
 JOIN tto.ph09_opportunities o ON o.opportunity_id=a.opportunity_id
 WHERE a.application_id=p_id AND o.tenant_id=tto.context_tenant_id()
 AND tto.has_tenant_role(o.tenant_id,'COOPERATIVE_MANAGER'));
$f$;
CREATE FUNCTION tto.ph09_application_status_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
BEGIN IF NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO tto.ph09_application_history(history_id,application_id,prior_status,new_status)
 VALUES(gen_random_uuid(),NEW.application_id,OLD.status,NEW.status);
END IF;RETURN NEW;END $f$;
CREATE TRIGGER ph09_application_status_history AFTER UPDATE OF status
 ON tto.ph09_applications FOR EACH ROW EXECUTE FUNCTION tto.ph09_application_status_audit();
CREATE FUNCTION tto.ph09_handoff_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE wanted text;tid uuid;
BEGIN SELECT handoff_kind,tenant_id INTO wanted,tid FROM tto.ph09_opportunities WHERE opportunity_id=NEW.opportunity_id;
IF wanted IS DISTINCT FROM NEW.destination OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e
 WHERE e.evidence_id=NEW.source_evidence AND e.tenant_id=tid)
THEN RAISE EXCEPTION 'PH09_OPP_HANDOFF_SOURCE_INVALID';END IF;
RETURN NEW;END $f$;
CREATE TRIGGER ph09_handoff_source BEFORE INSERT ON tto.ph09_opportunity_handoffs
 FOR EACH ROW EXECUTE FUNCTION tto.ph09_handoff_guard();
-- Impact: claim requires approved measurement and matching signed evidence tenant.
CREATE FUNCTION tto.ph09_impact_claim_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE tid uuid;
BEGIN SELECT tenant_id INTO tid FROM tto.ph09_impact_measurements
WHERE measurement_id=NEW.measurement_id AND status='APPROVED' AND source_evidence IS NOT NULL;
IF tid IS NULL OR NOT EXISTS(SELECT 1 FROM tto.evidence_references e
 WHERE e.evidence_id=NEW.approval_evidence AND e.tenant_id=tid)
THEN RAISE EXCEPTION 'PH09_IMPACT_CLAIM_APPROVAL_INVALID';END IF;
RETURN NEW;END $f$;
CREATE TRIGGER ph09_impact_claim_source BEFORE INSERT ON tto.ph09_public_impact_claims
FOR EACH ROW EXECUTE FUNCTION tto.ph09_impact_claim_guard();
CREATE TRIGGER ph09_impact_claim_immutable BEFORE UPDATE OR DELETE ON tto.ph09_public_impact_claims
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
-- DG: legal hold registration and disposition serialize on the SAME parent record.
CREATE FUNCTION tto.ph09_legal_hold_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $f$
DECLARE current_state text;
BEGIN
SELECT state INTO current_state FROM tto.ph09_retention_records WHERE record_id=NEW.record_id FOR UPDATE;
IF current_state IS NULL OR current_state='DISPOSED'
THEN RAISE EXCEPTION 'PH09_HOLD_MUST_PRECEDE_DISPOSITION';END IF;
RETURN NEW;
END $f$;
CREATE TRIGGER ph09_legal_hold_locks_record BEFORE INSERT ON tto.ph09_legal_holds
FOR EACH ROW EXECUTE FUNCTION tto.ph09_legal_hold_lock();
REVOKE ALL ON FUNCTION tto.ph09_can_review_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph09_can_review_application(uuid) TO tto_app;
COMMIT;