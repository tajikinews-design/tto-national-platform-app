#!/usr/bin/env bash
set -euo pipefail
db=tto-ph08-ci
docker exec -i "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 < tests/sql/ph08-concurrency-setup.sql >/dev/null
a="$(mktemp)";b="$(mktemp)"
trap 'rm -f "$a" "$b"' EXIT
run_registration(){
 local actor="$1" pause="$2"
 docker exec "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
SELECT set_config('tto.tenant_id','88000000-0000-4000-8000-000000000001',true);
SELECT set_config('tto.actor_id','$actor',true);
SET LOCAL ROLE tto_app;
SELECT tto.ph08_registration('88b10000-0000-4000-8000-000000000001','$actor');
SELECT pg_sleep($pause);
COMMIT;"
}
run_registration '88100000-0000-4000-8000-000000000001' 1.3 >"$a" 2>&1 & apid=$!
sleep 0.1
run_registration '88100000-0000-4000-8000-000000000003' 0 >"$b" 2>&1 & bpid=$!
wait "$apid"
wait "$bpid"
if [[ "$(grep -c '^CONFIRMED$' "$a" "$b" | awk -F: '{s+=$2} END{print s+0}')" != 1 ||
      "$(grep -c '^WAITLIST$' "$a" "$b" | awk -F: '{s+=$2} END{print s+0}')" != 1 ]];then
 echo PH08_LEARN_REAL_CONCURRENCY_FAILED;cat "$a" "$b";exit 1
fi
result="$(docker exec "$db" psql -U postgres -d tto -Atqc "
SELECT count(*) FROM tto.ph08_event_registrations WHERE event_id='88b10000-0000-4000-8000-000000000001' AND state='CONFIRMED'")"
test "$result" = 1 || { echo PH08_LEARN_CAPACITY_RACE_OVERBOOKED;exit 1; }
echo PH08_LEARN_AT002_TWO_POSTGRES_SESSIONS_CAPACITY_PASS
race_cas(){
 local pause="$1"
 docker exec "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
SELECT set_config('tto.tenant_id','88000000-0000-4000-8000-000000000001',true);
SELECT set_config('tto.actor_id','88100000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE tto_app;
SELECT tto.ph08_cas_project('88b20000-0000-4000-8000-000000000001',1);
SELECT pg_sleep($pause);
COMMIT;"
}
race_cas 1.2 >"$a" 2>&1 & apid=$!
sleep 0.1
race_cas 0 >"$b" 2>&1 & bpid=$!
wait "$apid"
wait "$bpid"
if [[ "$(grep -c '^t$' "$a" "$b" | awk -F: '{s+=$2} END{print s+0}')" != 1 ||
      "$(grep -c '^f$' "$a" "$b" | awk -F: '{s+=$2} END{print s+0}')" != 1 ]];then
 echo PH08_PROJ_REAL_CONCURRENCY_FAILED;cat "$a" "$b";exit 1
fi
echo PH08_PROJ_AT006_TWO_POSTGRES_SESSIONS_CONFLICT_PASS
