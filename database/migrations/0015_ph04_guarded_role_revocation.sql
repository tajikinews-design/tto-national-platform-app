-- PH04 defensive completion: revoke requires identical session-bound fresh step-up
-- as role assignment, and the legacy SQL entrypoint is not executable by tto_app.
-- Additive migration. Never run in production until full release approval.
BEGIN;
CREATE FUNCTION tto.revoke_role_assignment_guarded(
 p_assignment uuid,p_expected_version bigint,p_session_digest bytea)
 RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $guard$
 DECLARE actor uuid:=tto.context_actor_id(); tenant uuid; target uuid; done boolean;
 BEGIN
  IF actor IS NULL OR p_assignment IS NULL OR p_expected_version IS NULL
   OR p_expected_version<1 OR octet_length(p_session_digest)<>32
  THEN RETURN 'PERMISSION_DENIED'; END IF;
  SELECT a.tenant_id,a.user_id INTO tenant,target FROM tto.role_assignments a
   WHERE a.assignment_id=p_assignment;
  IF tenant IS NULL OR tenant IS DISTINCT FROM tto.context_tenant_id() OR target=actor
  THEN RETURN 'PERMISSION_DENIED'; END IF;
  IF NOT tto.has_tenant_role(tenant,'COOPERATIVE_MANAGER')
  THEN RETURN 'PERMISSION_DENIED'; END IF;
  IF NOT tto.has_verified_authority(tenant,'ROLE_MANAGEMENT')
  THEN RETURN 'AUTHORITY_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tto.user_sessions s
    JOIN tto.user_accounts a ON a.user_id=s.user_id
    WHERE s.user_id=actor AND s.session_hash=p_session_digest
    AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
    AND s.security_epoch=a.security_epoch
    AND s.authorization_epoch_at_issue=a.authorization_epoch
    AND a.status='ACTIVE' AND s.assurance_level IN('ELEVATED','HARDWARE')
    AND s.step_up_verified_at IS NOT NULL
    AND s.step_up_expires_at>clock_timestamp())
  THEN RETURN 'STEP_UP_REQUIRED'; END IF;
  done:=tto.revoke_role_assignment(p_assignment,p_expected_version);
  IF done THEN RETURN 'REVOKED'; END IF;
  RETURN 'PERMISSION_DENIED';
 END $guard$;
REVOKE ALL ON FUNCTION tto.revoke_role_assignment(uuid,bigint) FROM PUBLIC,tto_app;
REVOKE ALL ON FUNCTION tto.revoke_role_assignment_guarded(uuid,bigint,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.revoke_role_assignment_guarded(uuid,bigint,bytea) TO tto_app;
COMMIT;
