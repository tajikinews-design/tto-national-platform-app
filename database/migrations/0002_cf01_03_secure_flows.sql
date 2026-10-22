-- CF01-03 phase 2. Additive, one-way migration on disposable PG17 only.
-- NEVER run against Arvan/Production without an approved migration and rollback plan.
BEGIN;
CREATE TABLE tto.auth_policy (
 policy_key text PRIMARY KEY CHECK(policy_key = 'SESSION_CHALLENGE'),
 max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 20),
 session_ttl_minutes integer NOT NULL CHECK(session_ttl_minutes BETWEEN 1 AND 1440),
 changed_at timestamptz NOT NULL DEFAULT now()
);
-- No default policy: missing/invalid CF04 configuration must fail closed.
REVOKE ALL ON tto.auth_policy FROM PUBLIC, tto_app;
ALTER TABLE tto.role_assignments ADD COLUMN IF NOT EXISTS legal_authority_id uuid;
ALTER TABLE tto.role_assignments ADD COLUMN IF NOT EXISTS assignment_version bigint NOT NULL DEFAULT 1;
CREATE TABLE tto.legal_authorities (
 authority_id uuid PRIMARY KEY,
 holder_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 scope text NOT NULL CHECK(scope IN ('ROLE_MANAGEMENT','JIT_APPROVAL','TENANT_LIFECYCLE','PARTY_MERGE')),
 evidence_id uuid NOT NULL,
 verified_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 verified_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(holder_id <> verified_by)
);
ALTER TABLE tto.role_assignments ADD CONSTRAINT role_authority_ref
 FOREIGN KEY(legal_authority_id) REFERENCES tto.legal_authorities(authority_id);
CREATE TABLE tto.jit_access_grants (
 grant_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 requester_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 approver_id uuid REFERENCES tto.user_accounts(user_id),
 purpose text NOT NULL CHECK(length(trim(purpose))>=12),
 scope text NOT NULL CHECK(scope='DOCUMENT_REVIEW'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 decided_at timestamptz,
 CHECK(expires_at > requested_at),
 CHECK(approver_id IS NULL OR approver_id <> requester_id)
);
CREATE TABLE tto.party_aliases(
 old_party_id uuid PRIMARY KEY REFERENCES tto.parties(party_id),
 current_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 merged_at timestamptz NOT NULL DEFAULT now(),
 CHECK(old_party_id <> current_party_id)
);
CREATE TABLE tto.tenant_status_history (
 history_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 from_status text NOT NULL,
 to_status text NOT NULL,
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 changed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id, history_id)
);
CREATE TABLE tto.document_scans(
 file_object_id uuid PRIMARY KEY REFERENCES tto.file_objects(file_object_id),
 scanner_name text NOT NULL,
 scanner_version text NOT NULL,
 scan_evidence_hash bytea NOT NULL CHECK(octet_length(scan_evidence_hash)=32),
 verdict text NOT NULL CHECK(verdict IN ('CLEAN','BLOCKED')),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.legal_holds(
 hold_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 document_id uuid NOT NULL REFERENCES tto.documents(document_id),
 rule_reference text NOT NULL CHECK(length(trim(rule_reference))>=8),
 reason text NOT NULL CHECK(length(trim(reason))>=12),
 applied_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 applied_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz
);
CREATE INDEX ON tto.legal_holds(document_id) WHERE released_at IS NULL;
CREATE TABLE tto.document_publications(
 document_id uuid NOT NULL REFERENCES tto.documents(document_id),
 version_num integer NOT NULL,
 publisher_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 published_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(document_id,version_num),
 FOREIGN KEY (document_id,version_num) REFERENCES tto.document_versions(document_id,version_num)
);
-- No implicit write privileges. CF-02 lifecycle and Party merge remain migration-owner-only
-- until full legal authority/adjudication contract is reviewed.
ALTER TABLE tto.legal_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.legal_authorities FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.jit_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.jit_access_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.tenant_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.tenant_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.document_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.document_scans FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.legal_holds FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.document_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.document_publications FORCE ROW LEVEL SECURITY;
-- Block alteration/removal of audit evidence, even by mistaken owner-side CRUD.
CREATE FUNCTION tto.deny_evidence_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path = pg_catalog,tto AS $fn$
 BEGIN RAISE EXCEPTION 'IMMUTABLE_AUDIT_OR_EVIDENCE'; END $fn$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON tto.audit_events
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER publication_immutable BEFORE UPDATE OR DELETE ON tto.document_publications
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE TRIGGER scans_immutable BEFORE UPDATE OR DELETE ON tto.document_scans
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
-- Version rows are append-only; material correction means new version.
CREATE TRIGGER version_immutable BEFORE UPDATE OR DELETE ON tto.document_versions
 FOR EACH ROW EXECUTE FUNCTION tto.deny_evidence_mutation();
CREATE FUNCTION tto.trap_held_document_delete() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $fn$
 BEGIN
 IF EXISTS(SELECT 1 FROM tto.legal_holds h WHERE h.document_id=OLD.document_id AND h.released_at IS NULL)
 THEN RAISE EXCEPTION 'ACTIVE_LEGAL_HOLD_DELETE_DENIED'; END IF;
 RETURN OLD;
 END $fn$;
CREATE TRIGGER prevent_held_document_delete BEFORE DELETE ON tto.documents
 FOR EACH ROW EXECUTE FUNCTION tto.trap_held_document_delete();
-- No OTP, tokens or secrets can be included in audit data: audit model accepts event type/IDs only.
CREATE FUNCTION tto.append_actor_audit(p_tenant uuid,p_name text,p_target uuid) RETURNS uuid
 LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE id uuid:=gen_random_uuid();
 BEGIN
 IF tto.context_actor_id() IS NULL OR p_tenant <> tto.context_tenant_id()
 THEN RAISE EXCEPTION 'AUDIT_CONTEXT_REQUIRED'; END IF;
 INSERT INTO tto.audit_events(audit_id,tenant_id,actor_id,event_name,target_id)
 VALUES(id,p_tenant,tto.context_actor_id(),p_name,p_target);
 RETURN id;
 END $fn$;
-- Challenge consumption is atomic: FOR UPDATE ensures a challenge cannot be accepted twice.
-- Server provides HMAC(pepper, challenge_id || ':' || otp) and a SHA256 opaque session digest.
CREATE FUNCTION tto.consume_challenge(p_challenge uuid,p_candidate bytea,p_session_hash bytea)
 RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE r tto.auth_challenges%ROWTYPE; max_attempts integer; ttl integer; epoch bigint; active text;
 BEGIN
 SELECT max_attempts,session_ttl_minutes INTO max_attempts,ttl FROM tto.auth_policy
 WHERE policy_key='SESSION_CHALLENGE';
 IF max_attempts IS NULL OR octet_length(p_candidate)<>32 OR octet_length(p_session_hash)<>32 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM tto.auth_challenges WHERE challenge_id=p_challenge FOR UPDATE;
 IF NOT FOUND OR r.consumed_at IS NOT NULL OR r.expires_at<=clock_timestamp()
   OR r.attempt_count>=max_attempts OR r.user_id IS NULL THEN RETURN NULL; END IF;
 UPDATE tto.auth_challenges SET attempt_count=attempt_count+1 WHERE challenge_id=p_challenge;
 IF r.verifier_hash<>p_candidate THEN RETURN NULL; END IF;
 SELECT security_epoch,status INTO epoch,active FROM tto.user_accounts WHERE user_id=r.user_id FOR UPDATE;
 IF active IS DISTINCT FROM 'ACTIVE' THEN RETURN NULL; END IF;
 UPDATE tto.auth_challenges SET consumed_at=clock_timestamp() WHERE challenge_id=p_challenge;
 INSERT INTO tto.user_sessions(session_id,user_id,session_hash,security_epoch,expires_at)
 VALUES(gen_random_uuid(),r.user_id,p_session_hash,epoch,clock_timestamp()+make_interval(mins=>ttl));
 RETURN r.user_id;
 END $fn$;
CREATE FUNCTION tto.revoke_own_sessions() RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE cnt integer; BEGIN
 IF tto.context_actor_id() IS NULL THEN RETURN 0; END IF;
 UPDATE tto.user_sessions SET revoked_at=clock_timestamp()
  WHERE user_id=tto.context_actor_id() AND revoked_at IS NULL;
 GET DIAGNOSTICS cnt=ROW_COUNT;
 RETURN cnt;
 END $fn$;
-- For a sensitive function, legal authority must be verified by a distinct person.
CREATE FUNCTION tto.has_verified_authority(p_tenant uuid,p_scope text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 SELECT COALESCE(EXISTS(
 SELECT 1 FROM tto.legal_authorities a
 WHERE a.holder_id=tto.context_actor_id() AND a.tenant_id=p_tenant AND a.scope=p_scope
 AND a.revoked_at IS NULL AND a.valid_until>now()
 AND a.verified_by<>a.holder_id),false) $fn$;
-- Deliberately don't elevate SELECT from JIT grants until negative review is complete.
-- A JIT is a *record of proposed access*, NOT a tenant or legal authorization by itself.
CREATE FUNCTION tto.request_jit(p_tenant uuid,p_purpose text,p_expires timestamptz)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE id uuid := gen_random_uuid();
 BEGIN
 IF tto.context_actor_id() IS NULL OR p_tenant<>tto.context_tenant_id() OR length(trim(p_purpose))<12
  OR p_expires<=now() OR p_expires>now()+interval '1 hour'
 THEN RAISE EXCEPTION 'JIT_REQUEST_DENIED'; END IF;
 INSERT INTO tto.jit_access_grants(grant_id,tenant_id,requester_id,purpose,scope,expires_at)
 VALUES(id,p_tenant,tto.context_actor_id(),p_purpose,'DOCUMENT_REVIEW',p_expires);
 PERFORM tto.append_actor_audit(p_tenant,'JIT_REQUESTED',id);
 RETURN id;
 END $fn$;
CREATE FUNCTION tto.decide_jit(p_grant uuid,p_accept boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE request tto.jit_access_grants%ROWTYPE; BEGIN
 SELECT * INTO request FROM tto.jit_access_grants WHERE grant_id=p_grant FOR UPDATE;
 IF NOT FOUND OR request.status<>'PENDING' OR request.expires_at<=now()
  OR request.requester_id=tto.context_actor_id()
  OR request.tenant_id<>tto.context_tenant_id()
  OR NOT tto.has_verified_authority(request.tenant_id,'JIT_APPROVAL')
 THEN RETURN false; END IF;
 UPDATE tto.jit_access_grants SET
 status=CASE WHEN p_accept THEN 'APPROVED' ELSE 'REJECTED' END,
 approver_id=tto.context_actor_id(),decided_at=now()
 WHERE grant_id=p_grant;
 PERFORM tto.append_actor_audit(request.tenant_id,'JIT_DECIDED',p_grant);
 RETURN true;
 END $fn$;
-- Role changes require legal authority, current active tenancy and separation of duties.
CREATE FUNCTION tto.revoke_role_assignment(p_assignment uuid,p_version bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,tto AS $fn$
 DECLARE rec tto.role_assignments%ROWTYPE;
 BEGIN
 SELECT * INTO rec FROM tto.role_assignments WHERE assignment_id=p_assignment FOR UPDATE;
 IF NOT FOUND OR rec.tenant_id<>tto.context_tenant_id()
 OR rec.user_id=tto.context_actor_id()
 OR NOT tto.has_tenant_role(rec.tenant_id,'COOPERATIVE_MANAGER')
 OR NOT tto.has_verified_authority(rec.tenant_id,'ROLE_MANAGEMENT')
 OR rec.revoked_at IS NOT NULL OR rec.assignment_version<>p_version THEN RETURN false; END IF;
 UPDATE tto.role_assignments SET revoked_at=clock_timestamp(),assignment_version=assignment_version+1
 WHERE assignment_id=p_assignment;
 PERFORM tto.append_actor_audit(rec.tenant_id,'ROLE_REVOKED',p_assignment);
 RETURN true;
 END $fn$;
-- Application role never gets administrative privilege to change tenants or merge Parties.
REVOKE ALL ON tto.auth_policy,tto.legal_authorities,tto.jit_access_grants,
 tto.party_aliases,tto.tenant_status_history,tto.document_scans,
 tto.legal_holds,tto.document_publications FROM PUBLIC,tto_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tto FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.context_actor_id(),tto.context_tenant_id(),
 tto.has_tenant_role(uuid,text),tto.resolve_session(bytea),
 tto.consume_challenge(uuid,bytea,bytea),tto.revoke_own_sessions(),
 tto.has_verified_authority(uuid,text),tto.request_jit(uuid,text,timestamptz),
 tto.decide_jit(uuid,boolean),tto.revoke_role_assignment(uuid,bigint),
 tto.append_actor_audit(uuid,text,uuid) TO tto_app;
COMMIT;
