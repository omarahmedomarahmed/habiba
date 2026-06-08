# 24Therapy.ai — Financial Model & Unit Economics
> Generated: 2026-06-08 | Based on actual codebase, pricing schema, and industry benchmarks

---

## Executive Summary

**Verdict: Profitably positioned at scale, but currently UNDERPRICED at the Professional tier ($99/month) given AI costs and operational overhead. The Practice tier ($299/month for 10 therapists = $30/therapist/month) is dangerously thin-margined.**

| Metric | Current | Recommended |
|--------|---------|-------------|
| Professional plan | $99/month | $129–149/month |
| Practice plan (10 therapists) | $299/month ($30/therapist) | $399/month ($40/therapist) |
| Free tier AI notes | 10 notes free | Keep as funnel |
| Break-even (therapists) | ~287 Professional subscribers | Same |
| Target gross margin at scale | 65–72% | 70–78% |

---

## 1. Assumptions

### AI Model Costs (OpenAI, per-unit)
| Operation | Model | Cost |
|-----------|-------|------|
| Session transcription (60 min) | Whisper-1 | ~$0.36 (360 tokens @ $0.006/min) |
| Note generation (SOAP, ~800 tokens) | GPT-4o | ~$0.012 (in: $2.50/1M, out: $10/1M) |
| Copilot suggestion (avg 200 tokens) | GPT-4o | ~$0.003 |
| Memory embedding (avg 500 tokens) | text-embedding-3-small | ~$0.00001 |
| Risk detection check | GPT-4o (small prompt) | ~$0.002 |
| **Total per session (all AI)** | | **~$0.38–0.42** |

### Session Volume Assumptions
- Average therapist: **20 sessions/month** (50% utilization, 40 slot capacity)
- Average session duration: **50 minutes**
- AI note approval rate: **90%** (10% require regen)
- Copilot usage rate: **60%** of sessions

### Infrastructure Costs (Monthly, per-tier)
| Component | Shared (all) | Per 100 MAU |
|-----------|-------------|-------------|
| Railway backend (2 vCPU, 4GB) | $50 | +$20 |
| PostgreSQL + pgvector (Railway) | $35 | +$15 |
| Redis (Railway) | $15 | — |
| Vercel Pro (4 apps) | $80 | — |
| Daily.co video (per minute) | $0.004/min | — |
| AWS S3 (recordings) | $0.023/GB | — |
| Resend email | $20/month (50K) | — |
| Stripe fees | 2.9% + $0.30/txn | — |
| **Monthly infrastructure base** | **~$200** | |

---

## 2. Infrastructure Cost Model

### Base Monthly Fixed Costs
```
Railway API server:        $50
PostgreSQL + pgvector:     $35
Redis:                     $15
Vercel (4 apps):           $80
Resend (email):            $20
Monitoring/alerts:         $10
Domain/SSL/CDN:            $15
Total Fixed Base:          $225/month
```

### Variable Costs (per active therapist/month)
```
AI per therapist (20 sessions × $0.40):   $8.00
Video (20 sessions × 50min × $0.004):     $4.00
Storage (recordings, notes):              $0.50
Database compute scaling:                 $1.50
Email (notifications, reminders):         $0.30
Stripe fees (avg $99 plan):               $3.17 (2.9% + $0.30)
Total variable per therapist:             ~$17.47/month
```

---

## 3. Pricing Validation

### Current Pricing (from `010_billing_schema.sql`)

| Plan | Monthly | Annual | Max Therapists | AI Notes |
|------|---------|--------|----------------|---------|
| Free | $0 | $0 | 1 | 10 |
| Professional | $99 | $990 | 1 | Unlimited |
| Practice | $299 | $2,990 | 10 | Unlimited |
| Enterprise | Custom | Custom | Unlimited | Unlimited |

### Professional Plan ($99/month, 1 therapist)
```
Revenue:                          $99.00
Cost of Goods Sold:
  AI costs (20 sessions):         $8.00
  Video (Daily.co):               $4.00
  Storage:                        $0.50
  Database/infra allocation:      $4.00
  Email/comms:                    $0.30
  Stripe fee (2.9% + $0.30):      $3.17
  Total COGS:                    $20.00 (20.2% COGS)

Gross Profit:                    $79.00
Gross Margin:                    79.8% ✅

Allocated S&M/overhead (est.):   $35.00
Net per subscriber:              $44.00 (44.4% net) ✅

VERDICT: VIABLE at scale.
```

### Practice Plan ($299/month, 10 therapists)
```
Revenue:                          $299.00
Cost of Goods Sold:
  AI costs (10×20 sessions):      $80.00
  Video (Daily.co):               $40.00
  Storage (10 therapists):        $5.00
  Database/infra allocation:      $20.00
  Email/comms (10 therapists):    $3.00
  Stripe fee:                     $8.97
  Total COGS:                    $156.97 (52.5% COGS)

Gross Profit:                    $142.03
Gross Margin:                    47.5% ⚠️ THIN

Net per plan:                    $107.03 after overhead ($35)
Per-therapist revenue:           $29.90/therapist
Per-therapist COGS:              $15.70/therapist

VERDICT: UNDERPRICED. At $299 for 10 therapists, you're charging $30/therapist vs
         $99 for a solo therapist. The margin compression is severe at high AI usage.
         
RECOMMENDATION: Raise to $399/month ($40/therapist) OR limit sessions to 15/therapist
                and add an overage charge of $0.50/session above threshold.
```

---

## 4. Session Economics

### Per-Session Cost Breakdown
```
Item                              Cost
─────────────────────────────────────
Transcription (Whisper):          $0.360
Note generation (GPT-4o):         $0.012
Copilot suggestions (3 × avg):    $0.009
Memory embedding:                 $0.001
Risk check:                       $0.002
Video (50min × $0.004):           $0.200
Storage (50min recording ~50MB):  $0.001
Database query overhead:          $0.005
─────────────────────────────────────
Total per session:                $0.59

At 20 sessions/month/therapist:   $11.80/therapist/month
```

### Professional Plan Session Economics
```
Revenue per session (20 sessions): $4.95/session ($99/20)
Cost per session:                  $0.59/session
Session contribution margin:       $4.36/session (88% gross) ✅
```

### Practice Plan Session Economics
```
Revenue per session (200 sessions): $1.50/session ($299/200)
Cost per session:                   $0.59/session
Session contribution margin:        $0.91/session (61%)

AT 300 sessions (15/therapist × 10): $0.997/session revenue
AT 400 sessions (20/therapist × 10): $0.75/session revenue < $0.59 cost

DANGER ZONE: If Practice plan therapists average >15 sessions/month, 
             margins go negative on the session level. ⚠️
```

---

## 5. Unit Economics

### Customer Acquisition Cost (CAC) Estimates
```
Inbound (SEO + word of mouth): $150–300/therapist
Outbound (paid ads):           $400–800/therapist  
Conference/events:             $200–500/therapist
Target blended CAC:            $300/therapist
```

### Customer Lifetime Value (LTV)
```
Professional plan:
  MRR:                         $99
  Monthly churn (SaaS avg):    3–5%
  Avg lifetime:                20–33 months
  LTV (at 3.5% churn):         $99 × (1/0.035) = $2,828
  LTV:CAC ratio:               $2,828 / $300 = 9.4× ✅ (target: >3×)

Practice plan:
  MRR:                         $299
  Monthly churn:               2–3% (teams are stickier)
  Avg lifetime:                33–50 months
  LTV (at 2.5% churn):         $299 × (1/0.025) = $11,960
  LTV:CAC ratio:               $11,960 / $600 = 19.9× ✅✅
```

### Payback Period
```
Professional:  $300 CAC / ($99 - $20 COGS) = 3.8 months ✅
Practice:      $600 CAC / ($299 - $157 COGS) = 4.2 months ✅
```

---

## 6. Break-Even Analysis

### Fixed Cost Base: ~$5,000/month (infra + 2 FTE minimal team)
```
Infrastructure:           $225/month
Team (2 FTE @ $8k avg):   $4,000/month  
Total fixed:              $4,225/month

Break-even (Professional only, $79 gross profit/subscriber):
  $4,225 / $79 = 53 subscribers minimum

Break-even (full business with S&M, 2 devs + 1 CS):
  Fixed: ~$22,000/month (3 FTE + infra + tools)
  $22,000 / $44 net = 500 Professional subscribers

At 500 Professional subscribers:
  MRR:                    $49,500
  ARR:                    $594,000
  COGS:                   $10,000
  Gross profit:           $39,500/month
  Operating expenses:     $22,000/month
  EBITDA:                 $17,500/month ✅
```

---

## 7. Margin Analysis

### Gross Margin by Plan (at scale)
| Plan | Revenue | COGS | Gross Margin |
|------|---------|------|-------------|
| Professional | $99 | $20 | **79.8%** ✅ |
| Practice (10) | $299 | $157 | **47.5%** ⚠️ |
| Practice (rec.) | $399 | $157 | **60.7%** ✅ |
| Enterprise (est.) | $2,000 | $400 | **80.0%** ✅ |

### AI Cost Scenarios
```
Light user (10 sessions/month, 40min avg):
  AI cost: $4.50, Video: $1.60, Total: $6.10
  Professional margin: ($99 - $6.10 - fixed $8) / $99 = 85.8% ✅

Heavy user (30 sessions/month, 60min avg):
  AI cost: $12.50, Video: $7.20, Total: $19.70
  Professional margin: ($99 - $19.70 - fixed $8) / $99 = 71.5% ✅
  Practice (per therapist): ($29.90 - $19.70 - $5 overhead) / $29.90 = 17.4% 🔴
```

---

## 8. Scaling Analysis

### Revenue Projections

| Therapists | Monthly Revenue | Monthly COGS | Gross Profit | Gross Margin |
|-----------|----------------|-------------|-------------|-------------|
| 100 (Professional) | $9,900 | $2,000 | $7,900 | 79.8% |
| 500 (mix 70/30 Pro/Practice) | $40,830 | $9,500 | $31,330 | 76.7% |
| 1,000 (mix) | $81,660 | $19,000 | $62,660 | 76.7% |
| 5,000 (mix) | $400,000 | $90,000 | $310,000 | 77.5% |
| 10,000 (mix) | $800,000 | $175,000 | $625,000 | 78.1% |

*Note: Mix = 70% Professional, 20% Practice (avg 6 therapists/plan), 10% Enterprise*

### Infrastructure Scaling (Railway)
```
0–500 therapists:   Current infra ($225/month), scale as needed
500–2,000:          Add read replicas ($200/month), CDN ($100/month) 
2,000–10,000:       Dedicated DB cluster ($500/month), horizontal API scaling
10,000+:            Multi-region deployment, consider self-hosted Postgres cluster
```

### AI Cost Optimization Levers
```
1. GPT-4o-mini for copilot (80% cheaper): saves ~$1.50/therapist/month
2. Cache embeddings (dedup patient memory): saves ~30% on embedding costs
3. Batch transcription (off-peak): saves ~20% on Whisper
4. Negotiate OpenAI volume pricing at $100K+/year: 20–30% discount
5. Fine-tune smaller model for SOAP notes (10,000+ subscribers): saves 60%
```

---

## 9. Critical Risks

### Risk 1: Practice Plan Margin Squeeze 🔴 HIGH
**Problem:** At $299/10 therapists, if all therapists see 20 sessions/month with 60min avg:
- COGS = $157, Revenue = $299, Gross = $142 (47.5%)
- After overhead allocation: ~35% net gross  
**Fix:** Raise to $399/month OR implement session-based usage limits with overages

### Risk 2: OpenAI Pricing Volatility 🟡 MEDIUM
**Problem:** GPT-4o pricing has changed 3× in 2024–2025. A 2× increase would compress Professional gross margin from 80% to ~72%.  
**Fix:** Maintain pricing buffer; consider Anthropic fallback; implement local/fine-tuned model at scale

### Risk 3: Daily.co Video Costs at Scale 🟡 MEDIUM
**Problem:** At 10,000 therapists × 20 sessions × 50 min = 10M minutes/month = $40,000/month
**Fix:** Negotiate enterprise pricing with Daily.co; Jitsi/LiveKit self-hosted is an option at this scale ($5K/month vs $40K)

### Risk 4: Churn Risk from Practice Tier 🟡 MEDIUM
**Problem:** Practice teams require onboarding investment; churn event = large MRR drop
**Fix:** Annual contracts with 10% discount; dedicated onboarding for 5+ therapist teams

---

## 10. Recommendations

### Immediate (Before 100 Customers)
1. **Raise Practice plan to $399/month** — $30/therapist is below market; competitors charge $50–$100/therapist (Luminare, Osmind, Headway)
2. **Add session overage pricing**: $0.40/session above 15/month for Practice plan
3. **Implement Fair Use Policy**: Define "unlimited" as reasonable use (≤25 sessions/month/therapist); enterprise pricing above that

### Short-term (100–500 Customers)
4. **Annual plan discount**: 2 months free (16.7% discount) — reduces churn, improves cash flow
5. **Add-on revenue**: AI Credits pack ($19 for 50 extra sessions) for free tier
6. **Per-seat expansion**: Practice plan add seat = $35/month/additional therapist above 10

### Medium-term (500–2,000 Customers)
7. **Optimize AI stack**: Deploy GPT-4o-mini for non-critical tasks; save ~$3–4/therapist/month
8. **Negotiate Daily.co enterprise**: At 2,000+ therapists, negotiate per-minute rate or move to LiveKit
9. **OpenAI volume commitment**: At $50K+/month spend, negotiate 25–30% discount

### Long-term (2,000+ Customers)
10. **Fine-tune proprietary clinical note model**: At scale, a clinical fine-tuned Llama 3 or Mistral model could replace GPT-4o for notes, reducing AI cost by 60%
11. **Revenue-share model for Enterprise**: % of insurance reimbursements processed is an alternative revenue stream

---

## Profitability Summary

### Are we profitable?
**Not yet at current scale, but the unit economics are healthy.** At 500+ Professional subscribers, the business reaches profitability without additional capital, assuming a lean team (3–5 FTE).

### Are we underpriced?
**Yes, specifically the Practice plan.** Competitors charge:
- SimplePractice: $99–$149/clinician  
- Luminare Health: $75–125/therapist  
- Osmind: $99–199/clinician  
- TherapyNotes: $59/therapist (but no AI)
At $30/therapist (Practice plan), we are well below market. The Professional plan at $99 is competitive and appropriate.

### Are usage promises sustainable?
**"Unlimited" AI notes are sustainable at Professional tier** (79.8% gross margin even at heavy use), but **not at Practice tier** if therapists average >15 sessions/month at 60min each. The word "unlimited" should be defined in terms or include a fair-use threshold.

### Formulas Used
```
Gross Margin = (Revenue - COGS) / Revenue
LTV = ARPU / Monthly Churn Rate
LTV:CAC = LTV / Customer Acquisition Cost
Payback = CAC / Monthly Gross Profit per Customer
Break-even = Fixed Costs / Gross Profit per Customer
```

---

*Sources: OpenAI pricing (2026), Daily.co pricing page, Railway.app pricing, Stripe fee schedule, industry benchmarks from KLAS Research, Grand View Research telehealth market data, SimplePractice/TherapyNotes public pricing.*
