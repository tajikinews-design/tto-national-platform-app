# PH12 — cooperative-by-cooperative official issuer discovery and authentication matrix (2026-11-08)
**Issue:** #171 | **Draft PR:** #172 | **Release:** HOLD, tariff ACTIVE BLOCKED.

## Distinct evidence layers — do not collapse
1. **Known public institutional source**: legal statutes / competent institution, not a verified issuer of a *particular* record.
2. **Proposed per-cooperative source candidate**: a tenant-scoped, append-only candidate from migration 0053; ALWAYS `PENDING_ISSUER_AUTHENTICATION`.
3. **Authenticated record for one cooperative**: not implemented / no official keys or issuer-granted verification access.
4. **Legal signatory / resolution authorization**: requires independently evaluated historical signatories, quorum and joint signature. NOT IMPLEMENTED.
5. **Tariff effect**: no approved/active transition exists and none is authorized by this change.

## Legal basis and institutional candidates (NOT official API authorization)

| Source purpose | Potential competent custodian / publication | Public legal basis / access candidate | What is still required |
| --- | --- | --- | --- |
| LEGAL_ENTITY_IDENTITY | Organization for Registration of Deeds and Properties, national legal-entity identifier records | https://ilenc.ssaa.ir/ (candidate; availability not proven here); cooperative law art. 52 | National ID of exact cooperative and authenticated registry response/record |
| REGISTERED_BOARD_CHANGES | Company registration authority; Official Gazette published change notices | https://irsherkat.ssaa.ir/ ; https://www.rrk.ir/ (candidate websites, not verified service connectors) | Latest **and historical** stamped changes, registration reference, effective dates and supersession chain |
| AUTHORISED_SIGNATORIES | Registered signature grants + board resolution + cooperative's actual bylaws | Cooperative law art. 37 para. 10: signatories designated by board; not inferred from board membership alone | Exact names/person identifiers, historical appointment and term, joint-signature rule, written delegation and cancellation at resolution date |
| COOPERATIVE_OVERSIGHT | Relevant county Department of Cooperatives / Labor & Social Welfare | County development cooperative law 1389/09/28 art. 7; sample bylaws art. provisions require cooperative agency notices | Confirm whether oversight approval/record and particular board/CEO authority certification apply to the cooperative and decision |
| BOARD_MINUTES_QUORUM | Cooperative's official minute-book custodian, filed changes where required, independent legal reviewer | Cooperative law art. 37 and cooperative-specific registered bylaws | Call notices, agenda, attendees, quorum, vote threshold, legal purpose, effective dates, validated original with chain of custody |
| SOURCE_REVOCATION_HISTORY | Registration authority / Official Gazette / cooperative record owner (by claim type) | Regulator + registry amendment publication, with retrieval chronology | Authenticated, monotonic version/revocation feed or individually certified current-status verification; no public API assumed |

Sources reviewed as **legal research only**, not a claim of obtaining real cooperative records:
- `https://www.ekhtebar.ir/قانون-بخش-تعاونی-اقتصاد-جمهوري-اسلامي/` — consolidated law, arts. 37 and 51–52 (please confirm current official legal text before formal reliance).
- `https://amagestate.com/legal/establishment-district-development-cooperatives/` — law on county development cooperatives (secondary republication).
- `https://amagestate.com/legal/county-cooperative-development-bylaws/` — cabinet-approved example bylaws (secondary republication).
- `https://www.rrk.ir/`, `https://ilenc.ssaa.ir/`, `https://irsherkat.ssaa.ir/` — prospective official sites; automated access and authenticity of a specific response NOT established.

### Clarifying the authority distinction
- A cooperative's **own minute-book** can supply an original board decision; this is not automatically the externally authenticated *public corporate registry*.
- The **Official Gazette** can disclose filed changes; publication by itself does not demonstrate quorum, an unrevoked delegated mandate, all joint signatures or validity of a proposed tariff.
- County **cooperative oversight** is institutionally relevant, but cannot be substituted for an authentic company-registration record; the specific agency's verification power and data-access mandate must be confirmed.
- Even a legitimate source record may be **obsolete** on a later decision date; source authenticity, effective-time authority and current revocation are separate gates.

## Per-tenant evidence request, before any positive verifier
For each real cooperative, obtain without posting personal identity data to GitHub:
1. Registered name, 11-digit national legal-entity identifier, company registration number/location, official identity source reference and issue date.
2. Registered articles/bylaws *in force when the tariff resolution was adopted*, amendments and issuer-signed digest/version.
3. Official appointments, board roster and term windows at the resolution; authority-to-sign grants including joint signatures and delegates, plus all revocations.
4. Full board meeting minutes, invitation/agenda, attendance and vote quorum evidence; origin hash/source custody.
5. Independent, qualified legal reviewer identity and mandate, conflict check and source-independent signed decision.
6. Attested issuer authentication path (government API or official stamped offline attestation), credential scope, transport trust, replay checks, refresh SLA, expiry and revocation sequence.
7. Cross-tenant mapping approval and source-to-acceptance matrices with negative/positive, concurrency and recovery tests.

## Software implementation through migration 0053
- Candidate record is immutable and tenant-scoped; only a logged-in `LEGAL_REVIEWER` can propose/read it through SECURITY DEFINER PostgreSQL functions and a separately disabled-by-default NestJS feature flag.
- Candidate state CHECK only allows `PENDING_ISSUER_AUTHENTICATION`. Client cannot create `VERIFIED`, `APPROVED` or `ACTIVE`; role assignment itself does not authenticate an institution.
- No network fetch is made to candidate URLs. No API keys or personal identifiers are stored in this registry.
- Source check 0049–0050 remains PENDING/REJECTED; legal disposition 0051 stays HOLD/REJECT; revocation/recheck 0052 remains fail closed.
- **No per-cooperative real issuer has been authenticated.** The candidate matrix is an engineering readiness artifact, **not** a substitute for a licensed/official source integration.

## Release blockers / owner's next concrete decisions
- Identify first cooperating real cooperative and legal contact, and nominate a verified source owner/custodian for each of the six purposes above.
- Obtain access to *official*, institutionally signed or traceable records. Verify official site authenticity independently; public domain name alone cannot become a trust anchor.
- Have independent legal reviewer confirm which decisions must be filed, which need cooperative agency confirmation, signature configuration and whether selected tariff requires more than the generic cooperative law.
- Architect an issuer-signed source adapter and separate transactional final activation authority **only after evidence**; create a separate reviewed PR for any future positive states.

**Decision:** `PH12=HOLD`, `LEGAL_SIGNING_AUTHORITY=UNVERIFIED`, `TARIFF_ACTIVE=BLOCKED`, `PR172=Draft`, `NO_MERGE`, `NO_DEPLOY`, `NO_REAL_DATA`.
