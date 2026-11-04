-- PH10 national root: credentials MUST be rotated after first successful sign-in.
-- The initial login is configured only via protected Preview environment variables.
-- A rotated credential replaces the initial login; both user and password must change.
-- No privileged account is created by this migration.
ALTER TABLE tto.national_root_accounts
 ADD COLUMN IF NOT EXISTS username text,
 ADD COLUMN IF NOT EXISTS password_scrypt text,
 ADD COLUMN IF NOT EXISTS must_change_credentials boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS credentials_changed_at timestamptz;
ALTER TABLE tto.national_root_accounts
 ADD CONSTRAINT national_root_username_format
 CHECK(username IS NULL OR (length(username) BETWEEN 5 AND 64 AND username ~ '^[A-Za-z0-9._-]+$'));
ALTER TABLE tto.national_root_accounts
 ADD CONSTRAINT national_root_credentials_pair
 CHECK ((username IS NULL AND password_scrypt IS NULL)
     OR (username IS NOT NULL AND password_scrypt IS NOT NULL));
ALTER TABLE tto.national_root_accounts
 ADD CONSTRAINT national_root_scrypt_format
 CHECK(password_scrypt IS NULL OR password_scrypt ~ '^scrypt[$]v1[$][a-f0-9]{32}[$][a-f0-9]{128}$');

-- Only the TTO backend database role may retrieve server-side password verification data.
CREATE OR REPLACE FUNCTION tto.national_root_credential_state()
 RETURNS TABLE(username text,password_scrypt text,must_change_credentials boolean)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
 SELECT r.username,r.password_scrypt,r.must_change_credentials
 FROM tto.national_root_accounts r
 JOIN tto.user_accounts a ON a.user_id=r.user_id
 WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
 LIMIT 1
 $fn$;

CREATE OR REPLACE FUNCTION tto.is_national_root_principal()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
 SELECT EXISTS(SELECT 1 FROM tto.national_root_accounts r
   JOIN tto.user_accounts a ON a.user_id=r.user_id
   WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
    AND r.user_id=tto.context_actor_id())
 $fn$;

-- Before rotation, the first-login session is intentionally not an authorized manager.
CREATE OR REPLACE FUNCTION tto.has_national_root()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
 SELECT EXISTS(SELECT 1 FROM tto.national_root_accounts r
   JOIN tto.user_accounts a ON a.user_id=r.user_id
   WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
    AND r.user_id=tto.context_actor_id() AND NOT r.must_change_credentials)
 $fn$;

CREATE OR REPLACE FUNCTION tto.national_root_requires_change()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
 SELECT EXISTS(SELECT 1 FROM tto.national_root_accounts r
   JOIN tto.user_accounts a ON a.user_id=r.user_id
   WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
    AND r.user_id=tto.context_actor_id() AND r.must_change_credentials)
 $fn$;

-- Atomic username+password rotation. A single change invalidates ALL root sessions.
CREATE OR REPLACE FUNCTION tto.rotate_national_root_credentials(
 p_username text,p_password_scrypt text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
DECLARE v_user uuid; v_old_username text; v_changed integer;
BEGIN
 IF NOT tto.is_national_root_principal()
   OR p_username IS NULL OR p_username !~ '^[A-Za-z0-9._-]{5,64}$'
   OR p_password_scrypt IS NULL
   OR p_password_scrypt !~ '^scrypt[$]v1[$][a-f0-9]{32}[$][a-f0-9]{128}$'
 THEN RETURN false; END IF;
 SELECT r.user_id,r.username INTO v_user,v_old_username
 FROM tto.national_root_accounts r
 WHERE r.singleton=true AND r.revoked_at IS NULL FOR UPDATE;
 IF v_user IS NULL OR (v_old_username IS NOT NULL AND v_old_username=p_username)
 THEN RETURN false; END IF;
 UPDATE tto.national_root_accounts SET username=p_username,
  password_scrypt=p_password_scrypt,
  must_change_credentials=false,
  credentials_changed_at=clock_timestamp()
 WHERE singleton=true AND user_id=v_user AND revoked_at IS NULL;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RETURN false; END IF;
 UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=v_user;
 UPDATE tto.user_sessions SET revoked_at=clock_timestamp()
  WHERE user_id=v_user AND revoked_at IS NULL;
 RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION tto.national_root_credential_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.is_national_root_principal() FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.national_root_requires_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.rotate_national_root_credentials(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.national_root_credential_state() TO tto_app;
GRANT EXECUTE ON FUNCTION tto.is_national_root_principal() TO tto_app;
GRANT EXECUTE ON FUNCTION tto.national_root_requires_change() TO tto_app;
GRANT EXECUTE ON FUNCTION tto.rotate_national_root_credentials(text,text) TO tto_app;
