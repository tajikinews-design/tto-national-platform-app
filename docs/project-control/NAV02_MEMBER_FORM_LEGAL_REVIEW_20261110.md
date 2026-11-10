# NAV02 — درخواست عضویت اشخاص حقیقی | بررسی قانونی 2026-11-10

Parent: PR #182 at e7496b29fe90917cc5d62a63b815dc0f2c78df90.
This stacked branch is **not merged or deployed**. All formal legal acceptance gates remain HOLD.

## UI
- «افزودن اعضا» (member applicants) is now natural-person only; nonmember individual/corporate shareholders require their own source-reviewed entry workflow.
- 10-digit national code checksum, with conversion of Persian/Arabic numeric input. A valid check digit **never** proves ownership of that identity; Shahkar/PersonInfo or equivalent authorized government-backed identity verification is separate.
- First row photo with immediate **local** object URL preview; photo bytes when submitted remain encrypted in nonpublic quarantine, not publicly retrievable without independent scanning and lawful release.
- Title and full name on same row; date of birth and birthplace on same row; no synthetic-only warning paragraph on the add page.
- Article 2 (1389 law) and sample bylaws Article 10 (1391): birth OR residence OR employment in the relevant county; at least one declaration required and encrypted, not all three.
- The declaration is stored as `APPLICANT_UNVERIFIED`; no automatic member role, voting rights, share ownership, board authority or official ledger mutation.
- Nonmember shareholder votes and approvals in Article 11/17 belong in independent legal-rule decisions, never applied implicitly by this form.

## Operations and privacy gates
- New `memberProfile` action is separate from the previous synthetic `profile` pathway. The server requires both `TTO_NAV02_MEMBER_INTAKE_ENABLED=true` and `TTO_NAV02_REAL_PII_ENABLED=true`; without formal security/privacy/retention approval the API rejects real-data registration (503), without storing bytes.
- Preview and production remain independently gated; do NOT enable either flag, send real records into the public preview, or deploy without a signed protection plan and owner UAT.
- Even if future authorized draft collection is turned on, server result is an *unverified applicant*, not the legal membership master. Source owner, board approval, legal basis, consent, photo scanning, erasure/retention and incident-handling plan are separately required.
- The preexisting encrypted preview row and photo remain untouched. Existing synthetic management/delete actions cannot be assumed applicable to real applicants.

## Verified legal text and external checks
- Law Article 2: https://amagestate.com/legal/establishment-district-development-cooperatives/
- Bylaws Articles 10/11/17: https://amagestate.com/legal/county-cooperative-development-bylaws/
- Provider SDK describes separate Shahkar and PersonInfo verification: https://github.com/api-ir/php-sdk
- The actual registered cooperative's bylaws and later amendments prevail for case-specific authorizations.

## Next evidence
Source and full build CI on exact HEAD, independent authenticated Preview UI test (no real PII), authorized data-controller decision, separate official Child06/07 membership/shareholder paths, and final legal source approval. No Merge / Production deploy.
