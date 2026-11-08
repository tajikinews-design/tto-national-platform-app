# PH12 P0: Approved 3-dashboard identity and REAL company data staging — 2026-11-08

## Approved UX references (NOT a redesign)
**Owner-authoritative DOCX:** `TTO-DASHBOARD-UI-IMPLEMENTATION-HANDOFF-v1.0.docx` held in connected Google Drive. Three approved reference filenames in canonical `tajikinews-design/tto-national-platform`:
- A national: `persian_cooperative_analytics_dashboard.png`; documented SHA256 `06b85afb530c9059688e5a38f5826c9607e816d0b8d5d5bd82e6e400fe5cf5db`.
- B cooperative: `persian_cooperative_management_dashboard.png`; **same SHA256** as national. This is **known and explicitly documented in the APPROVED UI handoff**; national uses the same layout, but national meanings/KPIs come from profile E, not invented national figures.
- C shareholder: `persian_shareholders_dashboard_overview.png`; SHA256 `b7828e00f02ee8c7343f32bdc982aad9464989397302fe5d543fb39efb781d82`.

Both unique 1672x941 images were extracted and visually inspected from approved DOCX (shared right Sidebar + TopHeader, full-width Hero and ad area, four KPI cards, two identical aligned rows with columns **26/33/41** from right to left, alert/actions/chart and campaigns/ads/mini metric widgets). All three surfaces reuse `ApprovedDashboardHome` and `PortalShell`; no extra brochure navigation grid. IMPORTANT: branded original city/people artwork, logo/avatars and advertisement creatives are not yet independently available as separate approved image assets. Current Hero CSS and empty ad slots match area geometry and semantics but **cannot claim pixel-identical visual acceptance** until approved original assets are provided and screenshot comparison made at 1672x941 and mobile.

## Owner's REAL-data direction (binding)
The owner specifies that a **real cooperative's actual registration, manager and member records** will be entered to test the real platform, then removed from the test environment. They are **not synthetic fixtures** and must never be treated as public demo content. They may be legally sensitive/personally identifiable.

Preconditions **BEFORE ANY REAL UPLOAD**:
1. Explicit staging environment and controller identity, data minimization and lawful permissions; no real record in GitHub issues/actions/logs, Vercel public Preview, demo fixtures, screenshots, telemetry payloads or published assets.
2. Restricted dedicated encrypted staging PG17 and file storage with tenant isolation and **verified** access control. Confirm project ownership, HTTPS end-to-end, sessions, MFA/step-up where legally meaningful, credential secrets, backup & restore policies, retention, access log and error-masking behavior. The previous Vercel READY flag does not prove these gates.
3. Every company and natural-person entry must have an auditable consent/authority and purpose, owner responsible for accuracy, data classification and a list of storage sinks (database, uploads/object storage, backups, logs, secrets, browser caches, third-party services).
4. Contract for deletion BEFORE first real write: a documented deletion request, owner approval, planned expiry, scoped purge of PostgreSQL, file objects, sessions, derived search/analytics, error traces and backups after their retention period; demonstrate deletion evidence. It is misleading to promise instant complete deletion if immutable audit or backup policy prevents it. Use encryption-key expiry/cryptographic deletion when legally and operationally appropriate, preserve required regulatory audit with lawful minimization; do not blindly delete protected legal records.
5. All issuance of legally binding documents, Gazette authenticity, tariff ACTIVE, share transfers, payments and production data changes remain HOLD, even if test records are real.
6. `TTO_SECURE_REAL_DATA_STAGING_ENABLED` and `TTO_PORTAL_PASSWORD_LOGIN_ENABLED` MUST be true only after gate review on isolated **Preview**; unset by default. No additional credentials are created automatically.

## Isolated three separate sign-ins
- National: existing proven root username/password, forced first-login rotation, isolated `/login`.
- Cooperative: `/login` with account-specific username/password; role `COOPERATIVE_MANAGER` and exact tenant UUID + slug verified in PG and session binding.
- Shareholder: separate `/login`; `MEMBER` scope and tenant, no implicit share ownership/voting.
- DB migration 0062 provides independent offline identity provisioning, scrypt hashes, rate-limited sign-in, low-duration session, role revocation checks, FORCE RLS, `portal_password_session_bindings` which reject tokens obtained by SMS OTP/other portal as proof of password login. Neither username nor password appears in browser JS after BFF processing.
- No self-registration or credential seeding from an unverified gazette notice. Provisioning an actual cooperative manager requires identity/role verification. A newly reserved `/c/slug` alone **cannot** create a manager role or legal activation.

## Registration chain and current dependency
- National root `/login` -> `/cooperatives/new` reserves cooperative URL `/c/{slug}`.
- National root then opens `/cooperatives/onboarding?slug={slug}` to record a real dossier (existing endpoint, staging-gated).
- `/c/{slug}` presents configured cooperative portal login `/login?workspace={slug}`; candidate account cannot proceed until independently verified and provisioned against an ACTIVE tenant (or future explicitly restricted PENDING-workspace login, **not built in this PR**).
- Cooperative portal `/c/{slug}` verifies password-session role and actual DB context slug before rendering. An attacker changing the URL slug cannot access another cooperative.
- Shareholder follows independent session binding to verified `MEMBER` role and tenant. **No data in an unverified session.**

## Tests and acceptance
- `scripts/ci/ph12-approved-dashboard-roles-contract.cjs`: static geometry/3 login/no fake values/role & real data guards.
- `tests/sql/ph12_separate_portal_password_login_fence.sql`: PG17 migration 0062, FORCE RLS, no app raw credential access, reject fake accounts/sessions; must be run with migration owner in disposable DB.
- Existing multi-panel build and legacy 507 PG17 E2E remain relevant but DO NOT substitute independent success of real-data workflows.
- Still missing: actual separate approved city/banner creatives, pixel comparison, manager invitation+verification/credential activation, independent real-data staging audit, browser-based login/out flows, safe real-data export/purge proof. These are BLOCKERS to real-data deployment and legal acceptance.

## Status
DRAFT and NOT operational approval. No Merge, production Deploy, real cooperative data input, active share transactions or legally binding signatures in this development stage. Release only isolated Preview **after** successful builds and honest safety review.
