-- Isolated TTO commercial onboarding. A customer owns a software workspace after
-- the DEMO payment attestation; no legal cooperative authority or shareholder entitlement is granted.
-- Names are restricted to ttoir.ir; DNS and SMS are separate provisioning dependencies.
CREATE TABLE tto.commerce_demo_workspace_owners(
 order_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_orders(order_id),
 tenant_id uuid NOT NULL UNIQUE REFERENCES tto.tenants(tenant_id),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK (state='ACTIVE')
);
CREATE TABLE tto.commerce_demo_password_credentials(
 order_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_workspace_owners(order_id),
 username text NOT NULL UNIQUE CHECK(username ~ '^[a-z][a-z0-9._-]{4,63}$'),
 password_scrypt text CHECK(password_scrypt IS NULL OR password_scrypt ~ '^scrypt[$]v1[$][0-9a-f]{32}[$][0-9a-f]{128}$'),
 modified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.commerce_demo_otp_proofs(
 session_hash bytea PRIMARY KEY CHECK(octet_length(session_hash)=32),
 owner_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 expires_at timestamptz NOT NULL
);
CREATE TABLE tto.commerce_demo_password_sessions(
 session_hash bytea PRIMARY KEY CHECK(octet_length(session_hash)=32),
 owner_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE tto.commerce_demo_sms_outbox(
 order_id uuid PRIMARY KEY REFERENCES tto.commerce_demo_orders(order_id),
 phone text NOT NULL CHECK(phone ~ '^09[0-9]{9}$'),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','ACCEPTED','FAILED')),
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),
 last_attempt_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE tto.commerce_demo_workspace_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_workspace_owners FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_password_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_otp_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_otp_proofs FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_password_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_password_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_sms_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_sms_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_workspace_owners,tto.commerce_demo_password_credentials,
 tto.commerce_demo_otp_proofs,tto.commerce_demo_password_sessions,tto.commerce_demo_sms_outbox FROM PUBLIC,tto_app;

CREATE FUNCTION tto.provision_commerce_demo_workspace(p_order uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE o tto.commerce_demo_orders%ROWTYPE; v_tenant uuid; v_user text;
BEGIN
 SELECT * INTO o FROM tto.commerce_demo_orders WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR o.owner_id IS DISTINCT FROM tto.context_actor_id()
   OR o.status<>'DEMO_AMOUNT_ATTESTED' THEN
  RAISE EXCEPTION 'ORDER_OWNER_OR_DEMO_STATE_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT tenant_id INTO v_tenant FROM tto.commerce_demo_workspace_owners WHERE order_id=p_order;
 IF v_tenant IS NOT NULL THEN
  SELECT username INTO v_user FROM tto.commerce_demo_password_credentials WHERE order_id=p_order;
  RETURN jsonb_build_object('tenantId',v_tenant,'username',v_user,'replayed',true);
 END IF;
 -- Generic ACTIVE tenant, but NO official COOPERATIVE_MANAGER or MEMBER role is issued.
 -- Commercial ownership is represented by the separate, minimum-privilege table.
 v_tenant:=gen_random_uuid();
 INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES (v_tenant,o.slug,o.proposed_name,'ACTIVE');
 INSERT INTO tto.commerce_demo_workspace_owners(order_id,tenant_id,user_id)
 VALUES(o.order_id,v_tenant,o.owner_id);
 v_user:='mgr_'||o.slug;
 INSERT INTO tto.commerce_demo_password_credentials(order_id,username)
 VALUES(o.order_id,v_user);
 INSERT INTO tto.commerce_demo_sms_outbox(order_id,phone) VALUES(o.order_id,o.verified_mobile);
 RETURN jsonb_build_object('tenantId',v_tenant,'username',v_user,'replayed',false);
END $fn$;
REVOKE ALL ON FUNCTION tto.provision_commerce_demo_workspace(uuid) FROM PUBLIC;
-- It is called only from confirm_commerce_demo_order on behalf of the authenticated customer.
GRANT EXECUTE ON FUNCTION tto.provision_commerce_demo_workspace(uuid) TO tto_app;

CREATE OR REPLACE FUNCTION tto.confirm_commerce_demo_order(
 p_slug text,p_name text,p_plan text,p_amount bigint,p_mobile text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE v_actor uuid;v_plan tto.commerce_demo_plans%ROWTYPE;
 v_workspace uuid;v_order uuid;v_end timestamptz;v_setup jsonb;
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
 v_setup:=tto.provision_commerce_demo_workspace(v_order);
 RETURN jsonb_build_object('orderId',v_order,'slug',p_slug,'planCode',p_plan,
  'status','DEMO_AMOUNT_ATTESTED','expiresAt',v_end,
  'domain',p_slug||'.ttoir.ir','realPayment',false,'tenantActivated',true,
  'managerRoleGranted',false,'smsSent',false,'smsStatus','QUEUED',
  'username',v_setup->>'username','firstLoginOtpRequired',true,'dnsReady',false);
END $fn$;

CREATE FUNCTION tto.mark_commerce_demo_otp_proof(p_hash bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_actor uuid;
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 THEN RETURN false; END IF;
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM tto.resolve_session(p_hash) s WHERE s.user_id=v_actor)
 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.commerce_demo_workspace_owners w
   JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
   WHERE w.user_id=v_actor AND o.expires_at>now()) THEN RETURN false; END IF;
 INSERT INTO tto.commerce_demo_otp_proofs(session_hash,owner_id,expires_at)
 VALUES(p_hash,v_actor,clock_timestamp()+interval '10 minutes')
 ON CONFLICT(session_hash) DO UPDATE SET owner_id=EXCLUDED.owner_id,expires_at=EXCLUDED.expires_at;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION tto.mark_commerce_demo_otp_proof(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.mark_commerce_demo_otp_proof(bytea) TO tto_app;

CREATE FUNCTION tto.set_commerce_demo_credentials(p_slug text,p_username text,p_hash text,p_session_hash bytea)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_actor uuid;v_order uuid;
BEGIN
 v_actor:=tto.context_actor_id();
 IF v_actor IS NULL OR p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
  OR p_username IS NULL OR p_username !~ '^[a-z][a-z0-9._-]{4,63}$'
  OR p_hash IS NULL OR p_hash !~ '^scrypt[$]v1[$][0-9a-f]{32}[$][0-9a-f]{128}$'
  OR p_session_hash IS NULL OR octet_length(p_session_hash)<>32 THEN
  RAISE EXCEPTION 'INVALID_CREDENTIAL_SETUP' USING ERRCODE='22023';
 END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=v_actor AND o.slug=p_slug AND o.expires_at>now();
 IF v_order IS NULL OR NOT EXISTS(
   SELECT 1 FROM tto.commerce_demo_otp_proofs pr
   WHERE pr.session_hash=p_session_hash AND pr.owner_id=v_actor AND pr.expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'RECENT_OTP_REQUIRED' USING ERRCODE='42501'; END IF;
 UPDATE tto.commerce_demo_password_credentials
 SET username=p_username,password_scrypt=p_hash,modified_at=clock_timestamp() WHERE order_id=v_order;
 -- A proof may only establish one new password. Other sessions are revoked after reset.
 DELETE FROM tto.commerce_demo_otp_proofs WHERE session_hash=p_session_hash;
 UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=v_actor;
 UPDATE tto.user_sessions SET revoked_at=clock_timestamp() WHERE user_id=v_actor AND revoked_at IS NULL;
 RETURN jsonb_build_object('username',p_username,'slug',p_slug,'loginRequired',true);
END $fn$;
REVOKE ALL ON FUNCTION tto.set_commerce_demo_credentials(text,text,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.set_commerce_demo_credentials(text,text,text,bytea) TO tto_app;

CREATE FUNCTION tto.commerce_demo_password_lookup(p_username text)
 RETURNS TABLE(user_id uuid,slug text,password_scrypt text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT w.user_id,o.slug,c.password_scrypt
 FROM tto.commerce_demo_password_credentials c
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=c.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.user_accounts u ON u.user_id=w.user_id
 WHERE c.username=p_username AND c.password_scrypt IS NOT NULL
   AND u.status='ACTIVE' AND o.expires_at>now() LIMIT 1
 $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_password_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_password_lookup(text) TO tto_app;

CREATE FUNCTION tto.issue_commerce_demo_password_session(p_user uuid,p_hash bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE v_epoch bigint;v_sid uuid;
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 OR p_user IS NULL THEN RETURN false; END IF;
 SELECT a.security_epoch INTO v_epoch FROM tto.user_accounts a WHERE a.user_id=p_user AND a.status='ACTIVE';
 IF v_epoch IS NULL OR NOT EXISTS(
 SELECT 1 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_password_credentials c ON c.order_id=w.order_id
 WHERE w.user_id=p_user AND c.password_scrypt IS NOT NULL AND o.expires_at>now()
 ) THEN RETURN false; END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),p_user,p_hash,v_epoch,clock_timestamp()+interval '15 minutes')
 RETURNING session_id INTO v_sid;
 INSERT INTO tto.commerce_demo_password_sessions(session_hash,owner_id) VALUES(p_hash,p_user);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION tto.issue_commerce_demo_password_session(uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.issue_commerce_demo_password_session(uuid,bytea) TO tto_app;

CREATE FUNCTION tto.my_commerce_demo_workspace_details()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'slug',o.slug,'name',o.proposed_name,'username',c.username,
  'credentialsReady',c.password_scrypt IS NOT NULL,
  'loginUrl','https://' || o.slug || '.ttoir.ir/login',
  'smsStatus',sms.status,'tenantActive',t.status='ACTIVE',
  'roleGranted',false,'dnsReady',false
 ) ORDER BY o.confirmed_at DESC),'[]'::jsonb)
 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.tenants t ON t.tenant_id=w.tenant_id
 JOIN tto.commerce_demo_password_credentials c ON c.order_id=w.order_id
 JOIN tto.commerce_demo_sms_outbox sms ON sms.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND o.expires_at>now()
 $fn$;
REVOKE ALL ON FUNCTION tto.my_commerce_demo_workspace_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.my_commerce_demo_workspace_details() TO tto_app;

CREATE FUNCTION tto.commerce_demo_sms_payload(p_order uuid)
 RETURNS TABLE(mobile text,username text,slug text) LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $fn$
 SELECT sms.phone,c.username,o.slug FROM tto.commerce_demo_sms_outbox sms
 JOIN tto.commerce_demo_password_credentials c ON c.order_id=sms.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=sms.order_id
 WHERE sms.order_id=p_order AND sms.status IN ('QUEUED','FAILED')
 AND o.owner_id=tto.context_actor_id() AND sms.attempts<5
 $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_sms_payload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_sms_payload(uuid) TO tto_app;

CREATE FUNCTION tto.commerce_demo_sms_result(p_order uuid,p_accepted boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 UPDATE tto.commerce_demo_sms_outbox sms SET
  status=CASE WHEN p_accepted THEN 'ACCEPTED' ELSE 'FAILED' END,
  attempts=attempts+1,last_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
 FROM tto.commerce_demo_orders o
 WHERE sms.order_id=p_order AND o.order_id=sms.order_id
 AND o.owner_id=tto.context_actor_id() AND sms.status<>'ACCEPTED' AND sms.attempts<5;
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION tto.commerce_demo_sms_result(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_sms_result(uuid,boolean) TO tto_app;
