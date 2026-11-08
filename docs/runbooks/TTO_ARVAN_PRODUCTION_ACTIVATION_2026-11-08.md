# PH12 — ArvanCloud Production activation preflight (2026-11-08)

**Status: BLOCKED — production is NOT deployed.** This runbook is a controlled
preflight for the approved ArvanCloud production destination, not permission to
silently change production DNS, financial workflows, or real shareholder data.

## Provider facts verified at this checkpoint

- On the connected Supabase account, only TTO project
  `tto-national-preview-db` (`zkfwsgrgslxxlusxrwce`) is present.
  It must **never** be relabelled or reused as Production.
- The connected Vercel team currently exposes four **Preview-named** projects:
  `tto-api-preview`, `tto-national-preview`,
  `tto-cooperative-preview`, `tto-shareholder-preview`.
  Vercel deployment `READY` means build readiness only, not business acceptance.
- The repository's approved `docs/plan/ENVIRONMENT_AND_RELEASE_POLICY.md`
  designates **ArvanCloud** as the Production provider; Vercel Hobby is strictly
  synthetic, protected Preview. No connected ArvanCloud control-plane action
  or verified Arvan account/cluster is available in this checkpoint.
- `infra/arvan/k8s/base.yaml` is a portable **unapplied template**:
  registry/image entries are invalid placeholders, not releasable digests.
  It does not contain an ingress, TLS certificate, real credentials or live DNS.

## Operator sequence to reach a genuinely operational service

1. **Production environment and owner authority**:
   identify the ArvanCloud account, region, product, private namespace,
   approved operational domain, ingress/TLS and secret-manager boundaries.
   Collect evidence identifiers (not secrets) and exact owner authorization.
2. **Independent PostgreSQL 17**:
   provision a distinct production DB in an approved region; document data
   residency; apply reviewed migrations in sequence under controlled
   migration identity; provision a least-privilege runtime principal with RLS
   denial checks. Run and preserve a real backup + restore rehearsal BEFORE
   registering real cooperative or shareholder data.
3. **Four immutable images**:
   build the three Next.js portals and NestJS API from one reviewed exact SHA;
   scan and publish to the Arvan-approved private registry by immutable
   `@sha256` digest. Confirm deploy-time runtime configuration for
   `TTO_API_BASE_URL` and all server secrets, never browser-visible values.
4. **Backend + gateway and sessions**:
   make `GET /ready` prove restricted production DB access, establish trusted
   service-to-service ingress, rate-limit the root login, provision exactly one
   national root via the reviewed backend credential workflow (no raw SQL
   password override), validate mandatory credential rotation, session
   invalidation, strict origin and audit logs. Do not provide passwordless
   public national-root access.
5. **Acceptance before opening domain**:
   confirm authenticated national-root login, new cooperative onboarding,
   cooperative-manager login after approved provisioning, shareholder
   self-access with ownership checks, tenant isolation and recovery.
   Block real transfers or settlement until their own legal/operational gates
   are independently GREEN.
6. **Release and rollback**:
   obtain explicit owner release approval; stage deployment without public
   traffic, test exact live build, then enable ingress. Verify error monitoring,
   backups, restore and known-good rollback.

## Offline fail-closed gate added in this branch

Use `python3 scripts/ci/production_preflight.py <operator-evidence.json>`.
The JSON must remain **outside Git** and contain only nonsecret references.
The checker tests **presence/format** of the provider, production isolation,
four digest-pinned images, approval and critical acceptance evidence. It
returns BLOCKED for missing requirements and never deploys or checks external
references for authenticity.

Required root structure:

- `provider: "arvancloud"` and `environment: "production"`
- `release`: `owner_approval_ref`, `reviewed_commit` (40-hex SHA),
  `release_review_ref`
- `arvan`: `account_ref`, `cluster_ref`, `namespace_ref`,
  `region_approval_ref`, `tls_ingress_evidence`,
  `private_registry_evidence`, `secret_injection_evidence`,
  `rollback_evidence`
- `database`: `production_instance_ref` (MUST NOT identify Preview),
  `migration_evidence`, `restricted_role_evidence`,
  `backup_restore_evidence`, `residency_approval_ref`
- `images`: exact keys `shareholder`, `cooperative-management`,
  `national-admin`, `api` each containing a private-registry
  `repo/image@sha256:<64 hex>`
- `acceptance`: `national_login_e2e`, `cooperative_registration_e2e`,
  `cooperative_login_e2e`, `shareholder_login_e2e`,
  `tenant_isolation_e2e`, `audit_evidence`, `security_signoff`

Every evidence reference must be human-verified and correspond to the exact
release commit and production environment. Passing the offline gate is
**not** proof of deployment or authorisation to deploy.

## Current checkpoint

- Provider inventory: **DONE** (Vercel + Supabase).
- ArvanCloud live account/cluster access: **NOT_CONNECTED**.
- Independent Production DB, region and restore: **NOT_PROVISIONED**.
- Production images/secret injection/domain/OIDC equivalent: **NOT_VERIFIED**.
- National root actual login and three-portal E2E: **NOT_VERIFIED**.
- Production deploy / merge / data mutation: **NONE**.
