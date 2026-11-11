-- TTO Share Market v3 §51: isolated test-only relist REVIEW state.
-- Load only after tests/sql/ph12-market-v3-disposable-fixture.sql in PG17.
-- This is not a migration, not a legal register and not a listing instruction.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE market_v3_disposable.lab_relist_review (
 tenant_id uuid NOT NULL,
 offer_id uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version > 0),
 source_kind text NOT NULL CHECK(source_kind='SYNTHETIC_PG17_REVIEW_ONLY'),
 valid_until timestamptz NOT NULL,
 no_unresolved_payment_claim boolean,
 no_open_dispute boolean,
 no_legal_hold boolean,
 reservation_released_safely boolean,
 offer_still_valid boolean,
 pricing_rule_valid boolean,
 seller_relist_permission_valid boolean,
 market_policy_allows boolean,
 review_state text NOT NULL DEFAULT 'PENDING_REVIEW'
   CHECK(review_state IN('PENDING_REVIEW','READY_FOR_INDEPENDENT_REVIEW')),
 reviewed_by uuid,
 reviewed_at timestamptz,
 PRIMARY KEY(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,offer_id) REFERENCES market_v3_disposable.offers(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,reviewed_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 CHECK((review_state='PENDING_REVIEW' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
       (review_state='READY_FOR_INDEPENDENT_REVIEW' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
COMMIT;
