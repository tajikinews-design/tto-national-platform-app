# PH-01 — 23-Child physical evidence delta (source-grounded, NOT approval)

Source: immutable TTO Unified Implementation Pack v1.0, source SHA `5eb6be8edfbb61f2eca740a42c30f572b493f023`; existing extracted catalogue `docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`. Audited app SHA `adc4ec42e627403d44863e6f7abfc5f2d8c461bf` on **Draft PR #114 only**. Audit date: 2026-11-02.

**Meaning:** This is a source-to-physical evidence inventory of each child's one *representative* named entity (23 rows); it is NOT a substitute for all 148 canonical entities or field-by-field contract reconciliation. It must not be used to GREEN PH-01-C05/C06/C08.

Observed: 11 migration files, 32 declared `tto.*` tables, 155 locked acceptance index entries. All 155/155 reference-index `status=NOT_RUN`; all 155 missing official requirement references and 155 lack direct execution linkage, even though selected CI suites passed on different evidence boundaries.

Mapping notation: `PARTIAL_PHYSICAL_REPRESENTATIVE` = a table with *some* corresponding fields, not full semantic equivalence. `NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE` means no like-for-like physical table among the audited SQL migrations; other UI, fixtures or alternate names may exist. **Not a claim that the domain has no code.**

| Child | Representative source entity | Canonical SQL table evidenced | Source declared fields | SQL declared fields | Finding |
|---|---|---|---|---|---|
| CHILD-01 | `USER_ACCOUNT` | `tto.user_accounts` | user_account_id, party_ref?, status, authorization_epoch, security_epoch, version | `user_id`, `status`, `security_epoch`, `created_at` | PARTIAL_PHYSICAL_REPRESENTATIVE |
| CHILD-02 | `TENANT` | `tto.tenants` | tenant_id immutable, type, legal/display name, geography_ref, status, current_slug_ref, legal_profile_ref, version | `tenant_id`, `slug`, `display_name`, `status`, `version` | PARTIAL_PHYSICAL_REPRESENTATIVE |
| CHILD-03 | `FILE_OBJECT` | `tto.file_objects` | file_object_id, tenant_id?, storage_ref, mime_type, size_bytes, sha256, scan_status, classification, created_at | `file_object_id`, `tenant_id`, `storage_key`, `sha256`, `classification`, `scan_status`, `created_at` | PARTIAL_PHYSICAL_REPRESENTATIVE |
| CHILD-04 | `LEGAL_SOURCE` | — | source_id, source_type, citation, issued_at, authority, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-05 | `NOTIFICATION_JOB` | — | job_id, tenant_id, source_ref, recipient_ref, channel, template_ref, status, priority | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-06 | `MEMBERSHIP_APPLICATION` | — | application_id, tenant_id, party_id, status, submitted_at, evidence_refs[], decision_ref? | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-07 | `SHARE_OWNERSHIP_LEDGER_ENTRY` | — | entry_id, tenant_id, shareholder_account_id, share_qty, direction, source_case_ref, effective_at, previous_owner_ref? | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-08 | `ASSEMBLY` | — | assembly_id, type, tenant_id, mode, status, scheduled_at, rule_snapshot | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-09 | `COMMUNICATION_ITEM` | — | item_id, source_domain/ref, type, title/body_ref, classification, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-10 | `TICKET` | — | ticket_id, tenant_id, requester_ref, category, priority, status, assigned_queue, source_entity_ref? | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-11 | `DISCLOSURE_ITEM` | — | item_id, tenant_id, type, period, status, classification, source_refs[] | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-12 | `PROJECT` | — | project_id, tenant_id, name, type, status, location, owner_ref, resolution_refs[] | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-13 | `ENGAGEMENT_PROCESS` | — | process_id, tenant_id, type, audience_ref, status, opens_at, closes_at | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-14 | `COURSE` | — | course_id, owner_scope, title, status, learning_outcomes | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-15 | `BENEFIT` | — | benefit_id, tenant_id, type, terms, allocation_policy_ref, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-16 | `PRODUCT` | — | product_id, tenant_id, title, status, supplier_source_ref? | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-17 | `COLLAB_NEED` | — | need_id, tenant_id, scope, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-18 | `OPPORTUNITY` | — | opportunity_id, tenant_id, type, terms, status, opens/closes | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-19 | `COMMUNITY_NEED` | — | need_id, geography, source_refs, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-20 | `OBLIGATION` | — | obligation_id, rule_ref, tenant_id, owner, due_pattern, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-21 | `METRIC_DEFINITION` | — | metric_code, definition, grain, numerator/denominator, unit, window, source_contract, version | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-22 | `DATA_CLASSIFICATION_POLICY` | — | classification code, handling rules, export/search/ai constraints | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |
| CHILD-23 | `TEST_CASE` | — | test_id, source_requirement, layer, priority, owner, status | — | NO_CANONICAL_REPRESENTATIVE_TABLE_EVIDENCE |

## Explicit authoritative gaps

1. CF01 independent locked child has 9 canonical entities and 18 detailed acceptance tests, versus summary counts 7/8 in the Unified extracted map. Numeric test-ID collisions must be namespaced and independently signed off.
2. `USER_ACCOUNT`: SQL `user_id` differs from source `user_account_id`; `authorization_epoch`, version and several lifecycle fields are not established by the audited table; optional Party link is via `tto.user_party_links`. Mere field name analogy is not contract parity.
3. `TENANT`: SQL `slug` is a locator, **not** proof of the required `current_slug_ref` history and legal profile; source `type` and `geography_ref` not evidenced in `tto.tenants`.
4. `FILE_OBJECT`: SQL `storage_key` differs from contractual `storage_ref`, and `mime_type`/`size_bytes` are not declared in the audited table.
5. Member/share source snapshot tables are **read models**; they are neither `MEMBERSHIP_APPLICATION` truth nor a `SHARE_OWNERSHIP_LEDGER_ENTRY` authorization for share transfers. No official payment/custody/wallet flows inferred.
6. Distinguish synthetic preview code and CI fixture data from live domain business workflows and lawful authority. Independent Product, Architecture, Legal and QA certification has not been recorded in Draft PR114.

## Acceptance rules
- PH-01-C05: requires audited all-entity **148/148** field/constraint mapping; this report covers *23 representative entities only*. Status **PENDING**.
- PH-01-C06: requires **155/155** source requirement ⇄ executable assertion ⇄ code SHA/run links; the locked index has null requirement and evidence fields. Status **PENDING**.
- PH-01-C08: requires resolved semantic conflicts + formal independent owner-reviewed source decision. No review submitted. Status **PENDING**.
- Preserve prior documented **PH-01 = 5/8 GREEN**, not auto-advance PH-02. Source and candidate branch remain untouched except for this proposed audit file. No Merge/Deploy or real shareholder operations.
