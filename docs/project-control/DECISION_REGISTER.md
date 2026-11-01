# Decision register — as of 2026-11-01

| ID | Decision | State | Required authority |
|---|---|---|---|
| D-001 | TTO Delivery 3.0 as delivery model (implementation in Draft PR) | PROPOSED | Project owner review |
| D-002 | Select pilot cooperative and permitted test dataset | PENDING | Project owner + cooperative data owner |
| D-003 | Approve Child06 membership source provenance | PENDING | Membership source owner / legal |
| D-004 | Approve Child07 official share ledger | PENDING | Legal ledger authority / data owner |
| D-005 | Approve share-market legal Rule Registry / board gates | PENDING | Legal counsel + board as applicable |
| D-006 | Approve Child09 notice publisher and document disclosure classification | PENDING | Cooperative publisher / legal |
| D-007 | Choose safe baseline consolidation from stacked Draft PRs | PENDING | Code owner + product owner |
| D-008 | Authorize any merge or deployment | NOT_GRANTED | Project owner separately |

No inferred legal approval. Distinguish conversation approval of a plan from source/legal approval to process data or shares.

## PCS-006 candidates, not approvals (2026-11-01)
| ID | Proposal | State | Authority |
|---|---|---|---|
| D-009 | Freeze PR #90 SHA 064ef8b27b280526468b540291299d49e08347d6 as reviewed engineering candidate | TECHNICALLY_RECOMMENDED / OWNER_PENDING | Project owner and code owner |
| D-010 | Consolidate project-control docs #91 with app only on separately reviewed candidate | PROPOSED / NO_MERGE | Project owner and code owner |
| D-011 | Start first Wave-1 scope via fictional Child06/Child07 source fixtures and manager-to-shareholder tests | SPECIFIED / NOT_IMPLEMENTED | Product and data owners |
| D-012 | Permit official Child06/Child07 records and pilot cooperative | BLOCKED / NO_AUTHORITY | Cooperative official source owners and legal reviewer |

## PCS-015 — integrated technical candidate, not authority (2026-11-01)
| ID | Decision for responsible person | Status | Required sign-off |
|---|---|---|---|
| D-013 | Review integrated app PR #107 SHA cb533fd6f06dde8cdeccd8f0adf4665901e33b55 + all 22 historical PCS documents in the isolated PCS015 candidate | CANDIDATE_READY_FOR_RELEASE_TEST / NO_ACCEPTANCE | project owner + codeowner |
| D-014 | Accept full cumulative Wave-0 G3 after successful exact-SHA RELEASE, human keyboard/RTL/UX and security review | PENDING / NOT ACCEPTED | project owner, codeowner, product/QA |
| D-015 | Nominate named legally authorized pilot cooperative and data controller under written pilot scope | NOT_SELECTED / NO_AUTHORITY | project owner + cooperative legal representative |
| D-016 | Activate independent official Child06 membership source | BLOCKED | authorized membership source steward + legal |
| D-017 | Activate independent official Child07 share ledger (not inferred from Child06) | BLOCKED | ledger custodian + cooperative legal authority |
| D-018 | Authorize main merge or production deploy | NOT_GRANTED | explicit separate project-owner decision |

Historical D-001–D-012 remain as issued; PCS015 supersedes their *candidate* SHA only, not their recorded decisions. No legal data source, official share register or buyer/seller operation is activated by a passing CI.

## PCS-015 latest evidence for decision owners — 2026-11-01
- Proposed G3-reviewed code/docs baseline: frozen Draft PR **#109** SHA `e87f2a874200f7694faa3959d03bdeeb0890ba6f`. Full Release CI `41323031652` job `124897099133` **SUCCESS**; 22/22 source PCS documents present (21 unchanged blobs, checkpoint intentionally extended). Prior cancelled run `41322689067` is not an acceptance failure of the tested SHA.
- **D-013 technical evidence updated to PASS for submission to G3 review, not owner approval.** Decisions **D-014–D-018 remain PENDING/BLOCKED/NOT_GRANTED**. The required accountable individuals must explicitly approve; no assistant or CI result may sign on their behalf.
- Decision form for project owner: [ ] APPROVE this frozen candidate for formal Wave-0 G3 after required codeowner/QA review; [ ] REQUEST CHANGES; [ ] REJECT. **None selected.** Any later merge requires a separate instruction and a review of branch protections; deployment requires another approval.
- Pilot activation decisions: [ ] identify cooperative and legal signatory; [ ] approve source Child06; [ ] independently approve official share register Child07; [ ] document lawful purpose, permitted population, data processor/controller, retention/revocation/rollback and security; [ ] authorize any real data. **All unchecked.**
