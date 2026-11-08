# PH12 — Pilot cooperative prequalification (research-only, NO REAL DATA)
**Date:** 2026-11-08 | **Issue:** #171 | **PR:** #172 (DRAFT) | **Gate:** HOLD / ACTIVE BLOCKED

## Decision
**Research candidate #1 (NOT registered, onboarded, authorized, or formally selected by a legal owner):**
- Publicly claimed name: **شرکت تعاونی توسعه و عمران شهرستان اردکان** (Ardakan County Development & Construction Cooperative), Yazd Province.
- Publicly **claimed** legal-person national ID: **14010206904**.
- Publicly **claimed** company registration number: **1770**.
- Publicly **claimed** initial registration date: **1400/05/19** (Solar Hijri).
- Source of claims: public channel bearing the cooperative name, https://t.me/s/ttoardakan?after=11 ; an independent derived-directory snippet also associates this legal-person number with Ardakan, but neither is an official authenticated company-register extract.
- **Official national ID registry query not obtained**. Site https://ilenc.ssaa.ir/ timed out in this research environment.
- **Official Gazette notice not obtained**. Site https://www.rrk.ir/ timed out in this research environment.
- The cooperative's own web domain `www.ttoardakan.ir` was mentioned in the channel; independent site control, organization identity and API authorization were NOT established.
- **No historical or current board member, executive, signatory or delegation is authenticated.** Older public channel names MUST NOT be treated as current/legal mandates.
- No cooperative contacted, no access/mandate received, no production tenant created or mapped, no database rows changed, no PII imported.

## Source-to-claim acceptance matrix
| Evidence ID | Necessary claim | Proposed source owner | Research evidence currently available | Required official verification | State |
| --- | --- | --- | --- | --- | --- |
| PILOT-01 | Legal existence, exact legal name, national ID and current status | National legal-person registry / registration authority | Self-published claim only; 14010206904; registration 1770 | **Issuer-authenticated** register extract matching exact name, status, date and registration place | HOLD_UNVERIFIED |
| PILOT-02 | All historic and current registration changes | Company registration authority + Official Gazette | No source-native gazette notices acquired | Certified incorporation and change notices including last amendment and date | HOLD_MISSING |
| PILOT-03 | Actual bylaws operative on each resolution date | Registry + certified cooperative original | Generic model bylaws are publicly available; not actual filed Ardakan version | Filed bylaws, all amendments, registered version/effective dates | HOLD_MISSING |
| PILOT-04 | Board composition, appointment term, and actual legal authority | Registered changes + relevant cooperative oversight + board original | None issuer-authenticated | Historical roster as-of each resolution, appointments, revocations, authority ranges | HOLD_MISSING |
| PILOT-05 | Signatory identity, individual/joint signature and delegation | Board resolution + registered signature powers + issuer/oversight | No source-native signatures/authentication | Exact authorizations, current/historic revocations and independent cross-check | HOLD_MISSING |
| PILOT-06 | Tariff board resolution, meeting quorum and dates | Certified cooperative minute book + qualified independent legal review | No case-specific resolution provided | Minutes, call/agenda, attendance/quorum, voting threshold, original, scope, legal analysis | HOLD_MISSING |
| PILOT-07 | Freshness, expiry and authentic revocation/supersession | Each corresponding issuer / record custodian | No authenticated issuer feed/confirmation | Official version/status history, time-of-use recheck and withdrawal credentials | HOLD_MISSING |
| PILOT-08 | Legal ownership of pilot/test mandate | Cooperative's authorized representative + TTO project owner | No signed onboarding mandate | Independently authenticated organization-authorized written pilot permission and data-sharing terms | HOLD_MISSING |

## Primary-source procedures BEFORE changing any authority gate
1. Open the **competent national identity register** (SSAA/ilenc), query 14010206904, capture provenance of a source-native response/extract: retrieval UTC time, issuer, stable document reference, canonical identifier, legal name, current status and SHA-256 of the exact authentic response. **Do not upload personal information to public GitHub.**
2. Using that verified identity, query **Official Gazette** and company registration/changes service. Verify notice numbers, official publication dates, effective dates, any dissolutions, and that the published name and ID match.
3. Verify with the **county cooperative authority** its precise competence and which filing/qualification certificates exist. County supervisory evidence may complement, not replace, corporation-registration evidence.
4. Request the **cooperative's actual operative bylaws** and independent, legally adequate copies of original board resolutions, roster, quorum, signatory and joint-signature rules. Verify effectiveness at the resolution date; do not infer powers merely from named directors.
5. Obtain the pilot's data processing/onboarding mandate and an **independent, qualified legal reviewer**. Define time-limited access, retention, source revocation and failure/recovery tests. Do not map a real tenant or ingest identifying personal information into a public repo.
6. Only once each **official issuer** is identified and its signed/offline attestation path is independently verified, create a separate reviewed candidate for *positive* source proof. PR #172 has **no approval/activation path** and must stay Draft.

## Existing PH12 software boundary (no new production migration here)
Migration **0053** permits only `PENDING_ISSUER_AUTHENTICATION` records scoped to a *known verified tenant context* and `LEGAL_REVIEWER` role. Since Ardakan has **no verified TTO tenant or mandate**, **do not insert the Ardakan ID into 0053 or impersonate a tenant**. This file documents a **public research candidate**, not a database-registered candidate.
Migration 0049–0050 = source observations only; 0051 = HOLD/REJECT legal disposition only; 0052 = reported invalidation and HOLD recheck only. An uploaded PDF, hash, URL, channel, or role cannot make any `VERIFIED` or `ACTIVE` claim.

## Evidence pointers and limitations
- Public cooperative-identified channel (self-declared identity and establishment info): https://t.me/s/ttoardakan?after=11
- Public derived directory snippet (non-authoritative corroboration only): https://iran-gazette.com/c/qeynxmdwcd9a/ (Ardakan legal entity appears as a linked entity on another company page; this is NOT a certified notice and its automated classification may be wrong).
- Official identity-service candidate (unreachable in this session): https://ilenc.ssaa.ir/
- Official gazette candidate (unreachable in this session): https://www.rrk.ir/
- Cooperative model bylaws research (not a substitute for a company's registered actual bylaws): https://amagestate.com/legal/county-cooperative-development-bylaws/

## Promotion gate / measured state
`RESEARCH_CANDIDATE` -> `INDEPENDENT_OFFICIAL_IDENTITY_CONFIRMED` -> `LEGAL_MANDATE_CONFIRMED` -> `ISSUER_AND_HISTORICAL_AUTHORITY_VERIFIED` -> `INDEPENDENT_LEGAL_APPROVAL` -> `SEPARATE_ACTIVATION_AUTHORIZATION`.

**Current actual stage: RESEARCH_CANDIDATE / ALL LEGAL GATES HOLD.**
No official issuer verified, no source service connected, no real shareholders, no issuer keys, no DB mutations, no merge, no deploy, no tariff activation. This is not a partnership endorsement or permission to process the candidate cooperative's data.
