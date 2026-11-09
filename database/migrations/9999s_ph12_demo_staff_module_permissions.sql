-- Preview-only staff accounts and NAV permissions, independent of legal manager roles.
CREATE TABLE tto.commerce_demo_staff (
 staff_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES tto.commerce_demo_workspace_owners(order_id),
 user_id uuid NOT NULL UNIQUE REFERENCES tto.user_accounts(user_id),
 username text NOT NULL UNIQUE CHECK(username ~ '^staff_[a-z][a-z0-9._-]{4,58}$'),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 3 AND 120),
 password_scrypt text NOT NULL CHECK(password_scrypt ~ '^scrypt[$]v1[$][0-9a-f]{32}[$][0-9a-f]{128}$'),
 nav_permissions text[] NOT NULL DEFAULT '{NAV-01}'::text[],
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','DISABLED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(nav_permissions <@ ARRAY['NAV-01','NAV-02','NAV-03','NAV-04','NAV-05','NAV-06','NAV-07','NAV-08','NAV-09','NAV-10','NAV-11']::text[]),
 CHECK('NAV-01'=ANY(nav_permissions))
);
ALTER TABLE tto.commerce_demo_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_staff FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_staff FROM PUBLIC,tto_app;

CREATE FUNCTION tto.commerce_demo_team_list(p_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.staff_id,'username',s.username,
 'displayName',s.display_name,'permissions',s.nav_permissions,'state',s.state)
 ORDER BY s.created_at DESC),'[]'::jsonb)
 FROM tto.commerce_demo_staff s
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=s.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE'
 AND o.slug=p_slug AND o.expires_at>now()
$f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_team_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_team_list(text) TO tto_app;

CREATE FUNCTION tto.commerce_demo_team_create(p_slug text,p_username text,p_name text,
 p_hash text,p_permissions text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_order uuid; v_user uuid;v_staff uuid;
BEGIN
 IF p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' OR p_username !~ '^staff_[a-z][a-z0-9._-]{4,58}$'
 OR length(btrim(p_name)) NOT BETWEEN 3 AND 120
 OR p_hash !~ '^scrypt[$]v1[$][0-9a-f]{32}[$][0-9a-f]{128}$'
 OR p_permissions IS NULL OR cardinality(p_permissions)<1 OR cardinality(p_permissions)>11
 OR NOT p_permissions <@ ARRAY['NAV-01','NAV-02','NAV-03','NAV-04','NAV-05','NAV-06','NAV-07','NAV-08','NAV-09','NAV-10','NAV-11']::text[]
 OR NOT 'NAV-01'=ANY(p_permissions)
 OR (SELECT COUNT(DISTINCT x) FROM unnest(p_permissions) x)<>cardinality(p_permissions)
 THEN RAISE EXCEPTION 'INVALID_STAFF_INPUT' USING ERRCODE='22023'; END IF;
 SELECT w.order_id INTO v_order FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND w.state='ACTIVE' AND o.slug=p_slug AND o.expires_at>now() FOR UPDATE OF w;
 IF v_order IS NULL THEN RAISE EXCEPTION 'WORKSPACE_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM tto.commerce_demo_password_credentials WHERE username=p_username)
 THEN RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE='23505'; END IF;
 v_user:=gen_random_uuid();
 INSERT INTO tto.user_accounts(user_id,status) VALUES(v_user,'ACTIVE');
 INSERT INTO tto.commerce_demo_staff(order_id,user_id,username,display_name,password_scrypt,nav_permissions)
 VALUES(v_order,v_user,p_username,btrim(p_name),p_hash,p_permissions)
 RETURNING staff_id INTO v_staff;
 RETURN jsonb_build_object('id',v_staff,'username',p_username,'permissions',p_permissions,'state','ACTIVE');
END $f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_team_create(text,text,text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_team_create(text,text,text,text,text[]) TO tto_app;

CREATE FUNCTION tto.commerce_demo_team_update(p_slug text,p_id uuid,p_permissions text[],p_state text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_user uuid;
BEGIN
 IF p_state NOT IN ('ACTIVE','DISABLED') OR p_permissions IS NULL
 OR cardinality(p_permissions)<1 OR cardinality(p_permissions)>11
 OR NOT p_permissions <@ ARRAY['NAV-01','NAV-02','NAV-03','NAV-04','NAV-05','NAV-06','NAV-07','NAV-08','NAV-09','NAV-10','NAV-11']::text[]
 OR NOT 'NAV-01'=ANY(p_permissions)
 OR (SELECT COUNT(DISTINCT x) FROM unnest(p_permissions) x)<>cardinality(p_permissions)
 THEN RAISE EXCEPTION 'INVALID_STAFF_PERMISSIONS' USING ERRCODE='22023'; END IF;
 UPDATE tto.commerce_demo_staff s SET nav_permissions=p_permissions,state=p_state,updated_at=clock_timestamp()
 FROM tto.commerce_demo_workspace_owners w JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 WHERE s.order_id=w.order_id AND s.staff_id=p_id AND o.slug=p_slug
 AND w.user_id=tto.context_actor_id() AND w.state='ACTIVE' AND o.expires_at>now()
 RETURNING s.user_id INTO v_user;
 IF v_user IS NULL THEN RETURN false; END IF;
 UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=v_user;
 UPDATE tto.user_sessions SET revoked_at=clock_timestamp() WHERE user_id=v_user AND revoked_at IS NULL;
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_team_update(text,uuid,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_team_update(text,uuid,text[],text) TO tto_app;

CREATE OR REPLACE FUNCTION tto.commerce_demo_password_lookup(p_username text)
 RETURNS TABLE(user_id uuid,slug text,password_scrypt text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT w.user_id,o.slug,c.password_scrypt
 FROM tto.commerce_demo_password_credentials c
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=c.order_id
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.user_accounts u ON u.user_id=w.user_id
 WHERE c.username=p_username AND c.password_scrypt IS NOT NULL AND u.status='ACTIVE' AND o.expires_at>now()
 UNION ALL
 SELECT s.user_id,o.slug,s.password_scrypt
 FROM tto.commerce_demo_staff s
 JOIN tto.commerce_demo_orders o ON o.order_id=s.order_id
 JOIN tto.user_accounts u ON u.user_id=s.user_id
 WHERE s.username=p_username AND s.state='ACTIVE' AND u.status='ACTIVE' AND o.expires_at>now()
 LIMIT 1
$f$;

CREATE OR REPLACE FUNCTION tto.issue_commerce_demo_password_session(p_user uuid,p_hash bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
DECLARE v_epoch bigint;
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 OR p_user IS NULL THEN RETURN false; END IF;
 SELECT security_epoch INTO v_epoch FROM tto.user_accounts WHERE user_id=p_user AND status='ACTIVE';
 IF v_epoch IS NULL OR NOT (
 EXISTS(SELECT 1 FROM tto.commerce_demo_workspace_owners w
 JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.commerce_demo_password_credentials c ON c.order_id=w.order_id
 WHERE w.user_id=p_user AND c.password_scrypt IS NOT NULL AND o.expires_at>now())
 OR EXISTS(SELECT 1 FROM tto.commerce_demo_staff s JOIN tto.commerce_demo_orders o ON o.order_id=s.order_id
 WHERE s.user_id=p_user AND s.state='ACTIVE' AND o.expires_at>now())
 ) THEN RETURN false; END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),p_user,p_hash,v_epoch,clock_timestamp()+interval '15 minutes');
 INSERT INTO tto.commerce_demo_password_sessions(session_hash,owner_id) VALUES(p_hash,p_user);
 RETURN true;
END $f$;

CREATE OR REPLACE FUNCTION tto.my_commerce_demo_workspace_details()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(jsonb_agg(item ORDER BY item->>'slug'),'[]'::jsonb) FROM (
 SELECT jsonb_build_object('slug',o.slug,'name',o.proposed_name,'username',c.username,
 'credentialsReady',c.password_scrypt IS NOT NULL,'loginUrl','https://'||o.slug||'.ttoir.ir/login',
 'tenantActive',t.status='ACTIVE','roleGranted',false,'dnsReady',false,'staff',false,
 'permissions',ARRAY['NAV-01','NAV-02','NAV-03','NAV-04','NAV-05','NAV-06','NAV-07','NAV-08','NAV-09','NAV-10','NAV-11']) item
 FROM tto.commerce_demo_workspace_owners w JOIN tto.commerce_demo_orders o ON o.order_id=w.order_id
 JOIN tto.tenants t ON t.tenant_id=w.tenant_id JOIN tto.commerce_demo_password_credentials c ON c.order_id=w.order_id
 WHERE w.user_id=tto.context_actor_id() AND o.expires_at>now()
 UNION ALL
 SELECT jsonb_build_object('slug',o.slug,'name',o.proposed_name,'username',s.username,
 'credentialsReady',true,'loginUrl','https://'||o.slug||'.ttoir.ir/login',
 'tenantActive',t.status='ACTIVE','roleGranted',false,'dnsReady',false,'staff',true,
 'permissions',s.nav_permissions) item
 FROM tto.commerce_demo_staff s JOIN tto.commerce_demo_orders o ON o.order_id=s.order_id
 JOIN tto.commerce_demo_workspace_owners w ON w.order_id=s.order_id
 JOIN tto.tenants t ON t.tenant_id=w.tenant_id
 WHERE s.user_id=tto.context_actor_id() AND s.state='ACTIVE' AND o.expires_at>now()
 ) rows
$f$;
REVOKE ALL ON FUNCTION tto.commerce_demo_password_lookup(text),
 tto.issue_commerce_demo_password_session(uuid,bytea),tto.my_commerce_demo_workspace_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.commerce_demo_password_lookup(text),
 tto.issue_commerce_demo_password_session(uuid,bytea),tto.my_commerce_demo_workspace_details() TO tto_app;
