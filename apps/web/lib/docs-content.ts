/**
 * docs-content.ts — Static article content for /docs/[slug]
 * Priority articles per the handoff plan.
 */

export interface DocArticle {
  slug: string;
  title: string;
  category: string;
  readTime: string;
  status?: "live" | "beta" | "planned";
  body: string; // markdown-style plain text with ## headings
}

export const DOC_ARTICLES: Record<string, DocArticle> = {
  // ── Billing ──────────────────────────────────────────────────────────────
  "billing-model": {
    slug: "billing-model",
    title: "Billing & Subscription Guide",
    category: "Billing",
    readTime: "6 min",
    body: `
## How 24Therapy billing works

24Therapy uses a **pay-as-you-go** model by default, with optional monthly subscriptions for practices with steady volume.

### Pay As You Go (default for all new accounts)

Every therapist account starts on Pay As You Go.

- **First session: free.** Your very first completed session is $0 — no promo code needed. This happens automatically.
- **Every session after that: $6.** The $6 bill is created the moment you mark a session as completed.
- **Bills must be paid before scheduling the next session.** Until you settle the $6 charge, the "Schedule Session" button returns a payment prompt. This keeps billing simple and predictable.
- **How to pay:** A Stripe payment link is included in the bill email and in Settings → Usage → Unpaid Bills. Tap "Pay Now" to complete the charge with any major card.

If Stripe isn't configured yet on your account (early access), bills are still recorded and your admin can mark them paid manually.

### Starter — $59/month

Starter is the best choice if you see 10–20 patients per month.

- **20 sessions included per month** (≈$3/session — 50% cheaper than Pay As You Go).
- **Rollover bank:** Unused sessions roll to the next month, up to a maximum of 20 banked sessions. So if you used 15 of 20 in January, you start February with 20 included + 5 rolled over = 25 total.
- **Overage:** If you use all included + rolled-over sessions, additional sessions are billed at $6 each (same as Pay As You Go), and the pending-bill gate applies.
- **Annual:** $590/year (save 2 months).

### Unlimited — $99/month

For therapists with high volume or unpredictable caseloads.

- **No session cap.** Zero overage charges.
- **Full AI suite:** AI Copilot, emotional arc analysis, priority processing.
- **Annual:** $990/year.

### Practice — from $189/month for 2 therapists

For group practices.

- Base price covers 2 therapist seats ($94.50/therapist).
- Add seats at +$85/month each: 3 seats → $274/mo, 4 seats → $359/mo, 5 seats → $444/mo.
- For 6+ therapists, contact sales for custom pricing.
- All therapists in the practice share the unlimited session pool.
- **Annual:** $1,890/year base (10× monthly).

### Enterprise

Custom contracts for health systems, universities, and large group practices. Includes SSO, custom AI configuration, EHR integration, SLA, and dedicated account manager. [Contact us](/contact?type=enterprise).

---

## Switching plans

You can switch plans at any time from **Settings → Usage → Your Plan**. When you subscribe:

1. You're taken to a Stripe Checkout page.
2. After payment, your plan activates immediately.
3. Any outstanding Pay As You Go bills must still be settled.

When you cancel a subscription, your plan reverts to Pay As You Go at the end of the billing period.

---

## What happens if I don't pay a session bill?

The session is still recorded and fully accessible. You just can't schedule *new* sessions until the bill is paid. Historical data, notes, and patient records are never affected.

---

## Annual billing

Annual = 10× the monthly price (2 months free). You're billed the full annual amount upfront via Stripe. There are no refunds for unused months, but you can switch to monthly at renewal.

---

## HIPAA and billing data

Credit card information is stored exclusively by Stripe and never touches 24Therapy servers. We store only Stripe customer IDs and payment status — no raw card data.
    `.trim(),
  },

  // ── API ───────────────────────────────────────────────────────────────────
  "api-quickstart": {
    slug: "api-quickstart",
    title: "REST API Quickstart",
    category: "Developer",
    readTime: "10 min",
    status: "live",
    body: `
## Overview

The 24Therapy REST API is available at \`https://api.24therapy.ai/api/v1\` (your Railway deployment URL). All endpoints require a Bearer token except where marked Public.

Interactive API docs (Swagger UI) are available at \`/api/docs\` on your backend deployment.

---

## Authentication

### Get a token

\`\`\`bash
POST /auth/login
Content-Type: application/json

{
  "email": "therapist@example.com",
  "password": "your-password"
}
\`\`\`

Response:
\`\`\`json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "...",
  "user": { "id": "...", "role": "therapist" }
}
\`\`\`

### Use the token

\`\`\`bash
Authorization: Bearer <access_token>
\`\`\`

Tokens expire in 1 hour. Use \`POST /auth/refresh\` with your refresh token to get a new access token.

---

## Key endpoints

### Sessions

\`\`\`
GET  /sessions              — List sessions (filter: status, date, patient_id)
POST /sessions              — Create a session
GET  /sessions/:id          — Get session detail
PATCH /sessions/:id/status  — Update status (scheduled → in_progress → completed)
GET  /sessions/:id/transcript — Get transcript + segments
\`\`\`

### AI

\`\`\`
POST /ai/sessions/:id/notes/generate  — Generate SOAP/DAP/BIRP note
POST /ai/sessions/:id/summary         — Generate session summary
GET  /ai/sessions/:id/copilot         — Get copilot suggestions
POST /ai/sessions/:id/risk-check      — Run risk assessment
POST /ai/assistant/chat               — Chat with AI assistant about your sessions
\`\`\`

### Patients

\`\`\`
GET  /patients              — List patients
POST /patients              — Create patient
GET  /patients/:id          — Get patient detail
PATCH /patients/:id         — Update patient
GET  /patients/:id/memory   — Get patient memory (pgvector semantic search)
\`\`\`

### Billing

\`\`\`
GET  /billing/plans         — List active plans (public)
GET  /billing/usage/me      — Therapist usage summary (plan, quota, pending bills, credits)
POST /billing/subscribe     — Create Stripe checkout for subscription
POST /billing/charges/:id/checkout — Regenerate payment link for a pending bill
\`\`\`

---

## Example: create a session and generate a note

\`\`\`bash
# 1. Create a session
curl -X POST https://api.24therapy.ai/api/v1/sessions \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_id": "patient-uuid",
    "session_type": "standard",
    "modality": "video",
    "scheduled_at": "2026-06-15T14:00:00Z"
  }'

# 2. Mark it completed
curl -X PATCH https://api.24therapy.ai/api/v1/sessions/{id}/status \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"status": "completed"}'

# 3. Generate a SOAP note
curl -X POST https://api.24therapy.ai/api/v1/ai/sessions/{id}/notes/generate \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{"format": "soap"}'
\`\`\`

---

## Rate limits

| Route group | Limit |
|-------------|-------|
| Auth endpoints | 10 req/min per IP |
| AI generation | 60 req/min per org |
| All others | 300 req/min per org |

Rate limit headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`.

---

## Error format

All errors follow:

\`\`\`json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "scheduled_at must be a valid ISO date"
}
\`\`\`

Payment-required errors (session creation blocked):

\`\`\`json
{
  "success": false,
  "error": "payment_required",
  "message": "PAYMENT_REQUIRED:unpaid_session_bill",
  "charge_id": "uuid",
  "amount_due": 6.00,
  "checkout_url": "https://checkout.stripe.com/...",
  "upsell": "Save 50% — Starter $59/mo (20 sessions)"
}
\`\`\`
    `.trim(),
  },

  // ── HIPAA ─────────────────────────────────────────────────────────────────
  "hipaa-checklist": {
    slug: "hipaa-checklist",
    title: "HIPAA Setup Checklist",
    category: "Compliance",
    readTime: "5 min",
    body: `
## Before you see patients

Complete all items in this checklist before storing real patient data.

### Technical safeguards ✅

- [ ] **TLS in transit.** All traffic is HTTPS. Verify your Railway backend has a valid SSL certificate.
- [ ] **Encryption at rest.** PostgreSQL volume encryption must be enabled in Railway settings.
- [ ] **JWT secret.** Ensure \`JWT_SECRET\` is at least 32 characters in Railway environment variables.
- [ ] **CORS origins.** Set \`CORS_ORIGINS\` to your exact Vercel domain(s) — no wildcards.
- [ ] **Audit logging.** The \`PhiAuditInterceptor\` logs all PHI route access to \`phi_access_log\`. Confirm this table is being written to after your first login.

### Administrative safeguards

- [ ] **BAA executed.** A Business Associate Agreement must be signed before any real PHI is processed. [Request a BAA →](/contact?type=baa)
- [ ] **Workforce training.** All users must complete HIPAA workforce training before access.
- [ ] **Access controls.** Only assign the minimum necessary role (therapist, org_admin, patient). Super_admin accounts should be limited to 1–2 people.
- [ ] **Password policy.** Enforce strong passwords. Consider enabling MFA once available.

### Physical safeguards

- [ ] Confirm your Railway region is within the US (for US-based practices).
- [ ] Ensure clinic devices have screen lock enabled.

### Patient consent

- [ ] Informed consent for telehealth must be documented for each patient.
- [ ] Recording consent (audio/video) must be obtained before enabling session recording.
- [ ] AI assistance disclosure: patients must be informed that AI assists with documentation.

---

## PHI in 24Therapy

The following data is considered PHI and is subject to HIPAA safeguards:

- Patient names, dates of birth, contact info
- Session transcripts and audio recordings
- Clinical notes (SOAP, DAP, BIRP)
- Assessments and treatment plans
- AI-generated summaries and risk flags

The following is **not** PHI and is safe to use in logs:

- Session IDs (UUIDs)
- Aggregate statistics (session counts, plan type)
- Non-identifying timestamps

---

## Incident response

If you suspect a breach:

1. Immediately contact support at security@24therapy.ai
2. Preserve the \`phi_access_log\` table — do not delete entries
3. Review audit logs for unauthorized access patterns
4. Notify affected patients within 60 days per HIPAA Breach Notification Rule

See the [RUNBOOK](/docs/runbook) for technical incident steps.
    `.trim(),
  },

  // ── AI Scribe ─────────────────────────────────────────────────────────────
  "ai-scribe": {
    slug: "ai-scribe",
    title: "AI Scribe Setup",
    category: "AI Features",
    readTime: "8 min",
    body: `
## What is AI Scribe?

AI Scribe automatically generates structured clinical notes from your session transcripts. It supports SOAP, DAP, and BIRP formats and produces draft notes for your review — you always approve before anything is finalized.

---

## How it works

1. **Transcription:** During a session, audio is captured via the browser's MediaRecorder API, chunked every 5 seconds, and sent to OpenAI Whisper for transcription.
2. **Segmentation:** Each transcript segment is stored with speaker attribution (therapist vs. patient), timestamp, and sequence number.
3. **Note generation:** After the session, tap "Generate Note" to send the full transcript to GPT-4o with a structured clinical prompt.
4. **Review:** The draft note appears in your Notes workspace. Edit freely before approving. Only approved notes are visible to your organization.

---

## Supported formats

| Format | Sections | Best for |
|--------|----------|---------|
| SOAP | Subjective, Objective, Assessment, Plan | Outpatient therapy |
| DAP | Data, Assessment, Plan | Behavioral health |
| BIRP | Behavior, Intervention, Response, Plan | Case management |

---

## Setup steps

1. **Enable scribe on a session:** When creating a session, ensure "AI Scribe" is toggled on (it's on by default).
2. **Start session:** Click "Start Session" in the session room. Transcription begins automatically when you join.
3. **Grant mic permission:** Your browser will prompt for microphone access. This is required for transcription.
4. **End session:** Click "End Session." The transcript is finalized.
5. **Generate note:** In the session detail or Notes workspace, click "Generate Note" and choose your preferred format.
6. **Review and approve:** Edit the draft, then click "Approve Note." Approved notes are locked for audit purposes.

---

## Accuracy tips

- Speak clearly and avoid heavy background noise.
- The AI works best when both speakers are audible.
- If transcription is off (e.g., strong accent), you can manually paste a transcript into the session before generating notes.
- Review every note — the AI drafts, you decide.

---

## Privacy

Session transcripts are stored encrypted at rest and are never used to train AI models. Transcripts are scoped to your organization and are never shared across accounts. See the [HIPAA Checklist](/docs/hipaa-checklist) for full data handling details.
    `.trim(),
  },

  // ── Risk Detection ─────────────────────────────────────────────────────────
  "risk-detection": {
    slug: "risk-detection",
    title: "Crisis Detection & Risk Alerts",
    category: "AI Features",
    readTime: "8 min",
    body: `
## Overview

24Therapy's crisis detection pipeline scans live session transcripts for safety-critical language and generates real-time risk alerts for the therapist — without ever exposing sensitive clinical information to the patient.

**Safety invariant:** Crisis features are NEVER gated by plan or billing status. They work identically on Pay As You Go and Enterprise.

---

## How it works

### Step 1: Keyword scan (synchronous)

Every transcript segment is immediately scanned against a keyword list covering suicidal ideation, self-harm, abuse, and expressions of hopelessness. This runs in-process with zero network latency.

### Step 2: GPT-4o risk assessment (async)

When keywords are detected, the segment is sent to GPT-4o with a structured risk prompt. The model returns a risk level (low / medium / high) and the specific indicators it identified.

### Step 3: Alert routing

- **Therapist:** Receives a \`crisis_alert\` WebSocket event with full details (risk level, indicators, suggested response).
- **Clinical staff (org_admin):** Also receive the \`crisis_alert\` via the \`staff:{orgId}\` WebSocket room.
- **Patient:** Receives only a \`crisis_support\` event with supportive, non-clinical text. Patients never see risk level, indicators, or alert content. This is a hard security invariant.

### Step 4: Portal alert

A red crisis modal appears in the therapist's session room with:

- Risk level
- Specific indicators from the transcript
- Suggested in-session response language
- One-click escalation to emergency services

---

## Alert thresholds

You can adjust alert sensitivity in Settings → Risk Monitor:

- **Conservative (default):** Alert on high-confidence indicators only
- **Moderate:** Alert on medium+ risk
- **Sensitive:** Alert on any keyword match (may generate more false positives)

---

## What to do when an alert fires

1. Acknowledge the alert in the portal.
2. Use the suggested response language to address the patient directly.
3. If the patient is in immediate danger, contact emergency services.
4. Document the crisis intervention in the session note.
5. Follow your practice's crisis protocol.

---

## Radar integration

After a session with a crisis alert, you can use [Radar](/radar) to immediately match the patient with a therapist who has crisis specialization or immediate availability.
    `.trim(),
  },

  // ── Quickstart ────────────────────────────────────────────────────────────
  "quickstart": {
    slug: "quickstart",
    title: "Quickstart Guide",
    category: "Getting Started",
    readTime: "20 min",
    body: `
## Welcome to 24Therapy

This guide gets you from zero to your first AI-assisted therapy session in under 20 minutes.

---

## Step 1: Create your account

Go to [24therapy.ai/signup](/signup) and choose "I'm a therapist."

You'll need:
- Your name and email
- A password (at least 12 characters)
- Your license number and state (for credential verification)

Your account starts on **Pay As You Go** — first session is free, then $6 per session. No credit card required to start.

---

## Step 2: Complete onboarding

After signup, you'll be guided through the onboarding wizard:

1. **Profile:** Photo, bio, credentials
2. **Practice:** Specializations, modalities, languages
3. **AI Preferences:** Default note format (SOAP/DAP/BIRP), review workflow
4. **Availability:** Set your weekly availability for the calendar
5. **Billing:** Review your plan (you can skip this and stay on Pay As You Go)

---

## Step 3: Add your first patient

Go to **Patients → New Patient** and enter basic demographics and presenting concerns. You don't need full intake data to start — you can fill in details over time.

---

## Step 4: Schedule a session

Go to **Sessions → Schedule Session**. Pick your patient, date, time, and modality (video or in-person). Click Schedule.

---

## Step 5: Run your first session

Click **Start Session** on the session card. The session room opens with:

- Video (powered by Daily.co if configured, otherwise without video)
- Live transcription (starts when you click Start Recording)
- AI Copilot panel (suggestions appear as the session progresses)

When you're done, click **End Session**.

---

## Step 6: Generate your first AI note

After the session, go to the session detail. Click **Generate Note** and choose SOAP, DAP, or BIRP. The AI drafts the note from the transcript in about 15–30 seconds.

Review the draft, make any edits, and click **Approve**. The note is finalized and logged in the audit trail.

---

## What's next

- **Enable Radar:** Let 24Therapy match patients to you based on specialization and availability
- **Explore Memory Layer:** See how the AI builds longitudinal patient context over sessions
- **Set up billing:** If you're seeing 10+ patients/month, Starter ($59/mo) cuts your per-session cost in half
    `.trim(),
  },
};

export function getDocArticle(slug: string): DocArticle | undefined {
  return DOC_ARTICLES[slug];
}

export function getAllDocSlugs(): string[] {
  return Object.keys(DOC_ARTICLES);
}
