-- TTO CF01-03 foundation migration v0001. PostgreSQL 17, reviewed SQL-first.
-- Run once as dedicated MIGRATION OWNER ONLY. The runtime role must never own tables or BYPASSRLS.
BEGIN;
DO $do$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tto_app') THEN
   CREATE ROLE tto_app NOLOGIN NOBYPASSRLS;
 END IF;
END $do$;
CREATE SCHEMA tto;
REVOKE ALL ON SCHEMA tto FROM PUBLIC;
GRANT USAGE ON SCHEMA tto TO tto_app;

-- CF-01 user login identity is global and distinct from Party, tenant role and shareholding.
CREATE TABLE tto.user_accounts (
 user_id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','LOCKED','DISABLED')),
 security_epoch bigint NOT NULL DEFAULT 0 CHECK (security_epoch >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.user_sessions (
 session_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 session_hash bytea UNIQUE NOT NULL CHECK(octet_length(session_hash)=32),
 security_epoch bigint NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_active_lookup ON tto.user_sessions(session_hash) WHERE revoked_at IS NULL;
CREATE TABLE tto.auth_challenges (
 challenge_id uuid PRIMARY KEY,
 user_id uuid REFERENCES tto.user_accounts(user_id),
 purpose text NOT NULL,
 verifier_hash bytea NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count>=0)
);
CREATE TABLE tto.tenants (
 tenant_id uuid PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 display_name text NOT NULL,
 status text NOT NULL DEFAULT 'PROVISIONING'
   CHECK (status IN ('PROVISIONING','SETUP_PENDING','ACTIVE','SUSPENDED','TERMINATING','TERMINATED')),
 version bigint NOT NULL DEFAULT 1 CHECK (version>0)
);
CREATE TABLE tto.parties (
 party_id uuid PRIMARY KEY,
 party_kind text NOT NULL CHECK(party_kind IN ('PERSON','ORGANIZATION')),
 display_label text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.user_party_links (
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 verified_at timestamptz,
 PRIMARY KEY(user_id,party_id)
);
-- Role assignment is not legal authority. No default national cross-tenant privileges.
CREATE TABLE tto.role_assignments (
 assignment_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 role_code text NOT NULL CHECK (role_code IN ('MEMBER','COOPERATIVE_MANAGER','DOCUMENT_REVIEWER')),
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,tenant_id,role_code)
);
CREATE INDEX role_assignments_user_tenant_idx ON tto.role_assignments(user_id,tenant_id);

-- CF-02 membership business truth is NOT stored here; this is a projection only.
CREATE TABLE tto.relationship_projections (
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 party_id uuid NOT NULL REFERENCES tto.parties(party_id),
 membership_status text NOT NULL,
 source_event_id uuid NOT NULL,
 source_version bigint NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,party_id)
);

-- CF-03 files, documents, evidence, audit are separate concepts.
CREATE TABLE tto.file_objects (
 file_object_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 storage_key text NOT NULL,
 sha256 bytea NOT NULL CHECK (octet_length(sha256)=32),
 classification text NOT NULL,
 scan_status text NOT NULL DEFAULT 'PENDING' CHECK(scan_status IN ('PENDING','CLEAN','BLOCKED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.documents (
 document_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 title text NOT NULL,
 classification text NOT NULL
   CHECK(classification IN ('MEMBER','TENANT_INTERNAL','RESTRICTED','HIGHLY_RESTRICTED')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','SUPERSEDED','ARCHIVED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_tenant_created_idx ON tto.documents(tenant_id,created_at DESC);
CREATE TABLE tto.document_versions (
 document_id uuid NOT NULL REFERENCES tto.documents(document_id),
 version_num integer NOT NULL CHECK(version_num > 0),
 file_object_id uuid NOT NULL REFERENCES tto.file_objects(file_object_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(document_id,version_num)
);
CREATE TABLE tto.evidence_references (
 evidence_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 document_id uuid REFERENCES tto.documents(document_id),
 source_entity_type text NOT NULL,
 source_entity_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.audit_events (
 audit_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 actor_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 event_name text NOT NULL,
 target_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
-- Transaction-local context is trustworthy ONLY when derived server-side from verified opaque session.
CREATE FUNCTION tto.context_actor_id() RETURNS uuid
 LANGUAGE sql STABLE SET search_path = pg_catalog, tto
 AS $fn$ SELECT NULLIF(current_setting('tto.actor_id', true), '')::uuid $fn$;
CREATE FUNCTION tto.context_tenant_id() RETURNS uuid
 LANGUAGE sql STABLE SET search_path = pg_catalog, tto
 AS $fn$ SELECT NULLIF(current_setting('tto.tenant_id', true), '')::uuid $fn$;

-- SECURITY DEFINER owned by migration owner; no direct app SELECT on role_assignments.
CREATE FUNCTION tto.has_tenant_role(p_tenant uuid, p_role text DEFAULT NULL) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto
 AS $fn$
 SELECT COALESCE(
   p_tenant=tto.context_tenant_id() AND
   EXISTS (SELECT 1 FROM tto.role_assignments a JOIN tto.tenants t ON t.tenant_id=a.tenant_id
           WHERE a.user_id=tto.context_actor_id() AND a.tenant_id=p_tenant
           AND t.status='ACTIVE' AND a.revoked_at IS NULL
           AND (a.expires_at IS NULL OR a.expires_at > now())
           AND (p_role IS NULL OR a.role_code=p_role)),false)
 $fn$;
CREATE FUNCTION tto.resolve_session(p_hash bytea) RETURNS TABLE(user_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto
 AS $fn$
 SELECT a.user_id FROM tto.user_sessions s
 JOIN tto.user_accounts a ON a.user_id=s.user_id
 WHERE s.session_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at > now()
   AND s.security_epoch=a.security_epoch AND a.status='ACTIVE'
 LIMIT 1
 $fn$;

-- RLS is enabled and forced on ALL tenant-owned tables; app role cannot bypass.
ALTER TABLE tto.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_view ON tto.tenants FOR SELECT TO tto_app USING (tto.has_tenant_role(tenant_id));
ALTER TABLE tto.relationship_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.relationship_projections FORCE ROW LEVEL SECURITY;
CREATE POLICY relationship_view ON tto.relationship_projections FOR SELECT TO tto_app USING (tto.has_tenant_role(tenant_id));
ALTER TABLE tto.file_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.file_objects FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.evidence_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.evidence_references FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE tto.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.documents FORCE ROW LEVEL SECURITY;
CREATE POLICY document_view ON tto.documents FOR SELECT TO tto_app
 USING (tto.has_tenant_role(tenant_id) AND (
 classification='MEMBER'
 OR (classification='TENANT_INTERNAL' AND tto.has_tenant_role(tenant_id,'COOPERATIVE_MANAGER'))
 OR (classification='RESTRICTED' AND tto.has_tenant_role(tenant_id,'DOCUMENT_REVIEWER'))
 ));
CREATE POLICY document_insert ON tto.documents FOR INSERT TO tto_app
 WITH CHECK(tto.has_tenant_role(tenant_id,'COOPERATIVE_MANAGER') AND
  classification IN ('MEMBER','TENANT_INTERNAL'));

REVOKE ALL ON ALL TABLES IN SCHEMA tto FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tto FROM PUBLIC;
GRANT SELECT ON tto.tenants,tto.documents,tto.relationship_projections TO tto_app;
GRANT INSERT ON tto.documents TO tto_app;
GRANT EXECUTE ON FUNCTION tto.context_actor_id(),tto.context_tenant_id(),
  tto.has_tenant_role(uuid,text),tto.resolve_session(bytea) TO tto_app;
COMMIT;
