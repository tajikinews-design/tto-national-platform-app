-- PH10 audit-only PH08 read paths. No real data or operational activation.
BEGIN;
CREATE FUNCTION tto.ph10_member_retired_training_history()
RETURNS TABLE(event_id uuid,course_title text,registration_state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT e.event_id,c.title,r.state
 FROM tto.ph08_event_registrations r
 JOIN tto.ph08_training_events e ON e.event_id=r.event_id
 JOIN tto.ph08_courses c ON c.course_id=e.course_id
 WHERE c.status='RETIRED'
   AND c.tenant_id=tto.context_tenant_id()
   AND e.tenant_id=c.tenant_id
   AND r.registered_by=tto.context_actor_id()
   AND tto.has_tenant_role(c.tenant_id,'MEMBER')
 ORDER BY e.event_id
$fn$;
CREATE FUNCTION tto.ph10_member_sponsored_creatives()
RETURNS TABLE(creative_id uuid,caption text,sponsored boolean,official_notice boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT a.creative_id,a.caption,a.sponsored,a.official_notice
 FROM tto.ph08_ad_creatives a
 WHERE a.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(a.tenant_id,'MEMBER')
   AND a.sponsored=true AND a.official_notice=false
 ORDER BY a.creative_id
$fn$;
REVOKE ALL ON FUNCTION tto.ph10_member_retired_training_history(),
  tto.ph10_member_sponsored_creatives() FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph10_member_retired_training_history(),
  tto.ph10_member_sponsored_creatives() TO tto_app;
COMMIT;
