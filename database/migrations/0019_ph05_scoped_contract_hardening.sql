-- PH05 additive security controls for source-aligned acceptance tests.
-- Owner/legal final approval remains a separate record. No live adapters.
BEGIN;
CREATE TABLE tto.ph05_evidence_bundle_seals (
 bundle_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 document_id uuid NOT NULL,
 version_num integer NOT NULL,
 file_hash bytea NOT NULL CHECK(octet_length(file_hash)=32),
 seal_hash bytea NOT NULL CHECK(octet_length(seal_hash)=32),
 sealed_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 sealed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(document_id,version_num)
 REFERENCES tto.document_versions(document_id,version_num),
 FOREIGN KEY(document_id,tenant_id)
 REFERENCES tto.documents(document_id,tenant_id)
);
CREATE TRIGGER ph05_bundle_seal_immutable BEFORE UPDATE OR DELETE ON tto.ph05_evidence_bundle_seals
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
REVOKE ALL ON tto.ph05_evidence_bundle_seals FROM PUBLIC,tto_app;
ALTER TABLE tto.ph05_evidence_bundle_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph05_evidence_bundle_seals FORCE ROW LEVEL SECURITY;

-- Returns an opaque permit, never a storage_key. Denials have a tenant-local audit.
CREATE FUNCTION tto.ph05_request_file_access(p_file uuid) RETURNS boolean
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE tid uuid:=tto.context_tenant_id();actor uuid:=tto.context_actor_id();ok boolean;
 BEGIN
 IF tid IS NULL OR actor IS NULL OR p_file IS NULL THEN RETURN false;END IF;
 ok:=tto.ph05_can_download_file(p_file);
 IF NOT ok THEN
  PERFORM tto.append_actor_audit(tid,'FILE_ACCESS_DENIED',p_file);
 END IF;
 RETURN ok;
 END $f$;
REVOKE ALL ON FUNCTION tto.ph05_request_file_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.ph05_request_file_access(uuid) TO tto_app;

-- LEGAL-REVIEW-ONLY / synthetic baseline; not bound to a voting/share transaction.
CREATE FUNCTION tto.ph05_proxy_baseline_review(p_proxy_count integer)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog,tto
AS $f$ SELECT CASE WHEN p_proxy_count IS NULL OR p_proxy_count<0
 THEN 'BLOCKED' WHEN p_proxy_count>3 THEN 'BLOCKED'
 ELSE 'REVIEW_ONLY' END $f$;
CREATE FUNCTION tto.ph05_two_stage_review(p_subject_count integer)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog,tto
AS $f$ SELECT CASE WHEN p_subject_count IS NULL OR p_subject_count<0
 THEN 'BLOCKED' WHEN p_subject_count>500 THEN 'TWO_STAGE'
 ELSE 'REVIEW_ONLY' END $f$;
REVOKE ALL ON FUNCTION tto.ph05_proxy_baseline_review(integer),
 tto.ph05_two_stage_review(integer) FROM PUBLIC,tto_app;

-- Tenant-locked integration credential reference; no real keys are stored.
CREATE TABLE tto.ph05_integration_credential_refs(
 credential_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 integration_code text NOT NULL,
 external_secret_ref text NOT NULL CHECK(length(external_secret_ref)>8),
 UNIQUE (credential_id,tenant_id)
);
REVOKE ALL ON tto.ph05_integration_credential_refs FROM PUBLIC,tto_app;
ALTER TABLE tto.ph05_integration_credential_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph05_integration_credential_refs FORCE ROW LEVEL SECURITY;
CREATE FUNCTION tto.ph05_credential_tenant_match(p_credential uuid,p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(p_credential IS NOT NULL AND p_tenant IS NOT NULL
  AND EXISTS (SELECT 1 FROM tto.ph05_integration_credential_refs c
  WHERE c.credential_id=p_credential AND c.tenant_id=p_tenant),false);
$f$;
REVOKE ALL ON FUNCTION tto.ph05_credential_tenant_match(uuid,uuid) FROM PUBLIC,tto_app;

CREATE TABLE tto.ph05_notification_delivery_fixtures(
 job_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 business_ref uuid NOT NULL,delivery_status text NOT NULL
 CHECK(delivery_status IN('QUEUED','SENT','FAILED'))
);
REVOKE ALL ON tto.ph05_notification_delivery_fixtures FROM PUBLIC,tto_app;
ALTER TABLE tto.ph05_notification_delivery_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph05_notification_delivery_fixtures FORCE ROW LEVEL SECURITY;
COMMIT;
