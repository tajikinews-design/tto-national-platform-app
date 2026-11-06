-- PH10 / PH08 FIVE frozen-source operations: READ-ONLY PRE-FLIGHT ONLY.
-- Disposable PG17 synthetic CI. Never run on hosted/production DB.
-- No order, payment, refund, sealed bid, criteria edit, threshold edit or authority issuance.
BEGIN;
CREATE FUNCTION tto.ph10_member_checkout_preflight(p_offer uuid)
RETURNS TABLE(seller_kind text, price_snapshot numeric, published boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
 SELECT o.seller_kind,o.price_snapshot,(o.status='PUBLISHED')
 FROM tto.ph08_market_offers o
 WHERE o.offer_id=p_offer AND o.seller_tenant_id=tto.context_tenant_id()
   AND o.seller_kind='COOPERATIVE' AND o.status='PUBLISHED'
   AND tto.has_tenant_role(o.seller_tenant_id,'MEMBER')
$$;
CREATE FUNCTION tto.ph10_member_refund_policy_preflight(p_order uuid)
RETURNS TABLE(policy_version text, order_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
 SELECT r.policy_version,o.status
 FROM tto.ph08_market_orders o
 JOIN tto.ph08_market_refunds r ON r.order_id=o.order_id
 JOIN tto.ph08_market_offers offer ON offer.offer_id=o.offer_id
 WHERE o.order_id=p_order
   AND o.buyer_tenant_id=tto.context_tenant_id()
   AND offer.seller_tenant_id=o.seller_tenant_id
   AND offer.seller_kind='COOPERATIVE'
   AND tto.has_tenant_role(o.buyer_tenant_id,'MEMBER')
 ORDER BY r.refund_id
 LIMIT 1
$$;
CREATE FUNCTION tto.ph10_manager_bid_deadline_preflight(p_tender uuid)
RETURNS TABLE(deadline_passed boolean,opened boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
 SELECT (clock_timestamp()>=t.deadline),(t.opened_at IS NOT NULL)
 FROM tto.ph08_sourcing_tenders t
 WHERE t.tender_id=p_tender AND t.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER')
$$;
CREATE FUNCTION tto.ph10_manager_criteria_lock_preflight(p_tender uuid)
RETURNS TABLE(criteria_version integer,opened boolean,criteria_frozen boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
 SELECT t.criteria_version,(t.opened_at IS NOT NULL),(t.opened_at IS NOT NULL)
 FROM tto.ph08_sourcing_tenders t
 WHERE t.tender_id=p_tender AND t.tenant_id=tto.context_tenant_id()
   AND tto.has_tenant_role(t.tenant_id,'COOPERATIVE_MANAGER')
$$;
CREATE FUNCTION tto.ph10_manager_threshold_versions_preflight(p_code text)
RETURNS TABLE(policy_version integer,source_ref uuid,policy_value numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $$
 SELECT v.version,v.source_ref,v.value
 FROM tto.ph08_threshold_versions v
 JOIN tto.evidence_references e ON e.evidence_id=v.source_ref
 WHERE v.policy_code=p_code AND v.tenant_id=tto.context_tenant_id()
   AND e.tenant_id=v.tenant_id
   AND tto.has_tenant_role(v.tenant_id,'COOPERATIVE_MANAGER')
 ORDER BY v.version ASC
$$;
REVOKE ALL ON FUNCTION tto.ph10_member_checkout_preflight(uuid),
 tto.ph10_member_refund_policy_preflight(uuid),
 tto.ph10_manager_bid_deadline_preflight(uuid),
 tto.ph10_manager_criteria_lock_preflight(uuid),
 tto.ph10_manager_threshold_versions_preflight(text)
 FROM PUBLIC,tto_app;
GRANT EXECUTE ON FUNCTION tto.ph10_member_checkout_preflight(uuid),
 tto.ph10_member_refund_policy_preflight(uuid),
 tto.ph10_manager_bid_deadline_preflight(uuid),
 tto.ph10_manager_criteria_lock_preflight(uuid),
 tto.ph10_manager_threshold_versions_preflight(text) TO tto_app;
COMMIT;
