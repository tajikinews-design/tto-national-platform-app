BEGIN;
CREATE TABLE tto.ph09_release_candidates(
 candidate_id uuid PRIMARY KEY,source_sha text NOT NULL,
 mandatory_test_total int NOT NULL CHECK(mandatory_test_total>0),
 mandatory_test_passed int NOT NULL CHECK(mandatory_test_passed>=0),
 migration_reconciliation_errors int NOT NULL DEFAULT 0 CHECK(migration_reconciliation_errors>=0),
 rollback_verified boolean NOT NULL DEFAULT false,
 CHECK(mandatory_test_passed<=mandatory_test_total));
CREATE FUNCTION tto.ph09_release_allowed(p_candidate uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,tto AS $f$
SELECT EXISTS(SELECT 1 FROM tto.ph09_release_candidates r WHERE r.candidate_id=p_candidate
AND r.mandatory_test_passed=r.mandatory_test_total
AND r.migration_reconciliation_errors=0 AND r.rollback_verified);
$f$;
ALTER TABLE tto.ph09_release_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tto.ph09_release_candidates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tto.ph09_release_candidates FROM PUBLIC,tto_app;
REVOKE ALL ON FUNCTION tto.ph09_release_allowed(uuid) FROM PUBLIC,tto_app;
COMMIT;