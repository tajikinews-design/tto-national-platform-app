#!/usr/bin/env bash
set -euo pipefail
container="tto-ph06-isolated"
db="tto"
docker exec -i "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 < tests/sql/ph06-share-lock-concurrent-setup.sql >/dev/null
a="$(mktemp)"; b="$(mktemp)"
trap 'rm -f "$a" "$b"' EXIT
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
SELECT tto.ph06_try_lock_shares('b6cccccc-cccc-4ccc-8ccc-ccccccccccc1',
'b6dddddd-dddd-4ddd-8ddd-ddddddddddd1');
SELECT pg_sleep(2);
COMMIT;" >"$a" 2>&1 &
pid1=$!
sleep 0.15
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
SELECT tto.ph06_try_lock_shares('b6cccccc-cccc-4ccc-8ccc-ccccccccccc2',
'b6dddddd-dddd-4ddd-8ddd-ddddddddddd2');
COMMIT;" >"$b" 2>&1 &
pid2=$!
wait "$pid1"
wait "$pid2"
successes=$(( $(grep -cx 't' "$a" || true) + $(grep -cx 't' "$b" || true) ))
denials=$(( $(grep -cx 'f' "$a" || true) + $(grep -cx 'f' "$b" || true) ))
if [[ "$successes" != 1 || "$denials" != 1 ]];then
 echo "PH06_CONCURRENT_RACE_INVALID_RESULTS";cat "$a" "$b";exit 1
fi
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -Atqc "
DO \$x\$
DECLARE q bigint;
BEGIN
 SELECT coalesce(sum(quantity),0) INTO q
 FROM tto.ph06_share_locks
 WHERE tenant_id='b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
 AND state='ACTIVE';
 IF q NOT IN (6,7) OR q>10 THEN
 RAISE EXCEPTION 'SHARE003_CONCURRENT_OVERBOOKING';
 END IF;
 IF (SELECT count(*) FROM tto.ph06_share_locks
 WHERE tenant_id='b6aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
 AND state='ACTIVE')<>1 THEN
 RAISE EXCEPTION 'SHARE003_DOUBLE_ACCEPTED_CONCURRENT_LOCK';
 END IF;
END \$x\$;" >/dev/null
echo 'PH06_SHARE_AT003_TWO_INDEPENDENT_POSTGRES_SESSIONS_CONCURRENT_LOCK_PASS'
echo 'PH06_RACE_DISPOSABLE_ONLY_NO_REAL_SHARES'
