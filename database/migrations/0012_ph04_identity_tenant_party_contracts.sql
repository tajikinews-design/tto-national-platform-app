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
-- Active or redirecting slugs are globally reserved, not only unique per Tenant.
CREATE UNIQUE INDEX tenant_slug_global_live_unique ON tto.tenant_slugs(slug)
 WHERE status IN ('CURRENT','REDIRECT');
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
-- CHILD02 authorized immutable Tenant slug transition; optimistic version & redirect.
CREATE FUNCTION tto.change_tenant_slug(p_tenant uuid,p_new_slug text,p_expected_version bigint)
 RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
 SET search_path=pg_catalog,tto AS $fn$
 DECLARE old_slug text;old_version bigint;current_state text;new_id uuid:=gen_random_uuid();
 BEGIN
  IF tto.context_actor_id() IS NULL OR p_tenant IS DISTINCT FROM tto.context_tenant_id()
    OR NOT tto.has_verified_authority(p_tenant,'TENANT_LIFECYCLE')
    OR p_new_slug !~ '^[a-z0-9][a-z0-9-]{1,100}$'
    OR p_expected_version IS NULL OR p_expected_version<1
  THEN RETURN false;END IF;
  SELECT slug,version,status INTO old_slug,old_version,current_state
   FROM tto.tenants WHERE tenant_id=p_tenant FOR UPDATE;
  IF NOT FOUND OR old_version<>p_expected_version
    OR current_state NOT IN('SETUP_PENDING','ACTIVE') THEN RETURN false;END IF;
  IF old_slug=p_new_slug THEN RETURN true;END IF;
  BEGIN
   UPDATE tto.tenant_slugs SET status='RETIRED',valid_until=clock_timestamp()
    WHERE tenant_id=p_tenant AND status='CURRENT';
   INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from)
    VALUES(new_id,p_tenant,p_new_slug,'CURRENT',clock_timestamp());
   UPDATE tto.tenant_slugs SET status='REDIRECT',redirect_to=new_id,
       valid_until=clock_timestamp()
    WHERE tenant_id=p_tenant AND slug=old_slug;
   IF NOT FOUND THEN
    INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from,valid_until,redirect_to)
     VALUES(gen_random_uuid(),p_tenant,old_slug,'REDIRECT',
      clock_timestamp()-interval '1 second',clock_timestamp(),new_id);
   END IF;
   UPDATE tto.tenants SET slug=p_new_slug,current_slug_ref=new_id,version=version+1
     WHERE tenant_id=p_tenant AND version=p_expected_version;
   IF NOT FOUND THEN RETURN false; END IF;
   PERFORM tto.append_actor_audit(p_tenant,'TENANT_SLUG_CHANGED',p_tenant);
  EXCEPTION WHEN unique_violation OR check_violation OR foreign_key_violation THEN
   RETURN false;
  END;
  RETURN true;
 END $fn$;
REVOKE ALL ON FUNCTION tto.change_tenant_slug(uuid,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tto.change_tenant_slug(uuid,text,bigint) TO tto_app;

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

-- Actor-visible tenant options obey the same revoked-role/Party-link checks.
CREATE OR REPLACE FUNCTION tto.list_actor_tenant_options()
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
   AND r.tenant_id=t.tenant_id AND r.revoked_at IS NULL AND r.status='ACTIVE' AND r.scope_type='TENANT'
  AND (r.valid_from IS NULL OR r.valid_from<=now()) AND (r.expires_at IS NULL OR r.expires_at>now()))
  OR EXISTS(SELECT 1 FROM tto.jit_access_grants g WHERE g.requester_id=a.uid
   AND g.tenant_id=t.tenant_id AND g.status='APPROVED'
   AND g.decided_at IS NOT NULL AND g.approver_id IS NOT NULL
   AND g.approver_id<>g.requester_id AND g.expires_at>now())
 ))
SELECT e.tenant_id,e.display_name,
 EXISTS(SELECT 1 FROM tto.role_assignments r CROSS JOIN actor a WHERE
  r.tenant_id=e.tenant_id AND r.user_id=a.uid AND r.role_code='MEMBER'
  AND r.revoked_at IS NULL AND r.status='ACTIVE' AND r.scope_type='TENANT'
  AND (r.valid_from IS NULL OR r.valid_from<=now()) AND (r.expires_at IS NULL OR r.expires_at>now())),
 EXISTS(SELECT 1 FROM tto.role_assignments r CROSS JOIN actor a WHERE
  r.tenant_id=e.tenant_id AND r.user_id=a.uid AND r.role_code='COOPERATIVE_MANAGER'
  AND r.revoked_at IS NULL AND r.status='ACTIVE' AND r.scope_type='TENANT'
  AND (r.valid_from IS NULL OR r.valid_from<=now()) AND (r.expires_at IS NULL OR r.expires_at>now())),
 EXISTS(SELECT 1 FROM tto.user_party_links l CROSS JOIN actor a WHERE
  l.user_id=a.uid AND l.status='VERIFIED' AND l.verified_at IS NOT NULL),
 EXISTS(SELECT 1 FROM tto.user_party_links l
  JOIN tto.relationship_projections p ON p.party_id=l.party_id AND p.tenant_id=e.tenant_id
  CROSS JOIN actor a WHERE l.user_id=a.uid AND l.status='VERIFIED' AND l.verified_at IS NOT NULL
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
