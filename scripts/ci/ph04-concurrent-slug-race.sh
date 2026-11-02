#!/usr/bin/env bash
# PH04 CHILD02-AT-003 genuine concurrent transaction race, ephemeral PG17 only.
set -euo pipefail
test "${CI:-}" = "true"
name="tto-ph04-ci-pg"
sql() { docker exec "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 -Atqc "$1"; }
sql "INSERT INTO tto.tenants(tenant_id,slug,display_name,status) VALUES
 ('a1111111-1111-4111-8111-111111111111','race-a','Synthetic RACE A','ACTIVE'),
 ('b2222222-2222-4222-8222-222222222222','race-b','Synthetic RACE B','ACTIVE');"
a="INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from) VALUES
 ('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','same-live-slug','CURRENT',now());"
b="INSERT INTO tto.tenant_slugs(slug_id,tenant_id,slug,status,valid_from) VALUES
 ('b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','same-live-slug','CURRENT',now());"
tmpA="$(mktemp)";tmpB="$(mktemp)"
trap 'rm -f "$tmpA" "$tmpB"' EXIT
(docker exec "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 -c "BEGIN; $a SELECT pg_sleep(1.2); COMMIT;" >"$tmpA" 2>&1) &
p1=$!
sleep 0.15
(docker exec "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 -c "BEGIN; $b COMMIT;" >"$tmpB" 2>&1) &
p2=$!
set +e
wait "$p1";rc1=$?
wait "$p2";rc2=$?
set -e
if [[ "$rc1" -eq 0 && "$rc2" -ne 0 ]] || [[ "$rc2" -eq 0 && "$rc1" -ne 0 ]];then :;else
  echo "PH04_CONCURRENT_SLUG_RACE_UNEXPECTED_OUTCOME first=$rc1 second=$rc2"
  exit 1
fi
count="$(sql "SELECT count(*) FROM tto.tenant_slugs WHERE slug='same-live-slug' AND status='CURRENT'")"
test "$count" = "1" || { echo "PH04_DUPLICATE_LIVE_SLUG_RACE count=$count";exit 1; }
# Confirm conflict was unique constraint and not a transient process failure.
if [[ "$rc1" -ne 0 ]];then grep -q "duplicate key value violates unique constraint" "$tmpA"
else grep -q "duplicate key value violates unique constraint" "$tmpB";fi
echo "CORE-TENANT-AT-003_CONCURRENT_TWO_TRANSACTIONS_ONE_COMMIT_PASS"
echo "TTO_PH04_CONCURRENT_GLOBAL_SLUG_RACE_PASS"
