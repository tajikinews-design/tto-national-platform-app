# PH12 / ARDAKAN — attempted issuer-native legal identity verification
**Date (UTC):** 2026-11-08 | **Gate:** PILOT-01 + PILOT-02 | **Issue:** #171 | **Draft PR:** #172
**Result:** `HOLD_OFFICIAL_REGISTRY_RESPONSE_UNAVAILABLE`; no official ID/registration/governance records authenticated.

## Exact research subject — NOT yet an authorized TTO tenant
- Alleged legal-person name: `شرکت تعاونی توسعه و عمران شهرستان اردکان`.
- Alleged 11-digit Iranian legal-person ID: `14010206904`.
- Alleged registration number: `1770` (county/office must also match; number alone is not globally unique).
- Alleged registration date: `1400/05/19`.
- **Origin of all four assertions:** self-described cooperative Telegram channel; a third-party mirror/directory only cross-references the legal-person ID. Treat as `PUBLIC_SELF_CLAIM`, not `ISSUER_CERTIFIED`.

## Source retrieval evidence and trust status
| Check | Source | Method | Observed outcome | Evidentiary rank |
| --- | --- | --- | --- | --- |
| SR-01 | https://ilenc.ssaa.ir/ | direct browser/open; separate live scrape request | timed out / no source-native lookup result, no query proof returned | NO_OFFICIAL_RESPONSE |
| SR-02 | https://www.rrk.ir/ | direct browser/open; separate live scrape request | timed out / no source-native Gazette notice | NO_OFFICIAL_RESPONSE |
| SR-03 | https://irsherkat.ssaa.ir/ | direct browser/open | timed out; no source-native filing | NO_OFFICIAL_RESPONSE |
| SR-04 | https://agahi.ssaa.ir/ | direct browser/open; separate live scrape request | inaccessible/timed out; proposed additional SSAA bulletin source, **not confirmed current for this case** | NO_OFFICIAL_RESPONSE |
| SR-05 | https://t.me/s/ttoardakan?after=11 | public page fetched and read | self-declared name, registration number, legal ID, 1400 date. Historical board list visible but NOT a current legal mandate | UNVERIFIED_SELF_PUBLICATION |
| SR-06 | https://iran-gazette.com/c/qeynxmdwcd9a/ | web search index | third-party, automatically extracted **cross-reference** to ID in *another* company's page. No original gazette document or notice number. | NON_AUTHORITATIVE_INDEX |
| SR-07 | official-domain restricted web searches `14010206904`, `۱۴۰۱۰۲۰۶۹۰۴`, Ardakan exact name | multiple search engines | no issuer-hosted authenticated case-specific entity record or gazette notice located | NO_OFFICIAL_RESPONSE |

**A source being unreachable is not evidence that the cooperative is fictitious, inactive, revoked, or ineligible. It establishes only an unfulfilled verification request.** No official response hash, original document number, issuer authentication, publication date or dated signature-proof could be recorded.

## Required authentic material and exact validation procedure

### PILOT-01: issuer-origin legal existence
1. Authorized staff or a legal reviewer independently opens the official government identity-register service or requests a stamped certified extract from the competent company-registration authority. The URL itself is not authority: independently verify the custodian and source control.
2. Search `14010206904` and compare the *exact* legal name, registration office/location, number `1770`, incorporation date, company status, and last update/reference.
3. Record official response/notice ID, qualified issuer, retrieval/effective time, unmodified original-file SHA-256 and signed/certified provenance. Do not copy private individuals' identifiers to public GitHub.
4. If mismatch, unavailable result, identity ambiguity, outdated status, unverified stamp or technical retrieval failure: retain `PILOT-01=HOLD`; send only a discrepancy/verification request to authorized case owner.

### PILOT-02: legal Gazette and registration changes
1. Use confirmed official sources and entity ID to obtain all incorporation, change, dissolution, board and authorized-signatory notices; check authenticity and publication/version chain.
2. Bind each notice to the same exact entity, compare chronology of boards, signatory rules, individual/joint signature and revocations.
3. Last published notice is NOT by itself proof of quorum, validity of a particular tariff meeting, an unrevoked delegated mandate or legal authority at a historic resolution date.
4. Record at least official notice number, publication date, filing date, effective date, issuer and original archive URI/hash. No notice found => HOLD, not silent approval.

### PILOT-03..08: next independent approvals
- Obtain the specific registered bylaws operative on the resolution date; exact board roster and appointment terms; joint-signing authority; signed original minutes and quorum/vote record; any later cancellations; independent legal review/mandate; legitimate pilot participation/data-sharing permission issued by the cooperative's legal representative. No real tenant mapping before authenticated mandate.
- Retain a **two-person** review and transaction-level `ACTIVE` prohibition irrespective of UI, attached PDF hash or role flags.

## Ready-to-send evidence request outline (UNSENT)
**Addressee:** verified cooperative legal representative or the competent registration office (identify and authenticate before use).

**Subject:** Official registration and representation documentation request for the research candidate cooperative in Ardakan.

Kindly provide a source-authenticated extract showing exact legal name, legal-person national ID, registration number/office and current legal status; incorporation notice and full sequence of changes; current and historically effective board appointments, names/terms and authorized signatory/joint-signature powers; the registered bylaws and updates; the relevant resolution number/date and certified minute-book excerpt, plus authenticated revocation history. Separately, if participating in a pilot is desired, provide a signed legal mandate, information-sharing scope and contact for qualified independent legal review.

No request has been sent, no person contacted and no personal data imported.

## Implementation and decision record
- Existing migration 0053 permits a tenant-scoped **candidate issuer** record only, `PENDING_ISSUER_AUTHENTICATION`; Ardakan has **no authenticated TTO tenant**, so **no database row was created**.
- No GitHub CI rerun is necessary for this **documentation-only** change; preceding technical acceptance was 75 migrations + 289 synthetic HTTP checks, not an official legal clearance.
- `PILOT-01 = HOLD_OFFICIAL_REGISTRY_RESPONSE_UNAVAILABLE`.
- `PILOT-02 = HOLD_NO_ISSUER_NOTICE`.
- `PILOT-03..08 = HOLD`.
- `PH12 LEGAL = HOLD`; `TARIFF_ACTIVE = BLOCKED`; `PR172 = DRAFT/UNMERGED`; `NO_DEPLOY/NO_REAL_DATA/NO_OPERATION`.

**Evidence checkpoint:** once an issuer-native extract becomes available, retain the unmodified source *outside public GitHub* and submit its redacted metadata and an independently verified SHA256/issuer signature to the two-person governance review before changing any gate.
