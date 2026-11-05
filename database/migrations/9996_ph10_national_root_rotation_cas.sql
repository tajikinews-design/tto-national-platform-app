-- PH10 preview hardening: ensure stale concurrent sessions cannot overwrite new
-- national root credentials after a successful first-login rotation.
CREATE OR REPLACE FUNCTION tto.rotate_national_root_credentials(
 p_username text,p_password_scrypt text,p_expected_version bigint,p_session_hash bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
DECLARE v_user uuid;v_old_username text;v_version bigint;v_changed integer;
BEGIN
 IF p_session_hash IS NULL OR octet_length(p_session_hash)<>32
  OR p_expected_version IS NULL
  OR p_username IS NULL OR p_username !~ '^[A-Za-z0-9._-]{5,64}$'
  OR p_password_scrypt IS NULL
  OR p_password_scrypt !~ '^scrypt[$]v1[$][a-f0-9]{32}[$][a-f0-9]{128}$'
 THEN RETURN false; END IF;

 SELECT r.user_id,r.username,r.credentials_version
 INTO v_user,v_old_username,v_version
 FROM tto.national_root_accounts r
 JOIN tto.user_accounts a ON a.user_id=r.user_id
 WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
 FOR UPDATE OF r;

 -- Version check is inside the same row lock, so parallel rotations serialize.
 IF v_user IS NULL OR v_version<>p_expected_version
  OR v_old_username=p_username OR v_user IS DISTINCT FROM tto.context_actor_id()
 THEN RETURN false; END IF;
 -- The original session MUST still be current after obtaining the lock.
 IF NOT EXISTS(SELECT 1 FROM tto.resolve_session(p_session_hash) s WHERE s.user_id=v_user)
 THEN RETURN false; END IF;

 UPDATE tto.national_root_accounts SET
   username=p_username,password_scrypt=p_password_scrypt,
   must_change_credentials=false,credentials_changed_at=clock_timestamp(),
   credentials_version=credentials_version+1
 WHERE singleton=true AND user_id=v_user AND revoked_at IS NULL
   AND credentials_version=p_expected_version;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RETURN false; END IF;
 UPDATE tto.user_accounts SET security_epoch=security_epoch+1 WHERE user_id=v_user;
 UPDATE tto.user_sessions SET revoked_at=clock_timestamp()
 WHERE user_id=v_user AND revoked_at IS NULL;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION tto.rotate_national_root_credentials(text,text,bigint,bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION tto.rotate_national_root_credentials(text,text) FROM tto_app;
GRANT EXECUTE ON FUNCTION tto.rotate_national_root_credentials(text,text,bigint,bytea) TO tto_app;
