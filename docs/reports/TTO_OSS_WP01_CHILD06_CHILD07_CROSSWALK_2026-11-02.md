# TTO — گزارش تطبیق بندبه‌بند CHILD-06 و CHILD-07 با نمونه‌های جهانی
**WP-01 | نسخه ۱٫۰ | ۲۰۲۶-۱۱-۰۲ | وضعیت: بررسی مستند انجام شد؛ اجرای عملیاتی و تأیید حقوقی انجام نشده است**

## تصمیم اجرایی
**الگوبرداری کنترل‌شده، بدون انتقال کد یا اطلاعات واقعی.** پروژه‌های Tapir و MemberMatters برای تجربه کاربری عضویت مناسب‌اند؛ Open Cap Format (OCF) برای مقایسه مفاهیم مالکیت سهام مناسب است اما دفتر رسمی سهام تعاونی ایرانی نیست. هیچ‌کدام نباید جایگزین `Child06 Membership Source`، `Child07 Official Share Ledger`، موتور مجوزدهی و RLS فعلی شوند.

### مرجع و درجه قطعیت
- نسخه مرجع ۱۵ سند: `tajikinews-design/tto-national-platform@5eb6be8edfbb61f2eca740a42c30f572b493f023`؛ تغییر ممنوع.
- استخراج مستقیم قراردادها از همان منبع: `docs/analysis/CHILD23_SOURCE_POLICY_WORKFLOW_MAP.json`، `docs/analysis/PH01_SOURCE_148_ENTITY_FIELD_INDEX.json` با `source_paragraph` مشخص و `docs/analysis/ACCEPTANCE_IDS.json`.
- محدودیت: توصیف بندها از **استخراج قفل‌شده** است، نه تأیید حقوقی مستقل اصل Word؛ هفت MEMBER و هشت SHARE سناریوی رسمی با شناسه محفوظند ولی متن انتظارِ کامل هریک در این استخراج موجود نیست. جدول آزمون زیر **فرضیه آزمون تکمیلی** است، نه بازنویسی سناریوهای رسمی.
- معماری: `docs/architecture/ADR-001-FINAL-STACK.md`; `docs/analysis/CORE_OWNERSHIP_BOUNDARIES.md`; `docs/project-control/CAPABILITY_REGISTRY.json`. سه Next.js 16، NestJS 11، PostgreSQL17/forced RLS؛ CAP-003 و CAP-004 بر داده رسمی هنوز **BLOCKED**.
- مرجع جهانی بازبینی‌شده (README/Schema در ۲۰۲۶-۱۱-۰۲):
  - [Tapir README](https://github.com/SuperCoopBerlin/tapir/blob/master/README.md): profile, membership-fee, application accept/reject, roles, notifications, shift scheduling؛ AGPL-3.0، Python/Django.
  - [MemberMatters README](https://github.com/membermatters/MemberMatters/blob/main/README.md): signup, self-service member profile, activation/deactivation, notices, audit, payments/hardware access؛ MIT؛ Django/Vue.
  - [OCF docs](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/blob/main/docs/README.md), [Stakeholder schema](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/blob/main/schema/objects/Stakeholder.schema.json), [StockClass schema](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/blob/main/schema/objects/StockClass.schema.json) و [transaction schemas](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/tree/main/schema/objects/transactions). OCF مجوز **خاص** `LICENSE.md` دارد که کپی/مشتقات را مشروط می‌کند؛ پیش از هر اقتباس فایل یا schema اخذ تأیید مجوز لازم است. مقایسه مفهومی در این گزارش کپی کد نیست.

## A. CHILD-06: هر ۵ موجودیت رسمی (فیلدها از استخراج سند)
| موجودیت/پاراگراف مبدأ | تعریف دقیق قراردادی | تجربه جهانی قابل اقتباس | تصمیم / قید رد |
|---|---|---|---|
| `MEMBERSHIP_APPLICATION` §paragraph 896 | `application_id, tenant_id, party_id, status, submitted_at, evidence_refs[], decision_ref?` | Tapir: درخواست عضویت با review/accept/reject؛ MemberMatters: ثبت‌نام کاربر | **ADAPT** گردش‌کار درخواست و وضعیت؛ ثبت‌نام حساب، تأیید عضویت نیست؛ تمام تصمیمات باید authority/evidence داشته باشند |
| `COOPERATIVE_RELATIONSHIP` §898 | `relationship_id, tenant_id, party_id, type, status, valid_from, valid_until?, basis_ref` | Tapir: وضعیت و سابقه اعضا | **KEEP TTO** رابطه مستقل tenant/Party و تاریخ مؤثر؛ مدل یک‌تعاونی Tapir/عضویت معمولی جایگزین نیست؛ hard-delete ممنوع |
| `SHAREHOLDER_ACCOUNT` §900 | `shareholder_account_id, tenant_id, party_id, shareholder_type, status, bank_info_refs?` | OCF Stakeholder: شخص/سازمان و روابط با issuer | **ADAPT concept only**؛ Stakeholder OCF یا حساب سهامدار = **مالکیت معتبر نیست**؛ اطلاعات بانکی فقط references با classification |
| `MEMBER_PROFILE` §902 | `tenant_id, party_id, member_no?, contact/preferences refs, classification` | Tapir/MemberMatters: پروفایل و تنظیمات ارتباطی | **ADAPT UI** فقط self-service اطلاعات مجاز و source-approved؛ جلوگیری از duplication شناسه حساس در Child06 |
| `RELATIONSHIP_DECISION` §904 | `decision_id, application/relationship_ref, outcome, authority_ref, reason, decided_at` | Tapir: review/accept/reject فرایندها | **KEEP TTO** authority_ref و audit و تصمیم idempotent ضروری؛ یک «وضعیت فعال» بدون تصمیم معتبر پذیرفته نیست |

### B. CHILD-06: Commands، Queries، Events — تطبیق تک‌به‌تک
| قرارداد رسمی | الگوی منتخب | پذیرش و شرط توقف |
|---|---|---|
| `SubmitMembershipApplication` | Tapir form & request lifecycle | **ADAPT** نمایش وضعیت و ضمیمه؛ بدون Party binding و tenancy معتبر هیچ درخواست رسمی ایجاد نمی‌شود |
| `RecordMembershipDecision` | Tapir approver workflow | **ADAPT** only legal approval with `RELATIONSHIP_DECISION.authority_ref`, evidence, idempotency; reject maker-as-final-approver where SoD applies |
| `ActivateRelationship` | Tapir membership activation | **KEEP** تنها پس از approval و rule registry؛ account activation of MemberMatters ≠ relationship activation |
| `EndRelationship` | MemberMatters deactivation UX | **ADAPT** نمایش پایان رابطه و تاریخچه؛ منع حذف یا تنزل حقوق سهامداری از روی deactivation |
| `CreateShareholderAccount` | OCF Stakeholder as reference | **KEEP** مستقل از relationship؛ ایجاد حساب = ایجاد یا انتقال سهم نیست |
| `UpdateSelfServiceProfile` | MemberMatters self-service | **ADAPT** فقط فیلدهای مجاز own Party، consent/verification و طبقه‌بندی |
| `GetMyMemberProfile` | Tapir member portal | **ADAPT** own-only BFF/API/PG with approved source, never fallback to guessed record |
| `GetRelationship` | Tapir status | **KEEP** tenant+Party scoped, immutable historical chain |
| `ListMembers` | Tapir member office list | **ADAPT** manager only, tenant-bound query, narrow fields, pagination |
| `GetShareholderAccount` | OCF stakeholder concept | **KEEP** account read not share balance; explicit source truth |
| `MEMBERSHIP_APPLICATION_SUBMITTED` | application event | **KEEP** source version, actor and outbox/audit |
| `MEMBERSHIP_APPROVED` | approval event | **KEEP** authority reference and evidence; no synthetic approval in real source |
| `MEMBERSHIP_ENDED` | lifecycle event | **KEEP** no hard-delete; revoked access re-evaluated |
| `SHAREHOLDER_ACCOUNT_ACTIVATED` | account-created event | **KEEP** not ledger credit; no entitlement inferred |

### C. CHILD-06: non-goals/invariants و اعتبارسنجی
1. **Party identity ≠ membership ≠ shareholder account ≠ share ownership**. No join-by-name/phone inference or Party merge to transfer shares.
2. **Member vs non-member shareholder** distinct; rights from approved Rule Registry, not by possession of shares alone.
3. Duplicate active relationship must follow policy; decisions idempotent by application/version; `source_version` monotonic.
4. Self-service reads only own data, manager reads only own tenant; national admin requires scoped JIT.
5. Legacy identity dedup is a **candidate review**, never auto-merge; historical relationships immutable.
6. Integration with CF01/02/03/04 and Child07 has independent owners and evidence; profile preferences/notifications are not official membership proof.

### D. CHILD-07: هر ۷ موجودیت رسمی
| موجودیت/پاراگراف مبدأ | تعریف دقیق قراردادی | OCF نقطه مقایسه | تصمیم / قید |
|---|---|---|---|
| `SHARE_OWNERSHIP_LEDGER_ENTRY` §1026 | `entry_id, tenant_id, shareholder_account_id, share_qty, direction, source_case_ref, effective_at, previous_owner_ref?` | OCF issuance/transfer/repurchase/retraction transactions | **KEEP TTO** ledger append-only و مرجع رسمی مستقل؛ OCF مدل event خارجی است، منبع مالکیت قانونی نیست |
| `CAPITAL_OFFER` §1028 | `offer_id, resolution_ref, terms, eligibility_rule_snapshot, status` | OCF stock class/issuance | **CONCEPTUAL ADAPT** terms, snapshot؛ board/legal resolution و تعاونی rule registry برتر از نوع سهام خارجی |
| `SHARE_SELL_ORDER` §1030 | `sell_order_id, seller_ref, qty, valuation_ref, status` | OCF transfer event (postfactum) | **REJECT direct equivalent**: OCF انتقال مالکیت را توصیف می‌کند، نه فرآیند درخواست فروش محدودشده تعاونی |
| `BUY_REQUEST` §1032 | `buy_request_id, buyer_ref, sell/order_ref, status` | OCF transfer target | **KEEP TTO** eligibility/approval and tenant scoped case؛ OCF order matching ندارد |
| `SHARE_LOCK` §1034 | `lock_id, owner_ref, qty, source_case_ref, status, expires_at?` | Not a reliable equivalent in OCF | **KEEP TTO** lock atomic against double-spend / concurrent cases؛ no wallet/fund reservation |
| `TRANSFER_CASE` §1036 | `case_id, seller_ref, buyer_ref, qty, payment_refs, fee_refs, approvals, status` | OCF transfer record | **KEEP TTO** full workflow, SoD, legal approvals; payment verified ≠ ownership completed |
| `VALUATION_REPORT` §1038 | `valuation_id, document_ref, expert_ref, value, valid_from, valid_to?, status` | OCF valuation object | **ADAPT metadata concepts** with legally valid evaluator, date window, external evidence; no valuation → fail-closed finalization |

### E. CHILD-07: تمام Commands / Queries / Events
| قرارداد رسمی | تصمیم / حد و مرز |
|---|---|
| `CreateSellOrder` | **KEEP** no case absent official owned ledger & approved legal market scope; no live order from demo |
| `LockShares` | **KEEP** atomic owner-checked lock; concurrent request denial and expiry race tests |
| `SubmitBuyRequest` | **KEEP** buyer eligibility/tenant/related-party checks |
| `SelectBuyer` | **KEEP** no automatic selection without published policy |
| `RecordApproval` | **KEEP** board and legal authority, separation-of-duties |
| `AttachPaymentEvidence` | **KEEP** document quarantine/classification; report-only cannot finalize |
| `MarkPaymentVerified` | **KEEP** CF05 trusted verification and event integrity; no self-reported confirmation |
| `FinalizeTransfer` | **KEEP** append-only ledger, owner cap, legal valuation, approvals and transactional idempotency; **not authorized in current pilot** |
| `CancelTransfer` | **KEEP** release locked shares safely, audit irreversible historical events |
| `GetMyHoldings` | **ADAPT** OCF projection concepts, but source official Child07, own-only, asOf/sourceVersion |
| `ListMarketOffers` | **KEEP** source-approved listings only; not a public open marketplace |
| `GetTransferCase` | **KEEP** own case or authorized manager; sealed legal evidence separately |
| `GetValuationStatus` | **ADAPT** metadata display, never imply system creates market price |
| `SHARE_SELL_REQUESTED` | **KEEP** audit and official workflow event, not ledger mutation |
| `SHARES_LOCKED` | **KEEP** concurrency lock event; no cash reserve |
| `PAYMENT_REPORTED` | **KEEP** unverified signal only |
| `TRANSFER_READY` | **KEEP** pre-finalization gate, not transfer completed |
| `TRANSFER_COMPLETED` | **KEEP** ledger transaction committed and approved; only authorized legal source |

**Explicit TTO exclusions:** no `Wallet`, `FundReservation`, TTO-computed valuation, or substitute national e-voting. Direct buyer-to-seller and cooperative fee references mentioned in source design are **not operational authorization**; neither payment processing nor transfers are permitted before legal and release acceptance.

### F. اصل آزمون‌های رسمی را حفظ کن (15 شناسه)
**CHILD-06 7**: `MEMBER-AT-001`, `MEMBER-AT-002`, `MEMBER-AT-003`, `MEMBER-AT-004`, `MEMBER-AT-005`, `MEMBER-AT-006`, `MEMBER-AT-007`.

**CHILD-07 8**: `SHARE-AT-001`, `SHARE-AT-002`, `SHARE-AT-003`, `SHARE-AT-004`, `SHARE-AT-005`, `SHARE-AT-006`, `SHARE-AT-007`, `SHARE-AT-008`.

**Status for ALL 15**: Source index `NOT_RUN`; no fabricated per-ID test meaning, PASS or signing. Before any executable mapping, retrieve the original expected outcomes for each ID from the immutable source document and attach original paragraph/sentence reference. Separate proposed supplemental negative scenarios:
- C06-N01: authenticated account with no valid relationship returns NOT_MEMBER, not auto-created membership.
- C06-N02: third-party profile and cross-tenant member list DENIED at API/DB/cache/export.
- C06-N03: concurrent duplicate application, stale decision version and rejected authority do not create active membership.
- C06-N04: person dedup/Party merge does not alter shareholder relationship or ownership.
- C07-N01: holdings without approved official ledger = NOT_AVAILABLE, not numeric zero.
- C07-N02: concurrent double-lock/sell above balance fails atomically; no negative balance.
- C07-N03: reported/verified payment without legal approval does not append ownership.
- C07-N04: expired valuation, ownership cap breach, related-party conflict or cancelled transfer blocks completion.
- C07-N05: crash/retry FinalizeTransfer cannot duplicate ledger entry; no transaction on failed audit/outbox.
These are **new proposed tests**, not substitutes for MEMBER-AT/SHARE-AT.

## G. مهندسی اقدام بعدی با شواهد قابل بازبینی
| اقدام | اولویت | مسئول تصمیم | خروجی/پذیرش | وضعیت |
|---|---|---|---|---|
| Source-contract original test sentence crosswalk for all 15 official AT IDs | P0 | Product/source | verbatim-source pointers, exact expected result, no invented PASS | **BLOCKED** pending original source-case detailed review |
| Child06 membership lifecycle UI references only | P0 | Product/UX | wireframe/validation rules mapped to 5 entities, permissions; no code import | **READY_FOR_REVIEW** |
| Child07 capital events vs OCF JSON semantics | P0 | Legal + DB | keep/adapt/reject per 7 entities, file LICENSE review, no new official ledger | **READY_FOR_REVIEW** |
| Official independent Child06/07 source acceptance | Release blocker | Data owner + legal | approved source, legal Party binding, version/asOf, audit, tenant/PII handling | **NOT_GRANTED** |
| Optional synthetic 9 negative test additions | P1 | Security/QA | exact SHA CI with disposable PG17 and synthetic actors only | **PROPOSED** |
| Merge or production authorization | gated | Project owner | separate written decision | **NOT_GRANTED** |

## H. Review checklist and STOP
No copied upstream code, no vendor SaaS, no real Party/member/share data or financial traffic. Review Iranian cooperative law and policies first; AGPL from Tapir is a reason for conceptual study only. Cross-tenant, stale source, absent legal authority and duplicate share ownership must fail closed. All acceptance checks need source ID, SHA, run, independent reviewer before GREEN.

**Result:** 12/12 TTO entity contracts and all 15 commands, 8 queries and 9 events mapped for conceptual reuse; 15/15 official acceptance IDs preserved as NOT_RUN. **This is a contract-level crosswalk, not a runtime acceptance or code adoption.**
