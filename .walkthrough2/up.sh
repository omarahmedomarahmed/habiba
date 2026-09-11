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
node --import tsx .walkthrough2/mock.ts > /tmp/w2-mock.log 2>&1 &
npx next start -p 3000 > /tmp/w2-server.log 2>&1 &
for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3000/ && break; sleep 1; done
curl -sf -o /dev/null http://localhost:3000/ && echo "up" || { tail -20 /tmp/w2-server.log; exit 1; }
