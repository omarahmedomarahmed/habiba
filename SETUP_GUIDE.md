# 24Therapy — Complete Setup Guide
### No Terminal. No Code. Browser Only.
> Written for a non-technical founder. Every single click is described.
> Last updated: 2026-06-13

---

## Before You Start — What You're Building

You are deploying 5 separate services. They must be set up in this exact order:

```
1. Database (Neon)        → stores all your data
2. Backend API (Railway)  → the brain, connects to the database
3. Website (Vercel ×4)    → the 4 portals your users see
4. Domain (your registrar)→ connects your domain names
5. Payments (Stripe)      → activates billing
6. First admin account    → your god-mode login
```

**If you skip steps or do them out of order, things will break.** Follow this guide top to bottom.

---

## Accounts to Create First

Open each of these links and sign up before doing anything else. Use the same email address for all of them — it keeps things simple.

| # | Service | Sign-up link | Free? |
|---|---------|-------------|-------|
| 1 | **GitHub** | https://github.com/signup | ✅ Free |
| 2 | **Neon** (database) | https://neon.tech | ✅ Free tier |
| 3 | **Railway** (backend) | https://railway.app | ✅ $5 trial credit |
| 4 | **Vercel** (websites) | https://vercel.com/signup | ✅ Free |
| 5 | **OpenAI** (AI features) | https://platform.openai.com/signup | Pay-per-use |
| 6 | **Stripe** (payments) | https://dashboard.stripe.com/register | ✅ Free |
| 7 | **Resend** (email) | https://resend.com/signup | ✅ Free tier |
| 8 | **Daily.co** (video calls) | https://www.daily.co/signup | ✅ Free tier |

> ⚠️ **Don't skip Daily.co.** It's required for video therapy sessions.

---

## Step 1 — Fork the Code on GitHub

"Forking" means making your own personal copy of the code.

1. Make sure you're logged into GitHub
2. Go to: **https://github.com/omarahmedomarahmed/habiba**
3. Look at the top-right corner — click the **Fork** button
4. A popup appears. Leave everything as-is and click **Create fork**
5. After a few seconds, you'll be taken to: `https://github.com/YOUR-USERNAME/habiba`

That URL with YOUR username is your copy. You'll use it in every step below.

> ✅ **Done when:** You can see your name in the URL, e.g. `github.com/johndoe/habiba`

---

## Step 2 — Set Up Your Database (Neon)

Your database stores everything: patients, sessions, notes, billing, therapists. Without it, nothing works.

### 2a. Create the project

1. Go to **https://neon.tech** and sign in
2. Click the green **New Project** button
3. Fill in:
   - **Project name:** `24therapy-production`
   - **Postgres version:** leave as default (latest)
   - **Region:** pick the one closest to your users
     - US users → `US East (Virginia)` or `US West (Oregon)`
     - Europe → `Europe (Frankfurt)`
     - Middle East → `US East` (closest available)
4. Click **Create Project**
5. A popup appears showing your connection details — **don't close it yet**

### 2b. Save your connection string

On the screen after creating the project, find the box that says **Connection string**. It looks like:
```
postgresql://neondb_owner:AbcXyz123@ep-abc-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Copy this entire string and save it in a notes document.** You'll paste it into Railway in Step 3. It's your database password — keep it private.

> If you closed the popup: click **Dashboard** → your project → **Connection Details** → select **Connection string** from the dropdown.

### 2c. Enable required database features

1. In your Neon project, look at the left sidebar
2. Click **SQL Editor**
3. In the blank editor area, paste this exactly:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```
4. Click the **Run** button (or press Ctrl+Enter / Cmd+Enter)
5. You should see two green "Success" messages

> ⚠️ If you see "extension already exists" — that's fine, keep going.

### 2d. Run the database migrations

Migrations are SQL scripts that create all the tables your app needs. You must run all 16 of them, in order.

**How to do each one:**
1. Go to your GitHub fork: `https://github.com/YOUR-USERNAME/habiba`
2. Click the **migrations** folder
3. Click the file name (e.g., `001_core_schema.sql`)
4. Click the **Raw** button (top-right of the file view)
5. Press **Ctrl+A** (or Cmd+A on Mac) to select all, then **Ctrl+C** to copy
6. Go back to **Neon → SQL Editor**
7. Clear the editor and paste (Ctrl+V / Cmd+V)
8. Click **Run**
9. Wait for "Success" — then do the next file

Run them in this exact order:

| Order | File | Notes |
|-------|------|-------|
| 1 | `001_core_schema.sql` | Core tables — users, organizations |
| 2 | `002_therapists_schema.sql` | Therapist profiles |
| 3 | `003_patients_schema.sql` | Patient records |
| 4 | `004_clinical_schema.sql` | Clinical data |
| 5 | `005_medications_schema.sql` | Medication tracking |
| 6 | `006_sessions_schema.sql` | Therapy sessions |
| 7 | `007_ai_schema.sql` | AI memory + risk data |
| 8 | `008_assessments_schema.sql` | PHQ-9, GAD-7 etc. |
| 9 | `009_radar_schema.sql` | Instant matching |
| 10 | `010_billing_schema.sql` | Subscriptions + invoices |
| 11 | `011_notifications_schema.sql` | Alerts + push notifications |
| 12 | `012_audit_compliance_schema.sql` | HIPAA audit trail |
| 13 | `013_marketplace_schema.sql` | Therapist directory |
| 14 | `014_analytics_schema.sql` | Platform analytics |
| 15 | `015_pricing_management.sql` | Pricing plans |
| 16 | `016_schema_fixes.sql` | **Required fixes — don't skip this one** |
| 17 | `017_freemium_pricing.sql` | Freemium plan enhancements |
| 18 | `018_messaging_crisis.sql` | Messaging + crisis tables |
| 19 | `019_pricing_display_metadata.sql` | Pricing display metadata |
| 20 | `020_monetization.sql` | Billing engine, session charges, AI credits |
| 21 | `021_workflows_referrals.sql` | Clinical workflows, tasks, referrals |

> ⚠️ **"relation already exists" errors are normal.** Just continue to the next file.
> ⚠️ **Do NOT skip 016_schema_fixes.sql.** It fixes critical bugs.

> ✅ **Done when:** All 21 files have been run without red errors.

---

## Step 3 — Deploy the Backend API (Railway)

The backend is the engine that powers all 4 websites. It must be live before any website will work.

### 3a. Create the Railway project

1. Go to **https://railway.app** and sign in
2. Click **New Project** (big button in the middle or top-right)
3. Click **Deploy from GitHub repo**
4. Click **Configure GitHub App** if prompted — authorize Railway to access your repositories
5. Find `habiba` in the list and click it
6. Railway will create the project and show you a loading screen

> ⚠️ Don't click away. Wait for it to finish creating.

### 3b. Set the root directory

Railway needs to know the backend code is in the `backend` folder, not the root.

1. Click on your service (it's named `habiba` by default)
2. Click the **Settings** tab (gear icon)
3. Scroll down to **Build** or **Source**
4. Find **Root Directory** and type: `backend`
5. Press Enter / save

### 3c. Add environment variables (your secret keys)

This is where you tell the backend all its passwords and API keys.

1. Click the **Variables** tab
2. Click **Raw Editor** (it's easier to paste everything at once than add them one by one)
3. Paste the block below into the editor, **replacing every value in `< >` with your real information:**

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<paste your Neon connection string here>
DATABASE_SSL=true
JWT_SECRET=<go to https://generate-secret.vercel.app/64 — copy the long random string shown>
JWT_REFRESH_SECRET=<go to https://generate-secret.vercel.app/64 again — use a DIFFERENT string>
OPENAI_API_KEY=<your OpenAI key — see instructions below>
STRIPE_SECRET_KEY=<your Stripe secret key — see instructions below>
STRIPE_PUBLISHABLE_KEY=<your Stripe publishable key — see instructions below>
STRIPE_WEBHOOK_SECRET=whsec_placeholder
RESEND_API_KEY=<your Resend API key — see instructions below>
FROM_EMAIL=24Therapy <noreply@yourdomain.com>
DAILY_API_KEY=<your Daily.co API key — see instructions below>
APP_URL=https://24therapy.ai
THERAPIST_APP_URL=https://app.24therapy.ai
PATIENT_APP_URL=https://my.24therapy.ai
ADMIN_APP_URL=https://admin.24therapy.ai
```

4. Click **Update Variables**

> ⚠️ The `STRIPE_WEBHOOK_SECRET` placeholder is temporary. You'll replace it in Step 6.
> ⚠️ The URLs use your domain. If you're testing without a domain, use the Vercel URLs (you'll update them after Step 4).

---

### Where to get each API key

#### OpenAI API Key
1. Go to **https://platform.openai.com/api-keys**
2. Click **Create new secret key**
3. Name it `24therapy-production`
4. Click **Create secret key**
5. **Copy the key immediately** — it starts with `sk-proj-...` and you can't see it again
6. Paste it as your `OPENAI_API_KEY` value

> ⚠️ You also need to add a credit card at https://platform.openai.com/settings/billing — OpenAI requires payment info before the API works. Deposit $20 to start.

#### Stripe Secret Key and Publishable Key
1. Go to **https://dashboard.stripe.com/apikeys**
2. You'll see two keys:
   - **Publishable key** — starts with `pk_live_...` → this is your `STRIPE_PUBLISHABLE_KEY`
   - **Secret key** — click **Reveal live key** → starts with `sk_live_...` → this is your `STRIPE_SECRET_KEY`
3. Copy both and add them to Railway

> ⚠️ If you want to test payments before going live, use `pk_test_...` and `sk_test_...` instead. Switch to live keys when you're ready for real money.

#### Resend API Key (for emails)
1. Go to **https://resend.com/api-keys**
2. Click **Create API Key**
3. Name: `24therapy-production`, Permission: **Full access**
4. Click **Add** → copy the key (starts with `re_...`)
5. Paste as `RESEND_API_KEY`

> Also in Resend: go to **Domains** → **Add Domain** → add your domain → verify it (Resend will show you DNS records to add to your registrar).

#### Daily.co API Key (for video sessions)
1. Go to **https://www.daily.co** and sign in
2. Click the **Developers** tab in the left sidebar
3. Click **API keys**
4. You'll see a key already there — click the copy button next to it
5. Paste as `DAILY_API_KEY`

### 3d. Set the start command

1. Click **Settings** tab on your Railway service
2. Find **Start Command** and set it to:
   ```
   node dist/main.js
   ```

### 3e. Deploy and verify

1. Click the **Deploy** button (or Railway may deploy automatically when you save variables)
2. Click **Deployments** tab
3. Watch the logs — deployment takes 3–5 minutes
4. Look for a green checkmark next to the latest deployment
5. Click **Settings** → **Networking** → find the **Public URL**
   - It looks like: `https://habiba-production-xxxx.up.railway.app`
6. Open a new browser tab and go to:
   `https://habiba-production-xxxx.up.railway.app/health`
7. You should see:
   ```json
   {"status":"ok","service":"24therapy-api","timestamp":"..."}
   ```

**Save this Railway URL.** You'll need it for every Vercel deployment.

> ✅ **Done when:** The `/health` URL shows `"status":"ok"`

---

## Step 4 — Deploy the 4 Websites (Vercel)

You'll create 4 separate Vercel projects from the same GitHub repository. Each one is a different website.

### The environment variables (same for all 4)

Before you start, prepare this block. You'll paste it into each project. Replace `YOUR-RAILWAY-URL` with the URL from Step 3:

```
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.up.railway.app/api/v1
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

> ⚠️ If you don't have a domain yet, use the Vercel URLs instead (you'll find them after the first deployment). Something like `NEXT_PUBLIC_WEB_URL=https://habiba-web-xxx.vercel.app`.

---

### 4a. Deploy the Marketing Website

1. Go to **https://vercel.com** → click **Add New** → **Project**
2. If prompted, click **Import Git Repository** and connect your GitHub account
3. Find `habiba` in the list → click **Import**
4. A configuration screen appears:
   - **Project Name:** `24therapy-web` (or any name you like)
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** Click **Edit** → type `apps/web` → click **Continue**
5. Click **Environment Variables** to expand it
6. Click **Add** for each variable, or look for a bulk paste option:
   - Click the first variable field → paste `NEXT_PUBLIC_API_URL` → Tab → paste the value
   - Repeat for each variable in the block above
7. Click **Deploy**
8. Wait 3–5 minutes for the green checkmark
9. Click **Visit** to see your marketing website live

**Copy the URL Vercel gives you** (e.g., `https://24therapy-web.vercel.app`). If you don't have a custom domain yet, update your environment variables to use this URL.

---

### 4b. Deploy the Therapist Portal

1. **Add New** → **Project** → Import `habiba` (the same fork again)
2. Configuration:
   - **Project Name:** `24therapy-therapist`
   - **Root Directory:** `apps/therapist`
3. Add the same 6 environment variables
4. Click **Deploy**

---

### 4c. Deploy the Patient Portal

1. **Add New** → **Project** → Import `habiba`
2. Configuration:
   - **Project Name:** `24therapy-patient`
   - **Root Directory:** `apps/patient`
3. Add the same 6 environment variables
4. Click **Deploy**

---

### 4d. Deploy the Admin Portal

1. **Add New** → **Project** → Import `habiba`
2. Configuration:
   - **Project Name:** `24therapy-admin`
   - **Root Directory:** `apps/admin`
3. Add the same 6 environment variables
4. Click **Deploy**

---

### 4e. Update Railway's CORS settings

Now that all 4 websites are deployed, tell the backend which URLs are allowed to talk to it.

1. Go to Railway → your project → **Variables** tab
2. Find the **Raw Editor**
3. Add this new variable (replace with your actual Vercel URLs if you don't have a domain yet):

```
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
```

If you're using Vercel URLs (no custom domain yet):
```
CORS_ORIGINS=https://24therapy-web.vercel.app,https://24therapy-therapist.vercel.app,https://24therapy-patient.vercel.app,https://24therapy-admin.vercel.app
```

4. Click **Update Variables** — Railway will restart automatically

> ✅ **Done when:** All 4 Vercel deployments show green and you can open each URL in a browser.

---

## Step 5 — Connect Your Domain Names

Skip this step if you don't have a domain yet — come back when you do.

Your domain registrar is where you bought your domain (GoDaddy, Namecheap, Cloudflare, Google Domains, etc.). You'll add DNS records there to point your domain at Vercel and Railway.

### 5a. Add domains in Vercel

Do this for each of the 4 Vercel projects:

**Web project (24therapy.ai):**
1. Open the `24therapy-web` project in Vercel
2. Click **Settings** → **Domains**
3. Type `24therapy.ai` → click **Add**
4. Vercel shows you DNS records. Write them down.
5. Also add `www.24therapy.ai` → **Add**

**Therapist project (app.24therapy.ai):**
1. Open the `24therapy-therapist` project
2. Settings → Domains → type `app.24therapy.ai` → Add

**Patient project (my.24therapy.ai):**
1. Open `24therapy-patient`
2. Settings → Domains → type `my.24therapy.ai` → Add

**Admin project (admin.24therapy.ai):**
1. Open `24therapy-admin`
2. Settings → Domains → type `admin.24therapy.ai` → Add

### 5b. Add domains in Railway

1. Railway → your project → click your service
2. Click **Settings** → scroll to **Networking**
3. Click **Generate Domain** if you don't have one, or click **Custom Domain**
4. Type `api.24therapy.ai` → click **Add**
5. Railway shows you a CNAME record — write it down

### 5c. Add DNS records at your domain registrar

Log in to wherever you bought your domain. Go to the DNS settings (called "DNS Manager", "Zone Editor", "DNS Records", or similar).

Add these records:

| Type | Name/Host | Value/Points To |
|------|-----------|----------------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |
| `CNAME` | `app` | `cname.vercel-dns.com` |
| `CNAME` | `my` | `cname.vercel-dns.com` |
| `CNAME` | `admin` | `cname.vercel-dns.com` |
| `CNAME` | `api` | *(the CNAME Railway showed you — ends in `.railway.app`)* |

> ⚠️ DNS changes take between 5 minutes and 48 hours. This is normal — it's not a bug.

> ⚠️ After your domain is live, go back to Railway Variables and update `APP_URL`, `THERAPIST_APP_URL`, `PATIENT_APP_URL`, `ADMIN_APP_URL` to use your real domain. Also update the `CORS_ORIGINS` variable and the `NEXT_PUBLIC_API_URL` in all 4 Vercel projects.

### 5d. Update Vercel environment variables with your real domain

Once DNS is working:

1. Open each Vercel project → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL` to: `https://api.24therapy.ai/api/v1`
3. Click **Save** — Vercel will trigger a redeploy

---

## Step 6 — Set Up Stripe Webhooks (for Payments)

Webhooks let Stripe notify your backend instantly when someone pays, cancels, or changes their plan.

1. Go to **https://dashboard.stripe.com/webhooks**
2. Click **Add endpoint**
3. In the **Endpoint URL** field, type:
   ```
   https://api.24therapy.ai/api/v1/billing/webhooks/stripe
   ```
   (Or use your Railway URL if you don't have a custom domain yet)
4. Under **Events to send**, click **Select events**
5. Check these events:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
6. Click **Add events** → click **Add endpoint**
7. On the endpoint page, click **Reveal** under **Signing secret**
8. Copy the secret — it starts with `whsec_...`
9. Go to **Railway → Variables**
10. Find `STRIPE_WEBHOOK_SECRET` and replace `whsec_placeholder` with your actual secret
11. Click **Update Variables**

> ✅ **Done when:** Railway redeploys and you can see the webhook endpoint in Stripe shows "Enabled"

---

## Step 7 — Create Your First Admin Account

This is your god-mode account. You'll use it to manage everything from the admin portal.

### Method: Use the API directly from your browser

1. Open a new browser tab
2. Go to your API URL with `/api/v1/auth/register` added:
   ```
   https://api.24therapy.ai/api/v1/auth/register
   ```
   Or if using Railway URL:
   ```
   https://YOUR-RAILWAY-URL.up.railway.app/api/v1/auth/register
   ```

3. This will show an error page (that's normal — it needs a POST request, not a browser visit)

**Instead, use the Swagger UI (much easier):**

1. Go to:
   ```
   https://YOUR-RAILWAY-URL.up.railway.app/api/docs
   ```
2. You'll see the full API documentation with interactive forms
3. Click on **auth**
4. Click on **POST /auth/register**
5. Click the **Try it out** button
6. In the **Request body** box, replace the example with:

```json
{
  "email": "admin@yourdomain.com",
  "password": "YourSecurePassword123!",
  "first_name": "Your",
  "last_name": "Name",
  "role": "super_admin"
}
```

Replace `admin@yourdomain.com` and `YourSecurePassword123!` with your actual email and a strong password.

7. Click **Execute**
8. Scroll down to see the **Response** — you should see `"success": true`

> ⚠️ **Swagger docs are disabled in production** (NODE_ENV=production). To create the admin account, temporarily change `NODE_ENV=development` in Railway, create the account, then change it back to `production`.

### Alternative: Create admin via Neon SQL Editor

If the Swagger method doesn't work, you can insert the admin account directly into the database:

1. Go to **Neon → SQL Editor**
2. First, generate a password hash. Go to: **https://bcrypt-generator.com**
   - Type your password
   - Set rounds to **12**
   - Click **Generate** — copy the result (starts with `$2a$12$...`)

3. In Neon SQL Editor, paste this (replace the values):

```sql
-- Step 1: Create the organization for your admin
INSERT INTO organizations (
  id, name, slug, plan_type, status
) VALUES (
  uuid_generate_v4(),
  '24Therapy Platform',
  '24therapy-platform',
  'enterprise',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Create the admin user
INSERT INTO users (
  id,
  organization_id,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  status,
  email_verified
)
SELECT
  uuid_generate_v4(),
  o.id,
  'admin@yourdomain.com',
  '$2a$12$PASTE_YOUR_BCRYPT_HASH_HERE',
  'Your',
  'Name',
  'super_admin',
  'active',
  true
FROM organizations o
WHERE o.slug = '24therapy-platform';
```

4. Replace:
   - `admin@yourdomain.com` → your email
   - `$2a$12$PASTE_YOUR_BCRYPT_HASH_HERE` → the bcrypt hash from bcrypt-generator.com
   - `'Your'` and `'Name'` → your first and last name

5. Click **Run**
6. You should see "INSERT 1" — your admin account is created

### How to log in as admin

1. Go to your admin portal: `https://admin.24therapy.ai/login`
2. Enter the email and password you just created
3. You're in! The admin portal gives you full control over:
   - All organizations and users
   - Therapist approvals
   - Billing and subscriptions
   - AI governance settings
   - Audit logs and compliance
   - Feature flags

> ⚠️ **Keep your admin password very secure.** Anyone with this login can see all patient data across the entire platform.

---

## Step 8 — Set Up Pricing Plans in Stripe

Before therapists can subscribe, you need to create the pricing plans in Stripe.

### Create products in Stripe

1. Go to **https://dashboard.stripe.com/products**
2. Click **Add product**

**Create "Therapist Starter" plan:**
- Name: `Therapist Starter`
- Description: `AI scribe, session notes, copilot — up to 50 patients`
- Pricing: Click **Add price** → Recurring → $99/month
- Click **Save product**
- Copy the **Price ID** (starts with `price_...`) — you'll need it

**Create "Therapist Pro" plan:**
- Name: `Therapist Pro`
- Pricing: $149/month recurring
- Save and copy Price ID

**Create "Enterprise" plan:**
- Name: `Enterprise`
- Pricing: Click **Add price** → Choose **Custom pricing**
- Save

### Add price IDs to your database

1. Go to **Neon → SQL Editor**
2. Check what plans exist:
```sql
SELECT id, name, plan_key, monthly_price_usd FROM subscription_plans;
```
3. Update with your Stripe price IDs:
```sql
UPDATE subscription_plans
SET stripe_price_id = 'price_YOUR_STARTER_PRICE_ID'
WHERE plan_key = 'therapist_starter';

UPDATE subscription_plans
SET stripe_price_id = 'price_YOUR_PRO_PRICE_ID'
WHERE plan_key = 'therapist_pro';
```

---

## Step 9 — Verify Everything is Working

Go through each check in order:

### Check 1: Backend is alive
Open in browser: `https://api.24therapy.ai/health`
Expected result: `{"status":"ok",...}`

### Check 2: Marketing website loads
Open: `https://24therapy.ai`
Expected: The homepage with pricing, features, "Book a Demo" button

### Check 3: Admin portal login
Open: `https://admin.24therapy.ai/login`
Expected: Login form appears
Action: Log in with your admin credentials from Step 7

### Check 4: Admin dashboard works
After logging in, you should see:
- Dashboard with stats (may show zeros on a fresh install — that's normal)
- Left sidebar with Organizations, Users, Therapists, etc.

### Check 5: Registration works
Open: `https://24therapy.ai/signup`
Try creating a test therapist account:
- Fill in name, email, password
- Select "Therapist"
- Submit
- Check if it redirects to the therapist portal login

### Check 6: Therapist portal login
Open: `https://app.24therapy.ai/login`
Log in with the test account you just created

### Check 7: Patient portal login
Open: `https://my.24therapy.ai/signup`
Create a test patient account

### Check 8: Email is working
After signing up, check if you receive a welcome email. If not, check:
- Resend dashboard → **Logs** → look for errors
- Make sure your `FROM_EMAIL` domain is verified in Resend

---

## Step 10 — Approve Your First Therapist

When a therapist signs up, they won't appear as verified until you approve them. Here's how:

1. Log in to the admin portal: `https://admin.24therapy.ai`
2. Click **Therapists** in the left sidebar
3. Find the therapist with status "Pending"
4. Click their row
5. Click **Approve** (or the checkmark button)
6. The therapist can now log in and start using the platform

---

## How to Update Environment Variables Later

If you ever need to change an API key or add a new variable:

### In Railway (backend):
1. Go to https://railway.app → your project
2. Click your service → **Variables** tab
3. Find the variable and click the pencil (edit) icon
4. Change the value → click the checkmark to save
5. Railway will automatically redeploy (takes ~2 minutes)

### In Vercel (websites):
1. Go to https://vercel.com → click the project
2. Click **Settings** → **Environment Variables**
3. Find the variable → click the three dots → **Edit**
4. Change the value → click **Save**
5. You need to manually trigger a redeploy:
   - Click **Deployments** tab
   - Find the latest deployment → click the three dots → **Redeploy**

---

## Troubleshooting — Common Problems

### "Application error" when opening a website
**Where to look:** Vercel → your project → **Deployments** tab → click the latest (red) deployment → read the build logs
**Usually caused by:** Missing environment variable, or wrong Root Directory setting

### Login says "Network Error" or "Failed to fetch"
**Cause:** The `NEXT_PUBLIC_API_URL` is wrong, or the Railway backend is down
**Fix:**
1. Check Railway → your service → **Deployments** — is it running?
2. Open `YOUR-RAILWAY-URL/health` — do you get `{"status":"ok"}`?
3. In Vercel, check the `NEXT_PUBLIC_API_URL` variable — make sure it ends in `/api/v1` with no trailing slash

### "Invalid credentials" when logging in
**Cause:** Wrong email/password, or the account doesn't exist yet
**Fix:** Check Neon SQL Editor:
```sql
SELECT email, role, status FROM users WHERE email = 'your@email.com';
```
If nothing comes back, the account doesn't exist. If status is `suspended`, run:
```sql
UPDATE users SET status = 'active' WHERE email = 'your@email.com';
```

### Backend keeps restarting on Railway
**Where to look:** Railway → your service → **Deployments** → click the failing deployment → **View Logs**
**Usually caused by:** Missing required environment variable (the log will say exactly which one)

### Payments not working
**Check:**
1. Stripe Dashboard → **Developers** → **Logs** → look for errors
2. Make sure `STRIPE_SECRET_KEY` starts with `sk_live_` (not `sk_test_`) for production
3. Make sure the webhook endpoint is enabled in Stripe

### Emails not sending
**Check:**
1. Resend Dashboard → **Logs** → look for bounces or errors
2. Make sure your sending domain is verified in Resend (green checkmark)
3. Make sure `FROM_EMAIL` uses your verified domain, not Gmail

### Video sessions not working
**Check:**
1. Make sure `DAILY_API_KEY` is set correctly in Railway
2. Daily.co Dashboard → check your API key is active
3. Sessions must have `modality: "video"` when created

### "CORS error" in browser console
**Cause:** The `CORS_ORIGINS` variable in Railway doesn't include your website's URL
**Fix:** Railway → Variables → update `CORS_ORIGINS` to include all your website URLs, comma-separated

---

## Full List of Every Environment Variable

### Railway (Backend) — Required ★

```
★ NODE_ENV=production
★ PORT=4000
★ DATABASE_URL=postgresql://...@...neon.tech/...?sslmode=require
★ DATABASE_SSL=true
★ JWT_SECRET=<64 random characters from https://generate-secret.vercel.app/64>
★ JWT_REFRESH_SECRET=<different 64 random characters>
★ OPENAI_API_KEY=sk-proj-...
★ STRIPE_SECRET_KEY=sk_live_...
★ STRIPE_PUBLISHABLE_KEY=pk_live_...
★ RESEND_API_KEY=re_...
★ FROM_EMAIL=24Therapy <noreply@yourdomain.com>
  DAILY_API_KEY=...
  STRIPE_WEBHOOK_SECRET=whsec_...
  CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
  APP_URL=https://24therapy.ai
  THERAPIST_APP_URL=https://app.24therapy.ai
  PATIENT_APP_URL=https://my.24therapy.ai
  ADMIN_APP_URL=https://admin.24therapy.ai
  API_URL=https://api.24therapy.ai
  REDIS_URL=redis://...
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION=us-east-1
  AWS_S3_BUCKET=24therapy-uploads
```

### Vercel (All 4 websites) — Required ★

```
★ NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
★ NEXT_PUBLIC_WEB_URL=https://24therapy.ai
★ NEXT_PUBLIC_THERAPIST_URL=https://app.24therapy.ai
★ NEXT_PUBLIC_PATIENT_URL=https://my.24therapy.ai
★ NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
★ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

> **Important:** Variables starting with `NEXT_PUBLIC_` are visible to the browser. Never put secret keys in `NEXT_PUBLIC_` variables.

---

## Cost Estimate (Monthly)

| Service | Free Tier Limit | After Free Tier |
|---------|-----------------|-----------------|
| Railway | $5 credit free | ~$10–20/month |
| Vercel | Hobby plan (unlimited for 4 apps) | Free |
| Neon | 0.5 GB storage, 3 projects | $19/month (Launch plan) |
| OpenAI | None — pay per use | ~$50–200/month depending on usage |
| Stripe | Free — 2.9% + 30¢ per transaction | Free (% of revenue) |
| Resend | 3,000 emails/month free | $20/month (50k emails) |
| Daily.co | 10,000 participant-minutes/month | $0.00099/min after that |
| **Total** | | **~$100–250/month for a live platform** |

---

## What to Do After Launch

Once everything is live:

1. **Log in to the admin portal** → verify your own account shows `super_admin` role
2. **Test the full flow:** sign up as a therapist → approve them → sign up as a patient → create a session
3. **Add your Stripe webhook secret** (Step 6 above)
4. **Verify your email domain in Resend** so emails don't go to spam
5. **Set up your pricing plans** in Stripe (Step 8)
6. **Test a video session** — create a session with `video` modality and check that the Daily.co room loads
7. **Create your first real organization** from the admin portal → Organizations → Add Organization

---

## Getting Support

| Problem | First place to look |
|---------|---------------------|
| Backend not starting | Railway → Deployments → View Logs |
| Website build failing | Vercel → Deployments → click the failed build |
| Database errors | Neon → Monitoring tab |
| Payment issues | Stripe → Developers → Logs |
| Email delivery | Resend → Logs |
| AI not working | Check `OPENAI_API_KEY` in Railway, check OpenAI billing |
| Video not working | Check `DAILY_API_KEY` in Railway |

> **Always check logs first.** Every platform has a logs or monitoring section. The error message will almost always tell you exactly what's wrong.

<!-- Reviewed: 2026-06-13 — 24Therapy audit -->
