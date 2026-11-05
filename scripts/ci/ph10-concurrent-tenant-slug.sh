#!/usr/bin/env bash
set -euo pipefail
db=tto-ph10-ci
left="$(mktemp)";right="$(mktemp)"
trap 'rm -f "$left" "$right"' EXIT
insert() {
 local tenant="$1" pause="$2"
 docker exec "$db" psql -U postgres -d tto -X -A -t -v ON_ERROR_STOP=1 -c "
 BEGIN;
 INSERT INTO tto.tenants(tenant_id,slug,display_name,status)
 VALUES('$tenant','ph10-real-concurrency-slug','Synthetic PH10 slug race','PROVISIONING');
 SELECT pg_sleep($pause);
 COMMIT;"
}
insert 'a9b00000-0000-4000-8000-000000000001' 1.25 >"$left" 2>&1 & first=$!
sleep 0.15
insert 'a9b00000-0000-4000-8000-000000000002' 0 >"$right" 2>&1 & second=$!
set +e
wait "$first"; a=$?
wait "$second"; b=$?
set -e
if ! { [[ "$a" == 0 && "$b" != 0 ]] || [[ "$b" == 0 && "$a" != 0 ]]; }; then
 echo PH10_CORE_TENANT_AT003_UNEXPECTED_RACE
 cat "$left" "$right";exit 1
fi
if [[ "$a" != 0 ]];then
 grep -q 'duplicate key' "$left" || { cat "$left";exit 1; }
else
 grep -q 'duplicate key' "$right" || { cat "$right";exit 1; }
fi
n="$(docker exec "$db" psql -U postgres -d tto -Atqc "
SELECT count(*) FROM tto.tenants WHERE slug='ph10-real-concurrency-slug'")"
test "$n" = 1 || { echo PH10_TENANT_DUPLICATE_SLUG_ACCEPTED_COUNT="$n";exit 1; }
echo CORE_TENANT_AT003_TWO_INDEPENDENT_POSTGRES_SESSIONS_EXACT_SOURCE_PASS
