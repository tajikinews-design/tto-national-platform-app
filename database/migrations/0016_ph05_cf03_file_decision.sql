-- PH05 CF03 file/download authorization *decision* ONLY; no file serving/storage credentials.
-- Additive. No hosted/production migration authorization.
BEGIN;
CREATE FUNCTION tto.ph05_can_download_file(p_file uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
 SELECT coalesce(
  p_file IS NOT NULL AND tto.context_actor_id() IS NOT NULL
  AND tto.context_tenant_id() IS NOT NULL
  AND EXISTS (
   SELECT 1 FROM tto.file_objects f
   JOIN tto.tenants t ON t.tenant_id=f.tenant_id AND t.status='ACTIVE'
   JOIN tto.document_versions v ON v.file_object_id=f.file_object_id
     AND v.tenant_id=f.tenant_id
   JOIN tto.documents d ON d.document_id=v.document_id
     AND d.tenant_id=f.tenant_id AND d.status='PUBLISHED'
   JOIN tto.document_publications pub ON pub.document_id=d.document_id
     AND pub.version_num=v.version_num
   JOIN tto.document_scans scan ON scan.file_object_id=f.file_object_id
     AND scan.verdict='CLEAN'
   WHERE f.file_object_id=p_file
     AND f.tenant_id=tto.context_tenant_id()
     AND f.scan_status='CLEAN'
     AND (
      (d.classification='MEMBER' AND tto.has_tenant_role(f.tenant_id))
      OR (d.classification='TENANT_INTERNAL'
          AND tto.has_tenant_role(f.tenant_id,'COOPERATIVE_MANAGER'))
      OR (d.classification='RESTRICTED'
          AND (tto.has_tenant_role(f.tenant_id,'DOCUMENT_REVIEWER')
            OR tto.has_jit_access(f.tenant_id)))
     )
  ),false);
$f$;
REVOKE ALL ON FUNCTION tto.ph05_can_download_file(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph05_can_download_file(uuid) TO tto_app;
-- No "download by storage_key" or upload bytes implemented: storage access
-- requires an independently authorized handler and scanner-backed adaptor.
COMMIT;
