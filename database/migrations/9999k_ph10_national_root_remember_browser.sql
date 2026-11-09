-- PH10 isolated Preview: optionally remember national administrator browser for 7 days.
-- The cookie holds only a random bearer token, and PostgreSQL stores only its SHA-256 digest.
-- Never accept an unbounded client TTL. Default remains 15 minutes.
-- Revocation, account deactivation, credential rotation and security_epoch still invalidate it.
CREATE FUNCTION tto.issue_national_root_session(
 p_hash bytea,p_version bigint,p_remember_device boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,tto AS $fn$
DECLARE v_user uuid;v_epoch bigint;v_version bigint;v_changed boolean;v_password_ready boolean;
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 OR p_version IS NULL
    OR p_remember_device IS NULL THEN RETURN false; END IF;
 SELECT r.user_id,a.security_epoch,r.credentials_version,
        r.must_change_credentials,(r.password_scrypt IS NOT NULL)
 INTO v_user,v_epoch,v_version,v_changed,v_password_ready
 FROM tto.national_root_accounts r
 JOIN tto.user_accounts a ON a.user_id=r.user_id
 WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
 FOR UPDATE OF r;
 IF v_user IS NULL OR v_version<>p_version THEN RETURN false; END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),v_user,p_hash,v_epoch,
  clock_timestamp()+CASE WHEN p_remember_device IS TRUE AND v_changed IS FALSE
                         AND v_password_ready IS TRUE
    THEN interval '7 days' ELSE interval '15 minutes' END);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION tto.issue_national_root_session(bytea,bigint,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.issue_national_root_session(bytea,bigint,boolean) TO tto_app;
COMMENT ON FUNCTION tto.issue_national_root_session(bytea,bigint,boolean)
 IS 'Opt-in remembered national root Preview session, maximum seven days, only after mandatory credential rotation. Existing revocation and epoch controls remain.';
