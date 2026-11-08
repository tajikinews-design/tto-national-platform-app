-- Preview-only commercial self-registration; mock payment is NEVER banking evidence.
-- No independent domains, legal dossier, official validation, share permissions or financial debit.
-- Only verified-mobile users with a current server-validated session can submit.
-- This implementation deliberately does not create tto.tenants/role_assignments.
CREATE TABLE tto.commerce_demo_plans (
 code text PRIMARY KEY CHECK (code ~ '^demo-[a-z-]{2,30}$'),
 title text NOT NULL CHECK (length(title) BETWEEN 3 AND 100),
 duration_days int NOT NULL CHECK (duration_days BETWEEN 1 AND 366),
 features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features)='array'),
 preview_only boolean NOT NULL DEFAULT true CHECK (preview_only),
 active boolean NOT NULL DEFAULT true
);
INSERT INTO tto.commerce_demo_plans(code,title,duration_days,features) VALUES
 ('demo-basic','پایه (نمایشی)',30,'["نمایش پنل","ثبت تنظیمات"]'::jsonb),
 ('demo-plus','حرفه‌ای (نمایشی)',90,'["نمایش پنل","تنظیمات اشتراک","گزارش نمایشی"]'::jsonb),
 ('demo-enterprise','سازمانی (نمایشی)',365,'["نمایش پنل","تنظیمات اشتراک","گزارش نمایشی","پشتیبانی نمایشی"]'::jsonb);
CREATE TABLE tto.commerce_demo_orders(
 order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL UNIQUE REFERENCES tto.cooperative_workspace_addresses(workspace_id),
 owner_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 slug text NOT NULL UNIQUE,
 proposed_name text NOT NULL CHECK (length(btrim(proposed_name)) BETWEEN 5 AND 180),
 verified_mobile text NOT NULL CHECK (verified_mobile ~ '^09[0-9]{9}$'),
 plan_code text NOT NULL REFERENCES tto.commerce_demo_plans(code),
 submitted_amount_irr bigint NOT NULL CHECK (submitted_amount_irr BETWEEN 1 AND 1000000000000),
 status text NOT NULL DEFAULT 'DEMO_AMOUNT_ATTESTED' CHECK(status='DEMO_AMOUNT_ATTESTED'),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 gateway_transaction_id text,
 CONSTRAINT no_real_payment_claim CHECK (gateway_transaction_id IS NULL)
);
CREATE INDEX commerce_demo_orders_owner ON tto.commerce_demo_orders(owner_id,confirmed_at DESC);
ALTER TABLE tto.commerce_demo_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_orders FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_plans,tto.commerce_demo_orders FROM PUBLIC,tto_app;
-- Catalog exposes no private user information; private orders cannot be read directly.
GRANT SELECT ON tto.commerce_demo_plans TO tto_app;
CREATE POLICY commerce_plans_public_read ON tto.commerce_demo_plans FOR SELECT TO tto_app
 USING (active AND preview_only);
CREATE FUNCTION tto.confirm_commerce_demo_order(
 p_slug text,p_name text,p_plan text,p_amount bigint,p_mobile text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE v_actor uuid;v_plan tto.commerce_demo_plans%ROWTYPE;
 v_workspace uuid;v_order uuid;v_end timestamptz;
BEGIN
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR p_slug IS NULL OR
    p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR
    p_slug IN ('www','admin','national','manager','login','api','auth','system','demo','shareholder','new') OR
    p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 5 AND 180 OR
    p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000 OR
    p_mobile IS NULL OR p_mobile !~ '^09[0-9]{9}$' THEN
  RAISE EXCEPTION 'INVALID_DEMO_ORDER' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.verified_mobile_identifiers i
    JOIN tto.user_accounts a ON a.user_id=i.user_id
    WHERE i.user_id=v_actor AND i.mobile=p_mobile AND i.revoked_at IS NULL AND a.status='ACTIVE') THEN
  RAISE EXCEPTION 'VERIFIED_MOBILE_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_plan FROM tto.commerce_demo_plans WHERE code=p_plan AND active AND preview_only;
 IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_AVAILABLE' USING ERRCODE='22023'; END IF;
 -- One atomic transaction; the existing UNIQUE slug is the collision arbiter.
 -- No time-limited reservation engine or separate domain registrar is involved.
 INSERT INTO tto.cooperative_workspace_addresses(slug,created_by)
 VALUES(p_slug,v_actor) RETURNING workspace_id INTO v_workspace;
 v_end:=clock_timestamp()+make_interval(days=>v_plan.duration_days);
 INSERT INTO tto.commerce_demo_orders(workspace_id,owner_id,slug,proposed_name,
  verified_mobile,plan_code,submitted_amount_irr,expires_at)
 VALUES(v_workspace,v_actor,p_slug,btrim(p_name),p_mobile,p_plan,p_amount,v_end)
 RETURNING order_id INTO v_order;
 RETURN jsonb_build_object('orderId',v_order,'slug',p_slug,'planCode',p_plan,
  'status','DEMO_AMOUNT_ATTESTED','expiresAt',v_end,
  'domain',p_slug||'.ttoir.ir','realPayment',false,'tenantActivated',false,
  'managerRoleGranted',false,'smsSent',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.confirm_commerce_demo_order(text,text,text,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.confirm_commerce_demo_order(text,text,text,bigint,text) TO tto_app;
CREATE FUNCTION tto.my_commerce_demo_subscriptions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'slug',o.slug,'name',o.proposed_name,'planCode',o.plan_code,'planTitle',p.title,
  'features',p.features,'confirmedAt',o.confirmed_at,'expiresAt',o.expires_at,
  'remainingDays',greatest(0,ceil(extract(epoch from (o.expires_at-now()))/86400)::int),
  'status',CASE WHEN o.expires_at>now() THEN 'DEMO_ACTIVE' ELSE 'DEMO_EXPIRED' END,
  'realPayment',false,'tenantActivated',false
 ) ORDER BY o.confirmed_at DESC),'[]'::jsonb)
 FROM tto.commerce_demo_orders o JOIN tto.commerce_demo_plans p ON p.code=o.plan_code
 WHERE o.owner_id=tto.context_actor_id()
$fn$;
REVOKE ALL ON FUNCTION tto.my_commerce_demo_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.my_commerce_demo_subscriptions() TO tto_app;
COMMENT ON TABLE tto.commerce_demo_orders IS
 'Preview mock amount recording only; no payment gateway verification, tenant activation, role grant or SMS confirmation.';
