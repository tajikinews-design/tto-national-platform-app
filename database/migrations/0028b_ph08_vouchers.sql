BEGIN;
CREATE TABLE tto.ph08_benefit_entitlements(
entitlement_id uuid PRIMARY KEY,
benefit_id uuid NOT NULL REFERENCES tto.ph08_benefits(benefit_id),
tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
holder_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
noncash_units integer NOT NULL CHECK(noncash_units>=0),
withdrawable boolean NOT NULL DEFAULT false CHECK(withdrawable=false),
distribution_kind text NOT NULL DEFAULT 'REWARD' CHECK(distribution_kind='REWARD'),
UNIQUE(benefit_id,holder_id));
CREATE TABLE tto.ph08_benefit_vouchers(
voucher_id uuid PRIMARY KEY,
entitlement_id uuid NOT NULL REFERENCES tto.ph08_benefit_entitlements(entitlement_id),
expires_at timestamptz NOT NULL,
redeemed_at timestamptz,redeemed_by uuid REFERENCES tto.user_accounts(user_id));
CREATE FUNCTION tto.ph08_redeem_voucher(p_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v tto.ph08_benefit_vouchers%ROWTYPE;e tto.ph08_benefit_entitlements%ROWTYPE;
BEGIN
SELECT * INTO v FROM tto.ph08_benefit_vouchers WHERE voucher_id=p_id FOR UPDATE;
IF NOT FOUND OR v.redeemed_at IS NOT NULL OR v.expires_at<=clock_timestamp() THEN RETURN false;END IF;
SELECT * INTO e FROM tto.ph08_benefit_entitlements WHERE entitlement_id=v.entitlement_id;
IF e.tenant_id IS DISTINCT FROM tto.context_tenant_id() OR e.holder_id IS DISTINCT FROM tto.context_actor_id()
OR NOT EXISTS(SELECT 1 FROM tto.ph08_benefits b WHERE b.benefit_id=e.benefit_id AND b.tenant_id=e.tenant_id AND b.status='ACTIVE')
THEN RETURN false;END IF;
UPDATE tto.ph08_benefit_vouchers SET redeemed_at=clock_timestamp(),redeemed_by=e.holder_id
WHERE voucher_id=p_id;
PERFORM tto.append_actor_audit(e.tenant_id,'PH08_BENEFIT_VOUCHER_REDEEMED',p_id);
RETURN true;
END $f$;
DO $p$ DECLARE tb text;BEGIN
FOREACH tb IN ARRAY ARRAY['ph08_benefits','ph08_benefit_entitlements','ph08_benefit_vouchers']
LOOP EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tb);
EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tb);
EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tb);END LOOP;END $p$;
REVOKE ALL ON FUNCTION tto.ph08_redeem_voucher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph08_redeem_voucher(uuid) TO tto_app;
COMMIT;