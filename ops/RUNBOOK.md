# Runbook — 24Therapy Mental Health OS

## On-call contacts

Update this section before go-live. For now, escalate any P0 to the repo owner.

---

## Deployment

### Standard deploy (backend)
Railway auto-deploys on push to `main`. To manually trigger:
```bash
railway up
```

### Rollback (backend)
In Railway dashboard → Deployments → select previous deployment → Redeploy.

For a data-safe rollback, do NOT reverse migrations automatically. Assess impact first.

### Standard deploy (frontend)
Vercel auto-deploys on push to `main`. Manual:
```bash
vercel --cwd apps/<app-name> --prod
```

---

## Crisis alert pipeline

**What it does**: During live sessions the backend scans transcribed text for
suicide/self-harm keywords (CrisisService.handleKeywordHit). On a match:
1. Risk assessment row written to `risk_assessments` table.
2. In-app notification sent to therapist + all admins.
3. `ai.risk_detected` WebSocket event → therapist radar + admin portal.
4. `crisis.support` WebSocket event → patient gets supportive copy only (no risk info).
5. AI refinement runs async; may escalate level if GPT-4o rates risk higher.
6. Cron sweeper re-delivers unacknowledged alerts every 2 minutes.

**If alerts stop appearing**:
- Check `risk_assessments` table for recent rows: `SELECT * FROM risk_assessments ORDER BY created_at DESC LIMIT 10;`
- Check NestJS logs for `[CRISIS]` lines.
- Verify WebSocket gateway is running: `GET /health`.
- Check `notifications` table for `priority = 'urgent'` rows.

---

## Database

### Check migration status
```bash
DATABASE_URL=... node scripts/migrate.js --status
```

### Connect (Railway)
```bash
railway connect postgres
```

### Check active connections
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();
```

### Slow query log
```sql
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;
```

---

## Common incidents

### P0 — API is down (5xx on /health)

1. Check Railway deployment logs.
2. Check `DATABASE_URL` is set and PostgreSQL is reachable.
3. Check `JWT_SECRET` / `COOKIE_SECRET` are not weak defaults (validateEnv throws on boot).
4. Restart the service via Railway dashboard.

### P0 — Crisis alerts not reaching therapist

1. Check `risk_assessments` — are rows being inserted?
   ```sql
   SELECT id, risk_level, alert_status, created_at FROM risk_assessments
   ORDER BY created_at DESC LIMIT 5;
   ```
2. Check `notifications` for `priority='urgent'` rows with `status='pending'`.
3. Check WebSocket connection in therapist portal (browser DevTools → Network → WS).
4. Tail backend logs for `[CRISIS]` errors.
5. If DB insert is failing: check `risk_assessments` table exists and has correct schema (migration 009).

### P1 — Login broken

1. Check `DATABASE_URL` connectivity.
2. Verify `JWT_SECRET` has not changed (changing it invalidates all existing tokens).
3. Check `users` table: `SELECT status, locked_until FROM users WHERE email = '...';`
4. Check for `failed_login_count >= 5` → unlock: `UPDATE users SET failed_login_count=0, locked_until=NULL WHERE email='...';`

### P1 — New user can't register

1. Check `POST /auth/register` logs for ConflictException or validation errors.
2. Check email uniqueness: `SELECT id FROM users WHERE email = '...';`
3. Check `organizations` table if org slug already taken.

### P2 — Email not sending

1. Check `RESEND_API_KEY` is set (mail provider is Resend, not SendGrid).
2. Check `FROM_EMAIL` domain is verified in Resend dashboard.
3. Auth emails are fire-and-forget — they won't block login. Check backend logs for `[auth] ... email failed`.

### P2 — Video session room not loading

1. Check `DAILY_API_KEY` is set.
2. Check `sessions` table: `SELECT video_room_url FROM sessions WHERE id = '...';`
3. If null, video room was not created — check session creation logs.

---

## Useful SQL

```sql
-- Active users (last 24h)
SELECT count(*) FROM users WHERE last_login_at > now() - interval '24 hours';

-- Pending crisis alerts
SELECT * FROM risk_assessments
WHERE alert_status IN ('pending','delivered')
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Unlock a locked user
UPDATE users SET failed_login_count=0, locked_until=NULL WHERE email='...';

-- Check org status
SELECT id, name, status, plan, trial_ends_at FROM organizations WHERE slug='...';

-- Suspend an org
UPDATE organizations SET status='suspended' WHERE id='...';
```

---

## Monitoring

- Railway metrics: CPU, memory, request rate.
- PostgreSQL: connection count, slow queries (see above).
- Crisis alerts: monitor `risk_assessments` table for `alert_status = 'pending'` rows older than 5 minutes (sweeper should pick them up within 2 minutes).

No Prometheus/Grafana is wired yet — this is a stretch goal.

---

## Secrets rotation

1. Generate new secret: `openssl rand -hex 32`
2. Update in Railway → Variables.
3. Redeploy backend.
4. **JWT_SECRET rotation invalidates all active sessions** — users will need to log in again. Coordinate with beta users.
5. **COOKIE_SECRET rotation** invalidates signed cookies — same impact.

<!-- Reviewed: 2026-06-13 — 24Therapy audit -->
