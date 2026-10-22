#!/usr/bin/env bash
# Four synthetic/no-secrets OCI builds. No cloud deployment, no registry push.
set -euo pipefail
test "${CI:-}" = "true"
for item in \
 "shareholder:apps/shareholder/Dockerfile" \
 "cooperative-management:apps/cooperative-management/Dockerfile" \
 "national-admin:apps/national-admin/Dockerfile" \
 "api:services/api/Dockerfile"; do
 label="${item%%:*}"; file="${item#*:}"
 docker build --file "$file" --tag "tto-ci:$label" .
 docker image inspect "tto-ci:$label" --format '{{.Id}}' >/dev/null
 if [ "$label" = "api" ]; then
  timeout 15s docker run --rm "tto-ci:$label" > api-exit.log 2>&1 || true
  if ! grep -Eq 'TTO_API_STARTUP_FAILED|DATABASE_URL_NOT_CONFIGURED' api-exit.log; then
   echo 'API_FAIL_CLOSED_WITHOUT_DATABASE_NOT_PROVEN'
   sed -n '1,25p' api-exit.log
   exit 1
  fi
 else
  id="$(docker run -d --rm -p 127.0.0.1:30177:3000 "tto-ci:$label")"
  ready=0
  for n in $(seq 1 40); do
   if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:30177/ > /tmp/tto-preview.html; then ready=1; break; fi
   sleep 1
  done
  docker rm -f "$id" >/dev/null || true
  if [ "$ready" -ne 1 ]; then echo "OCI_RUNTIME_UNAVAILABLE_$label"; exit 1; fi
  grep -q 'dir="rtl"' /tmp/tto-preview.html
  grep -q 'داده' /tmp/tto-preview.html
 fi
 echo "TTO_RELEASE_OCI_$label_PASS"
done
