-- Isolated PG17 LAB independent board evidence metadata review.
-- NOT a production migration, NOT validation of actual signatures or legal authority.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE market_v3_disposable.actors DROP CONSTRAINT actors_role_check;
ALTER TABLE market_v3_disposable.actors ADD CONSTRAINT actors_role_check
 CHECK(role IN('SELLER','BUYER','COOP_MARKET_MANAGER','COOP_OPERATOR',
               'BOARD_SECRETARIAT','BOARD_EVIDENCE_REVIEWER'));
INSERT INTO market_v3_disposable.actors
 (tenant_id,actor_id,role,status,source_verified)
 VALUES ('91111111-1111-4111-8111-111111111111',
         'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
         'BOARD_EVIDENCE_REVIEWER','ACTIVE',true);
CREATE TABLE market_v3_disposable.board_evidence_metadata_reviews(
 check_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 decision_id uuid NOT NULL,
 entered_by uuid NOT NULL,
 checked_by uuid NOT NULL,
 metadata_digest_sha256 text NOT NULL CHECK(length(metadata_digest_sha256)=64),
 outcome text NOT NULL CHECK(outcome='LAB_METADATA_MATCHED_NOT_SIGNED'),
 idempotency_key text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,decision_id),
 UNIQUE(tenant_id,checked_by,idempotency_key),
 FOREIGN KEY(tenant_id,checked_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 FOREIGN KEY(tenant_id,entered_by) REFERENCES market_v3_disposable.actors(tenant_id,actor_id),
 FOREIGN KEY(decision_id) REFERENCES market_v3_disposable.board_decision_drafts(decision_id),
 CHECK(checked_by<>entered_by)
);
CREATE FUNCTION market_v3_disposable.deny_review_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'LAB_REVIEW_APPEND_ONLY';
END;
$$;
CREATE TRIGGER board_evidence_metadata_reviews_immutable
 BEFORE UPDATE OR DELETE ON market_v3_disposable.board_evidence_metadata_reviews
 FOR EACH ROW EXECUTE FUNCTION market_v3_disposable.deny_review_mutation();
COMMIT;
