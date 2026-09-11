#!/bin/bash
cd /home/user/habiba
set -a; . ./.env.local; set +a
export NODE_ENV=production
export APP_URL=http://localhost:3000
export AUTH_SECRET="${AUTH_SECRET:-walkthrough-2-secret-long-enough-0000000000}"
export OPENAI_API_KEY=sk-walkthrough-mock
export E2E_MOCK_PORT=8899
export OPENAI_BASE_URL="http://127.0.0.1:8899/v1"
export STRIPE_WEBHOOK_SECRET=whsec_walkthrough
export CRON_SECRET=walkthrough-cron
# 🔴 C199 — kill whatever is on the port first.
#
# `next start` does not fail loudly when the port is taken: the new process
# exits, the old build keeps answering, and every measurement after that is
# about code that is no longer on disk. That cost an hour in 37L; the e2e
# runner has warned about it since sprint 20 and this script did not.
pkill -f "next-server" 2>/dev/null || true
pkill -f "walkthrough2/mock.ts" 2>/dev/null || true
sleep 1

node --import tsx .walkthrough2/mock.ts > /tmp/w2-mock.log 2>&1 &
npx next start -p 3000 > /tmp/w2-server.log 2>&1 &
for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3000/ && break; sleep 1; done
curl -sf -o /dev/null http://localhost:3000/ && echo "up" || { tail -20 /tmp/w2-server.log; exit 1; }
