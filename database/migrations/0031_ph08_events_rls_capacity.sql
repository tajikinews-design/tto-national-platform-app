BEGIN;
DO $x$ DECLARE n text;BEGIN
FOREACH n IN ARRAY ARRAY['ph08_courses','ph08_training_events','ph08_event_registrations','ph08_learning_completions','ph08_course_certifications','ph08_event_refunds','ph08_sourcing_tenders','ph08_sourcing_bids','ph08_evaluator_conflicts','ph08_threshold_versions']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',n);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',n);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',n);END LOOP;
END $x$;
CREATE TRIGGER ph08_threshold_immutable BEFORE UPDATE OR DELETE ON tto.ph08_threshold_versions
FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE FUNCTION tto.ph08_registration(p_event uuid,p_user uuid) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
DECLARE e tto.ph08_training_events%ROWTYPE;n integer;s text;
BEGIN
SELECT * INTO e FROM tto.ph08_training_events WHERE event_id=p_event FOR UPDATE;
IF NOT FOUND OR e.tenant_id IS DISTINCT FROM tto.context_tenant_id() OR p_user IS DISTINCT FROM tto.context_actor_id() THEN RETURN 'BLOCKED';END IF;
IF EXISTS(SELECT 1 FROM tto.ph08_event_registrations WHERE event_id=p_event AND registered_by=p_user) THEN RETURN 'DUPLICATE';END IF;
SELECT count(*) INTO n FROM tto.ph08_event_registrations WHERE event_id=p_event AND state='CONFIRMED';
s:=CASE WHEN n<e.capacity THEN 'CONFIRMED' ELSE 'WAITLIST' END;
INSERT INTO tto.ph08_event_registrations(registration_id,event_id,registered_by,state)
VALUES(gen_random_uuid(),p_event,p_user,s);
RETURN s;
END $x$;
CREATE FUNCTION tto.ph08_waitlist_promote(p_event uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $x$
DECLARE e tto.ph08_training_events%ROWTYPE;target uuid;n integer;
BEGIN
SELECT * INTO e FROM tto.ph08_training_events WHERE event_id=p_event FOR UPDATE;
IF NOT FOUND OR e.tenant_id IS DISTINCT FROM tto.context_tenant_id() OR NOT tto.has_tenant_role(e.tenant_id,'COOPERATIVE_MANAGER') THEN RETURN false;END IF;
SELECT count(*) INTO n FROM tto.ph08_event_registrations WHERE event_id=p_event AND state='CONFIRMED';
IF n>=e.capacity THEN RETURN false;END IF;
SELECT registration_id INTO target FROM tto.ph08_event_registrations WHERE event_id=p_event AND state='WAITLIST' ORDER BY registration_id LIMIT 1 FOR UPDATE;
IF target IS NULL THEN RETURN false;END IF;
UPDATE tto.ph08_event_registrations SET state='CONFIRMED' WHERE registration_id=target;
RETURN true;
END $x$;
REVOKE ALL ON FUNCTION tto.ph08_registration(uuid,uuid),tto.ph08_waitlist_promote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph08_registration(uuid,uuid),tto.ph08_waitlist_promote(uuid) TO tto_app;
COMMIT;