# Child06/07 source-import staging and reconciliation — 2026-10-23

## Purpose
Next tranche after Draft PR #18. This does not authorize connection to live member master, official ledger, or a change to hosted Supabase. It supplies a disposable-CI-only quarantine surface so a future approved adapter cannot silently turn unverified claims into member status or shares.

### Inputs and immutable evidence
- tto.source_import_batches is append-only and tenant/domain/source/batch-reference scoped, with SHA-256 artifact digest, submitter and optional independent attestor/document evidence; no raw personal data, payment fields or identity secrets.
- tto.source_import_claims is append-only, typed Child06 or Child07 metadata (Party/account reference, canonical event/version or ledger entry/version, effective date, positive integer share count including an explicit 0, per-claim digest).
- All tables are REVOKE ALL from tto_app/PUBLIC; forced RLS and immutable triggers deny UPDATE/DELETE. **No runtime importer, source provider connector, or public endpoint is created.**
- Pure assessment function tto.assess_source_import_claim is ungranted to tto_app and PUBLIC. It never writes to snapshots, membership decisions, ownership ledger or source contracts.
- Before a claim can be considered READY_FOR_INDEPENDENT_REVIEW: active tenant; explicit tenant-domain approved source reference with legal/document evidence; independent submitter/attestor; published same-tenant attestation evidence; domain and tenant consistency; effective date not in future.
- Child06 assessment compares event id/version/status to authoritative Member Master projection and existing source snapshot. Child07 requires correctly mapped active shareholder account and independent Child06 source approval, then identifies replay, same-version conflict, stale ledger version, version gap, time regression and reused ledger reference.
- READY_FOR_INDEPENDENT_REVIEW is **not** approval, promotion or proof of source authenticity. Actual cryptographic/official-source attestation, human legal approval and provenance checks are outside this phase.

### Tests and withheld capabilities
Synthetic PG17 E2E asserts quarantined unreviewed claims, SoD failure, published-evidence and domain mismatch denials, replay/gap/conflict, restricted SQL reads, immutable import receipts and no share/membership mutation from assessment.
Host database migration 0010 is NOT APPLIED. Neither Child06/07 final acceptance nor real financial/shares operations is enabled.
