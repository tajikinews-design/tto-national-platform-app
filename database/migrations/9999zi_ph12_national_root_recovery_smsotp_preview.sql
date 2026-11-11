-- PH12 national-root SMS recovery challenge. PREVIEW ONLY, not applied to Supabase.
-- Reuses API.ir delivery + existing server-owned SMSOTP delivery receipt table.
-- This path issues ONLY proof of mobile possession: NEVER a root session, member
-- identity, privileges, or permission to rotate a credential by itself.
CREATE TABLE IF NOT EXISTS tto.national_root_recovery_smsotp_challenges(
 challenge_id uuid PRIMARY KEY REFERENCES tto.auth_challenges(challenge_id),
 root_user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 root_credentials_version bigint NOT NULL CHECK(root_credentials_version>=0),
 recovery_nonce uuid NOT NULL,
 mobile_hmac bytea NOT NULL CHECK(octet_length(mobile_hmac)=32),
 national_id_hmac bytea NOT NULL CHECK(octet_length(national_id_hmac)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 verified_at timestamptz
);
CREATE INDEX IF NOT EXISTS ph12_national_root_recovery_smsotp_root_window
 ON tto.national_root_recovery_smsotp_challenges(root_user_id,created_at DESC);
ALTER TABLE tto.national_root_recovery_smsotp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.national_root_recovery_smsotp_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.national_root_recovery_smsotp_challenges FROM PUBLIC,tto_app;

CREATE OR REPLACE FUNCTION tto.begin_national_root_recovery_smsotp(
 p_root uuid,p_expected_version bigint,p_id uuid,p_nonce uuid,
 p_mobile_hmac bytea,p_national_hmac bytea,p_verifier bytea,p_expiry timestamptz)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE v_root uuid;
BEGIN
 IF p_root IS NULL OR p_id IS NULL OR p_nonce IS NULL
  OR p_expected_version IS NULL OR p_expected_version<0
  OR octet_length(p_mobile_hmac)<>32 OR octet_length(p_national_hmac)<>32
  OR octet_length(p_verifier)<>32
  OR p_expiry<=clock_timestamp() OR p_expiry>clock_timestamp()+interval '65 seconds'
  OR NOT EXISTS (SELECT 1 FROM tto.auth_policy
    WHERE policy_key='SESSION_CHALLENGE' AND max_attempts BETWEEN 1 AND 20)
 THEN RETURN false; END IF;
 -- All root recovery challenges serialized against root credential rotation.
 SELECT r.user_id INTO v_root
 FROM tto.national_root_accounts r
 JOIN tto.user_accounts a ON a.user_id=r.user_id
 WHERE r.singleton=true AND r.revoked_at IS NULL
   AND a.status='ACTIVE' AND r.user_id=p_root
   AND r.credentials_version=p_expected_version
 FOR UPDATE OF r;
 IF v_root IS NULL THEN RETURN false; END IF;
 -- No delivery unless challenge bound to current active root with nonce.
 IF (SELECT count(*) FROM tto.national_root_recovery_smsotp_challenges
     WHERE root_user_id=p_root AND created_at>clock_timestamp()-interval '15 minutes')>=3
 THEN RETURN false; END IF;
 INSERT INTO tto.auth_challenges
  (challenge_id,user_id,purpose,verifier_hash,expires_at)
 VALUES (p_id,p_root,'NATIONAL_ROOT_RECOVERY_SMSOTP',p_verifier,p_expiry);
 INSERT INTO tto.national_root_recovery_smsotp_challenges
  (challenge_id,root_user_id,root_credentials_version,recovery_nonce,mobile_hmac,national_id_hmac)
 VALUES(p_id,p_root,p_expected_version,p_nonce,p_mobile_hmac,p_national_hmac);
 INSERT INTO tto.smsotp_delivery_attempts(challenge_id,state)
 VALUES(p_id,'PENDING');
 RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION tto.consume_national_root_recovery_smsotp(
 p_id uuid,p_candidate bytea,p_mobile_hmac bytea,p_national_hmac bytea)
RETURNS TABLE(root_user_id uuid,root_credentials_version bigint,
 recovery_nonce uuid,verified_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $fn$
DECLARE v tto.auth_challenges%ROWTYPE; v_receipt tto.national_root_recovery_smsotp_challenges%ROWTYPE;
 v_limit integer;
BEGIN
 IF p_id IS NULL OR octet_length(p_candidate)<>32
    OR octet_length(p_mobile_hmac)<>32 OR octet_length(p_national_hmac)<>32
 THEN RETURN; END IF;
 SELECT max_attempts INTO v_limit FROM tto.auth_policy
  WHERE policy_key='SESSION_CHALLENGE';
 IF v_limit IS NULL OR v_limit<1 THEN RETURN; END IF;
 SELECT * INTO v FROM tto.auth_challenges
  WHERE challenge_id=p_id FOR UPDATE;
 IF NOT FOUND OR v.purpose<>'NATIONAL_ROOT_RECOVERY_SMSOTP'
  OR v.consumed_at IS NOT NULL OR v.expires_at<=clock_timestamp()
  OR v.attempt_count>=v_limit THEN RETURN; END IF;
 SELECT * INTO v_receipt FROM tto.national_root_recovery_smsotp_challenges
  WHERE challenge_id=p_id FOR UPDATE;
 IF NOT FOUND OR v_receipt.verified_at IS NOT NULL
  OR v.user_id IS DISTINCT FROM v_receipt.root_user_id THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM tto.smsotp_delivery_attempts
    WHERE challenge_id=p_id AND state='ACCEPTED') THEN RETURN; END IF;
 UPDATE tto.auth_challenges SET attempt_count=attempt_count+1 WHERE challenge_id=p_id;
 -- Wrong attempts commit the counter. Never disclose the correct data or OTP.
 IF v.verifier_hash<>p_candidate
  OR v_receipt.mobile_hmac<>p_mobile_hmac
  OR v_receipt.national_id_hmac<>p_national_hmac THEN RETURN; END IF;
 -- Fail if the root was changed or revoked while the SMS travelled.
 IF NOT EXISTS(SELECT 1 FROM tto.national_root_accounts r
  JOIN tto.user_accounts u ON u.user_id=r.user_id
  WHERE r.singleton=true AND r.revoked_at IS NULL
    AND u.status='ACTIVE' AND r.user_id=v_receipt.root_user_id
    AND r.credentials_version=v_receipt.root_credentials_version)
 THEN RETURN; END IF;
 UPDATE tto.auth_challenges SET consumed_at=clock_timestamp()
  WHERE challenge_id=p_id;
 UPDATE tto.national_root_recovery_smsotp_challenges
  SET verified_at=clock_timestamp() WHERE challenge_id=p_id
  RETURNING tto.national_root_recovery_smsotp_challenges.root_user_id,
    tto.national_root_recovery_smsotp_challenges.root_credentials_version,
    tto.national_root_recovery_smsotp_challenges.recovery_nonce,
    tto.national_root_recovery_smsotp_challenges.verified_at
  INTO root_user_id,root_credentials_version,recovery_nonce,verified_at;
 RETURN NEXT;
END $fn$;

REVOKE ALL ON FUNCTION
 tto.begin_national_root_recovery_smsotp(uuid,bigint,uuid,uuid,bytea,bytea,bytea,timestamptz),
 tto.consume_national_root_recovery_smsotp(uuid,bytea,bytea,bytea)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 tto.begin_national_root_recovery_smsotp(uuid,bigint,uuid,uuid,bytea,bytea,bytea,timestamptz),
 tto.consume_national_root_recovery_smsotp(uuid,bytea,bytea,bytea)
 TO tto_app;
