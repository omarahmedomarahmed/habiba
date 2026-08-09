#!/usr/bin/env bash
#
# End-to-end test runner.
#
# Builds the app, starts it with OpenAI pointed at a local mock, runs the
# browser test against it, then tears everything down.
#
#   DATABASE_URL='postgres://…' ./tests/run-e2e.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DATABASE_URL:?DATABASE_URL must be set}"

export NODE_ENV=production
export APP_URL=http://localhost:3100
export AUTH_SECRET="${AUTH_SECRET:-e2e-secret-that-is-definitely-long-enough-000000}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-e2e-mock}"
export E2E_MOCK_PORT="${E2E_MOCK_PORT:-8899}"
export OPENAI_BASE_URL="http://127.0.0.1:${E2E_MOCK_PORT}/v1"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_e2e}"
export CRON_SECRET="${CRON_SECRET:-e2e-cron}"
export E2E_BASE_URL="$APP_URL"

# Use a Chromium that is already on disk, if there is one, rather than making
# the test suite depend on a browser download.
if [[ -z "${E2E_CHROMIUM:-}" ]]; then
  CANDIDATE=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)
  [[ -n "$CANDIDATE" ]] && export E2E_CHROMIUM="$CANDIDATE"
fi

cleanup() {
  [[ -n "${APP_PID:-}" ]] && kill "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "→ building"
npx next build >/tmp/e2e-build.log 2>&1 || { tail -30 /tmp/e2e-build.log; exit 1; }

echo "→ starting app on :3100"
npx next start -p 3100 >/tmp/e2e-server.log 2>&1 &
APP_PID=$!

for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "$APP_URL/"; then break; fi
  sleep 1
done

echo "→ running browser tests"
node --import tsx --conditions=react-server --test-concurrency=1 --test tests/e2e.test.ts
