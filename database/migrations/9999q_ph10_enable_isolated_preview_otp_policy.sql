-- TTO isolated Supabase Preview only: activate the existing fail-closed OTP policy
-- for customer signup / cooperative / shareholder SMS login.
-- Do not run in Production or Arvan; this is NOT a change to legal review.
-- Stored OTP challenge expiry remains strictly 60 seconds in API invocation.
-- Default is deliberately absent from base schema; explicit approval for Preview.
INSERT INTO tto.auth_policy(policy_key,max_attempts,session_ttl_minutes)
VALUES ('SESSION_CHALLENGE',5,15)
ON CONFLICT(policy_key) DO NOTHING;
DO $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM tto.auth_policy
  WHERE policy_key='SESSION_CHALLENGE'
  AND max_attempts BETWEEN 1 AND 5
  AND session_ttl_minutes BETWEEN 1 AND 15
 ) THEN
  RAISE EXCEPTION 'Preview SMSOTP policy missing or exceeds accepted guardrails';
 END IF;
END $$;
