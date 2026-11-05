# PH10.9 — Independent Gazette Claim Review | Design Gate v0.1

Status: **DESIGN ONLY / IMPLEMENTATION NOT RUN / LEGAL AUTHENTICITY BLOCKED**  
Issue: #161. Dependency: Draft PR #160.  
Source baseline: `093508cf5bc3858ea319c00d2d9ac0abf1592fe4`, isolated dossier workflow `42056193108` SUCCESS.

## 1. Existing behavior to preserve
- Authorized cooperative managers record their own Gazette references for board members, CEO and signatories.
- Required per-claim citation: official issue number, official publication date and official announcement number.
- Existing claim records are immutable; correction creates a new claim referencing its predecessor; no second successor for one predecessor.
- Self-reports remain `SELF_REPORTED_PENDING_REVIEW` and can never independently grant roles or lawful signatory authority.
- The current manager history is private and bounded to the first 100 rows, with `hasMore` but no continuation cursor.
- Rasmio commercial API remains out of scope by an approved business decision.

## 2. Separation of evidence and authority
1. **Claim:** manager's versioned self-report. The manager's authority to submit must be verified independently from the submitted claim.
2. **Review finding:** an independently mandated reviewer's dated, append-only assessment, always bounded to a specified claim version and source evidence. Allowed outcomes: `MATCH_REPORTED_UNVERIFIED`, `MISMATCH_REPORTED`, `INCONCLUSIVE`.
3. **Official-source verification:** out of scope until a primary-source validation method and reviewer mandate provenance are separately approved. A matching citation, uploaded document, hash or ClamAV result does **not** prove legal authenticity.
4. **Operational authority:** a separate legal and role-activation workflow. Never triggered by an inserted claim or reviewer finding.

## 3. Required future technical contract
- Append-only reviewer finding identity linked to `claim_id`, reviewer user ID, verified mandate, mandate version, tenant, canonical source locator/digest, evidence receipt reference, outcome, justification and creation timestamp.
- Same-session actor binding and explicit authorization, tenant separation, no reviewer-manager self-certification, mandate expiry/revocation checks and audit trail.
- Concurrent and replay requests must be deterministic; mutating past claims or reviews is prohibited.
- Reviewing a corrected claim must not rewrite or silently make the preceding review authoritative; display correction chain and review history explicitly.
- Paginated, bounded history using a stable ordering `(created_at, claim_id)` and an opaque validated cursor; do not expose arbitrary offsets, unrestricted scans or cross-tenant rows.
- Responsive Persian RTL interface, clear status distinction between claim, reviewer report and verified official source, accessible empty/error/loading states, and no display of unnecessary personal details outside the authorized audience.
- No change to `tto.tenants`, `tto.role_assignments`, `tto.legal_authorities`, payment/share records, or public shareholder disclosure.

## 4. Acceptance proof (implementation not yet performed)
| ID | Required synthetic test |
| --- | --- |
| GAZ-REV-01 | Authorized independent reviewer with live valid mandate can append a finding for the matching tenant and claim |
| GAZ-REV-02 | Expired, revoked, forged, absent, or tenant-mismatched mandate is denied |
| GAZ-REV-03 | Manager and subject of the claim cannot self-certify |
| GAZ-REV-04 | Existing claim and previous findings remain immutable across corrections |
| GAZ-REV-05 | Two concurrent successor attempts on same claim yield at most one append |
| GAZ-REV-06 | Duplicate/replay attempts cannot silently create a second differing review |
| GAZ-REV-07 | Page traversal exceeds 100 records without duplicates/omissions under stable snapshot/ordering |
| GAZ-REV-08 | Logged-out and wrong-tenant HTTP and Chromium paths fail closed |
| GAZ-REV-09 | Browser mobile RTL and keyboard navigation show claim vs reviewer outcome accurately |
| GAZ-REV-10 | Findings never create roles, tenants, legal grants, share trades or approvals |
| GAZ-REV-11 | Isolated PostgreSQL17 migration, real BFF/Nest HTTP, Chromium, Adaptive Security and stacked PH10 tests run on exact same SHA |
| GAZ-REV-12 | Official-source verification and production gates stay explicitly BLOCKED without independent evidence |

## 5. Release gates
- The passing workflow `42056193108` covers the **previous manager-history feature**, not any of the future GAZ-REV cases.
- This design file is not a running implementation and implies **no new tests passed**.
- Keep parent PR #160 Draft, no Merge, no Deploy, no hosted Preview migration, no real identity documents and no operational share/payment transactions.
- External primary-source authenticity, provenance of independent reviewer appointment, KMS/key-custody and retention policy, and full platform acceptance remain separate release prerequisites.
