-- Rate limiting commercial password login independently from statutory portal credentials.
CREATE TABLE tto.commerce_demo_login_attempts(
 attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 fingerprint bytea NOT NULL CHECK (octet_length(fingerprint)=32),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX commerce_demo_login_attempts_recent ON tto.commerce_demo_login_attempts(fingerprint,occurred_at DESC);
ALTER TABLE tto.commerce_demo_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.commerce_demo_login_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.commerce_demo_login_attempts FROM PUBLIC,tto_app;
CREATE FUNCTION tto.reserve_commerce_demo_login_attempt(p_hash bytea)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
BEGIN
 IF p_hash IS NULL OR octet_length(p_hash)<>32 THEN RETURN false;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_hash,'hex'),101));
 IF (SELECT count(*) FROM tto.commerce_demo_login_attempts
     WHERE fingerprint=p_hash AND occurred_at>clock_timestamp()-interval '15 minutes')>=5
 THEN RETURN false;END IF;
 INSERT INTO tto.commerce_demo_login_attempts(fingerprint) VALUES(p_hash);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION tto.reserve_commerce_demo_login_attempt(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.reserve_commerce_demo_login_attempt(bytea) TO tto_app;
