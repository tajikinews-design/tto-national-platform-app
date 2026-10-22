-- CF-01 SMSOTP bridge: verified identifier only, bounded request creation, delivery attestation.
-- PostgreSQL 17; additive. RUN IN EPHEMERAL TEST DB ONLY before full security/legal approval.
BEGIN;
ALTER TABLE tto.auth_challenges ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE TABLE tto.verified_mobile_identifiers (
  mobile text PRIMARY KEY CHECK (mobile ~ '^09[0-9]{9}$'),
  user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX verified_mobile_user ON tto.verified_mobile_identifiers(user_id);
CREATE TABLE tto.smsotp_delivery_attempts(
  challenge_id uuid PRIMARY KEY REFERENCES tto.auth_challenges(challenge_id),
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','ACCEPTED','FAILED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz
);
REVOKE ALL ON tto.verified_mobile_identifiers,tto.smsotp_delivery_attempts FROM PUBLIC,tto_app;
ALTER TABLE tto.verified_mobile_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.verified_mobile_identifiers FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.smsotp_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.smsotp_delivery_attempts FORCE ROW LEVEL SECURITY;

-- A verified mobile MUST already be bound to an active user via an independent enrollment.
-- Generic HTTP reply is identical for known/unknown numbers. Prevent >3 attempts/15m.
CREATE FUNCTION tto.begin_smsotp_login(p_mobile text,p_id uuid,p_hash bytea,p_expiry timestamptz)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE owner uuid;
BEGIN
 IF p_mobile IS NULL OR p_mobile !~ '^09[0-9]{9}$'
  OR octet_length(p_hash)<>32
  OR p_expiry<=clock_timestamp() OR p_expiry>clock_timestamp()+interval '5 minutes'
  OR NOT EXISTS (SELECT 1 FROM tto.auth_policy WHERE policy_key='SESSION_CHALLENGE')
 THEN RETURN false; END IF;
 -- Serialize concurrent challenges for the same mobile to enforce request limit.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mobile,0));
 SELECT v.user_id INTO owner FROM tto.verified_mobile_identifiers v
 JOIN tto.user_accounts a ON a.user_id=v.user_id
 WHERE v.mobile=p_mobile AND v.revoked_at IS NULL AND a.status='ACTIVE';
 IF owner IS NULL THEN RETURN false; END IF;
 IF (SELECT count(*) FROM tto.auth_challenges
     WHERE user_id=owner AND purpose='SMSOTP_LOGIN'
       AND created_at>clock_timestamp()-interval '15 minutes')>=3
 THEN RETURN false; END IF;
 INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at)
 VALUES (p_id,owner,'SMSOTP_LOGIN',p_hash,p_expiry);
 INSERT INTO tto.smsotp_delivery_attempts(challenge_id,state) VALUES(p_id,'PENDING');
 RETURN true;
END $fn$;

CREATE FUNCTION tto.complete_smsotp_delivery(p_id uuid,p_accepted boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
DECLARE changed integer;
BEGIN
 UPDATE tto.smsotp_delivery_attempts SET
  state=CASE WHEN p_accepted THEN 'ACCEPTED' ELSE 'FAILED' END,
  finished_at=clock_timestamp()
 WHERE challenge_id=p_id AND state='PENDING';
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $fn$;

-- Preserve historical non-SMS LOGIN contract but fail closed for unconfirmed SMSOTP_LOGIN.
CREATE OR REPLACE FUNCTION tto.consume_challenge(p_challenge uuid,p_candidate bytea,p_session_hash bytea)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE r tto.auth_challenges%ROWTYPE; max_attempts integer; ttl integer; epoch bigint; active text;
 BEGIN
 SELECT p.max_attempts,p.session_ttl_minutes INTO max_attempts,ttl FROM tto.auth_policy p
 WHERE p.policy_key='SESSION_CHALLENGE';
 IF max_attempts IS NULL OR octet_length(p_candidate)<>32 OR octet_length(p_session_hash)<>32 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM tto.auth_challenges WHERE challenge_id=p_challenge FOR UPDATE;
 IF NOT FOUND OR r.consumed_at IS NOT NULL OR r.expires_at<=clock_timestamp()
   OR r.attempt_count>=max_attempts OR r.user_id IS NULL THEN RETURN NULL; END IF;
 IF r.purpose='SMSOTP_LOGIN' AND NOT EXISTS (
    SELECT 1 FROM tto.smsotp_delivery_attempts d
    WHERE d.challenge_id=r.challenge_id AND d.state='ACCEPTED'
 ) THEN RETURN NULL; END IF;
 UPDATE tto.auth_challenges SET attempt_count=attempt_count+1 WHERE challenge_id=p_challenge;
 IF r.verifier_hash<>p_candidate THEN RETURN NULL; END IF;
 SELECT security_epoch,status INTO epoch,active FROM tto.user_accounts WHERE user_id=r.user_id FOR UPDATE;
 IF active IS DISTINCT FROM 'ACTIVE' THEN RETURN NULL; END IF;
 UPDATE tto.auth_challenges SET consumed_at=clock_timestamp() WHERE challenge_id=p_challenge;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),r.user_id,p_session_hash,epoch,clock_timestamp()+make_interval(mins=>ttl));
 RETURN r.user_id;
 END $fn$;
REVOKE ALL ON FUNCTION tto.begin_smsotp_login(text,uuid,bytea,timestamptz),
  tto.complete_smsotp_delivery(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.begin_smsotp_login(text,uuid,bytea,timestamptz),
 tto.complete_smsotp_delivery(uuid,boolean),tto.consume_challenge(uuid,bytea,bytea)
 TO tto_app;
COMMIT;
