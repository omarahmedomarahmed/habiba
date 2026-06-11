# 24Therapy — Deployment Guide (No Terminal Required)

> How to get 24Therapy live on the internet using only your web browser.
> No coding, no command line, no technical background needed.
> Last verified: 2026-06-11

---

## What You'll Be Setting Up

24Therapy runs as 5 separate services. You'll deploy each one using two free/paid platforms:

| Service | What it does | Platform |
|---------|-------------|----------|
| **API (Backend)** | The brain — handles all data, AI, payments | Railway |
| **Marketing Website** | 24therapy.ai — public homepage, pricing, blog | Vercel |
| **Therapist Portal** | app.24therapy.ai — where therapists work | Vercel |
| **Patient Portal** | my.24therapy.ai — where patients log in | Vercel |
| **Admin Portal** | admin.24therapy.ai — platform management | Vercel |

---

## Accounts You'll Need to Create First

Open each link in a new tab and create a free account before starting:

| # | Service | Website | What It's For |
|---|---------|---------|---------------|
| 1 | **GitHub** | https://github.com/signup | Where the code lives |
| 2 | **Railway** | https://railway.app | Runs the backend API |
| 3 | **Vercel** | https://vercel.com/signup | Hosts all 4 websites |
| 4 | **Neon** | https://neon.tech | Your database (PostgreSQL) |
| 5 | **Stripe** | https://dashboard.stripe.com/register | Payments |
| 6 | **OpenAI** | https://platform.openai.com/signup | AI features (notes, copilot) |
| 7 | **Resend** | https://resend.com/signup | Sending emails |

> You don't need all of these on Day 1. Steps below tell you when each is needed.

---

## Part 1 — Fork the Repository on GitHub

This gives you your own copy of the code.

1. Go to https://github.com/omarahmedomarahmed/habiba
2. Click the **Fork** button (top-right corner)
3. Click **Create fork**
4. You now have `https://github.com/YOUR-USERNAME/habiba` — this is your copy

---

## Part 2 — Set Up Your Database (Neon)

Your database stores all patients, sessions, therapists, and billing data.

### Create the database

1. Go to https://neon.tech and sign in
2. Click **New Project**
3. Name it: `24therapy-production`
4. Region: choose the one closest to your users (e.g., US East)
5. Click **Create Project**

### Enable required extensions

1. Inside your Neon project, click **SQL Editor** in the left sidebar
2. Paste the following and click **Run**:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

3. You should see "Success" for each line

### Save your connection string

1. Click **Connection Details** (or **Dashboard**) in Neon
2. Find the field labeled **Connection string** — it looks like:
   `postgresql://user:password@host.neon.tech/dbname?sslmode=require`
3. Copy it and save it somewhere safe (you'll need it in Part 3)

### Run the database migrations

You need to run 15 SQL scripts to create all the tables. Do them one at a time in the Neon SQL Editor:

1. Go to your GitHub repo: `https://github.com/YOUR-USERNAME/habiba/tree/main/migrations`
2. Click each file below, click the **Raw** button, copy all the text
3. Paste it into the Neon SQL Editor and click **Run**

Run them in this exact order:

| # | File name | Click to open |
|---|-----------|---------------|
| 1 | `001_core_schema.sql` | GitHub → migrations → 001_... |
| 2 | `002_therapists_schema.sql` | |
| 3 | `003_patients_schema.sql` | |
| 4 | `004_clinical_schema.sql` | |
| 5 | `005_medications_schema.sql` | |
| 6 | `006_sessions_schema.sql` | |
| 7 | `007_ai_schema.sql` | |
| 8 | `008_assessments_schema.sql` | |
| 9 | `009_radar_schema.sql` | |
| 10 | `010_billing_schema.sql` | |
| 11 | `011_notifications_schema.sql` | |
| 12 | `012_audit_compliance_schema.sql` | |
| 13 | `013_marketplace_schema.sql` | |
| 14 | `014_analytics_schema.sql` | |
| 15 | `015_pricing_management.sql` | |

> If any script gives a "relation already exists" error, that's OK — just continue to the next one.

---

## Part 3 — Deploy the Backend API (Railway)

The backend is the engine that powers everything else. It must be deployed before the websites.

### Create the project

1. Go to https://railway.app and sign in
2. Click **New Project**
3. Click **Deploy from GitHub repo**
4. Connect your GitHub account if asked
5. Select your `habiba` fork
6. Railway will start setting up — **don't close the tab**

### Set environment variables

Once the project is created, Railway needs to know your secret keys.

1. Click on your service (it will be named something like `habiba`)
2. Click the **Variables** tab
3. Click **Raw Editor** (easier to paste all at once)
4. Paste the following, replacing everything in `< >` with your actual values:

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<your Neon connection string from Part 2>
DATABASE_SSL=true
JWT_SECRET=<generate one at https://generate-secret.vercel.app/64>
OPENAI_API_KEY=<your OpenAI key — from https://platform.openai.com/api-keys>
STRIPE_SECRET_KEY=<from https://dashboard.stripe.com/apikeys — use sk_live_ for production>
STRIPE_PUBLISHABLE_KEY=<from Stripe dashboard — pk_live_...>
STRIPE_WEBHOOK_SECRET=<you'll add this later in Part 5>
RESEND_API_KEY=<from https://resend.com/api-keys>
FROM_EMAIL=24Therapy <noreply@yourdomain.com>
```

5. Click **Update Variables**
6. Railway will restart the service automatically

### Verify it's running

1. Click the **Deployments** tab
2. Wait for the deployment to show a green checkmark
3. Click **Settings** → **Networking** → find the public URL (looks like `https://habiba-production-xxxx.up.railway.app`)
4. Open that URL + `/health` in your browser:
   `https://habiba-production-xxxx.up.railway.app/health`
5. You should see: `{"status":"ok","timestamp":"..."}` — this means it's working

### Save your backend URL

Copy the Railway URL (without `/health`) — you'll need it when setting up the websites.

---

## Part 4 — Deploy the 4 Websites (Vercel)

You'll repeat this process 4 times — once for each website.

### Marketing Website (24therapy.ai)

1. Go to https://vercel.com and sign in
2. Click **Add New** → **Project**
3. Find your `habiba` fork and click **Import**
4. **IMPORTANT**: Change the **Root Directory** field to: `apps/web`
5. Click **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-railway-url.up.railway.app/api/v1` |
| `NEXT_PUBLIC_WEB_URL` | `https://24therapy.ai` (or your domain) |
| `NEXT_PUBLIC_THERAPIST_URL` | `https://app.24therapy.ai` |
| `NEXT_PUBLIC_PATIENT_URL` | `https://my.24therapy.ai` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.24therapy.ai` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` from Stripe |

6. Click **Deploy**
7. Wait for the green checkmark — your site is live!

---

### Therapist Portal (app.24therapy.ai)

1. Back in Vercel → **Add New** → **Project**
2. Import the same `habiba` fork again
3. **Root Directory**: `apps/therapist`
4. Add the same environment variables as above
5. Click **Deploy**

---

### Patient Portal (my.24therapy.ai)

1. **Add New** → **Project** → Import `habiba`
2. **Root Directory**: `apps/patient`
3. Add the same environment variables
4. Click **Deploy**

---

### Admin Portal (admin.24therapy.ai)

1. **Add New** → **Project** → Import `habiba`
2. **Root Directory**: `apps/admin`
3. Add the same environment variables
4. Click **Deploy**

---

## Part 5 — Connect Your Domain Names

After deploying, Vercel gives each site a URL like `habiba-web-xxxx.vercel.app`. To use your real domain:

### In Vercel (for each of the 4 projects)

1. Open the project → **Settings** → **Domains**
2. Type your domain and click **Add**:
   - Web project → `24therapy.ai` and `www.24therapy.ai`
   - Therapist project → `app.24therapy.ai`
   - Patient project → `my.24therapy.ai`
   - Admin project → `admin.24therapy.ai`
3. Vercel will show you DNS records to add

### In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)

Add these records (Vercel will show you the exact values):

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `app` | `cname.vercel-dns.com` |
| CNAME | `my` | `cname.vercel-dns.com` |
| CNAME | `admin` | `cname.vercel-dns.com` |
| CNAME | `api` | `your-service.railway.app` |

> DNS changes can take 5 minutes to 48 hours to work worldwide. Don't panic if it's not instant.

### For Railway (backend custom domain)

1. Railway → your project → **Settings** → **Networking** → **Custom Domain**
2. Add `api.24therapy.ai`
3. Railway shows you a CNAME record — add it to your DNS

---

## Part 6 — Set Up Stripe Webhooks

Stripe needs to notify your backend when payments happen.

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Endpoint URL: `https://api.24therapy.ai/api/v1/billing/webhooks/stripe`
4. Click **Select events** → check **All events** (or at minimum: `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`)
5. Click **Add endpoint**
6. Click **Reveal signing secret** — copy the `whsec_...` value
7. Go back to Railway → Variables → add `STRIPE_WEBHOOK_SECRET=whsec_...`
8. Railway will redeploy automatically

---

## Part 7 — Update CORS Settings in Railway

The backend needs to know which websites are allowed to talk to it.

1. Railway → Variables
2. Add or update this variable:

```
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
```

3. Click **Update Variables**

---

## Part 8 — Verify Everything Works

Go through this checklist in your browser:

- [ ] `https://api.24therapy.ai/health` → shows `{"status":"ok",...}`
- [ ] `https://24therapy.ai` → marketing homepage loads
- [ ] `https://app.24therapy.ai/login` → therapist login page loads
- [ ] `https://my.24therapy.ai/login` → patient login page loads
- [ ] `https://admin.24therapy.ai/login` → admin login page loads
- [ ] Try logging in with credentials you registered via the API

---

## Getting Help

| Problem | Where to look |
|---------|---------------|
| Site not loading | Vercel → your project → **Deployments** tab → click the latest deploy → read the error |
| API errors | Railway → your project → **Deployments** → **View Logs** |
| Database issues | Neon → **Monitoring** tab → check for errors |
| Payment issues | Stripe → **Developers** → **Logs** |

### Common Problems

**"Application error" on Vercel**
→ Open Vercel project → Deployments → click the red deployment → read the build log. Usually a missing environment variable.

**Login says "Network Error"**
→ The `NEXT_PUBLIC_API_URL` variable in Vercel is wrong or the Railway backend is down. Check the `/health` URL.

**Backend keeps restarting on Railway**
→ Check Railway logs — it will say exactly which environment variable is missing.

**"Invalid JWT" errors**
→ Make sure `JWT_SECRET` in Railway is the same value you used when you first deployed (don't change it after users have logged in).

---

## Environment Variables — Full Reference

This is every variable the backend can accept. Only the starred ones (★) are required to start.

```
★ NODE_ENV=production
★ DATABASE_URL=postgresql://...
★ DATABASE_SSL=true
★ JWT_SECRET=<64 random characters>
★ OPENAI_API_KEY=sk-...
★ STRIPE_SECRET_KEY=sk_live_...
★ STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
★ RESEND_API_KEY=re_...
  FROM_EMAIL=24Therapy <noreply@yourdomain.com>
  REDIS_URL=redis://...
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION=us-east-1
  AWS_S3_BUCKET=24therapy-uploads
  DAILY_API_KEY=...
  CORS_ORIGINS=https://24therapy.ai,...
  APP_URL=https://24therapy.ai
  THERAPIST_APP_URL=https://app.24therapy.ai
  PATIENT_APP_URL=https://my.24therapy.ai
  ADMIN_APP_URL=https://admin.24therapy.ai
  API_URL=https://api.24therapy.ai
```

> To generate a secure JWT_SECRET, visit: https://generate-secret.vercel.app/64

---

## Costs (Approximate)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Railway | $5 credit/month trial | ~$5–20/month for hobby |
| Vercel | Free for 4 hobby projects | Free (Hobby plan covers this) |
| Neon | Free tier (0.5 GB) | $19/month (10 GB) |
| OpenAI | Pay per use | ~$0.01–0.10 per session note |
| Stripe | Free (2.9% + 30¢ per transaction) | Free |
| Resend | 3,000 emails/month free | $20/month (50k emails) |
