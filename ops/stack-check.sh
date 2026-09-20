#!/usr/bin/env bash
# Checks a running Compose stack through the web service, as a browser would (M0 part 8 spec,
# P8.3). Run after `docker compose up -d --wait`; CI runs exactly this.
set -euo pipefail

BASE="${CODE_STACK_URL:-http://127.0.0.1:8090}"
HEALTH_WAIT_S="${CODE_STACK_HEALTH_WAIT_S:-60}"

fail() {
  echo "FAIL: $*" >&2
  docker compose ps >&2 || true
  docker compose logs --no-color --tail 80 >&2 || true
  exit 1
}

# The worker check reads down until the first heartbeat (part 4), so wait for 200.
status=""
for _ in $(seq 1 "$HEALTH_WAIT_S"); do
  status=$(curl -s -o /tmp/code-stack-health.json -w '%{http_code}' "$BASE/api/health" || true)
  [ "$status" = "200" ] && break
  sleep 1
done
[ "$status" = "200" ] || fail "/api/health answered ${status:-nothing} after ${HEALTH_WAIT_S}s: $(cat /tmp/code-stack-health.json 2>/dev/null)"
echo "ok   /api/health 200: $(cat /tmp/code-stack-health.json)"

for path in / /health /identity; do
  curl -sf "$BASE$path" | grep -q '<div id="root">' || fail "$path is not the app's index.html"
  echo "ok   $path serves the app"
done

docs=$(curl -sf "$BASE/api/docs") || fail "/api/docs did not answer 200"
asset=$(printf '%s' "$docs" | grep -o '/static/[^"]*' | head -n 1)
[ -n "$asset" ] || fail "/api/docs names no /static/ file"
curl -sf -o /dev/null "$BASE$asset" || fail "$asset did not load"
echo "ok   /api/docs 200 and $asset loads"
