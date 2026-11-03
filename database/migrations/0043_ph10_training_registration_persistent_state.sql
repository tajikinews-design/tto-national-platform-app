BEGIN;
-- PH10: restore member's real registration state after reload, scoped to same actor and tenant.
DROP FUNCTION tto.ph10_member_training_events();
CREATE FUNCTION tto.ph10_member_training_events()
RETURNS TABLE(event_id uuid,course_title text,capacity integer,refund_policy_version text,registration_state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT e.event_id,c.title,e.capacity,e.refund_policy_version,r.state
 FROM tto.ph08_training_events e
 JOIN tto.ph08_courses c ON c.course_id=e.course_id AND c.tenant_id=e.tenant_id
 LEFT JOIN tto.ph08_event_registrations r ON r.event_id=e.event_id
  AND r.registered_by=tto.context_actor_id()
 WHERE e.tenant_id=tto.context_tenant_id() AND c.status='ACTIVE'
 AND tto.has_tenant_role(e.tenant_id,'MEMBER') ORDER BY e.event_id LIMIT 100;
$f$;
REVOKE ALL ON FUNCTION tto.ph10_member_training_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph10_member_training_events() TO tto_app;
COMMIT;
