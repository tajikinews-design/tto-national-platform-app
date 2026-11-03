BEGIN;
CREATE FUNCTION tto.ph08_bid_deadline() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $x$
DECLARE d timestamptz;o timestamptz;
BEGIN
SELECT deadline,opened_at INTO d,o FROM tto.ph08_sourcing_tenders WHERE tender_id=NEW.tender_id FOR UPDATE;
IF d IS NULL OR o IS NOT NULL OR clock_timestamp()>=d THEN RAISE EXCEPTION 'PH08_BID_AFTER_DEADLINE';END IF;
RETURN NEW;
END $x$;
CREATE TRIGGER ph08_bid_deadline_guard BEFORE INSERT ON tto.ph08_sourcing_bids FOR EACH ROW EXECUTE FUNCTION tto.ph08_bid_deadline();
CREATE FUNCTION tto.ph08_criteria_frozen() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $x$
BEGIN
IF OLD.opened_at IS NOT NULL AND NEW.criteria_version<>OLD.criteria_version THEN RAISE EXCEPTION 'PH08_CRITERIA_FROZEN';END IF;
RETURN NEW;
END $x$;
CREATE TRIGGER ph08_tender_criteria_frozen BEFORE UPDATE ON tto.ph08_sourcing_tenders FOR EACH ROW EXECUTE FUNCTION tto.ph08_criteria_frozen();
CREATE FUNCTION tto.ph08_can_read_bid(p_bid uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
DECLARE t uuid;opened timestamptz;d timestamptz;
BEGIN
SELECT p.tenant_id,p.opened_at,p.deadline INTO t,opened,d FROM tto.ph08_sourcing_bids b
JOIN tto.ph08_sourcing_tenders p ON p.tender_id=b.tender_id WHERE b.bid_id=p_bid;
IF t IS DISTINCT FROM tto.context_tenant_id() OR opened IS NULL OR clock_timestamp()<d
OR NOT tto.has_tenant_role(t,'COOPERATIVE_MANAGER') THEN
IF t IS NOT NULL AND t=tto.context_tenant_id() AND tto.context_actor_id() IS NOT NULL
THEN PERFORM tto.append_actor_audit(t,'PH08_SEALED_BID_DENIED',p_bid);END IF;
RETURN false;END IF;
RETURN true;
END $x$;
CREATE FUNCTION tto.ph08_can_evaluate(p_tender uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
SELECT EXISTS(SELECT 1 FROM tto.ph08_sourcing_tenders t WHERE t.tender_id=p_tender
AND t.tenant_id=tto.context_tenant_id() AND t.opened_at IS NOT NULL
AND tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER')
AND NOT EXISTS(SELECT 1 FROM tto.ph08_evaluator_conflicts c WHERE c.tender_id=p_tender
AND c.evaluator_id=tto.context_actor_id() AND c.status='OPEN'));
$x$;
REVOKE ALL ON FUNCTION tto.ph08_can_read_bid(uuid),tto.ph08_can_evaluate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph08_can_read_bid(uuid),tto.ph08_can_evaluate(uuid) TO tto_app;
COMMIT;