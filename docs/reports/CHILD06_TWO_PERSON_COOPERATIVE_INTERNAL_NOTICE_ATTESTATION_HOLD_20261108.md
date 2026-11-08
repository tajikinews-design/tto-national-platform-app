# CHILD-06 | Owner-approved cooperative dual attestation — Stage 1 (DRAFT, NO DEPLOY)

**Decision:** An authenticated person representing a cooperative may state responsibility for the accuracy of an uploaded Gazette/registration PDF; TTO requires TWO DISTINCT verified legal-person representatives before marking the record *internally attested*. CEO + board chair is one possible combination; two registered signatories is another. This is NOT official Gazette issuer confirmation, an effective electronic legal signature, or permission to activate tariffs.

## Current data contract — migration 0061
- `cooperative_notice_attestation_policies`: one cooperative-scoped externally seeded policy, available combinations `CEO_AND_CHAIR` / `REGISTERED_SIGNATORY_PAIR`; independent trust reference and digest *different from the target PDF*.
- `cooperative_notice_trusted_signatories`: independently seeded per-user **natural-person Party** mapping, independent authority evidence and recorded capacity. A system manager role by itself creates no signatory entitlement.
- `cooperative_notice_internal_attestations`: append-only confirmation bound to exact file UUID + SHA-256 and per-person identity; DB uniqueness forbids same account or same Party from voting twice. Submitter cannot vote. Trusted person must be an ACTIVE authenticated tenant participant and have exactly one verified PERSON Party link.
- `cooperative_notice_internal_attestation_holds`: dispute, revision/supersession, identity compromise and signatory revocation. HOLD status takes precedence over prior votes.
- `cooperative_notice_trust_revocations`, `cooperative_notice_policy_revocations`: append-only independent cancellation of power and trust policy. Derived status revalidates all votes on each read.
- All tables FORCE ROW LEVEL SECURITY, immutable triggers, **no app-role raw-table privileges**; only restricted `SECURITY DEFINER` status/confirm/hold functions exposed.
- Requires preceding independent CLEAN scanner receipt. Scanner state or two confirmations **never** modifies `official_issuer_authenticated`, `legal_authority_granted`, tariff status, share ownership or legal disposition.

## Bootstrap policy: never believe the uploaded document about its own signing powers
Independent platform onboarding reviews natural person identity and authority source before a privileged migration/platform owner seeds the trusted roster. No API/tenant manager permission to seed. The incoming document's own hash must not match the bootstrap/authority evidence hash. External onboarding, verified witness IDs and legal signatory rule still require a real approved process before production.

## Positive and adversarial PG17 scenarios
1. No bootstrap: HOLD, even if source file uploaded and scanned.
2. Two different verified PERSON parties with CEO + CHAIR registered in separate trust roster rows: internally attested only.
3. One vote: pending. One person, two accounts: unique Party voter (and roster) prevents.
4. Wrong tenant, role, signer, uploader self-vote, incorrect digest: fail closed.
5. Same request replay: stable immutable event; modified request: rejected.
6. Legal dispute/superseded document, independent revocation of a signatory: prior vote history retained, internal readiness downgraded immediately.
7. `officialIssuerAuthenticated`, `legalAuthorityVerified`, `tariffActivated`, `bindingSignatureAuthorized` always false.

## Unimplemented / required for next development stage
- HTTP API routes + feature flag, explicit user-side signing acknowledgement UI and identity-bound reauthentication / MFA challenge. DB smoke uses independently validated user context in CI; this is *not* genuine in-app step-up authentication.
- An independently verified signatory authority onboarding workflow with evidence auditing, user→unique Party identity resolution, board term/revocation and registered joint-signature rule per cooperative. Two votes may be insufficient for some legally binding signing combinations.
- Legal sign-off about use of cooperative dual confirmation for internal flows, and rules for any legally binding electronic signature. If issuer-authenticity checks cannot be done, maintain the provenance label explicitly as **cooperative attestation**, not verified publication.
- Tariff activation is independently BLOCKED, and issuer source and operational Vault/offsite DR gates remain HOLD.

**Operations:** Draft PR #177 stacked on #176, #175, #174, #172; no Merge, Deploy, production DB mutation, transfers or financial acts. All test identities are synthetic.
