-- PH10 Preview: OTP registration for NEW mobile identities.
-- No operator authorization is created by this migration.
-- Existing SMSOTP_LOGIN and session verification stay unchanged.
CREATE TABLE IF NOT EXISTS tto.mobile_registration_challenges (
 challenge_id uuid PRIMARY KEY REFERENCES tto.auth_challenges(challenge_id) ON DELETE CASCADE,
 mobile text NOT NULL CHECK (mobile ~ '^09[0-9]{9}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS mobile_registration_challenges_mobile_created_idx
 ON tto.mobile_registration_challenges(mobile,created_at DESC);
ALTER TABLE tto.mobile_registration_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.mobile_registration_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.mobile_registration_challenges FROM PUBLIC;

CREATE OR REPLACE FUNCTION tto.begin_mobile_registration(
 p_mobile text,p_id uuid,p_hash bytea,p_expiry timestamptz)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
DECLARE policy_enabled boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM tto.auth_policy
  WHERE policy_key='SESSION_CHALLENGE') INTO policy_enabled;
 IF p_mobile IS NULL OR p_mobile !~ '^09[0-9]{9}$'
  OR p_id IS NULL OR octet_length(p_hash)<>32
  OR p_expiry<=clock_timestamp()
  OR p_expiry>clock_timestamp()+interval '5 minutes'
  OR NOT policy_enabled THEN RETURN false; END IF;

 -- Serialize first-use challenges and avoid parallel abuse or duplicate enrollment.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_mobile,0));
 IF EXISTS(SELECT 1 FROM tto.verified_mobile_identifiers
   WHERE mobile=p_mobile) THEN RETURN false; END IF;
 IF (SELECT count(*) FROM tto.mobile_registration_challenges
     WHERE mobile=p_mobile AND created_at>clock_timestamp()-interval '15 minutes')>=3
 THEN RETURN false; END IF;

 INSERT INTO tto.auth_challenges
  (challenge_id,user_id,purpose,verifier_hash,expires_at)
 VALUES (p_id,NULL,'SMSOTP_REGISTER',p_hash,p_expiry);
 INSERT INTO tto.mobile_registration_challenges(challenge_id,mobile)
 VALUES(p_id,p_mobile);
 INSERT INTO tto.smsotp_delivery_attempts(challenge_id,state)
 VALUES(p_id,'PENDING');
 RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION tto.consume_mobile_registration(
 p_challenge uuid,p_candidate bytea,p_session_hash bytea)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO pg_catalog,tto AS $fn$
DECLARE challenge tto.auth_challenges%ROWTYPE;
 v_mobile text; v_max_attempts integer; v_session_ttl integer; v_user uuid;
BEGIN
 SELECT p.max_attempts,p.session_ttl_minutes
 INTO v_max_attempts,v_session_ttl
 FROM tto.auth_policy p WHERE p.policy_key='SESSION_CHALLENGE';
 IF p_challenge IS NULL OR octet_length(p_candidate)<>32
  OR octet_length(p_session_hash)<>32
  OR v_max_attempts IS NULL OR v_session_ttl IS NULL
 THEN RETURN NULL; END IF;

 SELECT * INTO challenge FROM tto.auth_challenges
  WHERE challenge_id=p_challenge FOR UPDATE;
 IF NOT FOUND OR challenge.purpose<>'SMSOTP_REGISTER'
  OR challenge.user_id IS NOT NULL OR challenge.consumed_at IS NOT NULL
  OR challenge.expires_at<=clock_timestamp()
  OR challenge.attempt_count>=v_max_attempts
 THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.smsotp_delivery_attempts
  WHERE challenge_id=p_challenge AND state='ACCEPTED')
 THEN RETURN NULL; END IF;
 UPDATE tto.auth_challenges SET attempt_count=attempt_count+1
  WHERE challenge_id=p_challenge;
 IF challenge.verifier_hash<>p_candidate THEN RETURN NULL; END IF;
 SELECT mobile INTO v_mobile FROM tto.mobile_registration_challenges
  WHERE challenge_id=p_challenge;
 IF v_mobile IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_mobile,0));
 -- A mobile that was registered in a competing transaction is NEVER rebound.
 IF EXISTS(SELECT 1 FROM tto.verified_mobile_identifiers WHERE mobile=v_mobile)
 THEN RETURN NULL; END IF;

 v_user:=gen_random_uuid();
 INSERT INTO tto.user_accounts(user_id,status) VALUES(v_user,'ACTIVE');
 INSERT INTO tto.verified_mobile_identifiers(mobile,user_id,verified_at)
 VALUES(v_mobile,v_user,clock_timestamp());
 UPDATE tto.auth_challenges SET
  user_id=v_user,consumed_at=clock_timestamp()
 WHERE challenge_id=p_challenge;
 INSERT INTO tto.user_sessions
  (session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),v_user,p_session_hash,0,
  clock_timestamp()+make_interval(mins=>v_session_ttl));
 RETURN v_user;
END $fn$;

REVOKE ALL ON FUNCTION tto.begin_mobile_registration(text,uuid,bytea,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.consume_mobile_registration(uuid,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.begin_mobile_registration(text,uuid,bytea,timestamptz) TO tto_app;
GRANT EXECUTE ON FUNCTION tto.consume_mobile_registration(uuid,bytea,bytea) TO tto_app;
