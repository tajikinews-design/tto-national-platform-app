#!/usr/bin/env bash
set -euo pipefail
container=tto-ph07-isolated
docker exec -i "$container" psql -U postgres -d tto -v ON_ERROR_STOP=1 < tests/sql/ph07-concurrent-proxy-setup.sql >/dev/null
x="$(mktemp)";y="$(mktemp)"
trap 'rm -f "$x" "$y"' EXIT
runner() {
 local suffix="$1" target="$2"
 docker exec "$container" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
INSERT INTO tto.ph07_proxy_grants(grant_id,assembly_id,representative_party_id,represented_party_id)
VALUES('76300000-0000-4000-8000-00000000000${suffix}',
'76200000-0000-4000-8000-000000000001',
'76100000-0000-4000-8000-000000000001',
'76100000-0000-4000-8000-00000000000${target}');
SELECT pg_sleep(1.2);
COMMIT;"
}
runner 3 4 >"$x" 2>&1 & a=$!
sleep 0.1
runner 4 5 >"$y" 2>&1 & b=$!
set +e
wait "$a"; aexit=$?
wait "$b"; bexit=$?
set -e
if [[ "$aexit" -eq 0 && "$bexit" -ne 0 ]];then
 grep -q PH07_MAX_THREE_PROXY_REACHED "$y" || { cat "$y";exit 1; }
elif [[ "$bexit" -eq 0 && "$aexit" -ne 0 ]];then
 grep -q PH07_MAX_THREE_PROXY_REACHED "$x" || { cat "$x";exit 1; }
else
 echo PH07_GOV_CONCURRENT_PROXY_UNEXPECTED_RESULT
 cat "$x" "$y";exit 1
fi
n="$(docker exec "$container" psql -U postgres -d tto -Atqc "
SELECT count(*) FROM tto.ph07_proxy_grants
WHERE assembly_id='76200000-0000-4000-8000-000000000001'")"
if [[ "$n" != 3 ]];then
 echo PH07_GOV_PROXY_OVERBOOK_COUNT="$n";exit 1
fi
echo PH07_GOV_AT002_TWO_CONCURRENT_POSTGRES_PROXY_CAP_PASS
