# ADR — TTO-AUTH-UI-V1: freeze of approved authentication and commerce-order UI

**Decision date:** 2026-11-09  
**Status:** **APPROVED / UI GREEN / FROZEN**  
**Approving authority:** TTO product owner, explicit sign-off in the project conversation.  
**Scope:** presentation and interaction design of National Admin, Cooperative Manager, Shareholder login, customer OTP signup, and cooperative subscription order.  
**Approved source commit:** `51171ab034e29c31d52026fc39380fb4a636fad7`  
**Frozen snapshot branch:** `freeze/tto-auth-ui-v1-approved-20261109` (created from the exact approved commit).  
**Machine-readable reference:** `docs/design/TTO-AUTH-UI-V1-FREEZE.json`.  
**CI guard:** `scripts/ci/test_ph12_auth_ui_freeze.py` (full Git blob fingerprints for ten source files).

## What the owner approved

1. Unified branded RTL design (navy, turquoise and white, Vazirmatn, responsive layout) across National Admin, Cooperative Manager, and Shareholder login.
2. Same design language for OTP customer registration and cooperative plan/checkout.
3. **Compact desktop** cards: approx. **20% narrower and shorter** than the original; targeted at **870px** width / **615px** base height, centered on laptop/monitor displays. Never hide critical controls on smaller displays merely to eliminate scrolling.
4. OTP option and password option for cooperative/shareholder; server-authoritative OTP lifetime **60 seconds** with a live countdown. National-root OTP remains **disabled** until role-specific authentication is approved.
5. The three-step commerce-order UI preserves the preview **DEMO_AMOUNT_ATTESTED** contract; **no real banking payment** is implied, and **no statutory shareholder/manager authority** is granted by a purchase.
6. The feature's other identity, accounting, legal-operation and tenant-boundary contracts are *not* broadened by this UI sign-off.

## Acceptance evidence

| Evidence | Result |
| --- | --- |
| PH12 three-portal linked Preview UI build | **SUCCESS** — GitHub Actions run `42583354550` |
| TTO adaptive security CI, single runner | **SUCCESS** — GitHub Actions run `42583354374` |
| National Admin Preview | **READY** — `dpl_523hDfjvo8axRZM4VDKYbTwZ5gpL` |
| Cooperative Manager Preview (also signup + order) | **READY** — `dpl_Bh1HD8tgpTBsv85hLqtbGBe2VYTS` |
| Shareholder Preview | **READY** — `dpl_2QPgHX8TKZAxfq2AoLhNfWkFwhiH` |

**Preview reference URLs:**

- National Admin: `https://tto-national-preview-4t0959glu-tajikinews-6739.vercel.app/login`
- Cooperative Manager: `https://tto-cooperative-preview-gqg0tb3wa-tajikinews-6739.vercel.app/login`
- Shareholder: `https://tto-shareholder-preview-bem7uf8d3-tajikinews-6739.vercel.app/login`
- OTP customer registration: `https://tto-cooperative-preview-gqg0tb3wa-tajikinews-6739.vercel.app/customer-register`
- Commerce order: `https://tto-cooperative-preview-gqg0tb3wa-tajikinews-6739.vercel.app/subscribe`

The user has explicitly accepted the visual design. Automated build/security evidence is GREEN. This is **not** proof of live browser checks for every monitor resolution or full end-to-end banking/SMS operation. Do not conflate UI GREEN with production readiness.

## Freeze enforcement

- **No edits** to the ten pinned files in `TTO-AUTH-UI-V1-FREEZE.json` without renewed **explicit product-owner approval**.
- `test_ph12_auth_ui_freeze.py` uses exact Git blob hashes; altering any pinned byte without a new reviewed freeze causes **CI failure**. The PH12 preview UI workflow runs it before building. Adaptive security CI also runs it through Python test discovery.
- Freeze exceptions must be proposed as a separate `TTO-AUTH-UI-V2` decision: document reason, obtain owner approval, update snapshot/fingerprints, re-run *both* gates and review previews.
- No forced modification or re-pointing of the snapshot branch. Approved commit SHA remains the historical immutable source-of-truth.
- Branch-level immutable enforcement is **not in place** merely because this ADR and CI gate exist. For organizational enforcement, an administrator must configure a GitHub repository ruleset requiring passing checks and reviews for these paths/branches; do not imply that CODEOWNERS or this document alone prevents an administrator from bypassing checks.

## Release and safety boundary

**UI-approved GREEN; broader TTO product and Production remain HOLD.** No merge to `main`, Production/Arvan deploy, DNS change, real bank payment, real share action, or customer-data mutation is authorized by this record.

**Next unrelated feature work:** extend separate modules or pages without modifying pinned login/registration/order visuals. For corrections inside this scope, request owner approval and issue a newly versioned freeze.
