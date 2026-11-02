-- PH04 additive defence in depth: dedicated CF01 DED-015 and DED-018.
-- This SECURE path is NOT wired to a production endpoint. Never pretend an
-- OTP-only session is a step-up. Synthetic PG17 only until formal UAT.
BEGIN;
CREATE TABLE tto.role_assignment_request_receipts (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 request_id uuid NOT NULL,
 target_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 role_code text NOT NULL,
 legal_authority_id uuid NOT NULL REFERENCES tto.legal_authorities(authority_id),
 status text NOT NULL CHECK(status IN('PENDING','SUCCEEDED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,actor_id,request_id)
);
ALTER TABLE tto.role_assignment_request_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.role_assignment_request_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.role_assignment_request_receipts FROM PUBLIC,tto_app;
-- Session assurance is enforced from the stored opaque-token digest,
-- tied to the same verified actor and security/authorization epochs.
CREATE FUNCTION tto.assign_tenant_role_guarded(
 p_target uuid,p_tenant uuid,p_role text,p_authority uuid,p_request uuid,p_session_digest bytea)
 RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $gate$
 DECLARE actor uuid:=tto.context_actor_id();stored tto.role_assignment_request_receipts%ROWTYPE;effect boolean;
 BEGIN
  IF actor IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id() OR
   p_target IS NULL OR p_authority IS NULL OR p_request IS NULL OR
   p_role NOT IN('MEMBER','COOPERATIVE_MANAGER','DOCUMENT_REVIEWER') OR
   octet_length(p_session_digest)<>32
  THEN RETURN 'PERMISSION_DENIED'; END IF;
  IF NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
  THEN RETURN 'PERMISSION_DENIED';END IF;
  IF NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT')
  THEN RETURN 'AUTHORITY_REQUIRED';END IF;
  IF NOT EXISTS(SELECT 1 FROM tto.user_sessions s
    JOIN tto.user_accounts a ON a.user_id=s.user_id
    WHERE s.user_id=actor AND s.session_hash=p_session_digest
    AND s.revoked_at IS NULL AND s.expires_at>now()
    AND s.security_epoch=a.security_epoch
    AND s.authorization_epoch_at_issue=a.authorization_epoch
    AND a.status='ACTIVE'
    AND s.assurance_level IN ('ELEVATED','HARDWARE'))
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
REVOKE ALL ON FUNCTION tto.assign_tenant_role_guarded(uuid,uuid,text,uuid,uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.assign_tenant_role_guarded(uuid,uuid,text,uuid,uuid,bytea) TO tto_app;
COMMIT;
