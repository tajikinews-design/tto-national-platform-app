#!/usr/bin/env bash
set -euo pipefail
db=tto-ph09-proof
docker exec "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
INSERT INTO tto.ph09_retention_policies(policy_id,tenant_id,policy_code,version,source_evidence)
VALUES('9b000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
'RACE_HOLD',1,'99200000-0000-4000-8000-000000000001');
INSERT INTO tto.ph09_retention_records(record_id,tenant_id,classification,policy_id)
VALUES('9b100000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
'INTERNAL','9b000000-0000-4000-8000-000000000001');" >/dev/null
a="$(mktemp)";b="$(mktemp)"
trap 'rm -f "$a" "$b"' EXIT
docker exec "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
INSERT INTO tto.ph09_legal_holds(hold_id,record_id,reason_evidence)
VALUES('9b200000-0000-4000-8000-000000000001','9b100000-0000-4000-8000-000000000001',
'99200000-0000-4000-8000-000000000001');
SELECT pg_sleep(1.4);
COMMIT;" >"$a" 2>&1 & first=$!
sleep 0.1
docker exec "$db" psql -U postgres -d tto -v ON_ERROR_STOP=1 -AtX -c "
BEGIN;
SELECT set_config('tto.tenant_id','99000000-0000-4000-8000-000000000001',true);
SELECT set_config('tto.actor_id','99100000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE tto_app;
SELECT tto.ph09_dispose_record('9b100000-0000-4000-8000-000000000001');
COMMIT;" >"$b" 2>&1 & second=$!
wait "$first"
wait "$second"
grep -qx f "$b" || { echo "PH09_DG_AT001_RACE_DISPOSE_NOT_BLOCKED";cat "$b";exit 1; }
state="$(docker exec "$db" psql -U postgres -d tto -Atqc "
SELECT state FROM tto.ph09_retention_records WHERE record_id='9b100000-0000-4000-8000-000000000001'")"
test "$state" = ACTIVE || { echo "PH09_DG_AT001_RACE_WRONG_STATE=$state";exit 1; }
echo PH09_DG_AT001_REAL_TWO_SESSION_LEGAL_HOLD_VS_DELETE_PASS
