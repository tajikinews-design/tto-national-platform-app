-- PH12 P0 user-requested distinct USERNAME/PASSWORD sign-in surfaces (not SMS OTP).
-- Data may be real, so records MUST reside only in an approved isolated staging DB.
-- No self-signup, role/tenant creation, legal authority or share mutations here.
BEGIN;
CREATE TABLE tto.portal_password_credentials (
 credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 surface text NOT NULL CHECK(surface IN ('cooperative','shareholder')),
 username text NOT NULL CHECK(username ~ '^[a-z][a-z0-9._-]{4,63}$' AND username=lower(username)),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 password_scrypt text NOT NULL CHECK(password_scrypt ~ '^scrypt[$]v1[$][0-9a-f]{32}[$][0-9a-f]{128}$'),
 separately_verified_identity_reference text NOT NULL CHECK(length(separately_verified_identity_reference) BETWEEN 24 AND 350),
 independently_provisioned_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 valid_until timestamptz,
 revoked_at timestamptz,
 must_rotate boolean NOT NULL DEFAULT true,
 UNIQUE(surface,username),
 UNIQUE(surface,user_id,tenant_id),
 CHECK(independently_provisioned_by<>user_id)
);
CREATE TABLE tto.portal_password_session_bindings (
 session_id uuid PRIMARY KEY REFERENCES tto.user_sessions(session_id),
 surface text NOT NULL CHECK(surface IN ('cooperative','shareholder')),
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE tto.portal_password_session_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.portal_password_session_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.portal_password_session_bindings FROM PUBLIC,tto_app;
CREATE TABLE tto.portal_password_attempts(
 attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 fingerprint bytea NOT NULL CHECK(octet_length(fingerprint)=32),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX portal_password_attempts_lookup ON tto.portal_password_attempts(fingerprint,recorded_at DESC);
ALTER TABLE tto.portal_password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.portal_password_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.portal_password_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.portal_password_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tto.portal_password_credentials,tto.portal_password_attempts FROM PUBLIC,tto_app;
-- No browser actor, manager, member or platform login can provision, mutate or enumerate credentials.
CREATE FUNCTION tto.reserve_portal_password_attempt(p_fingerprint bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE attempts integer;
BEGIN
 IF octet_length(p_fingerprint)<>32 THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_fingerprint,'hex'),7));
 SELECT count(*) INTO attempts FROM tto.portal_password_attempts
 WHERE fingerprint=p_fingerprint AND recorded_at>clock_timestamp()-interval '15 minutes';
 IF attempts>=6 THEN RETURN false;END IF;
 INSERT INTO tto.portal_password_attempts(fingerprint) VALUES(p_fingerprint);
 RETURN true;
END $fn$;
CREATE FUNCTION tto.portal_password_credential_lookup(p_surface text,p_username text)
RETURNS TABLE(user_id uuid,tenant_id uuid,password_scrypt text,must_rotate boolean,workspace_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT c.user_id,c.tenant_id,c.password_scrypt,c.must_rotate,t.slug
 FROM tto.portal_password_credentials c
 JOIN tto.user_accounts u ON u.user_id=c.user_id AND u.status='ACTIVE'
 JOIN tto.tenants t ON t.tenant_id=c.tenant_id AND t.status='ACTIVE'
 JOIN tto.role_assignments role ON role.user_id=c.user_id AND role.tenant_id=c.tenant_id
   AND role.role_code=CASE p_surface WHEN 'cooperative' THEN 'COOPERATIVE_MANAGER'
                                    WHEN 'shareholder' THEN 'MEMBER' ELSE '-' END
   AND role.revoked_at IS NULL AND (role.expires_at IS NULL OR role.expires_at>now())
 WHERE c.surface=p_surface AND c.username=p_username AND c.revoked_at IS NULL
 AND (c.valid_until IS NULL OR c.valid_until>now())
 LIMIT 1
$fn$;
CREATE FUNCTION tto.issue_portal_password_session(p_surface text,p_username text,
 p_user uuid,p_tenant uuid,p_hash bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE ok boolean;new_session uuid;
BEGIN
 IF octet_length(p_hash)<>32 OR p_surface NOT IN ('cooperative','shareholder') THEN RETURN false;END IF;
 SELECT EXISTS(SELECT 1 FROM tto.portal_password_credential_lookup(p_surface,p_username) c
  WHERE c.user_id=p_user AND c.tenant_id=p_tenant AND c.must_rotate=false) INTO ok;
 IF NOT ok THEN RETURN false;END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 SELECT gen_random_uuid(),u.user_id,p_hash,u.security_epoch,clock_timestamp()+interval '15 minutes'
 FROM tto.user_accounts u WHERE u.user_id=p_user AND u.status='ACTIVE'
 RETURNING session_id INTO new_session;
 IF new_session IS NULL THEN RETURN false;END IF;
 INSERT INTO tto.portal_password_session_bindings(session_id,surface,user_id,tenant_id)
 VALUES(new_session,p_surface,p_user,p_tenant);
 RETURN true;
END $fn$;
CREATE FUNCTION tto.portal_password_session_identity(p_hash bytea,p_surface text)
RETURNS TABLE(user_id uuid,tenant_id uuid,slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT b.user_id,b.tenant_id,t.slug FROM tto.user_sessions sess
 JOIN tto.portal_password_session_bindings b ON b.session_id=sess.session_id
 JOIN tto.user_accounts u ON u.user_id=b.user_id AND u.status='ACTIVE'
 JOIN tto.tenants t ON t.tenant_id=b.tenant_id AND t.status='ACTIVE'
 JOIN tto.portal_password_credentials c ON c.user_id=b.user_id
  AND c.tenant_id=b.tenant_id AND c.surface=b.surface AND c.revoked_at IS NULL
 JOIN tto.role_assignments role ON role.user_id=b.user_id AND role.tenant_id=b.tenant_id
  AND role.role_code=CASE b.surface WHEN 'cooperative' THEN 'COOPERATIVE_MANAGER'
                                   WHEN 'shareholder' THEN 'MEMBER' ELSE '-' END
  AND role.revoked_at IS NULL AND (role.expires_at IS NULL OR role.expires_at>now())
 WHERE sess.session_hash=p_hash AND sess.user_id=b.user_id AND b.surface=p_surface
  AND sess.revoked_at IS NULL AND sess.expires_at>now()
  AND sess.security_epoch=u.security_epoch AND c.must_rotate=false
 LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION tto.reserve_portal_password_attempt(bytea),
 tto.portal_password_credential_lookup(text,text),
 tto.issue_portal_password_session(text,text,uuid,uuid,bytea),
 tto.portal_password_session_identity(bytea,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.reserve_portal_password_attempt(bytea),
 tto.portal_password_credential_lookup(text,text),
 tto.issue_portal_password_session(text,text,uuid,uuid,bytea),
 tto.portal_password_session_identity(bytea,text) TO tto_app;
COMMENT ON TABLE tto.portal_password_credentials IS
 'Independently provisioned, tenant-specific real-person sign-in. Never seed from a pending unverified cooperative notice. No direct app role table grants.';
COMMENT ON FUNCTION tto.issue_portal_password_session(text,text,uuid,uuid,bytea) IS
 'Issues a short tenant-scoped login session ONLY for separately validated ACTIVE tenant roles and rotated credentials; no grant or legal activation.';
COMMIT;
