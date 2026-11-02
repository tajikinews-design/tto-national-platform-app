#!/usr/bin/env bash
# Manual / ready-for-review release regression, ephemeral PG17 ONLY.
set -euo pipefail
test "${CI:-}" = "true"
test "${APIIR_TOKEN:-}" = ""
test "${TEST_ADMIN_DATABASE_URL:-}" = "postgresql://postgres@127.0.0.1:5432/tto"
container="tto-adaptive-postgres"
reset_db() {
 docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS tto WITH (FORCE)'
 docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE tto'
}
sql() { docker exec -i "$container" psql -U postgres -d tto -v ON_ERROR_STOP=1 < "$1"; }
echo 'TTO_RELEASE_HISTORICAL_REGRESSION_DISPOSABLE_ONLY'
reset_db
for f in \
 database/migrations/0001_cf01_cf03_foundation.sql \
 tests/sql/tenant-isolation.sql \
 database/migrations/0002_cf01_03_secure_flows.sql \
 tests/sql/cf01-cf03-v2.sql \
 database/migrations/0003_cf01_03_role_jit_party_document.sql \
 tests/sql/cf01-cf03-v3.sql \
 database/migrations/0004_cf02_privileged_lifecycle_cf03_hold_release.sql \
 tests/sql/cf02-cf03-v4.sql; do sql "$f"; done
# PH04 guarded HTTP tests require the complete additive schema after legacy v1-v4 checks.
# This database is disposable and is reset below; no hosted/Production migration.
for f in database/migrations/000[5-9]_*.sql database/migrations/001[0-8]_*.sql; do sql "$f"; done
echo "TTO_RELEASE_HISTORICAL_COMPLETE_MIGRATIONS_0001_TO_0018_PASS"
# PH05 candidate source-backed physical security slices, each ROLLBACK-only.
# Existing commands, historical E2E, and hosted DB remain untouched.
sql tests/sql/ph05-cf03-audit-hold-negative.sql
sql tests/sql/ph05-cf03-file-download-negative.sql
sql tests/sql/ph05-cf04-source-rule-asof.sql
sql tests/sql/ph05-cf05-webhook-payment-evidence.sql
echo "TTO_PH05_CF03_CF04_CF05_DISPOSABLE_SOURCE_NEGATIVE_SLICES_PASS_NOT_FULL_ACCEPTANCE"
secret="$(openssl rand -hex 48)"
echo "::add-mask::$secret"
AUTH_CHALLENGE_HMAC_SECRET="$secret" node services/api/test/identity-workflows.integration.cjs
reset_db
sql database/migrations/0001_cf01_cf03_foundation.sql
sql tests/sql/tenant-isolation.sql
node services/api/test/tenant-auth.integration.cjs
reset_db
for f in database/migrations/000{1,2,3,4,5}_*.sql;do sql "$f";done
sql tests/sql/cf01-smsotp-issuance.sql
node services/api/test/smsotp-request.integration.cjs
reset_db
for f in database/migrations/000{1,2,3,4,5,6,7}_*.sql;do sql "$f";done
node scripts/e2e-cf01-three-portal-login-logout.cjs
echo 'TTO_RELEASE_HISTORICAL_SECURITY_E2E_PASS'
