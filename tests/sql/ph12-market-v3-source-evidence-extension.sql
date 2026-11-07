-- Disposable lab extension for the already-isolated market_v3_disposable schema.
-- NOT a production migration, not a legal endorsement, not a signed official rule.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE market_v3_disposable.actors DROP CONSTRAINT actors_role_check;
ALTER TABLE market_v3_disposable.actors ADD CONSTRAINT actors_role_check
 CHECK(role IN('SELLER','BUYER','COOP_MARKET_MANAGER','COOP_OPERATOR','BOARD_SECRETARIAT'));
INSERT INTO market_v3_disposable.actors(tenant_id,actor_id,role,status,source_verified)
 VALUES ('91111111-1111-4111-8111-111111111111',
         'a9999999-9999-4999-8999-999999999999','BOARD_SECRETARIAT','ACTIVE',true);
CREATE TABLE market_v3_disposable.price_source_versions(
 tenant_id uuid NOT NULL,source_id text NOT NULL,version bigint NOT NULL CHECK(version>0),
 unit_price bigint NOT NULL CHECK(unit_price>0),
 expert_report_reference text NOT NULL, approval_reference text NOT NULL,
 valid_from timestamptz NOT NULL,valid_until timestamptz NOT NULL,
 evidence_state text NOT NULL CHECK(evidence_state IN('LAB_TEST_ATTESTED','UNVERIFIED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,source_id,version),
 CHECK(valid_until>valid_from)
);
CREATE TABLE market_v3_disposable.buyer_entitlement_sources(
 tenant_id uuid NOT NULL,buyer_id uuid NOT NULL,source_event_id text NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),classification text NOT NULL,
 legal_basis_ref text NOT NULL, cap_shares bigint NOT NULL CHECK(cap_shares>=0),
 effective_from timestamptz NOT NULL, effective_until timestamptz NOT NULL,
 evidence_state text NOT NULL CHECK(evidence_state IN('LAB_TEST_ATTESTED','UNVERIFIED')),
 PRIMARY KEY(tenant_id,buyer_id,source_version),
 FOREIGN KEY(tenant_id,buyer_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK(effective_until>effective_from)
);
-- Staged scheduling is a market coordination datum, NOT a legal transfer.
ALTER TABLE market_v3_disposable.offers
 DROP CONSTRAINT offers_status_check;
ALTER TABLE market_v3_disposable.offers ADD CONSTRAINT offers_status_check
 CHECK(status IN('QUEUED','SCHEDULED','LISTED','RESERVED','COOP_REVIEWED','CANCELLED'));
ALTER TABLE market_v3_disposable.offers
 ADD COLUMN scheduled_at timestamptz,
 ADD COLUMN pricing_source_id text,
 ADD COLUMN pricing_source_version bigint,
 ADD COLUMN estimated_listing_day date;
ALTER TABLE market_v3_disposable.market_policy
 ADD COLUMN release_daily_capacity integer NOT NULL DEFAULT 1 CHECK(release_daily_capacity>0),
 ADD COLUMN business_timezone text NOT NULL DEFAULT 'Asia/Tehran',
 ADD COLUMN business_workdays integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,6],
 ADD COLUMN excluded_business_dates date[] NOT NULL DEFAULT ARRAY[]::date[];
CREATE TABLE market_v3_disposable.board_decision_drafts(
 decision_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,buy_request_id uuid NOT NULL,
 meeting_reference text NOT NULL,resolution_reference text NOT NULL,
 attachment_reference text NOT NULL,legal_basis_reference text NOT NULL,
 decision_date date NOT NULL,
 decision text NOT NULL CHECK(decision IN('APPROVE','REJECT','RETURN_FOR_REVIEW')),
 entered_by uuid NOT NULL,verified_by uuid,
 evidence_status text NOT NULL DEFAULT 'UNVERIFIED_DRAFT'
 CHECK(evidence_status='UNVERIFIED_DRAFT'),
 idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,entered_by,idempotency_key), UNIQUE(tenant_id,buy_request_id),
 FOREIGN KEY(buy_request_id,tenant_id) REFERENCES market_v3_disposable.buy_requests(buy_request_id,tenant_id),
 FOREIGN KEY(tenant_id,entered_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK(verified_by IS NULL),
 CHECK(length(meeting_reference)>=8 AND length(resolution_reference)>=8
   AND length(attachment_reference)>=8 AND length(legal_basis_reference)>=8)
);
INSERT INTO market_v3_disposable.price_source_versions
 (tenant_id,source_id,version,unit_price,expert_report_reference,approval_reference,
  valid_from,valid_until,evidence_state) VALUES
 ('91111111-1111-4111-8111-111111111111','TEST-PRICE-RULE',1,1000,
  'TEST-EXPERT-REPORT','TEST-COOP-APPROVAL','2026-01-01','2028-01-01','LAB_TEST_ATTESTED'),
 ('91111111-1111-4111-8111-111111111111','TEST-PRICE-EXPIRED',1,500,
  'TEST-OLD-EXPERT','TEST-OLD-APPROVAL','2023-01-01','2024-01-01','LAB_TEST_ATTESTED'),
 ('91111111-1111-4111-8111-111111111111','TEST-PRICE-UNVERIFIED',1,999,
  'TEST-NO-EXPERT','TEST-NO-APPROVAL','2026-01-01','2028-01-01','UNVERIFIED');
INSERT INTO market_v3_disposable.buyer_entitlement_sources
 (tenant_id,buyer_id,source_event_id,source_version,classification,legal_basis_ref,
 cap_shares,effective_from,effective_until,evidence_state) VALUES
 ('91111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222',
  'TEST-BUYER-MEMBER-1',1,'MEMBER','TEST-CAP-LAW-v1',25,'2026-01-01','2028-01-01','LAB_TEST_ATTESTED'),
 ('91111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333',
  'TEST-BUYER-MEMBER-2',1,'MEMBER','TEST-CAP-LAW-v1',25,'2026-01-01','2028-01-01','LAB_TEST_ATTESTED'),
 ('91111111-1111-4111-8111-111111111111','a7777777-7777-4777-8777-777777777777',
  'TEST-NON-MEMBER-NO-AUTHORITY',1,'NON_MEMBER','TEST-UNAPPROVED',99,
  '2026-01-01','2028-01-01','UNVERIFIED');
UPDATE market_v3_disposable.market_policy
 SET release_daily_capacity=2,business_timezone='Asia/Tehran',
 business_workdays=ARRAY[0,1,2,3,4,6]
 WHERE tenant_id='91111111-1111-4111-8111-111111111111';
COMMIT;
