-- PH04: real session-bound fresh SMS verification for sensitive-role step-up.
-- No new share/payment functionality; only ephemeral PG17 CI until release gates.
BEGIN;
ALTER TABLE tto.user_sessions
 ADD COLUMN step_up_verified_at timestamptz,
 ADD COLUMN step_up_expires_at timestamptz;
ALTER TABLE tto.user_sessions
 ADD CONSTRAINT session_stepup_temporal_check CHECK (
  (step_up_verified_at IS NULL AND step_up_expires_at IS NULL) OR
  (step_up_verified_at IS NOT NULL AND step_up_expires_at IS NOT NULL
   AND step_up_expires_at>step_up_verified_at)
 );
-- Normal OTP login MUST NOT accept a STEP_UP code as a new bearer session;
-- new sessions inherit the current authorization epoch to prevent stale tokens.
CREATE OR REPLACE FUNCTION tto.consume_challenge(p_challenge uuid,p_candidate bytea,p_session_hash bytea)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $login$
 DECLARE r tto.auth_challenges%ROWTYPE; max_attempts integer; ttl integer;
   epoch bigint; auth_epoch bigint; active text;
 BEGIN
  SELECT p.max_attempts,p.session_ttl_minutes INTO max_attempts,ttl
   FROM tto.auth_policy p WHERE p.policy_key='SESSION_CHALLENGE';
  IF max_attempts IS NULL OR octet_length(p_candidate)<>32
   OR octet_length(p_session_hash)<>32 THEN RETURN NULL; END IF;
  SELECT * INTO r FROM tto.auth_challenges WHERE challenge_id=p_challenge FOR UPDATE;
  IF NOT FOUND OR r.purpose NOT IN('LOGIN','SMSOTP_LOGIN')
   OR r.consumed_at IS NOT NULL OR r.expires_at<=clock_timestamp()
   OR r.attempt_count>=max_attempts OR r.user_id IS NULL THEN RETURN NULL;END IF;
  IF r.purpose='SMSOTP_LOGIN' AND NOT EXISTS
   (SELECT 1 FROM tto.smsotp_delivery_attempts d
    WHERE d.challenge_id=r.challenge_id AND d.state='ACCEPTED') THEN RETURN NULL;END IF;
  UPDATE tto.auth_challenges SET attempt_count=attempt_count+1 WHERE challenge_id=p_challenge;
  IF r.verifier_hash<>p_candidate THEN RETURN NULL;END IF;
  SELECT security_epoch,authorization_epoch,status INTO epoch,auth_epoch,active
   FROM tto.user_accounts WHERE user_id=r.user_id FOR UPDATE;
  IF active IS DISTINCT FROM 'ACTIVE' THEN RETURN NULL;END IF;
  UPDATE tto.auth_challenges SET consumed_at=clock_timestamp() WHERE challenge_id=p_challenge;
  INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,
    authorization_epoch_at_issue,assurance_level,expires_at)
   VALUES(gen_random_uuid(),r.user_id,p_session_hash,epoch,auth_epoch,'OTP',
    clock_timestamp()+make_interval(mins=>ttl));
  RETURN r.user_id;
 END $login$;

-- A short-lived challenge can only be requested for a previously independently
-- verified phone associated with THIS actor and THIS current bearer session.
CREATE FUNCTION tto.begin_session_stepup_smsotp(p_challenge uuid,p_candidate_hash bytea,
 p_current_session_hash bytea) RETURNS text LANGUAGE plpgsql VOLATILE
 SECURITY DEFINER SET search_path=pg_catalog,tto AS $begin$
 DECLARE actor uuid:=tto.context_actor_id();mobile text;identifier_count integer;
 BEGIN
  IF actor IS NULL OR p_challenge IS NULL OR octet_length(p_candidate_hash)<>32
    OR octet_length(p_current_session_hash)<>32 THEN RETURN NULL;END IF;
  IF NOT EXISTS(SELECT 1 FROM tto.user_sessions s
     JOIN tto.user_accounts a ON a.user_id=s.user_id
    WHERE s.user_id=actor AND s.session_hash=p_current_session_hash
      AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
      AND s.security_epoch=a.security_epoch
      AND s.authorization_epoch_at_issue=a.authorization_epoch AND a.status='ACTIVE')
  THEN RETURN NULL; END IF;
  SELECT count(*),min(v.mobile) INTO identifier_count,mobile
   FROM tto.verified_mobile_identifiers v
   WHERE v.user_id=actor AND v.revoked_at IS NULL;
  IF identifier_count<>1 THEN RETURN NULL;END IF;
  -- Serialize challenge creation, including concurrent requests on the same User.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,91813));
  IF (SELECT count(*) FROM tto.auth_challenges
     WHERE user_id=actor AND purpose='SMSOTP_STEP_UP'
       AND created_at>clock_timestamp()-interval '15 minutes')>=3
  THEN RETURN NULL;END IF;
  INSERT INTO tto.auth_challenges(challenge_id,user_id,purpose,verifier_hash,expires_at)
   VALUES(p_challenge,actor,'SMSOTP_STEP_UP',p_candidate_hash,
    clock_timestamp()+interval '3 minutes');
  INSERT INTO tto.smsotp_delivery_attempts(challenge_id,state)
   VALUES(p_challenge,'PENDING');
  RETURN mobile;
 END $begin$;

CREATE FUNCTION tto.consume_session_stepup_smsotp(p_challenge uuid,p_candidate bytea,
 p_current_session_hash bytea) RETURNS boolean LANGUAGE plpgsql VOLATILE
 SECURITY DEFINER SET search_path=pg_catalog,tto AS $verify$
 DECLARE actor uuid:=tto.context_actor_id();chall tto.auth_challenges%ROWTYPE;
   max_attempts integer; sid uuid;
 BEGIN
  IF actor IS NULL OR octet_length(p_candidate)<>32
    OR octet_length(p_current_session_hash)<>32 THEN RETURN false;END IF;
  SELECT p.max_attempts INTO max_attempts
   FROM tto.auth_policy p WHERE p.policy_key='SESSION_CHALLENGE';
  IF max_attempts IS NULL THEN RETURN false;END IF;
  SELECT s.session_id INTO sid FROM tto.user_sessions s
   JOIN tto.user_accounts a ON a.user_id=s.user_id
   WHERE s.user_id=actor AND s.session_hash=p_current_session_hash
    AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND s.security_epoch=a.security_epoch
    AND s.authorization_epoch_at_issue=a.authorization_epoch AND a.status='ACTIVE'
   FOR UPDATE OF s;
  IF sid IS NULL THEN RETURN false;END IF;
  SELECT * INTO chall FROM tto.auth_challenges WHERE challenge_id=p_challenge FOR UPDATE;
  IF NOT FOUND OR chall.user_id<>actor OR chall.purpose<>'SMSOTP_STEP_UP'
    OR chall.consumed_at IS NOT NULL OR chall.expires_at<=clock_timestamp()
    OR chall.attempt_count>=max_attempts OR
    NOT EXISTS(SELECT 1 FROM tto.smsotp_delivery_attempts d
     WHERE d.challenge_id=p_challenge AND d.state='ACCEPTED')
  THEN RETURN false;END IF;
  UPDATE tto.auth_challenges SET attempt_count=attempt_count+1 WHERE challenge_id=p_challenge;
  IF chall.verifier_hash<>p_candidate THEN RETURN false;END IF;
  UPDATE tto.auth_challenges SET consumed_at=clock_timestamp() WHERE challenge_id=p_challenge;
  UPDATE tto.user_sessions SET assurance_level='ELEVATED',
    step_up_verified_at=clock_timestamp(),
    step_up_expires_at=LEAST(expires_at,clock_timestamp()+interval '5 minutes')
    WHERE session_id=sid;
  RETURN true;
 END $verify$;

-- A forged elevated enum alone is not enough; recent independent SMS verification
-- must have been persisted on the identical session.
CREATE OR REPLACE FUNCTION tto.assign_tenant_role_guarded(
 p_target uuid,p_tenant uuid,p_role text,p_authority uuid,p_request uuid,p_session_digest bytea)
 RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $gate$
 DECLARE actor uuid:=tto.context_actor_id();
   stored tto.role_assignment_request_receipts%ROWTYPE;effect boolean;
 BEGIN
  IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id() OR
   p_target IS NULL OR p_authority IS NULL OR p_request IS NULL OR
   p_role NOT IN('MEMBER','COOPERATIVE_MANAGER','DOCUMENT_REVIEWER') OR
   octet_length(p_session_digest)<>32
  THEN RETURN 'PERMISSION_DENIED';END IF;
  IF NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
  THEN RETURN 'PERMISSION_DENIED';END IF;
  IF NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT')
  THEN RETURN 'AUTHORITY_REQUIRED';END IF;
  IF NOT EXISTS(SELECT 1 FROM tto.user_sessions s
    JOIN tto.user_accounts a ON a.user_id=s.user_id
    WHERE s.user_id=actor AND s.session_hash=p_session_digest
    AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND s.security_epoch=a.security_epoch
    AND s.authorization_epoch_at_issue=a.authorization_epoch
    AND a.status='ACTIVE' AND s.assurance_level IN('ELEVATED','HARDWARE')
    AND s.step_up_verified_at IS NOT NULL
    AND s.step_up_expires_at>clock_timestamp())
  THEN RETURN 'STEP_UP_REQUIRED';END IF;
  INSERT INTO tto.role_assignment_request_receipts
   (tenant_id,actor_id,request_id,target_id,role_code,legal_authority_id,status)
   VALUES(p_tenant,actor,p_request,p_target,p_role,p_authority,'PENDING')
   ON CONFLICT(tenant_id,actor_id,request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO stored FROM tto.role_assignment_request_receipts
     WHERE tenant_id=p_tenant AND actor_id=actor AND request_id=p_request FOR UPDATE;
    IF stored.status='SUCCEEDED' AND stored.target_id=p_target
      AND stored.role_code=p_role AND stored.legal_authority_id=p_authority
    THEN RETURN 'ALREADY_APPLIED';END IF;
    RETURN 'IDEMPOTENCY_CONFLICT';
  END IF;
  effect:=tto.assign_tenant_role(p_target,p_tenant,p_role,p_authority);
  IF NOT effect THEN
    DELETE FROM tto.role_assignment_request_receipts
     WHERE tenant_id=p_tenant AND actor_id=actor AND request_id=p_request;
    RETURN 'AUTHORITY_REQUIRED';
  END IF;
  UPDATE tto.role_assignment_request_receipts SET status='SUCCEEDED'
   WHERE tenant_id=p_tenant AND actor_id=actor AND request_id=p_request;
  RETURN 'ASSIGNED';
 END $gate$;
-- Deny bypass via old definer function even for a direct app SQL connection.
REVOKE ALL ON FUNCTION tto.assign_tenant_role(uuid,uuid,text,uuid) FROM PUBLIC,tto_app;
REVOKE ALL ON FUNCTION tto.begin_session_stepup_smsotp(uuid,bytea,bytea),
 tto.consume_session_stepup_smsotp(uuid,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.begin_session_stepup_smsotp(uuid,bytea,bytea),
 tto.consume_session_stepup_smsotp(uuid,bytea,bytea) TO tto_app;
COMMIT;
