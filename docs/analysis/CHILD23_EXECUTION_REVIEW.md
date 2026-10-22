# TTO — All 23 approved Child contracts: fields, flows, security & dependencies

**Source:** read-only `TTO-UNIFIED-IMPLEMENTATION-PACK-v1.0.docx`, reference Git SHA `5eb6be8edfbb61f2eca740a42c30f572b493f023`. These are **logical specifications**, not implemented API/database tables. Tests `NOT_RUN`.

## Source contract counts
148 entities · 71 states · 165 commands · 90 queries · 89 events · 155 acceptance tests (not run)

## CHILD-01 — TTO-CORE-IDENTITY-AUTH-IMPLEMENTATION

**Representative entity and exact field contract:** `USER_ACCOUNT` — user_account_id, party_ref?, status, authorization_epoch, security_epoch, version

**Commands (7):** CreateUserAccount, VerifyAuthChallenge, CreateSession, AssignRole, RevokeRoleAssignment, BindAuthorityReference, GrantJitAccess

**Queries (4):** GetCurrentIdentity, EvaluatePermission, ListUserTenantContexts, ListActiveRoleAssignments

**Events (4):** USER_ACTIVATED, ROLE_ASSIGNMENT_ACTIVATED, ROLE_ASSIGNMENT_REVOKED, JIT_ACCESS_GRANTED

**Authorization:** tenant_id از payload عمومی trusted نیست. Cross-tenant resource mismatch = reject + audit. Secrets HIGHLY_RESTRICTED؛ audit بدون OTP/token/session secret. SoD: creator ≠ final approver در flowهای حساس.

**Invariants:** PARTY ≠ USER_ACCOUNT. ROLE ≠ LEGAL_AUTHORITY. LOGIN ≠ MEMBERSHIP. Revoked role/authority must not remain usable بسبب stale token/cache. Deny by default.

**Dependencies:** CF-02 interfaces, CF-03 audit. CF-02 Tenant/Party context. CF-03 Audit. CF-04 Policy/SoD configuration.

**Concurrency:** Challenge consumption atomic. Role assignment overlap policy concurrency-safe. Commands retryable use idempotency key. expected_entity_version برای admin changes.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-02 — TTO-CORE-TENANT-PARTY-IMPLEMENTATION

**Representative entity and exact field contract:** `TENANT` — tenant_id immutable, type, legal/display name, geography_ref, status, current_slug_ref, legal_profile_ref, version

**Commands (7):** CreateTenant, ActivateTenant, ChangeTenantSlug, CreateParty, LinkUserToParty, CreatePartyMergeCase, ExecutePartyMerge

**Queries (5):** ResolveTenantBySlug, GetTenantStatus, GetPartyReferenceForUser, GetActiveTenantRelationshipProjection, ResolveMergedPartyAlias

**Events (5):** TENANT_ACTIVATED, TENANT_SLUG_CHANGED, PARTY_CREATED, PARTY_MERGED, COOPERATIVE_RELATIONSHIP_PROJECTED

**Authorization:** All tenant-owned data tenant-scoped. Search/file/cache/job/event/export tenant-aware. Sensitive identifiers restricted/highly restricted. Suspended tenant default write deny.

**Invariants:** tenant_id immutable. slug locator only, never authorization key. Global Party ≠ public visibility. COOPERATIVE_RELATIONSHIP truth belongs to Member Master. Party merge preserves historical references.

**Dependencies:** CF-01 identity, CF-03 evidence. CF-01 identity/auth. CF-03 documents/evidence. Member Master publishes relationship truth events.

**Concurrency:** Slug reserve/change atomic unique. Projection idempotent by event id and monotonic source version. Merge cannot execute twice concurrently.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-03 — TTO-CORE-DOCUMENT-EVIDENCE-AUDIT-IMPLEMENTATION

**Representative entity and exact field contract:** `FILE_OBJECT` — file_object_id, tenant_id?, storage_ref, mime_type, size_bytes, sha256, scan_status, classification, created_at

**Commands (9):** CreateFileUpload, CompleteFileUpload, CreateDocument, AddDocumentVersion, PublishDocumentVersion, CreateEvidenceReference, SealEvidenceBundle, AppendAuditEvent, PlaceLegalHold

**Queries (5):** GetDocument, GetDocumentVersion, GetEvidenceBundle, SearchAudit, CreateDownloadGrant

**Events (4):** DOCUMENT_VERSION_CREATED, DOCUMENT_PUBLISHED, EVIDENCE_BUNDLE_SEALED, LEGAL_HOLD_PLACED

**Authorization:** Document/File access tenant + classification + resource permission می‌خواهد. HIGHLY_RESTRICTED evidence least-privilege + enhanced audit. Global platform file فقط با owner_scope=PLATFORM.

**Invariants:** FILE ≠ DOCUMENT ≠ EVIDENCE ≠ AUDIT. Published/legal version silent overwrite ندارد. Material correction = new version + supersedes link. Audit append-only؛ business record deletion audit event را حذف نمی‌کند. Download authorization مستقل از storage path است.

**Dependencies:** CF-01, CF-02 and Child-22 retention. Storage provider adapter. Malware scanning adapter. Retention Core برای disposition/hold. تمام Domainها via references نه DB query مستقیم.

**Concurrency:** Upload completion idempotent by upload_id/hash. Version number unique per document. Seal bundle once; reseal = new bundle/version. Audit ingestion durable؛ missing audit برای material command failure condition.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-04 — TTO-CORE-RULES-POLICY-GATES-IMPLEMENTATION

**Representative entity and exact field contract:** `LEGAL_SOURCE` — source_id, source_type, citation, issued_at, authority, status

**Commands (7):** CreateRuleVersion, ApproveRuleVersion, ActivateRuleVersion, SetPolicyValue, OpenLegalGate, ResolveLegalGate, CreateRuleSnapshot

**Queries (4):** EvaluateRules, GetActiveRuleVersion, GetGateStatus, ListPolicyValues

**Events (4):** RULE_VERSION_ACTIVATED, POLICY_VALUE_ACTIVATED, LEGAL_GATE_OPENED, LEGAL_GATE_RESOLVED

**Authorization:** Rule editing فقط Product/Legal governance roles. Tenant manager فقط tenant-configurable policy fields. Published rule immutable; correction via superseding version.

**Invariants:** UNKNOWN LEGAL RULE ≠ DEFAULT ALLOW. Rule جدید گذشته را بازنویسی نمی‌کند مگر retroactivity رسمی. Tenant policy فقط در allowed configuration boundary. Transaction حساس باید rule/policy version snapshot/reference داشته باشد.

**Dependencies:** CF-03 audit/evidence. CF-03 برای source/evidence. تمام Domainها via EvaluateRules contract. Action/Calendar می‌تواند deadlines از rule projection بگیرد.

**Concurrency:** As-of evaluation deterministic. Concurrent activation یک rule scope conflict ایجاد نکند. Gate status changes idempotent and audited.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-05 — TTO-CORE-NOTIFICATION-PAYMENT-INTEGRATIONS-IMPLEMENTATION

**Representative entity and exact field contract:** `NOTIFICATION_JOB` — job_id, tenant_id, source_ref, recipient_ref, channel, template_ref, status, priority

**Commands (8):** QueueNotification, ProcessDelivery, RecordDeliveryCallback, CreatePaymentIntent, ReportPaymentEvidence, VerifyPayment, RecordWebhook, DisableIntegration

**Queries (4):** GetNotificationStatus, GetPaymentVerification, GetIntegrationHealth, GetWebhookReceipt

**Events (5):** NOTIFICATION_SENT, PAYMENT_REPORTED, PAYMENT_VERIFIED, PAYMENT_FAILED, INTEGRATION_DEGRADED

**Authorization:** Provider secrets HIGHLY_RESTRICTED. Payment evidence RESTRICTED. Tenant-specific integration credentials tenant-bound.

**Invariants:** DELIVERED ≠ READ ≠ ACKNOWLEDGED. PAYMENT_REPORTED ≠ PAYMENT_VERIFIED ≠ BUSINESS_FINALIZED. TTO هیچ موجودی نقدی نگهداری نمی‌کند. Provider callback به‌تنهایی business state نهایی نمی‌کند.

**Dependencies:** CF-01..04. SMS/Email/Push providers. Payment gateway/bank verification. Official cooperative system adapter. Future e-sign adapter DEFERRED.

**Concurrency:** Webhook external_event_id idempotent. Out-of-order callbacks state regression ندهند. Retry side effect non-critical after commit. Amounts integer minor/base unit.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-06 — TTO-MEMBER-SHAREHOLDER-IMPLEMENTATION

**Representative entity and exact field contract:** `MEMBERSHIP_APPLICATION` — application_id, tenant_id, party_id, status, submitted_at, evidence_refs[], decision_ref?

**Commands (6):** SubmitMembershipApplication, RecordMembershipDecision, ActivateRelationship, EndRelationship, CreateShareholderAccount, UpdateSelfServiceProfile

**Queries (4):** GetMyMemberProfile, GetRelationship, ListMembers, GetShareholderAccount

**Events (4):** MEMBERSHIP_APPLICATION_SUBMITTED, MEMBERSHIP_APPROVED, MEMBERSHIP_ENDED, SHAREHOLDER_ACCOUNT_ACTIVATED

**Authorization:** Self-service فقط own data. Manager access tenant-bound. Sensitive IDs از Party Core reference شوند نه duplicate raw store.

**Invariants:** Party identity ≠ membership. ShareholderAccount ≠ ShareOwnership. Non-member shareholder rights از Rule Registry؛ ownership به‌تنهایی membership/vote نمی‌سازد. Historical relationship hard-delete نمی‌شود.

**Dependencies:** CF-01..04 and CF-03. CF-02 Party/Tenant. CF-04 rules. CF-03 documents/evidence. Share Market consumes shareholder eligibility refs.

**Concurrency:** Duplicate active relationship policy-controlled. Decision idempotent by application/version. Relationship event source_version monotonic.

**Acceptance:** 7 source scenarios, **NOT_RUN**.


## CHILD-07 — TTO-SHARE-CAPITAL-MARKET-IMPLEMENTATION

**Representative entity and exact field contract:** `SHARE_OWNERSHIP_LEDGER_ENTRY` — entry_id, tenant_id, shareholder_account_id, share_qty, direction, source_case_ref, effective_at, previous_owner_ref?

**Commands (9):** CreateSellOrder, LockShares, SubmitBuyRequest, SelectBuyer, RecordApproval, AttachPaymentEvidence, MarkPaymentVerified, FinalizeTransfer, CancelTransfer

**Queries (4):** GetMyHoldings, ListMarketOffers, GetTransferCase, GetValuationStatus

**Events (5):** SHARE_SELL_REQUESTED, SHARES_LOCKED, PAYMENT_REPORTED, TRANSFER_READY, TRANSFER_COMPLETED

**Authorization:** Seller/buyer own case visibility. Final transfer requires privileged role + authority + SoD. Related-party case hands off to GRC.

**Invariants:** No valid valuation → fail-closed for automatic finalization. Ownership cap evaluated post-transfer. Share lock protects shares; no internal cash reserve. Ownership ledger append-only. Payment reported/verified != transfer completed.

**Dependencies:** CF-01..06. CF-05 payment verification. CF-04 legal rules. GRC related-party. Member Master eligibility.

**Concurrency:** Share lock atomic/concurrent. FinalizeTransfer idempotent. Ledger write + case completion transactionally reliable.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-08 — TTO-GOVERNANCE-ASSEMBLIES-IMPLEMENTATION

**Representative entity and exact field contract:** `ASSEMBLY` — assembly_id, type, tenant_id, mode, status, scheduled_at, rule_snapshot

**Commands (9):** CreateAssembly, PublishAssemblyNotice, RegisterCandidate, RecordChamberLetter, RegisterProxy, RecordAttendance, RecordVoteResult, FinalizeMinutes, RecordBoardResolution

**Queries (5):** GetAssembly, ListEligibleVoters, ListCandidates, GetProxyCount, GetMinutes

**Events (5):** ASSEMBLY_PUBLISHED, CANDIDACY_OPENED, CANDIDATE_APPROVED, ASSEMBLY_COMPLETED, BOARD_RESOLUTION_RECORDED

**Authorization:** Member visibility vs internal candidate docs differentiated. Ballot confidentiality restricted. Finalization authority-bound.

**Invariants:** Members>500 → TWO_STAGE; <=500 → ONE_STAGE. حداکثر 3 proxy votes تا baseline جدید. Candidate approval فقط با official provincial chamber letter. Electronic legal assembly فقط official system handoff. Legal notice completion از required channels + evidence.

**Dependencies:** CF-01..05 and Child-06. Communications/Notice Assurance. CF-04 rules. Official cooperative system future adapter. Document/Evidence Core.

**Concurrency:** Proxy cap concurrency-safe. Eligibility snapshot frozen at relevant stage. Vote result/minutes versioned; no silent overwrite.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## CHILD-09 — TTO-COMMUNICATIONS-NOTICE-IMPLEMENTATION

**Representative entity and exact field contract:** `COMMUNICATION_ITEM` — item_id, source_domain/ref, type, title/body_ref, classification, status

**Commands (6):** CreateCommunication, ApproveCommunication, PublishCommunication, StartAssuranceCampaign, RecordRead, RecordAcknowledgement

**Queries (3):** GetCommunicationFeed, GetAssuranceStatus, GetEvidencePackage

**Events (4):** COMMUNICATION_PUBLISHED, NOTICE_ASSURANCE_STARTED, NOTICE_ACKNOWLEDGED, NOTICE_EVIDENCE_COMPLETE

**Authorization:** Audience tenant-scoped. Member-visible vs public/internal classification. Acknowledgement evidence restricted.

**Invariants:** DELIVERED ≠ READ ≠ ACKNOWLEDGED. Recipient snapshot برای evidence-sensitive notice frozen. Source module remains business truth. Failure notification non-critical rollback ندارد.

**Dependencies:** CF-03 and CF-05. CF-05 notification adapters. CF-03 evidence. Governance legal notices.

**Concurrency:** Publish idempotent. Recipient dedup. Retry delivery safe. Acknowledgement unique per recipient/campaign/version.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-10 — TTO-SUPPORT-IMPLEMENTATION

**Representative entity and exact field contract:** `TICKET` — ticket_id, tenant_id, requester_ref, category, priority, status, assigned_queue, source_entity_ref?

**Commands (7):** CreateTicket, AssignTicket, AddTicketMessage, SetWaitingState, ResolveTicket, CloseTicket, EscalateTicket

**Queries (4):** GetMyTickets, GetQueue, GetTicketTimeline, GetSLAStatus

**Events (4):** TICKET_CREATED, TICKET_ESCALATED, TICKET_RESOLVED, TICKET_REOPENED

**Authorization:** Requester sees own tickets. Agent access queue/tenant scoped. JIT required for sensitive tenant data beyond ticket evidence.

**Invariants:** Ticket never owns linked business record. SLA pause/resume explicit. Private/internal messages not exposed to requester.

**Dependencies:** CF-01..05. Source Module → Support handoff. GRC handoff for material/repeated issue. Notification Core for updates.

**Concurrency:** Message append-only/versioned correction. SLA calculations deterministic. Escalation idempotent per trigger/version.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-11 — TTO-TRANSPARENCY-IMPLEMENTATION

**Representative entity and exact field contract:** `DISCLOSURE_ITEM` — item_id, tenant_id, type, period, status, classification, source_refs[]

**Commands (5):** CreateDisclosure, ApproveDisclosure, PublishDisclosure, SupersedeDisclosure, CreateReportPackage

**Queries (3):** ListPublishedDisclosures, GetDisclosureHistory, ExportDisclosurePackage

**Events (2):** DISCLOSURE_PUBLISHED, DISCLOSURE_SUPERSEDED

**Authorization:** Member/public/internal classification enforced. Auditor read-only role.

**Invariants:** TTO not general accounting. Published figure must carry source/period/status. Proposed ≠ approved ≠ paid. Correction via new version.

**Dependencies:** CF-03/04 and Child-06. External accounting/reference export optional. Document/Evidence Core. Communications for publication notice.

**Concurrency:** Package generation idempotent by version. Source missing blocks official publication where required.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-12 — TTO-PROJECT-ASSET-IMPLEMENTATION

**Representative entity and exact field contract:** `PROJECT` — project_id, tenant_id, name, type, status, location, owner_ref, resolution_refs[]

**Commands (7):** CreateProject, ApproveProject, ActivateProject, RecordProjectUpdate, CompleteMilestone, LinkAsset, RequestProcurementHandoff

**Queries (4):** GetProjectPortfolio, GetProjectTimeline, GetAssetRegister, GetPermitStatus

**Events (4):** PROJECT_CREATED, PROJECT_STATUS_CHANGED, MILESTONE_COMPLETED, PROCUREMENT_NEEDED

**Authorization:** Tenant/internal restricted contracts. Member disclosure only via Transparency-approved projection.

**Invariants:** Branch ≠ independent activity. Activity progress ≠ impact outcome. No ownership/permit inference from record existence. Financial figures reference source; no accounting engine.

**Dependencies:** CF-01..04. Projects→Procurement. Projects→Community Impact. GRC for risk/escalation.

**Concurrency:** Milestone completion idempotent. Concurrent updates versioned. Permit expiry can block transition by rule.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-13 — TTO-MEMBER-VOICE-IMPLEMENTATION

**Representative entity and exact field contract:** `ENGAGEMENT_PROCESS` — process_id, tenant_id, type, audience_ref, status, opens_at, closes_at

**Commands (6):** CreateEngagement, OpenEngagement, SubmitResponse, CloseEngagement, PublishManagementResponse, SubmitProposal

**Queries (4):** GetOpenEngagements, GetMyResponses, GetAggregateResults, ListProposals

**Events (3):** ENGAGEMENT_OPENED, ENGAGEMENT_CLOSED, MANAGEMENT_RESPONSE_PUBLISHED

**Authorization:** Audience tenant-bound. Sensitive free text restricted. Aggregate output suppress small cohorts if needed.

**Invariants:** Not legal vote. Anonymous aggregate rules privacy-aware. Response editing after submit only if policy/version permits.

**Dependencies:** CF-01..05. Communications for invitation/result. GRC/Projects/Action handoff when accepted proposal becomes work.

**Concurrency:** One-response constraints concurrency-safe. Close vs late submit deadline atomic.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-14 — TTO-ACADEMY-EVENTS-IMPLEMENTATION

**Representative entity and exact field contract:** `COURSE` — course_id, owner_scope, title, status, learning_outcomes

**Commands (8):** PublishCourse, EnrollLearner, RecordAssessment, CompleteCourse, IssueCertificate, CreateEventFromCourse, RegisterEvent, RecordAttendance

**Queries (4):** GetCourseCatalog, GetMyLearning, GetEventAvailability, GetAttendance

**Events (5):** COURSE_ENROLLED, COURSE_COMPLETED, CERTIFICATE_ISSUED, EVENT_PUBLISHED, ATTENDANCE_RECORDED

**Authorization:** Learner self records private/member-visible. Instructor/manager scoped access. Assessment data restricted.

**Invariants:** Attendance != course completion. Capacity/waitlist atomic. Certificate does not imply statutory qualification. Course retired remains in historical records.

**Dependencies:** CF-01..05. Academy→Events handoff. Notification reminders. Payment Core for paid events if enabled.

**Concurrency:** Registration concurrency-safe. Duplicate attendance idempotent. Course completion deterministic from rules snapshot.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-15 — TTO-BENEFITS-IMPLEMENTATION

**Representative entity and exact field contract:** `BENEFIT` — benefit_id, tenant_id, type, terms, allocation_policy_ref, status

**Commands (6):** CreateBenefit, ActivateBenefit, IssueEntitlement, ReserveEntitlement, RedeemBenefit, CancelEntitlement

**Queries (4):** ListMyBenefits, GetBenefitTerms, GetRewardHistory, GetBenefitUtilization

**Events (3):** BENEFIT_ACTIVATED, ENTITLEMENT_ISSUED, BENEFIT_REDEEMED

**Authorization:** Self benefits only. Allocation decisions auditable. Partner redemption secrets restricted.

**Invariants:** Benefit wallet non-cash/non-withdrawable. Limited capacity requires approved allocation rule. Rewards are not dividends.

**Dependencies:** CF-01..05 and Child-06. Marketplace/Events optional redemption. Notification reminders.

**Concurrency:** Redeem atomic/idempotent. Voucher code single-use. Limited capacity concurrency safe.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-16 — TTO-MARKETPLACE-ADVERTISING-IMPLEMENTATION

**Representative entity and exact field contract:** `PRODUCT` — product_id, tenant_id, title, status, supplier_source_ref?

**Commands (8):** PublishOffer, CreateOrder, ConfirmPayment, RecordFulfillment, RequestRefund, SubmitSupplierProposal, ApproveCampaign, ServeAd

**Queries (4):** BrowseCatalog, GetMyOrders, GetSellerOrders, GetCampaignStats

**Events (4):** ORDER_CREATED, ORDER_FULFILLED, SUPPLIER_PROPOSAL_ACCEPTED, CAMPAIGN_STARTED

**Authorization:** Orders self/seller tenant scoped. Sensitive profile traits not used for ad targeting. Supplier proposal restricted.

**Invariants:** MVP buyer-facing seller = cooperative. Customer payment to cooperative; supplier settlement separate. Sponsored content clearly distinguished from official notices/editorial. No political ads by platform policy baseline.

**Dependencies:** CF-01..05. CF-05 payment. Benefits optional. Communications cannot be conflated with ads.

**Concurrency:** Order snapshot immutable for price/terms. Inventory/quantity if used concurrency-safe. Payment callback idempotent.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-17 — TTO-COLLABORATION-PROCUREMENT-IMPLEMENTATION

**Representative entity and exact field contract:** `COLLAB_NEED` — need_id, tenant_id, scope, status

**Commands (9):** PublishNeed, SubmitEOI, CreateJointInitiative, CreatePurchaseRequest, PublishSourcingEvent, SubmitBid, CloseBidding, RecordEvaluation, ApproveAward

**Queries (4):** BrowseCollaborationNeeds, GetSourcingEvent, GetMyBid, GetAward

**Events (4):** JOINT_INITIATIVE_CREATED, SOURCING_EVENT_PUBLISHED, BID_CLOSED, AWARD_APPROVED

**Authorization:** Sealed bids HIGHLY_RESTRICTED before opening. Evaluator conflict/SoD enforced. Cross-tenant access only approved network projection.

**Invariants:** Criteria frozen before bid opening. Procurement thresholds configurable/source-backed. No pooled funds. Group sourcing may aggregate demand; orders remain tenant-specific unless explicit legal model.

**Dependencies:** CF-01..05, Child-12/20 handoffs. Projects→Procurement. Collaboration→Procurement. GRC conflict. Payment not pooled.

**Concurrency:** Deadline atomic. Bid submission idempotent/versioned before close. Award single active outcome per lot as policy.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-18 — TTO-OPPORTUNITIES-IMPLEMENTATION

**Representative entity and exact field contract:** `OPPORTUNITY` — opportunity_id, tenant_id, type, terms, status, opens/closes

**Commands (6):** PublishOpportunity, SubmitApplication, ScreenApplication, ShortlistApplication, ScheduleInterview, CloseOpportunity

**Queries (3):** ListOpportunities, GetMyApplications, ListApplications

**Events (3):** OPPORTUNITY_PUBLISHED, APPLICATION_SUBMITTED, APPLICATION_STATUS_CHANGED

**Authorization:** Applications RESTRICTED. Reviewer least privilege. Sensitive protected attributes not used unless lawful/explicit.

**Invariants:** Opportunity type routes to employment/procurement/business rules. AI recommendation advisory only; no silent auto-reject. Application evidence retained per policy.

**Dependencies:** CF-01..05. Events for interview. Procurement if vendor selection. GRC for conflicts/background checks where enabled.

**Concurrency:** Submission deadline atomic. Status change optimistic concurrency.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-19 — TTO-COMMUNITY-IMPACT-IMPLEMENTATION

**Representative entity and exact field contract:** `COMMUNITY_NEED` — need_id, geography, source_refs, status

**Commands (6):** CreateImpactProgram, DefineIndicator, RecordMeasurement, CreateImpactClaim, ApproveImpactClaim, CreateGrantCase

**Queries (3):** GetImpactDashboard, GetMeasurementHistory, GetGrantStatus

**Events (3):** IMPACT_MEASUREMENT_RECORDED, IMPACT_CLAIM_PUBLISHED, GRANT_APPROVED

**Authorization:** Beneficiary sensitive data purpose-limited. Public claims only approved aggregate/evidence.

**Invariants:** No automatic SROI. Measurement quality explicit. Project progress not automatically impact. Grant finance records references only, not accounting.

**Dependencies:** CF-01..04 and Child-12. Projects→Impact handoff. Transparency publication. GRC for claim/control risk.

**Concurrency:** Measurement versioned. Duplicate period/source prevented per indicator policy.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-20 — TTO-GRC-IMPLEMENTATION

**Representative entity and exact field contract:** `OBLIGATION` — obligation_id, rule_ref, tenant_id, owner, due_pattern, status

**Commands (9):** CreateRisk, AssessRisk, DefineControl, RecordControlTest, DeclareConflict, ReviewRelatedPartyTransaction, BlockProhibitedDirectorLoan, OpenFinding, CreateRemediationAction

**Queries (4):** GetRiskRegister, GetControlStatus, GetConflictCase, GetFinding

**Events (4):** RISK_ESCALATED, FINDING_OPENED, ACTION_CLOSED, CONFLICT_REVIEWED

**Authorization:** GRC records RESTRICTED/HIGHLY_RESTRICTED. Conflict reviewers SoD. Platform support no default access.

**Invariants:** Article129 ≠ absolute void; workflow/recusal/reporting. Article132 prohibited categories hard block when applicable. No self-certification of compliance. Whistleblower identity need-to-know.

**Dependencies:** CF-01..04. Operational modules → GRC handoff. CF-04 legal rules. Support escalation.

**Concurrency:** Control tests immutable evidence. Repeated issue can aggregate but source refs preserved. Action close requires verification if policy.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-21 — TTO-NETWORK-INTELLIGENCE-IMPLEMENTATION

**Representative entity and exact field contract:** `METRIC_DEFINITION` — metric_code, definition, grain, numerator/denominator, unit, window, source_contract, version

**Commands (6):** DefineMetric, ApproveMetric, RunQualityCheck, BuildBenchmarkSnapshot, PublishInsight, SuppressBenchmark

**Queries (4):** GetMyMetrics, GetBenchmark, GetMetricDefinition, GetQualityStatus

**Events (3):** METRIC_APPROVED, BENCHMARK_SNAPSHOT_CREATED, INSIGHT_PUBLISHED

**Authorization:** Analytics access classification-aware. Tenant sees own exact values + anonymous peer stats.

**Invariants:** ZERO ≠ NO_DATA. ESTIMATED ≠ ACTUAL. Benchmark only compatible definitions/versions. Small cohort/re-identification risk suppressed. Named peer exact values prohibited.

**Dependencies:** All domain analytics and CF-03/04. All Domains via analytics contract/event/projection. Data Governance/Retention.

**Concurrency:** Snapshot immutable/versioned. Rebuild creates new snapshot. Double counting controlled in network aggregation.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-22 — TTO-DATA-GOVERNANCE-RETENTION-IMPLEMENTATION

**Representative entity and exact field contract:** `DATA_CLASSIFICATION_POLICY` — classification code, handling rules, export/search/ai constraints

**Commands (6):** AssignRetentionPolicy, PlaceLegalHold, ReleaseLegalHold, CreateDispositionCase, ApproveDisposition, ExecuteDisposition

**Queries (3):** GetRetentionStatus, ListLegalHolds, GetLineage

**Events (3):** LEGAL_HOLD_PLACED, RETENTION_DUE, DISPOSITION_EXECUTED

**Authorization:** Privacy/retention admins restricted. Highly restricted deletion/export enhanced audit.

**Invariants:** ARCHIVED ≠ DELETED. Legal Hold overrides disposition. Material records no hard delete unless explicit lawful policy. Classification != authorization.

**Dependencies:** CF-03 and CF-04. CF-03 document/evidence/audit. All Domains assign categories.

**Concurrency:** Disposition idempotent. Hold race must win over delete. Policy snapshot retained at disposition.

**Acceptance:** 6 source scenarios, **NOT_RUN**.


## CHILD-23 — TTO-TEST-MIGRATION-OPERATIONS-IMPLEMENTATION

**Representative entity and exact field contract:** `TEST_CASE` — test_id, source_requirement, layer, priority, owner, status

**Commands (8):** CreateTestPlan, ExecuteTestRun, CreateMigrationPlan, RunMigrationDryRun, ExecuteMigration, CreateReleaseCandidate, RecordBackup, RunRestoreTest

**Queries (4):** GetTraceabilityStatus, GetMigrationStatus, GetReleaseGateStatus, GetBackupHealth

**Events (4):** TEST_RUN_COMPLETED, MIGRATION_COMPLETED, RELEASE_CANDIDATE_READY, RESTORE_TEST_PASSED

**Authorization:** Test data synthetic. Production secrets/data not copied into reports. Security results restricted appropriately.

**Invariants:** No test deletion to manufacture green. Every P0/mandatory test linked to source requirement. Migration additive/reversible where feasible. Tenant isolation and no-wallet regression mandatory. Backup without restore test not considered verified.

**Dependencies:** Child-01..22. All Child specs. CI/CD/tooling chosen after repo inspection. Observability provider technology-specific later.

**Concurrency:** Test runs immutable evidence. Migration batches idempotent/restartable. Release candidate pins spec/rule versions.

**Acceptance:** 8 source scenarios, **NOT_RUN**.


## Cross-dependency sequencing

CF-01 identity ↔ CF-02 tenant & party → CF-03 audit/evidence has interface-level circularity. CF-03 ↔ Child-22 retention requires split interfaces and fail-closed defaults. Implement stable interfaces first, then primitive tenant identity, append-only audit, authorization, policies, integrations, membership, share ledger, governance and subsequent domains. Child-23 test infrastructure runs throughout. Never bypass audit or let missing legal rules default allow.

## Limitations

The original DOCX contains full logical field cells and state-machine transitions for every child. This compact app-repo index intentionally reproduces only one exact representative field cell per child and all canonical Command/Query/Event names; the complete field/state/test scenario matrix is retained in the immutable source document. Physical SQL schema and tests still need building.