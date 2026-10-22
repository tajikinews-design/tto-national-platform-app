-- CF-01 anonymous pre-enrollment OTP throttling, 2026-10-22.
-- Disposable PostgreSQL17 first. Never store raw IP, raw unknown mobile or browser fingerprints.
BEGIN;
CREATE TABLE tto.otp_request_throttle_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_digest bytea NOT NULL CHECK (octet_length(ip_digest) = 32),
  mobile_digest bytea NOT NULL CHECK (octet_length(mobile_digest) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX otp_public_ip_window ON tto.otp_request_throttle_events (ip_digest, created_at DESC);
CREATE INDEX otp_public_mobile_window ON tto.otp_request_throttle_events (mobile_digest, created_at DESC);
CREATE INDEX otp_public_event_retention ON tto.otp_request_throttle_events (created_at);
REVOKE ALL ON tto.otp_request_throttle_events FROM PUBLIC, tto_app;
REVOKE ALL ON SEQUENCE tto.otp_request_throttle_events_event_id_seq FROM PUBLIC, tto_app;
ALTER TABLE tto.otp_request_throttle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.otp_request_throttle_events FORCE ROW LEVEL SECURITY;

-- Called for all syntactically valid mobile requests, known or unknown.
-- Count attempts (not just delivered SMS); lock digest scopes before counting to prevent parallel bypass.
-- Fixed baseline thresholds until Rule Registry overrides are approved: 30/IP/15m and 3/mobile/15m.
-- SECURITY DEFINER is required ONLY for this narrowly granted operation; the event table is never API-readable.
CREATE FUNCTION tto.reserve_public_otp_request(p_ip_key bytea,p_mobile_key bytea)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE cutoff timestamptz;
BEGIN
  IF p_ip_key IS NULL OR p_mobile_key IS NULL OR
     octet_length(p_ip_key)<>32 OR octet_length(p_mobile_key)<>32 THEN
    RETURN false;
  END IF;
  -- Different domain tags prevent accidental cross-kind lock collisions.
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_ip_key,'hex'),991));
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(p_mobile_key,'hex'),992));
  cutoff:=clock_timestamp()-interval '15 minutes';
  IF (SELECT count(*) FROM tto.otp_request_throttle_events
      WHERE ip_digest=p_ip_key AND created_at>cutoff)>=30 THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM tto.otp_request_throttle_events
      WHERE mobile_digest=p_mobile_key AND created_at>cutoff)>=3 THEN
    RETURN false;
  END IF;
  INSERT INTO tto.otp_request_throttle_events(ip_digest,mobile_digest)
  VALUES (p_ip_key,p_mobile_key);
  RETURN true;
END $fn$;

-- Explicit limited housekeeping function; schedule it only with approved Preview/Production lifecycle.
CREATE FUNCTION tto.purge_expired_otp_request_events()
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE deleted bigint;
BEGIN
  DELETE FROM tto.otp_request_throttle_events
  WHERE created_at < clock_timestamp()-interval '24 hours';
  GET DIAGNOSTICS deleted=ROW_COUNT;
  RETURN deleted;
END $fn$;

REVOKE ALL ON FUNCTION tto.reserve_public_otp_request(bytea,bytea),
  tto.purge_expired_otp_request_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.reserve_public_otp_request(bytea,bytea) TO tto_app;
-- Deliberately NO GRANT of purge to the runtime role: maintenance-owner job only.
COMMIT;
