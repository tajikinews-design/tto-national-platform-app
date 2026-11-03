BEGIN;
-- Existing PH08 business commands are now exposed only through a member-gated
-- tenant-scoped bridge; no new payments / share transfer / voting authority.
CREATE FUNCTION tto.ph10_submit_member_poll(p_poll uuid,p_answer text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE tenant uuid;
BEGIN
SELECT tenant_id INTO tenant FROM tto.ph08_polls WHERE poll_id=p_poll;
IF tenant IS DISTINCT FROM tto.context_tenant_id()
OR NOT tto.has_tenant_role(tenant,'MEMBER') THEN RETURN false;END IF;
RETURN tto.ph08_submit_poll(p_poll,p_answer);
END $f$;
CREATE FUNCTION tto.ph10_enroll_training_event(p_event uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE tenant uuid;actor uuid:=tto.context_actor_id();
BEGIN
SELECT tenant_id INTO tenant FROM tto.ph08_training_events WHERE event_id=p_event;
IF tenant IS DISTINCT FROM tto.context_tenant_id() OR actor IS NULL
OR NOT tto.has_tenant_role(tenant,'MEMBER') THEN RETURN 'BLOCKED';END IF;
RETURN tto.ph08_registration(p_event,actor);
END $f$;
CREATE FUNCTION tto.ph10_redeem_member_voucher(p_voucher uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE tenant uuid;
BEGIN
SELECT e.tenant_id INTO tenant FROM tto.ph08_benefit_vouchers v
JOIN tto.ph08_benefit_entitlements e ON e.entitlement_id=v.entitlement_id
WHERE v.voucher_id=p_voucher;
IF tenant IS DISTINCT FROM tto.context_tenant_id()
OR NOT tto.has_tenant_role(tenant,'MEMBER') THEN RETURN false;END IF;
RETURN tto.ph08_redeem_voucher(p_voucher);
END $f$;
REVOKE ALL ON FUNCTION tto.ph10_submit_member_poll(uuid,text),
tto.ph10_enroll_training_event(uuid),tto.ph10_redeem_member_voucher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph10_submit_member_poll(uuid,text),
tto.ph10_enroll_training_event(uuid),tto.ph10_redeem_member_voucher(uuid) TO tto_app;
COMMIT;