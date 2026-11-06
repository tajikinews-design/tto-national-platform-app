#!/usr/bin/env bash
# PH10 OPS-004/005/008 isolated PG17: never financial, live, or hosted.
set -euo pipefail
[[ "$CI" == "true" && -z "$VERCEL" && "$TTO_PH10_OPS_DISPOSABLE" == "true" ]] || {
 echo "PH10_OPS_DISPOSABLE_CI_ONLY" >&2; exit 1;
}
[[ "$TEST_ADMIN_DATABASE_URL" == "postgresql://postgres@127.0.0.1:5432/tto" ]] || {
 echo "PH10_OPS_REMOTE_DATABASE_FORBIDDEN" >&2; exit 1;
}
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ && "$GITHUB_RUN_ID" =~ ^[0-9]+$ ]] || {
 echo "PH10_OPS_EXACT_CI_RUN_REQUIRED" >&2; exit 1;
}
name=tto-ph10-ci
image=$(docker inspect --format '{{.Config.Image}}|{{.State.Running}}' "$name")
[[ "$image" == "postgres:17-alpine|true" || "$image" == "postgres:17|true" ]] || {
 echo "PH10_OPS_ISOLATED_POSTGRES17_REQUIRED" >&2; exit 1;
}
cd "$(dirname "$0")/../.."
mkdir -p ph10-artifacts
temp_migration=tto_ph10_ops_replay
temp_backup=tto_ph10_ops_restore
cleanup(){
 docker exec "$name" dropdb -U postgres --if-exists "$temp_migration" >/dev/null 2>&1 || true
 docker exec "$name" dropdb -U postgres --if-exists "$temp_backup" >/dev/null 2>&1 || true
 docker exec "$name" rm -f /tmp/ph10-ops-snapshot.dump /tmp/ph10-ops-source-schema.sql \
  /tmp/ph10-ops-replay-schema.sql >/dev/null 2>&1 || true
}
trap cleanup EXIT

# OPS-008: independently verify that PH09 transaction ROLLBACK removed both
# its synthetic 500 tenants and release candidate, then probe a new rollback.
count=$(docker exec "$name" psql -U postgres -d tto -Atqc \
 "SELECT count(*) FROM tto.tenants WHERE slug LIKE 'ph09-scale-%'")
[[ "$count" == "0" ]] || { echo "PH10_OPS008_500_TENANT_ROLLBACK_LEAK" >&2; exit 1; }
count=$(docker exec "$name" psql -U postgres -d tto -Atqc \
 "SELECT count(*) FROM tto.ph09_release_candidates WHERE candidate_id='99900000-0000-4000-8000-000000000001'")
[[ "$count" == "0" ]] || { echo "PH10_OPS008_RELEASE_ROW_ROLLBACK_LEAK" >&2; exit 1; }
docker exec -i "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
BEGIN;
INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
VALUES ('9fa00000-0000-4000-8000-000000000001','ph10-ops-rollback-probe',
        'Synthetic independent rollback test','ACTIVE');
DO $proof$ BEGIN
 IF (SELECT count(*) FROM tto.tenants
   WHERE slug='ph10-ops-rollback-probe')<>1
 THEN RAISE EXCEPTION 'PH10_OPS008_TRANSACTION_WRITE_UNOBSERVABLE'; END IF;
END $proof$;
ROLLBACK;
DO $proof$ BEGIN
 IF EXISTS (SELECT 1 FROM tto.tenants WHERE slug='ph10-ops-rollback-probe')
 THEN RAISE EXCEPTION 'PH10_OPS008_TRANSACTION_ROLLBACK_FAILED'; END IF;
END $proof$;
SQL
echo "PH10_OPS_AT008_INDEPENDENT_TRANSACTION_ROLLBACK_SCOPED_PASS"

# OPS-004: snapshot and restore synthetic DB. Compare EVERY tenant-ID-bearing
# table's full data fingerprint, keeping each tenant ID in the digest.
docker exec "$name" pg_dump -U postgres -d tto -Fc --no-owner --no-acl \
 -f /tmp/ph10-ops-snapshot.dump
docker exec "$name" test -s /tmp/ph10-ops-snapshot.dump
docker exec "$name" createdb -U postgres "$temp_backup"
docker exec "$name" pg_restore -U postgres --exit-on-error --no-owner --no-acl \
 -d "$temp_backup" /tmp/ph10-ops-snapshot.dump
tables=$(docker exec "$name" psql -U postgres -d tto -Atqc \
 "SELECT c.relname FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id'
 WHERE n.nspname='tto' AND c.relkind='r' AND a.attnum>0
 AND NOT a.attisdropped ORDER BY c.relname")
[[ -n "$tables" ]] || { echo "PH10_OPS004_NO_TENANT_TABLES" >&2; exit 1; }
checked=0
while IFS= read -r table; do
 [[ "$table" =~ ^[a-z][a-z0-9_]*$ ]] || { echo "PH10_OPS004_UNSAFE_TABLE_NAME"; exit 1; }
 sql="SELECT md5(coalesce(string_agg(
   tenant_id::text || ':' || md5(to_jsonb(t)::text),
   '|' ORDER BY tenant_id::text, md5(to_jsonb(t)::text)),'')) FROM tto.\"$table\" t"
 before=$(docker exec "$name" psql -U postgres -d tto -Atqc "$sql")
 after=$(docker exec "$name" psql -U postgres -d "$temp_backup" -Atqc "$sql")
 [[ "$before" =~ ^[0-9a-f]{32}$ && "$before" == "$after" ]] || {
   echo "PH10_OPS004_TENANT_CONTENT_MISMATCH:$table" >&2; exit 1;
 }
 checked=$((checked+1))
done <<<"$tables"
[[ "$checked" -ge 3 ]] || { echo "PH10_OPS004_TENANT_TABLE_SCOPE_TOO_NARROW" >&2; exit 1; }
source_tenants=$(docker exec "$name" psql -U postgres -d tto -Atqc \
 "SELECT count(*) FROM tto.tenants")
[[ "$source_tenants" -ge 2 ]] || { echo "PH10_OPS004_CROSS_TENANT_FIXTURE_MISSING" >&2; exit 1; }
# A zero-row or single-tenant fixture could make identical empty hashes
# appear to prove isolation. Demand independent, nonempty evidence records
# belonging to BOTH known synthetic tenants in source and restored PG17.
# This does not test real backup/DR, and never accesses hosted data.
for database in tto "$temp_backup"; do
 for tenant_id in 99000000-0000-4000-8000-000000000001 99000000-0000-4000-8000-000000000002; do
  present=$(docker exec "$name" psql -U postgres -d "$database" -Atqc \
   "SELECT count(*) FROM tto.evidence_references WHERE tenant_id='$tenant_id'")
  [[ "$present" =~ ^[0-9]+$ && "$present" -ge 1 ]] || {
   echo "PH10_OPS004_NONEMPTY_DISTINCT_TENANT_EVIDENCE_MISSING:$database:$tenant_id" >&2
   exit 1
  }
 done
done
# Ensure the restored tenant set is identical to the original, including
# tenant labels, not merely an equal global count.
tenant_sql="SELECT md5(coalesce(string_agg(tenant_id::text || ':' || slug || ':' || status,'|' ORDER BY tenant_id::text),'')) FROM tto.tenants"
tenants_before=$(docker exec "$name" psql -U postgres -d tto -Atqc "$tenant_sql")
tenants_after=$(docker exec "$name" psql -U postgres -d "$temp_backup" -Atqc "$tenant_sql")
[[ "$tenants_before" =~ ^[0-9a-f]{32}$ && "$tenants_before" == "$tenants_after" ]] || {
 echo "PH10_OPS004_TENANT_REGISTRY_CHANGED_ON_RESTORE" >&2;exit 1;
}
echo "PH10_OPS004_TWO_NONEMPTY_TENANT_EVIDENCE_RESTORE_PASS"
echo "PH10_OPS_AT004_TENANT_SCOPED_ROW_FINGERPRINT_RESTORE_PASS"
echo "PH10_OPS004_TENANT_TABLES_CHECKED=$checked"

# OPS-005: replay exact-head migrations against a second clean PG17 database;
# compare schema-only dump of exercised DB with fresh migrated DB. Any drift
# is an unexplained migration difference and must fail CI.
docker exec "$name" createdb -U postgres "$temp_migration"
migrations=0
for f in database/migrations/[0-9][0-9][0-9][0-9]*.sql; do
 [[ -f "$f" ]] || { echo "PH10_OPS005_MIGRATIONS_MISSING"; exit 1; }
 docker exec -i "$name" psql -U postgres -d "$temp_migration" \
   -v ON_ERROR_STOP=1 < "$f" >/dev/null
 migrations=$((migrations+1))
done
[[ "$migrations" -ge 10 ]] || { echo "PH10_OPS005_MIGRATION_COUNT_SUSPICIOUS" >&2; exit 1; }
docker exec "$name" pg_dump -U postgres -d tto --schema-only --no-owner \
 --no-acl --no-comments -f /tmp/ph10-ops-source-schema.sql
docker exec "$name" pg_dump -U postgres -d "$temp_migration" --schema-only \
 --no-owner --no-acl --no-comments -f /tmp/ph10-ops-replay-schema.sql
# PG17 pg_dump may emit freshly randomized psql injection-guard tokens
# (backslash restrict/unrestrict). They are dump-transport metadata, not DDL.
# Strip only those token lines before strict full schema comparison.
for file in /tmp/ph10-ops-source-schema.sql /tmp/ph10-ops-replay-schema.sql; do
 docker exec "$name" sed -i -e '/^\\restrict /d' -e '/^\\unrestrict /d' "$file"
done
if ! docker exec "$name" cmp -s /tmp/ph10-ops-source-schema.sql /tmp/ph10-ops-replay-schema.sql; then
 echo "PH10_OPS005_SCHEMA_RECONCILIATION_NONZERO_CHECK_MIGRATIONS" >&2
 # Keep substantive differences visible, but never silently downgrade them.
 docker exec "$name" diff -U2 /tmp/ph10-ops-source-schema.sql /tmp/ph10-ops-replay-schema.sql | head -100 || true
 exit 1
fi
echo "PH10_OPS_AT005_CLEAN_MIGRATION_SCHEMA_RECONCILIATION_PASS"
echo "PH10_OPS005_MIGRATION_FILES_REPLAYED=$migrations"
echo "PH10_OPS_NO_REAL_RELEASE_OR_DATA_USED"
