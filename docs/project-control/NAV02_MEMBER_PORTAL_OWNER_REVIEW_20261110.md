# NAV02 / CHILD06 member register, catalog and case screen — WIP 2026-11-10

Source: four owner-supplied screenshots. Implemented UI uses approved TTO visual language,
not a pixel-perfect reuse of the third-party CRM screenshot.

## Implemented in Draft PR #183
- Registration = **ثبت عضو**, capital = **ثبت سهام**.
- Dedicated left-side panel for member photo, collection, occupation and
  file attachment subject/selector. Immediate photo preview stays local.
- Member list with membership number, name, eligibility/application status,
  collection, group, masked national ID, masked mobile and action icons.
- Per-person membership file view with header, related member list, tabs,
  and fourteen labeled feature icons. Only existing verified read/audit data
  is shown, no fictitious member records or fabricated full personal IDs.
- Separate collection listing: members grouped from their encrypted record,
  and a protected server catalog API prepared to create empty collections.
- Numbering settings and prepared PG17 registry: per-workspace serial starts,
  configurable prefix/suffix, globally unique full member number, transactional
  sequence, immutable issued code, permanent tombstone retained after deletion.
- Server membership intake must atomically verify Shahkar and allocate number,
  otherwise roll back whole registration. No legal admission or voting rights.

## Deliberate HOLDs
- Migration 9999x is source only, **not applied** to Preview/Production.
- API backend and new secret-gated `TTO_NAV02_NUMBER_LEDGER_ENABLED`,
  `TTO_NAV02_COLLECTIONS_ENABLED` not activated until migration audit and
  contract acceptance. Number configuration form does not falsely claim save.
- Real identity registration, Shahkar and photo/attachment uploads remain
  fail-closed pending privacy, retention, scanner and legal authorization.
- Attachment UI only; secure multi-file quarantine, scan and access controls
  are not released. A picked attachment blocks final member save.
- Full member editing needs a scoped authorized encrypted profile-read/edit API;
  the Edit link opens same form with edit mode and fail-closed warning.
- Archival requires a separate audited member-vs-shareholder state transition;
  deleting a legal member cannot blindly erase shareholder/ledger histories.
- Board approval/CF02 membership, shareholder rights and voting remain separate.
- Approved frozen login UI stays byte-identical.
- No GitHub Merge or Production deployment.
