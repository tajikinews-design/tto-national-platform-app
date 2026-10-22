-- TTO CF02 actor-bound context discovery. Apply ONLY in disposable PG17 CI until reviewed.
BEGIN;
CREATE FUNCTION tto.list_actor_tenant_options()
RETURNS TABLE ("tenantId" uuid,"displayName" text,"memberRole" boolean,
 "managerRole" boolean,"verifiedPartyLink" boolean,"activeMembershipProjection" boolean,
 "roleManagementAuthority" boolean,"approvedDocumentJit" boolean,"platformOperator" boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto
AS $func$
WITH actor AS (SELECT tto.context_actor_id() AS uid),
eligible AS (
 SELECT t.tenant_id,t.display_name FROM tto.tenants t CROSS JOIN actor a
 WHERE a.uid IS NOT NULL AND t.status='ACTIVE' AND (
  EXISTS(SELECT 1 FROM tto.role_assignments r WHERE r.user_id=a.uid
   AND r.tenant_id=t.tenant_id AND r.revoked_at IS NULL
   AND (r.expires_at IS NULL OR r.expires_at>now()))
  OR EXISTS(SELECT 1 FROM tto.jit_access_grants g WHERE g.requester_id=a.uid
   AND g.tenant_id=t.tenant_id AND g.status='APPROVED'
   AND g.decided_at IS NOT NULL AND g.approver_id IS NOT NULL
   AND g.approver_id<>g.requester_id AND g.expires_at>now())
 ))
SELECT e.tenant_id,e.display_name,
 EXISTS(SELECT 1 FROM tto.role_assignments r CROSS JOIN actor a WHERE
  r.tenant_id=e.tenant_id AND r.user_id=a.uid AND r.role_code='MEMBER'
  AND r.revoked_at IS NULL AND (r.expires_at IS NULL OR r.expires_at>now())),
 EXISTS(SELECT 1 FROM tto.role_assignments r CROSS JOIN actor a WHERE
  r.tenant_id=e.tenant_id AND r.user_id=a.uid AND r.role_code='COOPERATIVE_MANAGER'
  AND r.revoked_at IS NULL AND (r.expires_at IS NULL OR r.expires_at>now())),
 EXISTS(SELECT 1 FROM tto.user_party_links l CROSS JOIN actor a WHERE
  l.user_id=a.uid AND l.verified_at IS NOT NULL),
 EXISTS(SELECT 1 FROM tto.user_party_links l
  JOIN tto.relationship_projections p ON p.party_id=l.party_id AND p.tenant_id=e.tenant_id
  CROSS JOIN actor a WHERE l.user_id=a.uid AND l.verified_at IS NOT NULL
  AND p.membership_status='ACTIVE' AND p.source_version>0),
 EXISTS(SELECT 1 FROM tto.legal_authorities v CROSS JOIN actor a WHERE
  v.holder_id=a.uid AND v.tenant_id=e.tenant_id AND v.scope='ROLE_MANAGEMENT'
  AND v.revoked_at IS NULL AND v.valid_until>now() AND v.verified_by<>v.holder_id),
 EXISTS(SELECT 1 FROM tto.jit_access_grants g CROSS JOIN actor a WHERE
  g.requester_id=a.uid AND g.tenant_id=e.tenant_id AND g.status='APPROVED'
  AND g.decided_at IS NOT NULL AND g.approver_id<>g.requester_id
  AND g.expires_at>now()),
 EXISTS(SELECT 1 FROM tto.platform_operator_authorizations o CROSS JOIN actor a WHERE
  o.user_id=a.uid AND o.approved_by<>o.user_id AND o.revoked_at IS NULL AND o.expires_at>now())
FROM eligible e ORDER BY e.display_name,e.tenant_id LIMIT 50
$func$;
REVOKE ALL ON FUNCTION tto.list_actor_tenant_options() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.list_actor_tenant_options() TO tto_app;
COMMIT;
