BEGIN;
-- Phase10 integration only: Source-bound, read-only façades on implemented PH08 tables.
-- Every function must enforce tenant, verified actor role and safe projection.
CREATE FUNCTION tto.ph10_member_open_polls()
RETURNS TABLE(poll_id uuid,title text,deadline timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT p.poll_id,p.title,p.deadline FROM tto.ph08_polls p
 JOIN tto.ph08_poll_audience a ON a.poll_id=p.poll_id
 WHERE p.tenant_id=tto.context_tenant_id()
 AND a.user_id=tto.context_actor_id() AND p.status='OPEN'
 AND p.deadline>clock_timestamp() AND p.legal_vote=false
 AND tto.has_tenant_role(p.tenant_id,'MEMBER')
 ORDER BY p.deadline LIMIT 100;
$f$;
CREATE FUNCTION tto.ph10_member_training_events()
RETURNS TABLE(event_id uuid,course_title text,capacity integer,refund_policy_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT e.event_id,c.title,e.capacity,e.refund_policy_version
 FROM tto.ph08_training_events e
 JOIN tto.ph08_courses c ON c.course_id=e.course_id AND c.tenant_id=e.tenant_id
 WHERE e.tenant_id=tto.context_tenant_id() AND c.status='ACTIVE'
 AND tto.has_tenant_role(e.tenant_id,'MEMBER') ORDER BY e.event_id LIMIT 100;
$f$;
CREATE FUNCTION tto.ph10_member_vouchers()
RETURNS TABLE(voucher_id uuid,title text,expires_at timestamptz,noncash_units integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT v.voucher_id,b.title,v.expires_at,e.noncash_units FROM tto.ph08_benefit_vouchers v
 JOIN tto.ph08_benefit_entitlements e ON e.entitlement_id=v.entitlement_id
 JOIN tto.ph08_benefits b ON b.benefit_id=e.benefit_id AND b.tenant_id=e.tenant_id
 WHERE e.tenant_id=tto.context_tenant_id()
 AND e.holder_id=tto.context_actor_id() AND v.redeemed_at IS NULL
 AND v.expires_at>clock_timestamp() AND b.status='ACTIVE'
 AND e.withdrawable=false AND e.distribution_kind='REWARD'
 AND tto.has_tenant_role(e.tenant_id,'MEMBER')
 ORDER BY v.expires_at LIMIT 100;
$f$;
CREATE FUNCTION tto.ph10_member_market_offers()
RETURNS TABLE(offer_id uuid,title text,price_snapshot numeric,seller_kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT o.offer_id,o.title,o.price_snapshot,o.seller_kind FROM tto.ph08_market_offers o
 WHERE o.seller_tenant_id=tto.context_tenant_id() AND o.status='PUBLISHED'
 AND o.seller_kind='COOPERATIVE'
 AND tto.has_tenant_role(o.seller_tenant_id,'MEMBER')
 ORDER BY o.offer_id LIMIT 100;
$f$;
CREATE FUNCTION tto.ph10_manager_procurement_tenders()
RETURNS TABLE(tender_id uuid,deadline timestamptz,opened_at timestamptz,criteria_version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT t.tender_id,t.deadline,t.opened_at,t.criteria_version
 FROM tto.ph08_sourcing_tenders t
 WHERE t.tenant_id=tto.context_tenant_id()
 AND tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER')
 ORDER BY t.deadline LIMIT 100;
$f$;
REVOKE ALL ON FUNCTION tto.ph10_member_open_polls(),tto.ph10_member_training_events(),
tto.ph10_member_vouchers(),tto.ph10_member_market_offers(),
tto.ph10_manager_procurement_tenders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph10_member_open_polls(),tto.ph10_member_training_events(),
tto.ph10_member_vouchers(),tto.ph10_member_market_offers(),
tto.ph10_manager_procurement_tenders() TO tto_app;
COMMIT;