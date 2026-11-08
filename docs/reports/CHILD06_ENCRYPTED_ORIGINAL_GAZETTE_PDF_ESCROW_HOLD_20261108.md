# CHILD-06 / PH12 — Original Gazette PDF encrypted escrow (HOLD)
Date: 2026-11-08

## Scope and boundary
This follow-on to PR #172 and Issue #171 adds a **development-only, immutable,
encrypted PDF quarantine** bound to a CHILD-06 conflict-evidence row and a
same-tenant **issuer candidate**. This is NOT issuer authentication, legally
certified publication, or authorization for tariff ACTIVE, legal signatory
status, financial operations or share transfer.

## Implementation
- Migration **0058** creates `tto.cooperative_governance_source_files`:
  tenant/case/evidence linkage, same-tenant proposed issuer, SHA-256 of plaintext,
  AES-256-GCM IV/tag/ciphertext, immutable status, intake actor/request key,
  fixed negative legal flags, FORCE RLS, no raw `tto_app` grants.
- `cooperative_store_governance_source_file` is SECURITY DEFINER, restricted to
  the manager who opened the case and recorded that evidence, and only a
  matching candidate issuer of compatible declared purpose/kind. If the
  source row included a *claimed* attachment SHA, it must equal the measured
  plaintext SHA. Existing immutable conflict dispositions cannot gain new
  late evidence. Atomic idempotent request-key replays cannot change binding.
- `cooperative_governance_source_integrity_packet` reads only encrypted bytes
  under tenant and role context; it never directly grants raw table access.
- NestJS experimental endpoints:
  - `POST /v1/tenants/:tenantId/child06/governance-conflicts/source-files`
  - `GET /v1/tenants/:tenantId/child06/governance-conflicts/source-files/:fileId/integrity`
- Explicit opt-in: `TTO_CHILD06_ORIGINAL_PDF_ESCROW_ENABLED=true`,
  `TTO_CHILD06_PDF_ESCROW_KEY_HEX` must be a 32-byte hex key provided
  by the test environment. **VERCEL blocks both APIs.**
- JSON PDF intake is limited to 512 KiB with strict canonical Base64, PDF
  header/EOF validation. AES-256-GCM additional authenticated data includes
  tenant and evidence UUID, preventing cross-binding ciphertext replay.
- No raw PDF output is exposed; integrity GET decrypts inside API,
  authenticates the GCM tag, rehashes plaintext, compares the SHA-256 digest,
  checks PDF magic, zeroes the decrypted buffer, and only reports
  `integrity:MATCH` or fails closed.
- Malware status is **NOT_SCANNED_QUARANTINED** even when digest matches.
  No route promotes data from quarantine.

## Security exclusions / next acceptance
1. **No official proof of source:** an issuer candidate is just a declaration.
   Must integrate independently authenticated registry/Gazette provenance,
   signed issuer responses, trust anchor rotation and revocation.
2. **No clean-file attestation:** run ClamAV/freshness checks on content in a
   fenced scanner; reject malicious PDFs and guard against active-content
   processing before permitting any authorized download.
3. **No key lifecycle:** move lab-only key to managed KMS/HSM; implement
   envelope-key rotation and revocation, independent durable encrypted backups,
   offsite integrity checkpoint and operational recovery tests.
4. **Limited file size and format:** current bounded JSON intake is an
   intentionally restricted technical pilot, not a full production document
   repository. Production should use resumable streamed uploads with strict
   quotas, rate limits and backpressure.
5. **No comprehensive behavioral E2E yet:** dedicated PG17 CI tests
   installation, RLS, immutable triggers and negative flag schema. Full
   manager/reviewer HTTP, multi-tenant, bad-key/tag and backup restore tests
   are separate acceptance gates before technical GREEN.
6. No PR merge, deployment, data migration on hosted databases, real legal
   approval, tariff activation, payment or share operation is authorized.

## Evidence
Migration: `database/migrations/0058_child06_original_pdf_encrypted_escrow_hold.sql`
Structural tests: `tests/sql/child06_original_pdf_escrow_fence.sql`
Workflow: `.github/workflows/ph12-board-legal-source-pg17.yml`

CI status is **not assumed** from the act of committing; review the run
conclusion and job logs before assigning PG17 GREEN. PH12 legal = HOLD,
tariff ACTIVE = BLOCKED, PR Draft, no Merge/Deploy.
