-- TTO Share Market v3 §51 isolated HTTP/PG17 lab. NOT a deployable migration.
-- This schema exists ONLY in the temporary test database after all 68 migrations.
-- No external payment or official ownership register writes, ever.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA market_v3_disposable;
CREATE TABLE market_v3_disposable.actors(
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('SELLER','BUYER','COOP_MARKET_MANAGER','COOP_OPERATOR')),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','SUSPENDED')),
 classification text NOT NULL DEFAULT 'MEMBER' CHECK(classification IN('MEMBER','NON_MEMBER')),
 source_verified boolean NOT NULL DEFAULT false,
 buyer_cap bigint NOT NULL DEFAULT 0 CHECK(buyer_cap>=0),
 PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE market_v3_disposable.holdings(
 tenant_id uuid NOT NULL,actor_id uuid NOT NULL,
 registered_quantity bigint NOT NULL CHECK(registered_quantity>=0),
 commitment_clear boolean NOT NULL,
 legal_hold boolean NOT NULL DEFAULT false,
 source_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,actor_id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TABLE market_v3_disposable.market_policy(
 tenant_id uuid PRIMARY KEY,
 pricing_rule_version text NOT NULL,
 unit_price bigint NOT NULL CHECK(unit_price>0),
 valuation_valid boolean NOT NULL,
 fifo boolean NOT NULL DEFAULT true,
 max_active_listings integer NOT NULL CHECK(max_active_listings>0)
);
CREATE TABLE market_v3_disposable.offers(
 offer_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 requested_quantity bigint NOT NULL CHECK(requested_quantity>0),
 unit_price bigint NOT NULL CHECK(unit_price>0),
 pricing_rule_version text NOT NULL,
 sale_mode text NOT NULL DEFAULT 'FULL_OFFER' CHECK(sale_mode='FULL_OFFER'),
 status text NOT NULL DEFAULT 'QUEUED'
 CHECK(status IN('QUEUED','LISTED','RESERVED','COOP_REVIEWED','CANCELLED')),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 idempotency_key text NOT NULL,
 UNIQUE(tenant_id,seller_id,idempotency_key),
 UNIQUE(offer_id,tenant_id),
 FOREIGN KEY(tenant_id,seller_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE INDEX idx_market_v3_lab_queue ON market_v3_disposable.offers(tenant_id,status,accepted_at,offer_id);
CREATE TABLE market_v3_disposable.buy_requests(
 buy_request_id uuid PRIMARY KEY, tenant_id uuid NOT NULL,offer_id uuid NOT NULL,
 buyer_id uuid NOT NULL,quantity bigint NOT NULL CHECK(quantity>0),
 state text NOT NULL CHECK(state IN('COOP_REVIEW','BOARD_APPROVAL_PENDING')),
 idempotency_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(offer_id),UNIQUE(tenant_id,buyer_id,idempotency_key),
 UNIQUE(buy_request_id,tenant_id),
 FOREIGN KEY(offer_id,tenant_id) REFERENCES market_v3_disposable.offers(offer_id,tenant_id),
 FOREIGN KEY(tenant_id,buyer_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
CREATE TABLE market_v3_disposable.coop_reviews(
 review_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,buy_request_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,verdict text NOT NULL CHECK(verdict='REFER_TO_BOARD'),
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 idempotency_key text NOT NULL,
 UNIQUE(tenant_id,reviewer_id,idempotency_key),UNIQUE(buy_request_id),
 FOREIGN KEY(buy_request_id,tenant_id) REFERENCES market_v3_disposable.buy_requests(buy_request_id,tenant_id),
 FOREIGN KEY(tenant_id,reviewer_id) REFERENCES market_v3_disposable.actors(tenant_id,actor_id)
);
-- Fixture tenants and actors do not reference actual cooperative tables.
INSERT INTO market_v3_disposable.actors(tenant_id,actor_id,role,source_verified,buyer_cap,classification) VALUES
('91111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','SELLER',true,0,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','BUYER',true,25,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333','BUYER',true,25,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a4444444-4444-4444-8444-444444444444','COOP_MARKET_MANAGER',true,0,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a5555555-5555-4555-8555-555555555555','COOP_OPERATOR',true,0,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a6666666-6666-4666-8666-666666666666','SELLER',true,0,'MEMBER'),
('91111111-1111-4111-8111-111111111111','a7777777-7777-4777-8777-777777777777','BUYER',false,0,'NON_MEMBER'),
('92222222-2222-4222-8222-222222222222','a8888888-8888-4888-8888-888888888888','BUYER',true,99,'MEMBER');
INSERT INTO market_v3_disposable.holdings(tenant_id,actor_id,registered_quantity,commitment_clear,source_verified) VALUES
('91111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',100,true,true),
('91111111-1111-4111-8111-111111111111','a6666666-6666-4666-8666-666666666666',18,false,true),
('91111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222',10,true,true),
('91111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333',10,true,true);
INSERT INTO market_v3_disposable.market_policy(tenant_id,pricing_rule_version,unit_price,valuation_valid,max_active_listings) VALUES
('91111111-1111-4111-8111-111111111111','TEST-PRICE-RULE-v1',1000,true,2);
COMMIT;
