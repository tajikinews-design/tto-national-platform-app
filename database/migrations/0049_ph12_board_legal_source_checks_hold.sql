-- PH12 Issue #171: source-bound legal verification dossier (HOLD).
-- Deliberately NO ACTIVE status, no tariff-draft updates, no authority claims.
-- Requires migration 0048; apply only in isolated PostgreSQL until reviewed.
BEGIN;
CREATE TABLE tto.ph12_tariff_board_legal_source_checks (
 check_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tto.tenants(tenant_id),
 case_id uuid NOT NULL REFERENCES tto.ph12_tariff_board_evidence_cases(case_id),
 source_category text NOT NULL CHECK(source_category IN
   ('BOARD_ROSTER','SIGNING_AUTHORITY','BYLAWS','MEETING_QUORUM','RESOLUTION_VALIDITY')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 8 AND 200),
 source_version text NOT NULL CHECK(length(source_version) BETWEEN 1 AND 100),
 source_sha256 bytea NOT NULL CHECK(octet_length(source_sha256)=32),
 checked_by uuid NOT NULL REFERENCES tto.user_accounts(user_id),
 source_observed_at timestamptz NOT NULL,
 source_expires_at timestamptz NOT NULL,
 verified_result text NOT NULL DEFAULT 'PENDING_OFFICIAL_VERIFICATION'
   CHECK(verified_result IN('PENDING_OFFICIAL_VERIFICATION','SOURCE_REJECTED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 request_key uuid NOT NULL,
 UNIQUE(tenant_id,checked_by,request_key),
 CHECK(source_expires_at > source_observed_at),
 CHECK(source_observed_at <= created_at)
);
CREATE INDEX ph12_legal_checks_case_idx
 ON tto.ph12_tariff_board_legal_source_checks(tenant_id,case_id,created_at DESC);
ALTER TABLE tto.ph12_tariff_board_legal_source_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph12_tariff_board_legal_source_checks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph12_tariff_board_legal_source_checks FROM PUBLIC,tto_app;
CREATE TRIGGER ph12_board_legal_checks_immutable
 BEFORE UPDATE OR DELETE ON tto.ph12_tariff_board_legal_source_checks
 FOR EACH ROW EXECUTE FUNCTION tto.ph12_tariff_board_no_changes();
COMMENT ON TABLE tto.ph12_tariff_board_legal_source_checks IS
 'Append-only official-source check records; neither authenticity nor legal approval is inferred from intake. No ACTIVE pathway.';
COMMIT;
