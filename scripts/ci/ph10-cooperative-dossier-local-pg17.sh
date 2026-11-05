#!/usr/bin/env bash
# Reproducible isolated PG17 acceptance command for Codex or an authorized local machine.
# Uses ONLY docker exec on a network-disabled, transient database. Never touches Preview.
set -Eeuo pipefail
: "${DOCKER_BIN:=docker}"
name="tto-ph10-dossier-${RANDOM}-$$"
cleanup(){ "$DOCKER_BIN" rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
if [[ ! -f database/migrations/9999b_ph10_cooperative_evidence_quarantine.sql ]]; then
  echo "FAIL: run from repo root at the exact PH10 dossier branch" >&2;exit 2
fi
if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
 echo "BLOCKED: Docker daemon unavailable. No fallback to hosted Preview." >&2;exit 3
fi
"$DOCKER_BIN" run -d --rm --network none --name "$name" \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=tto postgres:17-alpine >/dev/null
ok=false
for i in $(seq 1 90);do
 if "$DOCKER_BIN" exec "$name" psql -U postgres -d tto -Atqc 'select 1' >/dev/null 2>&1;then
  ok=true;break
 fi
 sleep 1
done
if [[ "$ok" != true ]];then echo "BLOCKED: ephemeral PG17 not ready" >&2;exit 4;fi
for f in database/migrations/[0-9][0-9][0-9][0-9]*.sql;do
 echo "TTO_PH10_MIGRATION=${f##*/}"
 "$DOCKER_BIN" exec -i "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 < "$f" >/dev/null
done
for f in tests/sql/ph10-cooperative-dossier-review-disposable.sql \
 tests/sql/ph10-cooperative-draft-disposable.sql \
 tests/sql/ph10-cooperative-evidence-quarantine-disposable.sql \
 tests/sql/ph10-cooperative-external-source-review-disposable.sql \
 tests/sql/ph10-cooperative-malware-scan-disposable.sql \
 tests/sql/ph10-manual-official-governance-claims-disposable.sql;do
 echo "TTO_PH10_TEST=$f"
 "$DOCKER_BIN" exec -i "$name" psql -U postgres -d tto -v ON_ERROR_STOP=1 < "$f"
done
echo "TTO_PH10_ISOLATED_PG17_PASS_NO_HOSTED_DB"
