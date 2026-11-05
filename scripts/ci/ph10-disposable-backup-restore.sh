#!/usr/bin/env bash
# PH10 G5 disposable PG17 backup/restore verification. NEVER USE ON HOSTED DB.
set -euo pipefail
[[ "${CI:-}" == "true" && -z "${VERCEL:-}" ]] || { echo PH10_CI_ONLY; exit 1; }
name=tto-ph10-ci
docker inspect "$name" >/dev/null
docker exec "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 -Atqc "SELECT 1 FROM tto.tenants LIMIT 1" >/dev/null
docker exec "$name" pg_dump -U postgres -d tto --format=custom --no-owner --no-acl -f /tmp/ph10-g5-backup.dump
docker exec "$name" test -s /tmp/ph10-g5-backup.dump
docker exec "$name" pg_restore -l /tmp/ph10-g5-backup.dump >/dev/null
docker exec "$name" createdb -U postgres tto_ph10_restore
docker exec "$name" pg_restore -U postgres --exit-on-error --no-owner --no-acl -d tto_ph10_restore /tmp/ph10-g5-backup.dump
source_count=$(docker exec "$name" psql -U postgres -d tto -Atqc 'SELECT count(*) FROM tto.tenants')
restored_count=$(docker exec "$name" psql -U postgres -d tto_ph10_restore -Atqc 'SELECT count(*) FROM tto.tenants')
[[ "$source_count" == "$restored_count" ]] || { echo PH10_G5_RESTORE_TENANT_MISMATCH; exit 1; }
source_functions=$(docker exec "$name" psql -U postgres -d tto -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='tto'")
restored_functions=$(docker exec "$name" psql -U postgres -d tto_ph10_restore -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='tto'")
[[ "$source_functions" == "$restored_functions" ]] || { echo PH10_G5_RESTORE_FUNCTION_MISMATCH; exit 1; }
docker exec "$name" dropdb -U postgres tto_ph10_restore
docker exec "$name" rm -f /tmp/ph10-g5-backup.dump
echo PH10_G5_DISPOSABLE_BACKUP_RESTORE_PASS
