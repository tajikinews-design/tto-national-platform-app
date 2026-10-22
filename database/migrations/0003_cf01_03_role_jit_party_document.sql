-- CF01-03 v0003: gates for role issuance, JIT access, tenant lifecycle, Party merge,
-- scan attestation, document versions, legal hold and auditable publication.
-- NO production migration authorized.
BEGIN;
ALTER TABLE tto.legal_authorities DROP CONSTRAINT legal_authorities_scope_check;
ALTER TABLE tto.legal_authorities ADD CONSTRAINT legal_authorities_scope_check
 CHECK(scope IN ('ROLE_MANAGEMENT','JIT_APPROVAL','TENANT_LIFECYCLE','PARTY_MERGE','LEGAL_HOLD','DOC_PUBLISH'));
CREATE TABLE tto.platform_operator_authorizations (
 user_id uuid PRIMARY KEY REFERENCES tto.user_accounts(user_id),
 approved_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 evidence_id uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(user_id<>approved_by)
);
REVOKE ALL ON tto.platform_operator_authorizations FROM PUBLIC,tto_app;
ALTER TABLE tto.platform_operator_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.platform_operator_authorizations FORCE ROW LEVEL SECURITY;
CREATE FUNCTION tto.has_platform_operator() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(EXISTS(SELECT 1 FROM tto.platform_operator_authorizations o
 WHERE o.user_id=tto.context_actor_id() AND o.revoked_at IS NULL
 AND o.expires_at>now() AND o.approved_by<>o.user_id),false)
 $f$;
-- JIT is request -> independent tenant authorized approval -> temporary restricted access.
-- A user cannot create requests without either existing tenant assignment or verified platform role.
CREATE OR REPLACE FUNCTION tto.request_jit(p_tenant uuid,p_purpose text,p_expires timestamptz)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE id uuid:=gen_random_uuid(); BEGIN
 IF tto.context_actor_id() IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
 OR (NOT tto.has_tenant_role(p_tenant) AND NOT tto.has_platform_operator())
 OR length(trim(coalesce(p_purpose,'')))<12
 OR p_expires<=now() OR p_expires>now()+interval '1 hour'
 THEN RAISE EXCEPTION 'JIT_REQUEST_DENIED'; END IF;
 INSERT INTO tto.jit_access_grants(grant_id,tenant_id,requester_id,purpose,scope,expires_at)
 VALUES(id,p_tenant,tto.context_actor_id(),p_purpose,'DOCUMENT_REVIEW',p_expires);
 PERFORM tto.append_actor_audit(p_tenant,'JIT_REQUESTED',id);
 RETURN id;
 END $f$;
CREATE FUNCTION tto.has_jit_access(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 SELECT COALESCE(p_tenant=tto.context_tenant_id() AND EXISTS(
  SELECT 1 FROM tto.jit_access_grants g
  JOIN tto.tenants t ON t.tenant_id=g.tenant_id
  WHERE g.tenant_id=p_tenant AND g.requester_id=tto.context_actor_id()
   AND g.status='APPROVED' AND g.decided_at IS NOT NULL
   AND g.approver_id<>g.requester_id AND g.expires_at>now() AND t.status='ACTIVE'),false)
 $f$;
CREATE POLICY tenant_jit_view ON tto.tenants FOR SELECT TO tto_app
 USING(tto.has_jit_access(tenant_id));
DROP POLICY document_view ON tto.documents;
CREATE POLICY document_view ON tto.documents FOR SELECT TO tto_app
 USING(tenant_id=tto.context_tenant_id() AND
   ((classification='MEMBER' AND tto.has_tenant_role(tenant_id))
   OR (classification='TENANT_INTERNAL' AND tto.has_tenant_role(tenant_id,'COOPERATIVE_MANAGER'))
   OR (classification='RESTRICTED' AND
      (tto.has_tenant_role(tenant_id,'DOCUMENT_REVIEWER') OR tto.has_jit_access(tenant_id)))));
-- Role grants require independently verified authority (not role alone) and SoD.
CREATE FUNCTION tto.assign_tenant_role(p_target uuid,p_tenant uuid,p_role text,p_authority uuid)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE aid uuid; rid uuid:=gen_random_uuid(); BEGIN
 IF p_target=tto.context_actor_id() OR p_tenant<>tto.context_tenant_id()
 OR p_role NOT IN ('MEMBER','COOPERATIVE_MANAGER','DOCUMENT_REVIEWER')
 OR NOT tto.has_tenant_role(p_tenant,'COOPERATIVE_MANAGER')
 OR NOT tto.has_verified_authority(p_tenant,'ROLE_MANAGEMENT')
 THEN RETURN false; END IF;
 SELECT authority_id INTO aid FROM tto.legal_authorities
 WHERE authority_id=p_authority AND tenant_id=p_tenant AND holder_id=tto.context_actor_id()
 AND scope='ROLE_MANAGEMENT' AND revoked_at IS NULL AND valid_until>now();
 IF aid IS NULL THEN RETURN false; END IF;
 INSERT INTO tto.role_assignments(assignment_id,user_id,tenant_id,role_code,legal_authority_id)
 VALUES(rid,p_target,p_tenant,p_role,aid)
 ON CONFLICT (user_id,tenant_id,role_code) DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM tto.append_actor_audit(p_tenant,'ROLE_ASSIGNED',rid);
 RETURN true;
 END $f$;
-- Metadata trust: enforce same-tenant foreign keys for file <-> document version.
ALTER TABLE tto.documents ADD CONSTRAINT documents_tenant_unique UNIQUE(document_id,tenant_id);
ALTER TABLE tto.file_objects ADD CONSTRAINT file_objects_tenant_unique UNIQUE(file_object_id,tenant_id);
ALTER TABLE tto.document_versions ADD COLUMN tenant_id uuid NOT NULL;
ALTER TABLE tto.document_versions ADD CONSTRAINT version_same_document_tenant
 FOREIGN KEY(document_id,tenant_id) REFERENCES tto.documents(document_id,tenant_id);
ALTER TABLE tto.document_versions ADD CONSTRAINT version_same_file_tenant
 FOREIGN KEY(file_object_id,tenant_id) REFERENCES tto.file_objects(file_object_id,tenant_id);
-- Backend storage and AV scanner are separate principals; app role cannot assert CLEAN.
DO $f$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tto_scanner') THEN
 CREATE ROLE tto_scanner NOLOGIN NOBYPASSRLS; END IF; END $f$;
CREATE FUNCTION tto.record_scan_verdict(p_file uuid,p_name text,p_version text,p_hash bytea,p_verdict text)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE old_status text; BEGIN
 IF length(trim(p_name))<3 OR length(trim(p_version))<1 OR octet_length(p_hash)<>32
 OR p_verdict NOT IN ('CLEAN','BLOCKED') THEN RETURN false; END IF;
 SELECT scan_status INTO old_status FROM tto.file_objects WHERE file_object_id=p_file FOR UPDATE;
 IF old_status IS DISTINCT FROM 'PENDING' THEN RETURN false; END IF;
 INSERT INTO tto.document_scans(file_object_id,scanner_name,scanner_version,scan_evidence_hash,verdict)
 VALUES(p_file,p_name,p_version,p_hash,p_verdict);
 UPDATE tto.file_objects SET scan_status=p_verdict WHERE file_object_id=p_file;
 RETURN true;
 END $f$;
CREATE FUNCTION tto.publish_document(p_document uuid,p_file uuid,p_version integer)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE d tto.documents%ROWTYPE; f tto.file_objects%ROWTYPE; BEGIN
 SELECT * INTO d FROM tto.documents WHERE document_id=p_document FOR UPDATE;
 IF NOT FOUND OR d.tenant_id<>tto.context_tenant_id()
 OR d.classification NOT IN ('MEMBER','TENANT_INTERNAL','RESTRICTED')
 OR NOT tto.has_tenant_role(d.tenant_id,'COOPERATIVE_MANAGER')
 OR NOT tto.has_verified_authority(d.tenant_id,'DOC_PUBLISH')
 OR p_version<1 OR d.status NOT IN ('DRAFT','PUBLISHED')
 OR EXISTS (SELECT 1 FROM tto.legal_holds h WHERE h.document_id=p_document AND h.released_at IS NULL)
 THEN RETURN false; END IF;
 SELECT * INTO f FROM tto.file_objects WHERE file_object_id=p_file AND tenant_id=d.tenant_id FOR UPDATE;
 IF NOT FOUND OR f.scan_status<>'CLEAN' OR
 NOT EXISTS(SELECT 1 FROM tto.document_scans s WHERE s.file_object_id=p_file AND s.verdict='CLEAN')
 THEN RETURN false; END IF;
 INSERT INTO tto.document_versions(document_id,tenant_id,version_num,file_object_id)
 VALUES(p_document,d.tenant_id,p_version,p_file);
 INSERT INTO tto.document_publications(document_id,version_num,publisher_id)
 VALUES(p_document,p_version,tto.context_actor_id());
 UPDATE tto.documents SET status='PUBLISHED' WHERE document_id=p_document;
 PERFORM tto.append_actor_audit(d.tenant_id,'DOCUMENT_VERSION_PUBLISHED',p_document);
 RETURN true;
 END $f$;
-- Verified legal hold with immutable history (release represented by a dated transition).
CREATE FUNCTION tto.place_legal_hold(p_doc uuid,p_reference text,p_reason text)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 DECLARE tid uuid; hid uuid:=gen_random_uuid(); BEGIN
 SELECT tenant_id INTO tid FROM tto.documents WHERE document_id=p_doc FOR UPDATE;
 IF tid IS NULL OR tid<>tto.context_tenant_id() OR
 NOT tto.has_verified_authority(tid,'LEGAL_HOLD')
 OR length(trim(p_reference))<8 OR length(trim(p_reason))<12 THEN RETURN NULL; END IF;
 INSERT INTO tto.legal_holds(hold_id,tenant_id,document_id,rule_reference,reason,applied_by)
 VALUES(hid,tid,p_doc,p_reference,p_reason,tto.context_actor_id());
 PERFORM tto.append_actor_audit(tid,'LEGAL_HOLD_PLACED',p_doc);
 RETURN hid;
 END $f$;
-- Authorised privileged operator only, never exposed to tto_app by default.
CREATE FUNCTION tto.transition_tenant(p_tenant uuid,p_from text,p_to text,p_version bigint,p_actor uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM tto.legal_authorities WHERE holder_id=p_actor AND
 tenant_id=p_tenant AND scope='TENANT_LIFECYCLE' AND revoked_at IS NULL AND valid_until>now())
 THEN RETURN false; END IF;
 IF NOT ((p_from='PROVISIONING' AND p_to='SETUP_PENDING') OR
 (p_from='SETUP_PENDING' AND p_to='ACTIVE') OR
 (p_from='ACTIVE' AND p_to='SUSPENDED') OR
 (p_from='SUSPENDED' AND p_to='ACTIVE') OR
 (p_from='ACTIVE' AND p_to='TERMINATING') OR
 (p_from='SUSPENDED' AND p_to='TERMINATING') OR
 (p_from='TERMINATING' AND p_to='TERMINATED')) THEN RETURN false; END IF;
 UPDATE tto.tenants SET status=p_to,version=version+1 WHERE tenant_id=p_tenant
  AND status=p_from AND version=p_version;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO tto.tenant_status_history(history_id,tenant_id,from_status,to_status,actor_id)
 VALUES(gen_random_uuid(),p_tenant,p_from,p_to,p_actor);
 RETURN true;
 END $f$;
CREATE FUNCTION tto.merge_party_alias(p_old uuid,p_current uuid,p_tenant uuid,p_actor uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
 BEGIN
 IF p_old=p_current OR NOT EXISTS(SELECT 1 FROM tto.legal_authorities
 WHERE holder_id=p_actor AND tenant_id=p_tenant AND scope='PARTY_MERGE'
 AND revoked_at IS NULL AND valid_until>now()) THEN RETURN false; END IF;
 PERFORM party_id FROM tto.parties WHERE party_id IN (p_old,p_current) ORDER BY party_id FOR UPDATE;
 IF (SELECT count(*) FROM tto.parties WHERE party_id IN (p_old,p_current))<>2
 OR EXISTS(SELECT 1 FROM tto.party_aliases WHERE old_party_id IN (p_old,p_current)
 OR current_party_id=p_old) THEN RETURN false; END IF;
 INSERT INTO tto.party_aliases(old_party_id,current_party_id) VALUES(p_old,p_current)
 ON CONFLICT DO NOTHING;
 RETURN FOUND;
 END $f$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tto FROM PUBLIC;
REVOKE ALL ON FUNCTION tto.transition_tenant(uuid,text,text,bigint,uuid),
 tto.merge_party_alias(uuid,uuid,uuid,uuid) FROM tto_app;
GRANT EXECUTE ON FUNCTION tto.context_actor_id(),tto.context_tenant_id(),
 tto.has_tenant_role(uuid,text),tto.resolve_session(bytea),
 tto.consume_challenge(uuid,bytea,bytea),tto.revoke_own_sessions(),
 tto.has_verified_authority(uuid,text),tto.has_platform_operator(),
 tto.request_jit(uuid,text,timestamptz),tto.has_jit_access(uuid),
 tto.decide_jit(uuid,boolean),tto.revoke_role_assignment(uuid,bigint),
 tto.assign_tenant_role(uuid,uuid,text,uuid),
 tto.publish_document(uuid,uuid,integer),
 tto.place_legal_hold(uuid,text,text),tto.append_actor_audit(uuid,text,uuid) TO tto_app;
GRANT USAGE ON SCHEMA tto TO tto_scanner;
GRANT EXECUTE ON FUNCTION tto.record_scan_verdict(uuid,text,text,bytea,text) TO tto_scanner;
COMMIT;
