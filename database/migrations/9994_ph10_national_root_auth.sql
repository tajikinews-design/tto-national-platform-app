-- PH10 PREVIEW: A single independently authenticated national root principal.
-- No password or phone/mobile value is stored in the database or source.
-- The root login is enabled only when preview-scoped server secrets exist.
CREATE TABLE IF NOT EXISTS tto.national_root_accounts (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  user_id uuid NOT NULL UNIQUE REFERENCES tto.user_accounts(user_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS tto.national_root_auth_attempts (
  attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint bytea NOT NULL CHECK(octet_length(fingerprint)=32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS national_root_auth_attempts_recent
 ON tto.national_root_auth_attempts(fingerprint,created_at DESC);
ALTER TABLE tto.national_root_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.national_root_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.national_root_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.national_root_auth_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.national_root_accounts FROM PUBLIC;
REVOKE ALL ON tto.national_root_auth_attempts FROM PUBLIC;

CREATE OR REPLACE FUNCTION tto.reserve_national_root_attempt(p_key bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $$
BEGIN
 IF p_key IS NULL OR octet_length(p_key)<>32 THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_key,'hex'),0));
 IF (SELECT count(*) FROM tto.national_root_auth_attempts
     WHERE fingerprint=p_key
       AND created_at>clock_timestamp()-interval '15 minutes') >= 5
 THEN RETURN false; END IF;
 INSERT INTO tto.national_root_auth_attempts(fingerprint) VALUES(p_key);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION tto.issue_national_root_session(p_hash bytea)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $$
DECLARE v_user uuid; v_epoch bigint;
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 THEN RETURN false; END IF;
 SELECT r.user_id,a.security_epoch INTO v_user,v_epoch
 FROM tto.national_root_accounts r
 JOIN tto.user_accounts a ON a.user_id=r.user_id
 WHERE r.singleton=true AND r.revoked_at IS NULL AND a.status='ACTIVE'
 FOR UPDATE OF r;
 IF v_user IS NULL THEN RETURN false; END IF;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),v_user,p_hash,v_epoch,clock_timestamp()+interval '15 minutes');
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION tto.has_national_root()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $$
 SELECT EXISTS(
  SELECT 1 FROM tto.national_root_accounts r
   JOIN tto.user_accounts a ON a.user_id=r.user_id
  WHERE r.singleton AND r.revoked_at IS NULL
   AND a.status='ACTIVE' AND r.user_id=tto.context_actor_id()
 )
 $$;

-- Root is a separately defined owner-authorized account, NOT an artificial
-- independently-approved delegated operator authorization.
CREATE OR REPLACE FUNCTION tto.has_platform_operator()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $$
 SELECT COALESCE(
  tto.has_national_root() OR
  EXISTS(SELECT 1 FROM tto.platform_operator_authorizations o
   WHERE o.user_id=tto.context_actor_id()
     AND o.revoked_at IS NULL
     AND o.expires_at>now()
     AND o.approved_by<>o.user_id),false)
 $$;

REVOKE ALL ON FUNCTION tto.reserve_national_root_attempt(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.issue_national_root_session(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.has_national_root() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.reserve_national_root_attempt(bytea) TO tto_app;
GRANT EXECUTE ON FUNCTION tto.issue_national_root_session(bytea) TO tto_app;
GRANT EXECUTE ON FUNCTION tto.has_national_root() TO tto_app;
-- National root row deliberately NOT seeded in this migration:
-- no login can succeed until the explicitly approved Preview bootstrap.
