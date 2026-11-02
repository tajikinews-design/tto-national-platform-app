-- PH04: additive CF01/CF02 source-contract physical foundation.
-- Synthetic disposable PostgreSQL 17 CI only until separately approved production migration.
-- These tables are NOT public signup, real Party ID verification, or share ownership truth.
BEGIN;

-- Existing runtime fields retain their original semantics; new contract fields are
-- deliberately nullable when a lawful verification/evidence step has not occurred.
ALTER TABLE tto.user_accounts
  ADD COLUMN IF NOT EXISTS authorization_epoch bigint NOT NULL DEFAULT 0 CHECK (authorization_epoch >= 0),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN IF NOT EXISTS party_ref uuid REFERENCES tto.parties(party_id);
ALTER TABLE tto.user_sessions
  ADD COLUMN IF NOT EXISTS assurance_level text NOT NULL DEFAULT 'OTP'
    CHECK (assurance_level IN ('OTP','ELEVATED','HARDWARE')),
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS authorization_epoch_at_issue bigint NOT NULL DEFAULT 0;
ALTER TABLE tto.auth_challenges
  ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE tto.auth_identifiers (
  identifier_id uuid PRIMARY KEY,
  user_account_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  identifier_type text NOT NULL CHECK (identifier_type IN ('MOBILE','EMAIL','EXTERNAL')),
  normalized_hash bytea NOT NULL CHECK (octet_length(normalized_hash)=32),
  protected_value bytea NOT NULL CHECK (octet_length(protected_value)>0),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED','VERIFIED','REVOKED')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((verification_status='VERIFIED')=(verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX auth_identifiers_verified_unique
 ON tto.auth_identifiers(identifier_type,normalized_hash)
 WHERE verification_status='VERIFIED';
CREATE INDEX auth_identifiers_user_lookup ON tto.auth_identifiers(user_account_id);

CREATE TABLE tto.auth_factors (
  factor_id uuid PRIMARY KEY,
  user_account_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  factor_type text NOT NULL CHECK (factor_type IN ('SMS_OTP','TOTP','WEBAUTHN')),
  status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(status IN ('UNVERIFIED','ACTIVE','REVOKED')),
  evidence_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tto.role_definitions (
  role_code text PRIMARY KEY,
  tenant_scoped boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Role definitions are not seeded automatically; an unset/unknown role grants NOTHING.
ALTER TABLE tto.role_assignments
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'TENANT'
    CHECK (scope_type IN ('TENANT','RESOURCE')),
  ADD COLUMN IF NOT EXISTS resource_ref uuid,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS basis_ref uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE'
    CHECK(status IN ('ACTIVE','REVOKED','EXPIRED'));
-- Existing RLS/role predicate is still the authoritative check.
-- No new grant reads these fields until a reviewed policy migration exists.

CREATE TABLE tto.authority_references (
  authority_reference_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
  holder_id uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  authority_type text NOT NULL,
  source_domain text NOT NULL,
  source_entity_id uuid NOT NULL,
  evidence_ref uuid,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(status IN ('UNVERIFIED','VERIFIED','REVOKED')),
  CHECK(valid_until>valid_from)
);
-- Authority reference is not a legal_authorities grant. No access path uses it.
CREATE INDEX authority_references_lookup ON tto.authority_references(tenant_id,holder_id);

ALTER TABLE tto.tenants
  ADD COLUMN IF NOT EXISTS tenant_type text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS geography_ref text,
  ADD COLUMN IF NOT EXISTS current_slug_ref uuid,
  ADD COLUMN IF NOT EXISTS legal_profile_ref uuid;
-- Existing tenant status/slug remain canonical for old routes.
CREATE TABLE tto.tenant_slugs (
  slug_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,100}$'),
  status text NOT NULL CHECK(status IN ('CURRENT','REDIRECT','RETIRED')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  redirect_to uuid REFERENCES tto.tenant_slugs(slug_id),
  CHECK(valid_until IS NULL OR valid_until > valid_from),
  CHECK(status<>'REDIRECT' OR redirect_to IS NOT NULL),
  UNIQUE(tenant_id,slug),
  UNIQUE(slug_id,tenant_id),
  FOREIGN KEY(redirect_to,tenant_id) REFERENCES tto.tenant_slugs(slug_id,tenant_id)
);
CREATE UNIQUE INDEX tenant_one_current_slug ON tto.tenant_slugs(tenant_id)
 WHERE status='CURRENT';
CREATE TABLE tto.tenant_legal_profiles (
  profile_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
  registration_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK(jsonb_typeof(registration_refs)='array'),
  establishment_document_ref uuid,
  change_document_refs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK(jsonb_typeof(change_document_refs)='array'),
  declared_values jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK(jsonb_typeof(declared_values)='object'),
  status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(status IN ('UNVERIFIED','VERIFIED','SUPERSEDED')),
  approved_evidence_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,tenant_id)
);
-- For now these optional pointers do not certify record ownership/verification.
ALTER TABLE tto.tenants ADD CONSTRAINT tenant_current_slug_ref_fk
 FOREIGN KEY(current_slug_ref,tenant_id) REFERENCES tto.tenant_slugs(slug_id,tenant_id);
ALTER TABLE tto.tenants ADD CONSTRAINT tenant_legal_profile_ref_fk
 FOREIGN KEY(legal_profile_ref,tenant_id) REFERENCES tto.tenant_legal_profiles(profile_id,tenant_id);
-- The tenant-specific meaning of these links is checked by future
-- credentialed command handlers, not trusted from direct client input.

ALTER TABLE tto.parties
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(status IN ('UNVERIFIED','VERIFIED','MERGED','DISABLED')),
  ADD COLUMN IF NOT EXISTS canonical_name text,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES tto.parties(party_id);
CREATE TABLE tto.party_identifiers (
  identifier_id uuid PRIMARY KEY,
  party_id uuid NOT NULL REFERENCES tto.parties(party_id),
  identifier_type text NOT NULL,
  normalized_hash bytea NOT NULL CHECK(octet_length(normalized_hash)=32),
  protected_value bytea NOT NULL CHECK(octet_length(protected_value)>0),
  verification_status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(verification_status IN ('UNVERIFIED','VERIFIED','REVOKED')),
  verified_at timestamptz,
  CHECK ((verification_status='VERIFIED')=(verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX party_identifiers_verified_unique
 ON tto.party_identifiers(identifier_type,normalized_hash)
 WHERE verification_status='VERIFIED';

ALTER TABLE tto.user_party_links
  ADD COLUMN IF NOT EXISTS link_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK(status IN ('UNVERIFIED','VERIFIED','REVOKED')),
  ADD COLUMN IF NOT EXISTS basis text,
  ADD COLUMN IF NOT EXISTS evidence_ref uuid;
CREATE UNIQUE INDEX user_party_links_link_id_unique ON tto.user_party_links(link_id);

ALTER TABLE tto.relationship_projections
  ADD COLUMN IF NOT EXISTS relationship_id uuid,
  ADD COLUMN IF NOT EXISTS relationship_type text,
  ADD COLUMN IF NOT EXISTS relationship_status text;
-- Snapshot remains read-only source projection, not membership business truth.
CREATE TABLE tto.party_merge_cases (
  case_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
  survivor_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
  duplicate_party_id uuid NOT NULL REFERENCES tto.parties(party_id),
  evidence_ref uuid,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
  requested_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(survivor_party_id<>duplicate_party_id)
);
-- Source Child01: explicit revocation/status/start/end & authorization epoch
-- MUST take effect immediately even when session token itself remains unexpired.
CREATE OR REPLACE FUNCTION tto.has_tenant_role(p_tenant uuid, p_role text DEFAULT NULL) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto
 AS $fn$
 SELECT COALESCE(
   p_tenant=tto.context_tenant_id() AND
   EXISTS (
     SELECT 1 FROM tto.role_assignments a JOIN tto.tenants t ON t.tenant_id=a.tenant_id
     WHERE a.user_id=tto.context_actor_id() AND a.tenant_id=p_tenant
       AND t.status='ACTIVE' AND a.revoked_at IS NULL
       AND a.status='ACTIVE' AND a.scope_type='TENANT'
       AND (a.valid_from IS NULL OR a.valid_from<=now())
       AND (a.expires_at IS NULL OR a.expires_at>now())
       AND (p_role IS NULL OR a.role_code=p_role)
   ),false) $fn$;
CREATE OR REPLACE FUNCTION tto.resolve_session(p_hash bytea) RETURNS TABLE(user_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto
 AS $fn$
 SELECT a.user_id FROM tto.user_sessions s JOIN tto.user_accounts a ON a.user_id=s.user_id
 WHERE s.session_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now()
   AND s.security_epoch=a.security_epoch
   AND s.authorization_epoch_at_issue=a.authorization_epoch
   AND a.status='ACTIVE' LIMIT 1 $fn$;

-- Existing Party link approval writes verified_at; enforce a consistent
-- source-contract status atomically without granting extra runtime privileges.
CREATE FUNCTION tto.sync_verified_party_link_status() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,tto AS $fn$
 BEGIN
   IF NEW.status='REVOKED' THEN
     NEW.verified_at=NULL;
   ELSIF NEW.verified_at IS NOT NULL THEN
     NEW.status='VERIFIED';
   ELSE
     NEW.status='UNVERIFIED';
   END IF;
   RETURN NEW;
 END $fn$;
UPDATE tto.user_party_links SET status=CASE WHEN verified_at IS NOT NULL THEN 'VERIFIED' ELSE 'UNVERIFIED' END;
CREATE TRIGGER party_link_verification_status
 BEFORE INSERT OR UPDATE OF verified_at,status ON tto.user_party_links
 FOR EACH ROW EXECUTE FUNCTION tto.sync_verified_party_link_status();
REVOKE ALL ON FUNCTION tto.sync_verified_party_link_status() FROM PUBLIC,tto_app;

-- All newly created sensitive tables are owner-only; no app read/write or
-- SECURITY DEFINER mutation routes. Also forbid accidental service-role access.
DO $do$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY[
   'auth_identifiers','auth_factors','role_definitions','authority_references',
   'tenant_slugs','tenant_legal_profiles','party_identifiers','party_merge_cases'
 ] LOOP
  EXECUTE format('ALTER TABLE tto.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tto.%I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON tto.%I FROM PUBLIC,tto_app',tbl);
 END LOOP;
END $do$;
COMMIT;
