# Stale statements, merged and checked

Written 2026-09-22. Read only: nothing in the repository was changed to write this.

Sources merged: the `## Stale` sections of `takeover/reading/code-01.md` to `code-16.md`, `DOCS-digest.md` s5 (first list), `SIMULATION-digest.md` s5, `PLAN-digest.md` s0 and s2 (the SILENT rulings, which are stale text inside `PLAN.md`), and `takeover/MAP.md` "Stale" 1 to 7 plus the stale line under "Live-site checks". Two readers reporting one statement are one entry with both sources.

Verdicts:

- **CONFIRMED STALE**: I opened the file and the code it describes and the statement is false today.
- **NOT STALE**: the statement is true, or is history in the past tense, or the reader misread.
- **UNSURE**: needs a database, a browser or a decision; or I did not reopen it (said so in the entry).

Format of each entry: `file:line` . what it says . what is true now . verdict . sources.

---

## Part 1. Read these first: stale statements a new reader would act on dangerously

Ordered by harm. Each also appears, by number only, under its file in Part 2.

### D1. `HAZARDS.md:152` says every verifier refuses production
- Says: "Every verifier that touches the database refuses the production endpoint by name."
- True now: `scripts/verify-sprint1.ts:28`, `verify-sprint2.ts:18`, `verify-sprint4.ts:14` and also `verify-sprint7.ts:19` connect through `scripts/db.ts` (`connect()`, lines 14 to 20: no host check) and never call `writesTo()`. sprint1 updates `platform_settings` (234, 299), sprint2 updates it (89, 124), sprint4 stores an FX quote, and **sprint7 deletes `patient_accounts` by phone prefix** (`:394`, prefix `+2013000` at `:430`). `package.json` runs them with `--env-file-if-exists=.env.local`, so a `.env.local` pointed at production is enough. verify-sprint7 is my addition; the readers named three.
- Verdict: **CONFIRMED STALE**. The guard a reader relies on does not exist for four scripts.
- Sources: code-14 Stale 1; verify-sprint7 found while checking code-15 Stale 4.

### D2. `README.md:350-351` says the crisis re-delivery cron runs every 5 minutes
- Says: `/api/cron/crisis` "every 5 min" re-delivers crisis alerts whose notification failed; `/api/cron/billing` "every 30 min".
- True now: `vercel.json` schedules crisis `0 3 * * *` and billing `5 3 * * *`: **once a day**. A failed crisis alert waits up to 24 hours for its retry. The table also lists 3 jobs; `vercel.json` has 5 and the cron route defines 6 (`crisis, billing, radar, retention, reminders, extract`; radar has no schedule).
- Verdict: **CONFIRMED STALE**.
- Sources: MAP Stale 2; code-16 Stale 26; code-07 Stale 1 (the route's own "four jobs").

### D3. `docs/simulation/01-THE-CAST.md:50-53` and `DEPLOY.md:132-166` tell the reader to run seed and age commands on production
- Says: "It has already been run. Run `npm run on:production -- simulate:seed` anyway as your first act: it will refuse, saying an operator already exists." DEPLOY step 4 repeats `on:production -- simulate:seed`; DEPLOY:166 `on:production -- age -- --marker wave1 --days 30` (06-AGEING:96 says `--days 180`).
- True now: production was wiped by `seed:demo` on 2026-09-20 (`12-THE-LOGINS.md:5-15`) and now holds the demo cast; the simulation never ran. `scripts/simulate-seed.ts:200-236` does not refuse on an operator at all (it says so: counting `super_admin` was removed); it refuses only if a clinic organisation or a sponsor exists. It is still one of the six scripts allowed through to production. The safety of that "first act" rests on the demo cast happening to contain a clinic or sponsor, and the refusal text the doc promises will not appear. `age` is also on the production door and rewrites timestamps.
- Verdict: **CONFIRMED STALE**. Commands aimed at the production database for a run that is not going to happen there.
- Sources: SIMULATION-digest 5.1, 5.10, 5.14, 5.21.

### D4. `HAZARDS.md:231-235`, `scripts/_verify.ts:189,206`, `scripts/verify-sprint57.ts:414`, `scripts/sync-blocks.ts:45` disagree on how many scripts may write to production
- Says: HAZARDS "four do: settings, simulate-seed, age and migrate" and "verify:sprint57 asserts it is exactly those four"; `_verify.ts` "the five"; sprint57:414 "Four files may pass it".
- True now: six files pass `productionIsAllowed: true`: `age, migrate, seed-demo, settings, simulate-seed, sync-blocks` (grep). `verify-sprint57.ts:436-473` asserts six. Plus `ship-content.ts` writes to production without calling `writesTo()` at all (its own header, :20-27).
- Verdict: **CONFIRMED STALE** (three numbers for one set, none of them six).
- Sources: code-15 Stale 1; code-12 Stale 10; code-13 Stale (sync-blocks, HAZARDS).

### D5. `scripts/ship-content.ts:20-30` claims a confirmation step and that it is the only unguarded writer
- Says: "Every other writing script in this directory refuses the production endpoint by name", and it "refuses `--yes` as a substitute for reading" the host it prints.
- True now: no prompt, readline or question exists in the file; it prints the host and proceeds. And see D1: four verifiers are also unguarded writers.
- Verdict: **CONFIRMED STALE**.
- Sources: code-13 Stale 1.

### D6. `scripts/verify-sprint7.ts:388-394` says the phone block it deletes is fiction-only
- Says: "The phone block is reserved for fiction and no real account can be in it, so sweeping it is safe."
- True now: `scripts/seed-capture.ts:90,96` seeds the capture cast's patient accounts at `+201300052001/2`, inside the `+2013000` prefix the sweep deletes (`:394, :430`). Egypt has no reserved fiction range (MAP Suspect 19). Combined with D1 (no production guard), this is a delete on real-shaped rows.
- Verdict: **CONFIRMED STALE**.
- Sources: code-15 Stale 4.

### D7. `scripts/verify-synthetic.ts:47-52` treats the company's real domain as unable to receive mail
- Says: every listed domain is RFC-reserved and "cannot reach a real inbox".
- True now: the list includes `24therapy.app`; `omar@24therapy.app` and `habiba@24therapy.app` are real inboxes (`scripts/_demo-cast.ts:40-46`). The synthetic gate therefore passes real addresses as synthetic (`:150`).
- Verdict: **CONFIRMED STALE**.
- Sources: code-15 Stale 9.

### D8. `components/session/new-session-form.tsx:184-186` tells the clinician the patient decides recording
- Says (rendered to the clinician): "It does not decide whether the session is recorded. The patient decides that, on their own screen."
- True now: the default `where` is `in_person` (`:88`); in person there is no join link and no patient screen, consent stays null and the room records (MAP Confirmed 4). A clinician reading this believes consent was asked. Task 123.
- Verdict: **CONFIRMED STALE**.
- Sources: code-10 Stale 12; code-07 Stale (sessions/actions 91-95 context).

### D9. Public copy that promises consent before recording: `lib/content/defaults.ts:1193`, `lib/integrations/registry.ts:71`, `lib/consent.ts:2`, `lib/ehr/policy.ts:90`
- Says: hipaa page "Patients are asked to agree to being recorded before they enter the room"; registry public copy "The patient is asked for consent on the same screen, in their language" (in-person); consent.ts "What the patient is asked before they enter the room"; EHR policy "under a consent we recorded (C214)".
- True now: no in-person consent write exists (MAP Confirmed 4). The same hipaa sentence also says "sessions expire after 30 minutes of inactivity and 8 hours absolute"; clinician sessions are 2 h idle and 12 h absolute (`lib/auth/session.ts:34,36`), patients 4 h and 7 d (`lib/patient-auth/session.ts:29-31`).
- Verdict: **CONFIRMED STALE** (public, legal-adjacent claims).
- Sources: code-06 Stale 5; code-05 Stale 6, 10.

### D10. `app/(admin)/admin/transfers/actions.ts:72` and `lib/billing/payment-notices.ts:44-46` say a rejected payer is told
- Says: operator sees "Rejected, and they have been told why."; payment-notices: a rejection is "loud elsewhere: `rejectPayment` already carries the operator's own words".
- True now: `rejectPayment` (`lib/billing/manual.ts:670-694`) sends nothing; grep for `payment.rejected` finds nothing. MAP Confirmed 7. The operator is told something false every time.
- Verdict: **CONFIRMED STALE** (MAP Confirmed 7, not re-verified beyond the grep).
- Sources: code-04 Stale 2, 3; code-09 Stale 16.

### D11. `lib/audio/recorder.ts:53-66,99` says the caller must state consent
- Says: "Never assume consent: the caller states it."
- True now: `this.muted = options.muted ?? false` (`:100`): a caller that says nothing records.
- Verdict: **CONFIRMED STALE**.
- Sources: code-05 Stale 2.

### D12. `lib/meetings/recall.ts:56` says the meeting webhook is signed
- Says: webhook URL "Ours, signed."
- True now: `app/api/meetings/transcript/[sessionId]/route.ts` has no signature, secret or HMAC check (grep); the only check is `bot_id` in the body.
- Verdict: **CONFIRMED STALE** (a security guard that does not exist).
- Sources: code-05 Stale 11.

### D13. `lib/data/challenge.ts:509-513` calls `challengePassed` the gate every screen consults
- Says: "The gate every screen consults before rendering anything about a record."
- True now: no caller in app, components or lib (grep). MAP Confirmed 8.
- Verdict: **CONFIRMED STALE**.
- Sources: code-02 Stale 3.

### D14. `app/(admin)/admin/radar/page.tsx:17-19`, `components/admin/report-queue.tsx:115-120`, `app/(admin)/admin/radar/investigate/[id]/page.tsx:16` say reports are the only route to a transcript
- Says: "The only route to a transcript in the entire admin console is through a report somebody filed."
- True now: `/admin/tv` shows any session's transcript and note (`tv/page.tsx:155-184`, `lib/console/reads.ts`). Related: `lib/auth/guard.ts:145-153` "no screen behind this guard queries a clinical table"; `components/admin/gate.tsx:29` "every read is recorded" (only the unlock is); `components/admin/total-view.tsx:181` "Nothing here can be edited" (it sends two kinds of disclosure email).
- Verdict: **CONFIRMED STALE** (radar page and total-view checked; guard.ts reading depends on counting requireManager as "this guard", see Part 2).
- Sources: code-09 Stale 12, 13, 14; code-06 Stale 21.

### D15. Record export "never to whoever pressed the button": `lib/mail.ts:432-438,460`, `lib/data/export.ts:50-52,204,256`, `app/(admin)/admin/actions.ts:566-569`
- Says: sent to the patient, never to the presser; body "nobody at 24Therapy read it".
- True now: `sendRecordExport` takes `copyTo`, and `app/(admin)/admin/tv/actions.ts:51` passes `actor.email`: the operator gets the live link. `tv/actions.ts:33-35` also says the owning clinician "is notified exactly as ... any other request"; nothing notifies them (`admin/actions.ts:571-573` makes the same claim).
- Verdict: **CONFIRMED STALE**.
- Sources: code-02 Stale 10; code-05 Stale 12; code-09 Stale 3, 4, 11.

### D16. `app/(admin)/admin/therapists/page.tsx:20` tells the operator verification is not a gate
- Says (rendered): "A signal, not a gate: an unverified clinician can still record sessions."
- True now: `requireVerified` and the (app) layout redirect gate unverified clinicians; trigger 0060/0083 gate grants. Same family: `lib/db/schema.ts:300` "Soft signal only, it must never gate the clinical loop" (orphaned comment, next to `verification_status`).
- Verdict: **CONFIRMED STALE**.
- Sources: code-09 Stale 8; code-01 Stale (schema.ts:300).

### D17. `lib/env.ts:222` says AUTH_SECRET is checked in every environment
- True now: every check is inside `if (isProd)` (`:225-236`).
- Verdict: **CONFIRMED STALE**.
- Sources: code-06 Stale 3.

### D18. `scripts/migrate.ts:79-80` and `scripts/seed.ts:1-2` say they run on every deploy
- Says: migrate's audit "runs on every deploy"; seed "safe to re-run on every deploy".
- True now: HAZARDS H16 (`HAZARDS.md:45`): nothing applies migrations on deploy; the build is `next build`. A reader trusting migrate.ts pushes `main` before migrating production. `seed.ts:115-131` `--refresh-content` "touches nothing else" also false (org, subscription, super-admin upsert still run).
- Verdict: **CONFIRMED STALE**.
- Sources: code-12 Stale 12, 16.

### D19. `scripts/seed-demo.ts:196-199` says it checks the append-only trigger is back on
- Says: "the last thing this script does is check that it is enabled again".
- True now: it runs `ENABLE TRIGGER` in a `finally` (`:220`) and never reads `pg_trigger`. A guard on production's append-only summaries is asserted, not checked.
- Verdict: **CONFIRMED STALE**.
- Sources: code-12 Stale 14.

### D20. `.walkthrough/run.sh:3`, `.walkthrough2/up.sh:3` source `.env.local`
- Says: nothing; but the harness does `set -a; . ./.env.local; set +a`, which HAZARDS H48 forbids, and `up.sh` sets `NODE_ENV=production`.
- True now: harness is dead (code-16 Stale 22) yet still runnable.
- Verdict: **CONFIRMED STALE** (a hazard kept on disk).
- Sources: code-16 Stale 19.

### D21. Counts people quote
- `docs/TRAPS.md:83` "19 of 101 verifiers still have none": today 106 `verify-*.ts`, 18 without the word control/CONTROL (`grep -L`). TAKEOVER:414/952 and ORIENTATION:159 "18 of 106" are right by that measure; `scripts/verify-traps.ts:162` `NO_CONTROL_BASELINE = 19` lags by one and counts a spelling (code-15 Stale 13). TRAPS: **CONFIRMED STALE**; TAKEOVER/ORIENTATION: **NOT STALE**. (MAP Stale 6; code-15 Stale 13.)
- `docs/VALUE-STATEMENTS.md:~270` via `scripts/_prove-doc.ts:162-167` "Three of these are at example.com ... Dr Sara, Dr Kareem and Mariam": 7 of the 12 logins are at example.com (`_demo-cast.ts:67+`). **CONFIRMED STALE**. (code-12 Stale 6.)
- `scripts/_demo-cast.ts:33` "FOUR REAL INBOXES": `OWNED_INBOXES` has five. `:23,:29` "eleven logins", `seed-demo.ts:2` "TEN LOGINS", `logins.ts:198` "ten of eleven": `DEMO_LOGINS` has twelve. **CONFIRMED STALE**. (code-12 Stale 5.)
- `README.md:91` "Six kinds of person authenticate today. A seventh is being built": clinic staff is built (`drizzle/0093_clinic_staff.sql`, `lib/clinic-auth/session.ts`, `lib/data/clinic-team.ts`). **CONFIRMED STALE**. (MAP Stale 3.)
- `scripts/verify-reachable.ts:94-99` "87 ... must never rise" beside `DEAD_EXPORT_BASELINE = 96`. **CONFIRMED STALE**. (code-13.)
- `lib/db/schema.ts:22` "22 tables": 120 `pgTable(` calls. **CONFIRMED STALE**. (code-01.)
- `docs/PROVE-IT.md:182` "We say three taps on `/for-patients`": the live sentence is on `/` only. **CONFIRMED STALE** (MAP live-site check; not refetched).
- Simulation counts (documents, walks, gates, clinicians, tables): see Part 2, SIMULATION.

### D22. `lib/db/schema.ts:316-325` says we never hold therapists' money
- Says: "We never hold their money ... paying it out by hand would make us a payment intermediary."
- True now: ledger (0024), manual payouts (0047) and the manual rail (0102) hold and pay out money by hand; `markPayoutSent` exists (MAP Confirmed 6). A reader forming a licensing view from this comment is misled (PLAN C73).
- Verdict: **CONFIRMED STALE**.
- Sources: code-01 Stale; PLAN-digest s2.1.

### D23. `lib/i18n/messages.ts:1152` `jconsent.cannotUndo` tells the patient recording cannot stop
- Says (patient copy): "Recording cannot stop part-way. Ask your therapist to end the session."
- True now: since 48.10 the patient has a Stop recording button (`components/join/patient-room.tsx:343-357`). But that button only sets `recording_paused_at`, which the clinician's room never reads (MAP Confirmed 4b), so in effect the recording does not stop. The sentence contradicts the button; the button's effect contradicts the button. `components/join/consent-controls.tsx:12-18` carries the same one-way rationale.
- Verdict: **CONFIRMED STALE** (copy stale against the UI; the underlying defect is task 123).
- Sources: code-06 Stale 8; code-10 Stale 1.

### D24. `docs/TAKEOVER.md:965` and `README.md:603` call PLAN.md "The specification"
- True now: PLAN.md's own header says "Working document"; TAKEOVER:496 says "A SPRINT LOG, NOT A SPECIFICATION". A reader who takes it as spec builds overridden rulings (Part 2, PLAN.md).
- Verdict: **CONFIRMED STALE**.
- Sources: MAP Stale 1.

---

## Part 2. Every entry, grouped by the file that is stale

### Documents (.md)

**README.md**
- R1. `:603` PLAN.md "The specification". See D24. CONFIRMED STALE. (MAP 1)
- R2. `:346-352` cron table. See D2. CONFIRMED STALE. (MAP 2, code-16 26)
- R3. `:91,104` seventh principal "being built". See D21. CONFIRMED STALE. (MAP 3)

**docs/TAKEOVER.md**
- T1. `:965` PLAN.md "The specification. 5,425 lines". See D24. CONFIRMED STALE. (MAP 1)
- T2. `:414,952` "18 of the 106". NOT STALE by the grep measure (106 files, 18 without the word). (MAP 6)
- T3. "six" crons (per MAP 2): five are scheduled, six jobs exist. UNSURE which the sentence meant; not located by line. (MAP 2, code-16 26)

**docs/TRAPS.md**
- TR1. `:83` "19 of 101". CONFIRMED STALE. See D21. (MAP 6, code-15 13)
- TR2. T1 "Enforced by verify:sprint37l2 (C205)": detector `scripts/verify-sprint37l2.ts:270-276` scans only `^verify-.*\.ts$` and only a literal `.ts"`/`.tsx"` path inside `readFileSync(`; variable paths and `verify-sprint45.tsx` are invisible. CONFIRMED STALE (enforcement is partial). (code-14 2)

**HAZARDS.md**
- H1. `:152` every verifier refuses production. See D1. CONFIRMED STALE. (code-14 1)
- H2. `:231-235` "four do ... exactly those four". See D4. CONFIRMED STALE. (code-15 1, code-13, code-12 10)
- H3. H6 (`:35`) marked "live": `lib/audit.ts:129-130` routes a non-uuid id to `resource_key` centrally, so the 500 cannot happen through `audit()`. CONFIRMED STALE (should be fixed). (code-06 1)

**docs/THE-REDESIGN.md**
- RD1. s4 Phase 0 to 5 (`:370-400`: Phase 1 spine, Phase 2 admin consolidation, Phase 5 prove it) contradicts THE-PLAN's phases used by TAKEOVER s11. CONFIRMED STALE. (MAP 4)
- RD2. `:317-318,375` "32 pages, 153 controls" / "125 pages, 570 controls": inventory counts dated; not re-measured. UNSURE. (DOCS-digest 4 family)
- RD3. `:262-265` tasks #20 and #21 cited as live; neither is in the 38. UNSURE (see TASKS.md).

**docs/THE-PLAN.md**
- PL1. `:203-204` "Carried over and unscheduled: 52, 104, 105, 108": TAKEOVER s11 has 52, 105, 108, 156. 104 is in no current group. UNSURE (closed or silently dropped; ask the founder). (MAP 5)
- PL2. `:188-201` task table omits Phase 1 spine 163 to 167 and 156, and still lists Phase 3 (133 to 141). The Phase 3 row is flagged deleted at `:95-99`, so that half is admitted; the omissions are stale. CONFIRMED STALE.
- PL3. `:1` and `:192` "Phase 0 ... Nothing else starts until these are closed": all four are open (see TASKS.md). NOT STALE (still the rule).

**docs/PROVE-IT.md**
- PR1. `:182` three taps on `/for-patients`. See D21. CONFIRMED STALE. (MAP live-site)

**docs/DEMO-LOGINS.md**
- DL1. "fourteen KEEP tables hold every crisis line". NOT STALE: crisis lines live in `country_settings.crisis_line_label/tel/verified_at/verified_by` (`lib/db/schema.ts:3520-3527`), a KEEP table (`scripts/seed-demo.ts:71`). TAKEOVER's KEEP table not naming it is an omission, not a contradiction. (MAP 7, code-12 25)

**docs/VALUE-STATEMENTS.md**
- VS1. `:~270` "Three of these are at example.com". Generated from `_prove-doc.ts:162-167`. CONFIRMED STALE. See D21. (code-12 6)

**docs/BRAND.md** (DOCS-digest 5, list "Likely stale")
- B1. `:18` "`brand-500` `#1F5EFF` is the interactive colour": `app/globals.css:10,19` says brand-500 was #1F5EFF and IS now #2EC4B6. CONFIRMED STALE. (DOCS 1)
- B2. "teal Crisis Radar only": follows from B1. CONFIRMED STALE. (DOCS 1)
- B3. Design-system artifact Afso8BsBSLy992W1zYhk3B (blue era). UNSURE (external artifact, not opened). (DOCS 2)

**docs/EMAIL-DNS.md**
- E1. "What to add" section and `:30` SPF claim. UNSURE (DNS state is external; `scripts/verify-email-dns.ts:84-99` vs `:252-258` disagree with each other, code-13). (DOCS 3, code-13)

**docs/INVENTORY.md**
- I1. `:1,5` title "The admin side, as it is", "32 pages": generator (`scripts/inventory.ts:433`) covers seven portals. CONFIRMED STALE. (DOCS 4, code-12 24)

**docs/content-backup/**
- CB1. Backups are pre-rewrite (home had five `hero` blocks, now one `audiences` block, task 137); staging locales `en-x-staging`, `ar-x-staging` drifted; no gate compares. CONFIRMED STALE per `lib/content/defaults.ts:245` (Task 137 one hero); staging drift UNSURE (published rows not read). (DOCS 5)

**docs/FINANCIAL-PLAN.md**
- F1. `:374` "Cards" cost column while Egypt has no card processor. CONFIRMED STALE (manual transfer rail, `lib/billing/manual.ts`). (DOCS 6)
- F2. Competitor table `checkedOn 2026-09-19` with third-party prices. UNSURE (ages; public factual claim about competitors). (DOCS 7)

**docs/simulation/** (SIMULATION-digest s5; line references are the digest's, file prefixes 00 to 14, DEPLOY, PROMPT = `docs/SIMULATION-PROMPT.md`)
- SM1. Production state: 12:5-15 (wiped 2026-09-20) vs PROMPT:461-521, 00-START:324-327, DEPLOY:132-154, 14:170-192, 00-LESSONS:120-137 (seeded, 9 users). 12 is right; the others are CONFIRMED STALE. (SIM 1)
- SM2. Which pot drains (E1 vs E2), and E1 funded by transfer. UNSURE (plan internal, no run). (SIM 2)
- SM3. "Account on hold, ask HR" screen required by 01:215, 05:161, 09:73, 10:56,183, VS E5; declared nonexistent by 03:239 and PROMPT:925,1020. UNSURE (MAP Suspect 16, settle in code: booking path when `payFromPot` refuses). (SIM 3)
- SM4. Auto billing month 4 (03:219, 06:40) vs "nothing renews by itself" (PROMPT:1018). UNSURE; `vercel.json` billing is daily and the cron route runs renewals, so "no monthly cron" is at best loose. (SIM 4)
- SM5. Free first session bills $1 + $3 (03:32, PROMPT:416) vs waived (03:173). UNSURE (MAP live-site Suspect "first session free"). (SIM 5)
- SM6. Vault totals must equal (03:116) vs need not (PROMPT:1023). UNSURE. (SIM 6)
- SM7. /admin/usage as acceptance vs 30-day window. UNSURE. (SIM 7)
- SM8. 50-minute session L1 vs "no sessions longer than eight minutes". UNSURE. (SIM 8)
- SM9. Progression waves 07:26-30 vs PROMPT:805-807. UNSURE. (SIM 9)
- SM10. Seed "run it anyway" (01:52) vs "do not" (14:189, DEPLOY:150, PROMPT:669). See D3. CONFIRMED STALE. (SIM 10)
- SM11. Counts: documents "twelve"/"ten"/"fifteen" vs 17 on disk (`ls docs/simulation` shows 17 files, confirmed); walks "eleven" vs 12; gates 35 vs 28 (`scripts/_gates.ts` has 35 `name:` entries, so 28 is stale); clinicians "nine" vs 7; "sixty patients" vs 7; tables 122 vs 120. CONFIRMED STALE for documents and gates; others not recounted, UNSURE. (SIM 11)
- SM12. Patients sign in by phone and code vs "email and one password for every agent". UNSURE. (SIM 12)
- SM13. "every address at example.com" (00-START:263, 10:352, PROMPT:969) vs 24therapy.app and gmail inboxes on production. CONFIRMED STALE (`_demo-cast.ts:40-46`). (SIM 13)
- SM14. Ageing `--days 30` vs `--days 180`. See D3. CONFIRMED STALE (DEPLOY:166 read). (SIM 14)
- SM15. Timeline slips (T1, T5, E3, Layla, P7, E2-HR). UNSURE (plan internal). (SIM 15)
- SM16. Board guard: tv super_admin vs `requireManager()`. The page is founder only in effect (`lib/console/gate.ts:150` requires `super_admin`); board actions are `requireManager` (code-09 10). Docs saying requireManager for the page are STALE. CONFIRMED STALE. (SIM 16)
- SM17. Crisis line "filled in" (05:119) vs null by design (01:341). Egypt 105 now lives in `lib/crisis/line.ts` and `country_settings` (0088). UNSURE which is true on production. (SIM 17)
- SM18. Bank details typed on camera vs already filled. UNSURE. (SIM 18)
- SM19. Partial transfers "stop rather than part-pay" (04:80) vs RA7/RA9. Code: `grantSubscription` `continue`s past an invoice it cannot cover (`lib/billing/manual-grants.ts:437`). Doc and code comment both STALE. CONFIRMED STALE. (SIM 19, code-04 10)
- SM20. 570 EGP vs 1,140 EGP session. UNSURE. (SIM 20)
- SM21. One dev server vs run on production. CONFIRMED STALE (DEPLOY uses `on:production`). (SIM 21)
- SM22. Budget $4.80 planned + $5.20 left vs costs above $10. UNSURE. (SIM 22)
- SM23. AUTH_SECRET "64 hex" vs "32+". Code wants 32+ in production only (`lib/env.ts:230`). CONFIRMED STALE for "64 hex". (SIM 23)
- SM24. `verify:runbook` not holding archaeology and counts. UNSURE (gate not run). (SIM 24)
- SM25. Sample output presented as data (07:146-155, 08:121-129). CONFIRMED STALE by nature (the run never happened). (SIM 25)
- SM26. Churn labelling owner `verify:plan` vs `verify:finance`. UNSURE. (SIM 26)
- SM27. `docs/simulation/` as a whole: 17 documents about a run that never happened (TAKEOVER s12). CONFIRMED STALE (12-THE-LOGINS says so).

**PLAN.md** (PLAN-digest s0 and s2 SILENT items; each is stale text left beside a later ruling in the same file. Where I checked code, it is noted.)
- PN1. Header dead paths (`lib/ai/crisis.ts`, `lib/ai/descriptors.ts`, `lib/ai/patient-copilot.ts`, `scripts/_fk.ts`, `docs/screens/`, `docs/walkthrough*/`). CONFIRMED STALE (the header says so; `lib/crisis/` exists). (PLAN s0.1)
- PN2. 318 ticks retroactive; `[x]` is not evidence (55.4/55.5 ticked though deleted). CONFIRMED STALE as a status signal. (PLAN s0.2)
- PN3. C349 to C367 reused in sprints 69 to 73 with other meanings; any comment citing them is ambiguous. CONFIRMED STALE (collision). (PLAN s0.3)
- PN4. Build-log sprint titles differ from s4 content (43, 47, 48, 49, 51, 54, 59). UNSURE which verifier tests what. (PLAN s0.4)
- PN5. 0061 to 0065 "WAITING FOR THE PLANNING SESSION", never closed in text. UNSURE (needs production migration table). (PLAN s0.6)
- PN6. 1.8 "no code path can put a patient's payment anywhere but a clinician's own Stripe account" and s3c "we never touch it". CONFIRMED STALE (pot capture `platform`, manual rail; see D22). (PLAN s2.1)
- PN7. Sprint 17 copy "$4 ... No subscription, no seat fee", 17.4, 17.6, 46.4, 73.6 "$100". CONFIRMED STALE (Practice $80, Clinic $72/seat per `lib/finance/plans.ts:581-588`). (PLAN s2.2)
- PN8. s3 "In-person: Always free", s7 "first one free". CONFIRMED STALE vs C209 (fee on every session). Whether first-session-free survives is UNSURE. (PLAN s2.3)
- PN9. 48.6 "free window is the session". UNSURE. (PLAN s2.4)
- PN10. "We do not send it" (invite). CONFIRMED STALE: `invitePatient` notifies by email/WhatsApp (code-07:37). (PLAN s2.6)
- PN11. s3 step 4 redacted name `H••••• A•••••`. PARTLY: the challenge route shows the therapist only (`lib/data/challenge.ts:62-67`), but the sprint 6 match route still renders `redactedName` (`lib/data/claims.ts:120`, `components/patient/claim-flow.tsx:178`, mounted at `app/(patient)/patient/claim/page.tsx:105`). So s3 is still true for that route. NOT STALE (and a live inconsistency; see code-02 entry below). (PLAN s2.7)
- PN12. s3b/s6 "Sign-in accepts either handle plus the password" vs C119 password optional. UNSURE. (PLAN s2.8)
- PN13. s3 consent "Wants to turn it off: Cannot" and 7.8 one-way. CONFIRMED STALE (patient Stop button exists). (PLAN s2.9)
- PN14. Sprint 41 "pay, then the AI question" vs C281 consent-first kept. CONFIRMED STALE per C281. (PLAN s2.10)
- PN15. 41.8 bot joins at consent vs C216 scheduled lead time. UNSURE. (PLAN s2.11)
- PN16. 48.5 one sentence vs three by consent state. UNSURE. (PLAN s2.12)
- PN17. 47.6 and s6 "journals may never produce a risk level". CONFIRMED STALE: journals are risk-scanned (`lib/data/journals.ts`, `scanForCrisisLanguage` sets `riskLevel`). Same text in `lib/data/facts.ts:96-98`. (PLAN s2.13, code-02 13)
- PN18. s3f/54.9 "patient names and appointment times". CONFIRMED STALE vs C327: `clinicSchedule` gives first name plus last initial (code-02:91). Both conflict with VS C2. (PLAN s2.14)
- PN19. 54.7 clinic billed per session like a solo therapist. CONFIRMED STALE (seat plans, `lib/billing/seats.ts`). (PLAN s2.15)
- PN20. 58.7 six principals. CONFIRMED STALE (clinic staff built). (PLAN s2.16)
- PN21. 58.6 principal matrix text. UNSURE. (PLAN s2.17)
- PN22. s3e "a roster", "payer may see who is enrolled", 53.1, 53 Accept. PARTLY: C227 removed the approval roster, but `/sponsor/people` shows enrolled names (`sponsor.roster*` keys, `lib/data/sponsors.ts:92-107`). UNSURE which ruling the product follows (MAP Suspect 10). (PLAN s2.18)
- PN23. 53.3 below floor sponsor sees "the balance and nothing else". CONFIRMED STALE and worse: MAP Confirmed 5 (live totals beside the floored balance). (PLAN s2.19)
- PN24. 53.14 overdraft one session per patient. UNSURE. (PLAN s2.20)
- PN25. 53.21 "pays nothing". CONFIRMED STALE (`coverage_bps`, 0090). (PLAN s2.21)
- PN26. s3e VAT "as it always is". UNSURE. (PLAN s2.22)
- PN27. 53.10 "no new ledger accounts beyond the pot". CONFIRMED STALE (`vat_payable`, C391). (PLAN s2.23)
- PN28. Re-verification cadence 6 vs 3 months. Code: DB default 6 (`drizzle/0073:48`), schema.ts says 3. UNSURE which ruling stands; schema.ts is stale either way (see code-01). (PLAN s2.24)
- PN29. s3e partner API for HR, 55.4/55.5 ticked. CONFIRMED STALE (C397; `lib/partner/keys.ts:94-106`). (PLAN s2.25)
- PN30. s3 "VAT is not refunded". UNSURE (C396 says refund includes tax). (PLAN s2.27)
- PN31. s3c/16.x currency is a display choice. CONFIRMED STALE (C393, two currencies in `lib/billing/money.ts`). (PLAN s2.28)
- PN32. 16.4 `[x]` live rate vs PROVIDERS empty. UNSURE (not opened). (PLAN s2.29)
- PN33. s3d support correspondence emailed. UNSURE. (PLAN s2.30)
- PN34. 19.7/21.9 admin can add a language. UNSURE. (PLAN s2.31)
- PN35. Verification source of truth (s2.33): the "live contradiction" is resolved in the database: trigger 0083 forces `users.verification_status` to the derived value (`drizzle/0083_verification_one_truth.sql:108-121`). NOT STALE as a digest claim of history, but the contradiction itself is closed; only stale comments remain (code-02 1).
- PN36. s6 "Remove the loser, never wire both" vs C219 rewritten. UNSURE. (PLAN s2.34)
- PN37. 53.20 one log. UNSURE. (PLAN s2.35)
- PN38. C101 row still "open" vs C186 refuses duplicates. UNSURE. (PLAN s2.36)
- PN39. Sprint 41 ticked though blocked on 37.4. CONFIRMED STALE as a status. (PLAN s2.44)

### Code comments and copy: schema and migrations

**drizzle/**
- M1. `0012_radar_demo_ban.sql:3-6`: `demo` "exempt from the heartbeat expiry". CONFIRMED STALE: `lib/data/radar.ts:185-193, 692, 1245-1249` removed every demo exemption (founder ruling). (code-01)
- M2. `0040_repair.sql:45-104`: repair "forward" of the DO $$ blocks omits `person_invites_issuer_fk` and `person_invites_used_by_fk` (0034:54-55); only `person_invites_person_fk` is repaired (`:69`). CONFIRMED STALE (comment claims completeness). (code-01)
- M3. `0050_country_rails.sql:31-33` argues 10,000 bps; CHECK is 5000 (`:38`). CONFIRMED STALE. (code-01)
- M4. `0063_risk_findings.sql:10` `indicators` "(text[])"; column is jsonb (`0000:116`). CONFIRMED STALE. (code-01)
- M5. `0062_clinical_facts.sql:176-178` "evidence pointer must match the kind"; CHECK tests only the clinician branch, `ELSE true` (`:184-186`). CONFIRMED STALE. (code-01)
- M6. `0072_corporate.sql:189-196` "ONE IDENTIFIER, USED ONCE, EVER, across every sponsor"; hash salted per sponsor, 0085 adds a global index. CONFIRMED STALE (superseded by 0085). (code-01)
- M7. `0079_one_fk_per_column.sql` name reads schema-wide; fixes one column. NOT STALE (a name, and the header says which column). (code-01)
- M8. `0082_set_null_vs_check.sql:12-24` "an audit ... found six" and a permanent check in verify:sprint52; reader found at least four more pairs. UNSURE (the extra pairs are a Broken claim for the schema verifier). (code-01)
- M9. `0089_renewal_obligations.sql:37` "0088's rule decides which" currency; 0088 is the crisis line (`0088_a_crisis_line_per_country.sql`). CONFIRMED STALE. (code-01)

**lib/db/**
- DB1. `directory.ts:23-32` "a per-request Map" cache; no Map or cache in the file. CONFIRMED STALE. (code-01)
- DB2. `schema.ts:22` "22 tables"; 120. CONFIRMED STALE. (code-01)
- DB3. `schema.ts:300` "Soft signal only". See D16. CONFIRMED STALE. (code-01)
- DB4. `schema.ts:316-325` "We never hold their money". See D22. CONFIRMED STALE. (code-01)
- DB5. `schema.ts:3918-3923` phone "NOT VALID until sprint 22"; validated in 0054. CONFIRMED STALE (0054 validates the rules; reader). (code-01)
- DB6. `schema.ts:3755-3757, 4167-4169` "56 of 66 patients have no email and none has a phone": pre-purge measurement. Same in `components/patient/record-access.tsx:21-22`. CONFIRMED STALE (undated measurement of a database that was wiped). (code-01, code-10 7)
- DB7. `schema.ts:5138-5141` payout_requests `approved_by_user_id` "restrict, 0082"; DB is SET NULL (`0047_two_rails.sql:206`); 0082 changed `phone_change_requests`. CONFIRMED STALE. (code-01)
- DB8. `schema.ts:6541` `verify_cycle_months` default 3; DB default 6 (`0073:48,55`). CONFIRMED STALE. (code-01)
- DB9. `schema.ts:4164-4175` person_invites doc detached above claimAttempts; `:8542` orphaned ehrWritebacks doc. CONFIRMED STALE per reader (not reopened; cosmetic). (code-01)

### Code comments and copy: lib/data

- LD1. `admin.ts:132-139` "written to both places": trigger 0083 overwrites the direct write. CONFIRMED STALE. (code-02 1)
- LD2. `capital.ts:151-158` `monthRange` starts at first product event; `actuals.ts:480` includes `capital_contributions`. CONFIRMED STALE. (code-02 2)
- LD3. `challenge.ts:511-513`. See D13. CONFIRMED STALE. (code-02 3)
- LD4. `claims.ts:43-44`, `claim-flow.tsx:174-180` "show[s] a redacted name". NOT STALE: the match route still shows it (`claims.ts:120`, mounted `claim/page.tsx:105`). `challenge.ts:63-67` describes the challenge route, also true. The real finding is a design inconsistency (the route the challenge calls "one question too generous" still runs), which belongs in Broken or Suspect. (code-02 4)
- LD5. `enrolment-verify.ts:33-35` "re-enter their work address, which mints a new code": the same identifier fails the unique index and `enrol` returns "That could not be activated" (`enrolment.ts:400, 451`). CONFIRMED STALE. (code-02 5)
- LD6. `enrolment-verify.ts:222-225` roster dates carry no signal: `confirmEnrolmentCode` (`:200`) and `enrol` (`enrolment.ts:435`) stamp the person's own moment. CONFIRMED STALE. (code-02 6)
- LD7. `discover.ts:74` "not a fixture": demo filter removed (`:88-111`). CONFIRMED STALE (reader; consistent with M1). (code-02 7)
- LD8. `discover.ts:345` `RATING_BAR` "Used by the count query above": no count query. CONFIRMED STALE. (code-02 8)
- LD9. `feedback.ts:547-548` "A day for the first, three for the second": first is a warning (`:856`, `prior === 0 ? null`). CONFIRMED STALE. (code-02 9, task 122)
- LD10. `export.ts:50-52,204,256`. See D15. CONFIRMED STALE. (code-02 10)
- LD11. `export.ts:98` "A clinician may only do this for their own caseload": callers are only `admin/actions.ts:586` and `admin/tv/actions.ts:42`. CONFIRMED STALE (no clinician path). (code-02 11)
- LD12. `documents.ts:55-57` "A deleted document leaves a hole": no delete function in the module. UNSURE (true of the design; no deleter today, so moot). (code-02 12)
- LD13. `facts.ts:96-98` journals never a risk level. CONFIRMED STALE. See PN17. (code-02 13)
- LD14. `checkins.ts:39-41` "A claimed account means ... agreed to the consent question": query needs only a live `patient_accounts` row (`:58-66`), no `claimed_at` or consent column. CONFIRMED STALE. (code-02 14)
- LD15. `clinic.ts:30-31` "a list of patient names with appointment times" vs VS C2. NOT STALE code; a stale or broken promise (MAP contradiction 1). (code-02 15)
- LD16. `ehr.ts:30-32` "a solo clinician from settings ... no second case": `app/(app)/settings/records/page.tsx:32-37` checks `isClinicOrganization` and tells a solo practice to use something else (67.1). CONFIRMED STALE. (code-02 16)
- LD17. `notices.ts:78` `undismissedCount` "Drives the badge": no caller. CONFIRMED STALE. (code-03)
- LD18. `notifications.ts:21-29` "never marked read" is fixed: `markAllRead` has no caller. CONFIRMED STALE. (code-03)
- LD19. `patients.ts:294` JSDoc above nothing (function removed, `:295-304`). CONFIRMED STALE. (code-03)
- LD20. `patient-view.ts:293-296` "caller passes a zone-bucketed comparison": `groupOf` takes `{at, now, scheduled, fromRadar}` (`:298-303`). CONFIRMED STALE. (code-03)
- LD21. `vault.ts:23-31` metrics derived from the ledger: no `ledger_entries` read; `cost_cents` abandoned. CONFIRMED STALE. (code-03)
- LD22. `vault.ts:421-423` MRR `payingOrgs * 9900` for a plan that no longer exists. CONFIRMED STALE. (code-03)
- LD23. `taxonomy.ts:231` cites `radar.ts:201`; `BOARD_TTL_MS` is at `:250`. CONFIRMED STALE. (code-03)
- LD24. `timezone.ts:20-22` reminder cron "runs at 03:20": hourly `20 * * * *`. CONFIRMED STALE. (code-03)
- LD25. `people.ts:193-199`, `sessions.ts:291-300` detached JSDoc. CONFIRMED STALE. (code-03)
- LD26. `support.ts:563-569` "Every successful read is audited": only the caller audits. CONFIRMED STALE per reader (the function itself was read, no audit call in the snippet). (code-03)
- LD27. `sponsor-integrations.ts:296-306` "failed the identifier check": query counts unanswered attestations (`:328-333`). CONFIRMED STALE. (code-03)

### lib/billing, lib/settings, lib/finance

- LB1. `manual-grants.ts:74-75` cancelled session "NOT quietly revived": WHERE checks only `paymentStatus = 'pending'` (`:82-83`); cancel sets `status` and leaves `payment_status` (`lib/data/sessions.ts:668`). CONFIRMED STALE. (code-03)
- LB2. `pending.ts:117-124` "`awaiting_proof` IS EXCLUDED": included (`:139`), next comment says so. CONFIRMED STALE. (code-04 1)
- LB3. `payment-notices.ts:44-46`. See D10. CONFIRMED STALE. (code-04 2)
- LB4. `manual.ts:478-481`, `manual-grants.ts:18-19, 518-520, 612` "an operator can re-run a grant": no re-run path. CONFIRMED STALE per reader (the manual.ts line read; no re-run action found in `admin/transfers/actions.ts`). (code-04 4)
- LB5. `payment-notices.ts:68-72` "Admins only": query takes the first `sponsor_users` row with no role filter (`:73-77`). CONFIRMED STALE. (code-04 5)
- LB6. `money.ts:236-240` no pot money in the Egyptian entity: `grantPotTopUp` credits Egyptian sponsors by transfer (`manual-grants.ts:527+`, entity read at `:550`). CONFIRMED STALE. (code-04 6)
- LB7. `invoice.ts:193-197` "the only entity it accepts is `us`". CONFIRMED STALE (as LB6). (code-04 7)
- LB8. `lib/settings/defs.ts:336-338` "The Egyptian half is here and unreachable". CONFIRMED STALE (as LB6). (code-04 8)
- LB9. `manual.ts:222-231` "the floor is $5,000": `minTopUpCents` 10_000 ($100, `defs.ts:654`). CONFIRMED STALE. (code-04 9)
- LB10. `manual-grants.ts:408-412` "IT STOPS RATHER THAN PART-PAYING" oldest first: `continue` (`:437`) skips and may settle a newer smaller invoice. CONFIRMED STALE. (code-04 10, SIM 19)
- LB11. `session-owed.ts:61-65` "ordering by creation and taking the first" and "A refund writes its own row". CONFIRMED STALE per reader (comment read; ORDER BY absence not rechecked). (code-04 11)
- LB12. `pot.ts:470` "`balance + overdraft >= gross`": code compares `sponsorShare` (`:491`). CONFIRMED STALE. (code-04 12)
- LB13. `defs.ts:804-807` "the caller does not apply" a negative proration: `seats.ts:161-168` applies it as a discount. `defs.ts:1783` "VAT rounds up": `Math.round` (`:1777`). `:1643-1671` orphaned `vatOn` doc; `:1174-1180` step not enforced (not rechecked). CONFIRMED STALE (first two checked). (code-04 13)
- LB14. `connect.ts:739-744` held-capture branch dead: `capture` is `"destination" as const` (`:441`). CONFIRMED STALE. (code-04 14)
- LB15. Uncalled exports: `stripe.ts` `createCreditCheckout`, `ledger.ts:748` `postEntityTransfer`, `money.ts:78` `egpSettlement`, purpose `payg_session`. UNSURE (dead code rather than a stale statement; not regrepped). (code-04 15)
- LB16. `payouts.ts:525,551` `owner` built then voided; `ownerName: null` (`:570`). CONFIRMED STALE. (code-04 16)
- LB17. `lib/finance/plans.ts` PROVENANCE vs values (arrivals, headers in EGP, `payg.perSessionUsd` "$4 ... alternative to the $100 plan" beside $80). CONFIRMED STALE (lines 575-588 read). (code-04 17)
- LB18. `lib/finance/beta.ts:435` "AI runs on every session" while multiplying by `consentRate`; `:414` "every PAID session". CONFIRMED STALE (435 read). (code-04 18)
- LB19. `lib/finance/store.ts:4-8` no module can "reach" `platform_settings`: `benchmark.ts:103` reads it via `getSettings`. UNSURE: the sentence is about writing ("A forecast that can move a price"); a read does not contradict it. (code-04 19)
- LB20. `lib/finance/scenarios.ts:112-122` fees typed as constants and labelled measured from `platform_settings`. CONFIRMED STALE. (code-04 20)

### lib/ai, lib/audio, lib/crisis, lib/clinical, lib/consent, lib/ehr, lib/integrations, lib/meetings, lib/mail, lib/partner, lib/session-clock

- LA1. `lib/ai/case-copilot.ts:354-365, 456-457` C373 bound applied to `profileFor`: `void before;`. CONFIRMED STALE. (code-05 1)
- LA2. `lib/audio/recorder.ts:53-66,99`. See D11. CONFIRMED STALE. (code-05 2)
- LA3. `lib/crisis/alerts.ts:50-52` "imported by exactly one caller": importers include `lib/data/transcript.ts`, `session-risk.ts`, `journals.ts`, `lib/checkins/receive.ts`, `lib/session-finish.ts`, the cron route. CONFIRMED STALE. (code-05 3)
- LA4. `lib/crisis/alerts.ts:410` "detected in a live session": also used for check-in replies (`receive.ts:82`). CONFIRMED STALE per reader. (code-05 4)
- LA5. `lib/clinical/context.ts:88-108` "the note generator is sent no diagnoses at all": `lib/ai/notes.ts:113-115` sends "Working diagnoses". CONFIRMED STALE. (code-05 5)
- LA6. `lib/consent.ts:2`, `lib/ehr/policy.ts:90`. See D9. CONFIRMED STALE. (code-05 6)
- LA7. `lib/ehr/owner.ts:6-18` picks the owner "in one place": only `whatIsMissing` exists; `ConnectionOwner` unused (grep). CONFIRMED STALE. (code-05 7)
- LA8. `lib/ehr/file-note.ts:36-41,181-189` author "the clinician or nobody": `authorReference: null` always (`:205`). CONFIRMED STALE. (code-05 8)
- LA9. `lib/ehr/smart.ts:185-191` scope re-check refuses whole-chart tokens; `vendors.ts:106-117` refuses only `*`, `user/`, v1 writes. UNSURE (not reopened; code-05 Broken 9 owns it). (code-05 9)
- LA10. `lib/integrations/registry.ts:71` in-person consent asked; `:147` "the note you approve is filed back" (`fileNote` has no caller, grep). See D9. CONFIRMED STALE. (code-05 10)
- LA11. `lib/meetings/recall.ts:56` "Ours, signed". See D12. CONFIRMED STALE. (code-05 11)
- LA12. `lib/mail.ts:432-438,460`. See D15. CONFIRMED STALE. (code-05 12)
- LA13. `lib/mail-previews.ts:143-145` copy "lifted from those call sites": check-in preview (`:370-379`) differs from `lib/checkins/send.ts:124`; "therapist message" labelled `patient`. CONFIRMED STALE per reader (not reopened). Task 108 territory. (code-05 13)
- LA14. `lib/partner/api.ts:441-452` `isNull(revokedAt)` in `resolveSubject` "closes ... deliverNote": `deliverableNote` (`:348`) never calls `resolveSubject` (callers `:90, :188, :477`). CONFIRMED STALE. (code-05 14)
- LA15. `lib/partner/media.ts:25-36` consent boundary: `fromSeconds` declared (`:43`) and never read. CONFIRMED STALE. (code-05 15)
- LA16. `lib/partner/keys.ts:167-170` `lastUsedAt` written on scope failures: written after the scope check (`:338-345`). CONFIRMED STALE. (code-05 16)
- LA17. `lib/partner/launch.ts:65-67` "no credential of ours in their hands". UNSURE (an argument about the launch URL; code-05 Suspect 1). (code-05 17)
- LA18. `lib/session-clock.ts:116-121` off record has no last segment: true only if off record from the start. CONFIRMED STALE (partial). (code-05 18)
- LA19. `lib/diarisation/align.ts`, `lib/transcript/descriptors.ts` assume real segment windows; production windows are `(seq-1)*8000` to `seq*8000`. UNSURE (an assumption, not a statement; code-05 Broken 5). (code-05 19)

### lib/auth, lib/env, lib/content, lib/console, lib/i18n, lib/lifecycle, lib/patient-auth, lib/uploads, lib/scheduling, lib/observability, lib/marketing, lib/geo, lib/rate-limit, middleware, root files

- LX1. `lib/audit.ts` vs HAZARDS H6. See H3. CONFIRMED STALE. (code-06 1)
- LX2. `lib/auth/session.ts:155` "checked in the same read" then a second query (`:156-164`). CONFIRMED STALE. (code-06 2)
- LX3. `lib/env.ts:222`. See D17. CONFIRMED STALE. (code-06 3)
- LX4. `lib/content/sanitise.ts:220-226` invoice-discount docstring with no function. CONFIRMED STALE. (code-06 4)
- LX5. `lib/content/defaults.ts:1193` hipaa page. See D9. CONFIRMED STALE. (code-06 5)
- LX6. `lib/console/pot-trace.ts:46-50, 59-62` patient reference "LINKS": `patientHref: null`, ref is a session id prefix (`:129-130`). CONFIRMED STALE. (code-06 6, code-09 22)
- LX7. `lib/i18n/strings.ts:57` `SAFETY_PREFIXES` includes `"recording."`; zero keys start with it. CONFIRMED STALE. (code-06 7)
- LX8. `lib/i18n/messages.ts:1152` `jconsent.cannotUndo`. See D23. CONFIRMED STALE. (code-06 8)
- LX9. `lib/i18n/messages.ts:1489` "C227 removed the roster" while `sponsor.roster*` keys (`:1432-1433, 1565`) render a roster. CONFIRMED STALE (or the roster contradicts C227; MAP Suspect 10). (code-06 9)
- LX10. `lib/i18n/messages.ts:2576` vs `:2939` two copilot allowance models. CONFIRMED STALE (one of them; `tcop.exhaustedBody` "Unlimited removes the cap" names a plan model that changed). (code-06 10)
- LX11. `lib/lifecycle/machines.ts:350-374` grant machine names entity `benefit_grants`: no such table. CONFIRMED STALE. (code-06 11)
- LX12. `lib/lifecycle/machines.ts:386-390` held sponsor screen "the company portal": held sponsors cannot sign in (`lib/sponsor-auth/session.ts:117-118`). CONFIRMED STALE. (code-06 12)
- LX13. `lib/lifecycle/machines.ts:130-149` clinic-endorsement payout state that does not exist. UNSURE (the comment admits it; a spec in a verifier input). (code-06 13)
- LX14. `lib/patient-auth/session.ts:29` "A shorter window" introducing longer limits. CONFIRMED STALE. (code-06 14)
- LX15. `lib/patient-auth/actions.ts:143-148` "same wording as a wrong password": `:150` vs `:282` differ. CONFIRMED STALE. (code-06 15)
- LX16. `lib/patient-auth/actions.ts:213-216, 266-276` equal timing. UNSURE (code-06 Broken; timing needs a run). (code-06 16)
- LX17. `lib/patient-auth/handle.ts:178-182` email code proves the address not the number. UNSURE (not reopened). (code-06 17)
- LX18. `lib/uploads.ts:20,143` "32-byte": `randomBytes(24)` (`:168`). `:55-57` avatar through an authenticated route (not rechecked). CONFIRMED STALE (first half). (code-06 18)
- LX19. `lib/scheduling/hours.ts:21-26` `nextHour` two identical branches. CONFIRMED (dead branch, not a statement). (code-06 19)
- LX20. `lib/observability/errors.ts:26-27` "same access control and retention as the record": errors are 30-day and staff-readable. CONFIRMED STALE per reader (comment read). (code-06 20)
- LX21. `lib/auth/guard.ts:145-153` "no screen behind this guard queries a clinical table". UNSURE: true of `requireStaff` screens; false if `requireManager` (tv board) counts as this guard. See D14. (code-06 21)
- LX22. `lib/marketing/fixtures.ts:199-204` self-contradicting description of `sponsors.ts:96`. UNSURE (not reopened). (code-06 22)
- LX23. `lib/content/demo.ts:231` "never has been" a demo row: undated. UNSURE (needs the database). (code-06 23)
- LX24. `lib/geo.ts:240-244` neutral globe vs US/Egypt flags. UNSURE (not reopened). (code-06 24)
- LX25. `lib/i18n/config.ts:52-58` Western digits vs hard-coded Eastern digits in Arabic strings. UNSURE (not reopened). (code-06 25)
- LX26. `middleware.ts:193-194` matcher comment names two API reasons; excludes all `/api/`. CONFIRMED STALE. (code-06 26)
- LX27. `lib/rate-limit.ts:304-310` `purgeExpiredLimits` uses `new Date()`, the two-clock defect. CONFIRMED (a leftover, not a statement). (code-06 27)
- LX28. `mock-run.ts` referenced by nothing outside takeover/. CONFIRMED (dead file). (code-06 28)

### app/ (routes and actions)

- AP1. `app/api/cron/[job]/route.ts:31` "Four jobs, three of them on a clock"; `:81-84` "went to nothing at all". Six jobs, five scheduled. CONFIRMED STALE. (code-07 1)
- AP2. Same file `:99-102` "An hour late is fine" for the abandoned-patient backstop; daily at 03:00. CONFIRMED STALE. (code-07 2, code-03)
- AP3. Same file `:337` check-ins "runs HOURLY like the rest"; billing is daily 03:05. CONFIRMED STALE. (code-07 3)
- AP4. Same file `:375-391` two stacked docblocks for `radar`; `:423-434` extract doc above reminders; `extract` (`:604`) has none. CONFIRMED STALE. (code-07 4)
- AP5. `app/api/revalidate/route.ts:55-57` "Length-independent comparison": early-exit `!==`. `:31` vs `:33` contradict on timers. CONFIRMED STALE. (code-07 5)
- AP6. `app/api/sessions/[id]/state/route.ts:25-27` polled "only while it is waiting": polled all session, ends sessions. CONFIRMED STALE. (code-07 6)
- AP7. `app/(app)/sessions/actions.ts:242-245` `recordingPausedAt` "is what `answerConsent` and the transcript webhook both already read": the room path reads nothing (MAP Confirmed 4b). CONFIRMED STALE. (code-07 7)
- AP8. `app/join/[token]/actions.ts:768-769` "the 24Therapy room stops sending it": nothing makes it stop (MAP Confirmed 4b). CONFIRMED STALE. (code-07 8)
- AP9. `app/actions/locale.ts:17` "patients here never have an account". CONFIRMED STALE (`/patient/login` exists). (code-07 9)
- AP10. `app/records/[token]/route.ts:53-54` "Ask your therapist to send it again": only admins can send (`admin/actions.ts:586`, `tv/actions.ts:42`; see LD11). CONFIRMED STALE (patient-facing dead end). (code-07 10)
- AP11. `app/api/partner/v1/launch/route.ts:37-40` "NO SCOPE": `:49` requires `record:read` (the next comment admits it). CONFIRMED STALE. (code-07 11)
- AP12. `app/api/partner/v1/sessions/[ref]/summary/route.ts:39` draft "from `patientBrief` and `patientSteps`": written from the transcript (`:73-74`). CONFIRMED STALE. (code-07 12)
- AP13. `app/pay/[token]/actions.ts:125-127` recomputed "from `sessions.price_cents`". NOT STALE for the card path: `createSessionPaymentCheckout` still uses `row.session.priceCents` (`lib/billing/connect.ts:402, 477`). The transfer rail uses `patientOwesFor`, which this comment does not describe. (code-07 13)
- AP14. `app/(app)/patients/[id]/homework/actions.ts:60,80`, `assessments/actions.ts:68` revalidate routes with no page (only `actions.ts` in those directories); UI lives on `/documents`. CONFIRMED STALE. (code-07 14)
- AP15. `components/scheduling/calendar.tsx:330-336` "cancelled with a message, elsewhere": only `/on-call` cancels, no link. CONFIRMED STALE per reader. Task 131. (code-07 15)
- AP16. `app/(partner)/partner/actions.ts:35-39` "`mintKey` refuses `employment:verify`": removed 2026-09-14 (`lib/partner/keys.ts:94-106`). CONFIRMED STALE. (code-08 1)
- AP17. `app/(partner)/partner/actions.ts:81-94` "who raised it ... has to come from a row": audit `actor: null`. CONFIRMED STALE per reader. (code-08 2)
- AP18. `app/(patient)/patient/consent/page.tsx:187` `consent.canKeep`: renders `consent.mayKeep` (`:119`). CONFIRMED STALE. (code-08 3)
- AP19. `app/(patient)/patient/messages/page.tsx:39` reached from the account screen: no link anywhere (grep finds only action imports). CONFIRMED STALE (a screen with no door). (code-08 4)
- AP20. `app/(patient)/patient/notices/page.tsx:33` "main view": no link, one caller. CONFIRMED STALE. (code-08 5)
- AP21. `app/(patient)/layout.tsx:10-12` radar not in this route group: `/patient/radar` is. CONFIRMED STALE. (code-08 6)
- AP22. `app/(clinic)/clinic/export/route.ts:46-50` "shows one week at a time": export is minus 90 to plus 90 days. CONFIRMED STALE. (code-08 7)
- AP23. `app/(public)/developers/page.tsx:12`, `devs.body` (`messages.ts:2209`) "Five things": three render. CONFIRMED STALE per reader (public copy). (code-08 8)
- AP24. `app/(public)/integrations/page.tsx:49-50` `/developers` generated from API constants: hand-typed. CONFIRMED STALE per reader. (code-08 9)
- AP25. `app/(public)/integrations/page.tsx:168` "There is no self-serve key": sandbox keys are self-serve (`lib/partner/keys.ts:108-113`). `:199` "Nothing is signed with a shared secret": webhooks hand out a signing secret. CONFIRMED STALE (public copy). (code-08 10)
- AP26. `app/(public)/design/page.tsx:200-206` "six items" of a five-item list. UNSURE (not reopened; `/design` is replaced by task 174). (code-08 11)
- AP27. `app/(public)/design/patient/page.tsx:94-99` "Four tabs": shipped bar has five (`components/patient/bottom-nav.tsx:59-65`). CONFIRMED STALE per reader (superseded by 174). (code-08 12)
- AP28. `app/(public)/design/patient/sample/page.tsx:85` "SOS ... on every screen": none drawn. UNSURE (not reopened; 174). (code-08 13)
- AP29. `app/globals.css:62,64` 3.22:1 and 7.71:1 vs table 3.34 and 7.27. UNSURE (not recomputed). (code-08 14)
- AP30. `app/(public)/design/*` unused imports. CONFIRMED per reader (dead code). (code-08 15)
- AP31. `app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx:12-24` "NO GUARD": `lib/routing.ts:299` opens only `/sponsor/apply`, so the router guards this page and an IT contact with no account cannot use the link. CONFIRMED STALE (and a Broken: the mailbox proof is shut). (code-08 16)
- AP32. `app/(public)/design/clinic/page.tsx:159` wireframe B "No patient names": the built Option A shows names. CONFIRMED STALE per reader (C2). (code-08 17)
- AP33. `app/(admin)/layout.tsx:46-48` nav "nobody is shown a door that will bounce them": eight bounce. CONFIRMED STALE per reader (code-09 Broken 1). (code-09 1)
- AP34. `app/(admin)/layout.tsx:221-229` 76.53 fixed the bounce for two items; Audit, Usage, Errors, Ratings still bounce. UNSURE (not reopened). (code-09 2)
- AP35. `app/(admin)/admin/actions.ts:571-573` "The clinician is told". See D15. CONFIRMED STALE. (code-09 3)
- AP36. `app/(admin)/admin/actions.ts:566-569` admin never sees it: true here, false for tv. See D15. CONFIRMED STALE (as a general claim). (code-09 4)
- AP37. `app/(admin)/admin/actions.ts:618-624` switching off never hides clinicians: false for countries (`taxonomy/page.tsx:25-27`). UNSURE (not reopened). (code-09 5)
- AP38. `app/(admin)/admin/audit/page.tsx:59-66` four actors: patient actors render as "system". CONFIRMED STALE per reader. (code-09 6)
- AP39. `app/(admin)/admin/verifications/page.tsx:33` "This page is super-admin only was true": past tense, and the sentence says it "was never the thing protecting the file". NOT STALE. (code-09 7)
- AP40. `app/(admin)/admin/therapists/page.tsx:20`. See D16. CONFIRMED STALE. (code-09 8)
- AP41. `app/(admin)/admin/settings/actions.ts:466-468`, `components/admin/settings-editor.tsx:298-299` "Five admin pages are behind requireStaff() and /admin/tv is behind requireManager()": seven pages plus the receipt route; tv is founder only (`lib/console/gate.ts:150`). CONFIRMED STALE. (code-09 9)
- AP42. `app/(admin)/admin/tv/board-actions.ts:35` "the same guard as the page": page is founder only, actions are manager. CONFIRMED STALE. (code-09 10)
- AP43. `app/(admin)/admin/tv/actions.ts:33-35` clinician notified. See D15. CONFIRMED STALE. (code-09 11)
- AP44. Admin radar "only route to a transcript". See D14. CONFIRMED STALE. (code-09 12)
- AP45. `app/(admin)/admin/payouts/actions.ts:18` "The 24/7 team's four buttons": every one `requireRole("super_admin")` (`:27, 45, 70`). CONFIRMED STALE. (code-09 15)
- AP46. `app/(admin)/admin/transfers/actions.ts:72`. See D10. CONFIRMED STALE. (code-09 16, code-04 3)
- AP47. `app/(admin)/admin/clinics/actions.ts:20-23`, `components/admin/clinic-manager.tsx:30-32` `/admin/verifications` "the one path that exists": `verifyUser` is a second path (`clinician-row.tsx:62`, `therapist-panel.tsx:801`). CONFIRMED STALE per reader. (code-09 19)
- AP48. `app/(admin)/admin/page.tsx:88` "Stripe is the ledger of record": the Egyptian rail has no processor. CONFIRMED STALE. (code-09 20)
- AP49. `app/(admin)/admin/settings/actions.ts:405`, `transfer-fields-editor.tsx:79-80` "Clear the transfers queue first": open carts count and the console cannot clear them. CONFIRMED STALE per reader (task 52 blocker). (code-09 23)

### components/

- C1. `components/admin/gate.tsx:29` "every read is recorded". See D14. CONFIRMED STALE per reader. (code-09 13)
- C2. `components/admin/total-view.tsx:181` "Nothing here can be edited". See D14. CONFIRMED STALE per reader. (code-09 14)
- C3. `components/admin/support-queue.tsx:226` "Open it to read what they wrote": no open control. CONFIRMED STALE per reader. (code-09 17)
- C4. `components/admin/sponsor-manager.tsx:291` "Admin can remove somebody": no remove control. CONFIRMED STALE per reader. (code-09 18)
- C5. `components/admin/position-card.tsx:23` the table "still says CASH": `financial-model.tsx:446` says Cash, `actuals-table.tsx:136` says Trading. UNSURE which table sits below the card. (code-09 21)
- C6. `components/join/consent-controls.tsx:12-18` one-way. See D23. CONFIRMED STALE. (code-10 1)
- C7. `components/auth/forms.tsx:56-64` "every one of them carries the way out" (four pages): `PatientDoor` renders at `:280, :307` only. CONFIRMED STALE. (code-10 2)
- C8. `components/auth/auth-shell.tsx:199-204` omit title vs empty h1. UNSURE (not reopened). (code-10 3)
- C9. `components/session/cancel-session.tsx:34-35` "clicking anywhere else disarms it": no such handler. CONFIRMED STALE per reader. (code-10 4)
- C10. `components/scheduling/booking-calendar.tsx:19-21` `toLocaleTimeString` with no locale: code uses `formatTime`/`formatWhen` with a zone. CONFIRMED STALE per reader. `:25-26` Resend unverified, no WhatsApp key: undated environment claim, UNSURE. (code-10 5, 6)
- C11. `components/patient/record-access.tsx:21-22` "56 of 66". See DB6. CONFIRMED STALE. (code-10 7)
- C12. `components/patient/chrome.tsx:76-79` UNDER the SOS orb "which is why it is rendered before it": z-index decides (60 vs 70). CONFIRMED STALE (reasoning wrong, result right). (code-10 8)
- C13. `components/patient/back.tsx:30-33` cost is one extra tap: `router.back()` can leave the site. UNSURE (not reopened). (code-10 9)
- C14. `components/patient/category-grid.tsx:70-74` "A prefix match": `key.includes` (`:75`). CONFIRMED STALE. (code-10 10)
- C15. `components/session/new-session-form.tsx:55` orphaned doc; `:184-186` see D8. CONFIRMED STALE. (code-10 11, 12)
- C16. `components/copilot/chat.tsx:693,803,859` unused `locale`; `components/join/join-flow.tsx:5,10` unused imports; `components/patient/invite-flow.tsx:34-51` unreachable card; `components/clinical/transcript-panel.tsx:147` dead ternary. CONFIRMED per reader (dead code, not statements). (code-10 13 to 16)
- C17. `components/session/session-room.tsx:561` banner "no audio is being kept". UNSURE: true while the clinician's own off-record mute holds (MAP Confirmed 4: that toggle does mute locally); the server would accept audio if sent. (code-10 17)
- C18. `components/billing/payment-history.tsx:46-50` card brand and last four are here: removed (`:13-22, 92-98`). CONFIRMED STALE. (code-11)
- C19. `components/billing/pending-bar.tsx:179-181` red for unfinished business: both amber. CONFIRMED STALE per reader. (code-11)
- C20. `components/billing/withdraw.tsx:14` "an English-only surface": strings go through `t()`. CONFIRMED STALE per reader. (code-11)
- C21. `components/clinic/chrome.tsx:14` "THREE DESTINATIONS", `:48` "a fourth": six tabs. CONFIRMED STALE. (code-11)
- C22. `components/partner/chrome.tsx:13` "FOUR DESTINATIONS": five tabs (`:32-37`). CONFIRMED STALE. (code-11)
- C23. `components/sponsor/chrome.tsx:11` "Five destinations": seven. CONFIRMED STALE. (code-11)
- C24. `components/partner/key-list.tsx:70-75,183` sponsor picker not rendered. CONFIRMED STALE per reader. (code-11)
- C25. `components/partner/webhook-list.tsx:22-26` signing scheme printed: only the secret. CONFIRMED STALE per reader. (code-11)
- C26. `components/demo/component-showcase.tsx:12-17` every one is the real component: two are mockups. CONFIRMED STALE per reader. (code-11)
- C27. `components/demo/device-frame.tsx:165-171` fallback TABS pre-Option-A. CONFIRMED STALE per reader. (code-11)
- C28. `components/demo/session-demo.tsx:28-35` a client component cannot read the dictionary: `useT()` is used. CONFIRMED STALE per reader. (code-11)
- C29. `components/public/audience-demos.tsx:13-16,77-78` imports `TherapistCard`, fixtures: neither. CONFIRMED STALE per reader. (code-11)
- C30. `components/public/audience-page.tsx:14-19`, `blocks.tsx:545-556` `Features` discards `item.body`: rendered at `:575-577`. CONFIRMED STALE per reader. (code-11)
- C31. `components/public/audience-rotator.tsx:42-45` screen readers get all four headlines: inactive three are `aria-hidden`/`inert`. CONFIRMED STALE per reader (accessibility claim). (code-11)
- C32. `components/public/how-it-works.tsx:39` hard-coded "[ 02 ]". CONFIRMED per reader. (code-11)
- C33. `components/money/price-tag.tsx:52-54` en-US "until 19.4". CONFIRMED STALE per reader. (code-11)
- C34. `components/notes/provenance.tsx:32-37` C213: `NoteOrigin` ignores `offRecordSeconds`. CONFIRMED STALE per reader. (code-11)
- C35. `components/radar/therapist-console.tsx:30-31` `PING_MS` unused. CONFIRMED per reader. (code-11)
- C36. `components/radar/types.ts:65` "Every card ... carries a label": only TherapistCard. CONFIRMED STALE per reader. (code-11)
- C37. `components/sponsor/top-up-form.tsx:29` names `EgpSettlement`: no such component (grep: only this comment). CONFIRMED STALE. (code-11)
- C38. `components/support/therapist-support.tsx:17-19` topic list vs `TOPICS`. CONFIRMED STALE per reader. (code-11)
- C39. `components/visual/primitives.tsx:9` "Six primitives": nine exported. CONFIRMED STALE. (code-11)
- C40. `components/design/wire.tsx:208-217` words must be props: literals in the file. CONFIRMED STALE per reader. (code-11)
- C41. `components/ehr/records-panel.tsx` and clinic/partner/sponsor forms: "Working…" literals; the i18n ratchet (H23) cannot see ternaries. CONFIRMED STALE per reader (ratchet blind spot). (code-11)

### scripts/ (non-verifier)

- SC1. `_cast.ts:25-31` "Three people are seeded": SEEDED is seven. CONFIRMED STALE. (code-12 1)
- SC2. `_cast.ts:64-81` patient email cannot exist; CAST gives P1 to P7 an email. CONFIRMED STALE per reader. (code-12 2)
- SC3. `_content-ready.ts:42` `AWAITS = "22.8b"`. CONFIRMED STALE (every content skip names a long-past step). (code-12 3)
- SC4. `_dashes.ts:21-22` `lib/i18n/config.ts` allowed: `ALLOWED` (`:40-44`) omits it. CONFIRMED STALE. (code-12 4)
- SC5. `_demo-cast.ts`, `seed-demo.ts:2`, `logins.ts:198` counts. See D21. CONFIRMED STALE. (code-12 5)
- SC6. `_prove-doc.ts:162-167`. See D21. CONFIRMED STALE. (code-12 6)
- SC7. `_gates.ts:386-430, 511-533` comments above the wrong entries; `:491-510` "eighty-one ... twelve ... seventy-nine" vs 35 gates; `gates.ts:21-34` "these four" vs 35. CONFIRMED STALE (35 `name:` entries). (code-12 7)
- SC8. `_surfaces.ts:308-334` four "Zero callers" now have callers; `:146` `../` imports followed. CONFIRMED STALE per reader. (code-12 8)
- SC9. `_stub-empty.ts:1-3`, `_stub-link.tsx:1-2` "used only by ...": loaded for about 20 scripts via `_render-preload.mjs`. CONFIRMED STALE per reader. (code-12 9)
- SC10. `_verify.ts:189,206` "the five". See D4. CONFIRMED STALE. (code-12 10)
- SC11. `demo.ts:12-15` `demo` exempts from heartbeat; "Nothing else sets that column". CONFIRMED STALE (see M1; `seed-demo.ts` writes demo rows). Note `seed-demo.ts:458-461` relies on `reachable()` exempting demo rows, which is now false: seeded demo clinicians appear only while their heartbeat is live. (code-12 11, MAP Suspect 2)
- SC12. `migrate.ts:79-80`. See D18. CONFIRMED STALE. (code-12 12)
- SC13. `on-production.ts:114-116` snapshot "holds the six month simulation": production held only the starting position (`:124-128`, `logins.ts:18-24`, 12-THE-LOGINS). CONFIRMED STALE. (code-12 13)
- SC14. `seed-demo.ts:196-199`. See D19. CONFIRMED STALE. (code-12 14)
- SC15. `seed-demo.ts:31-37` "every cent is posted": 14 sessions written `paid` with no payment. UNSURE (reader Suspect; count not rechecked). (code-12 15, MAP Suspect 6)
- SC16. `seed.ts:115-131, 1-2`. See D18. CONFIRMED STALE. (code-12 16)
- SC17. `pitch-deck.cjs:14-20` numbers "read out of the code": literals, and the model ($6/$99/10%) is superseded. CONFIRMED STALE. (code-12 17)
- SC18. `capture-payments.tsx:28-33` amounts from product helpers: mostly typed. CONFIRMED STALE per reader. (code-12 18)
- SC19. `seed-coverage.ts:16-18` "Every step runs through the product's own functions": only the money. CONFIRMED STALE per reader. (code-12 19)
- SC20. `reset.ts:7-10` "Every row ... is test data": undated; false for production now (real inboxes). CONFIRMED STALE. (code-12 20)
- SC21. `check-live.ts:21-23` page "states no price of its own": not checked. CONFIRMED STALE per reader. (code-12 21)
- SC22. `probe.ts:446-449` F8 refusal never tested. CONFIRMED STALE per reader. (code-12 22)
- SC23. `lifecycles.ts:9` "eleven machines"; `_prove-doc.ts:67` "five per audience"; `_value-statements.ts:62` "TWENTY-FIVE": typed counts, the last two correct today. UNSURE for eleven (not recounted). (code-12 23)
- SC24. `inventory.ts:433` "The admin side, as it is" over seven portals. CONFIRMED STALE. (code-12 24, DOCS 4)
- SC25. `ship-content.ts:28-30`. See D5. CONFIRMED STALE. (code-13)
- SC26. `settings.ts:709-711` "keeps the guard" then both verbs `productionIsAllowed: true` (`:717`). CONFIRMED STALE. (code-13)
- SC27. `settings.ts:89-91` stored sponsor row equals default: dated fact as safety argument. UNSURE (needs the database). (code-13)
- SC28. `simulate-seed.ts:58` "three scripts and two documents import it": no importer (grep for `./simulate-seed`). CONFIRMED STALE. (code-13)
- SC29. `shoot-room.ts:294` five states, four driven. CONFIRMED STALE per reader. (code-13)
- SC30. `verifiers.ts:45-47` "read-only with one exception the pass names": none named, most plant fixtures. CONFIRMED STALE. (code-13)
- SC31. `sync-blocks.ts:111-112` "If nothing matches, append": returns 0, top of page (`:122`). CONFIRMED STALE. `:45` "the fifth door": see D4. (code-13)
- SC32. `whatsapp-check.ts:7-9` "Nothing else ... does that yet": notify sends WhatsApp templates. CONFIRMED STALE per reader. (code-15 5)
- SC33. `demo-full.mts:34-36` "Read `--dry-run` output first": no such flag (only the comment mentions it). CONFIRMED STALE (an operator told to preview a write that cannot be previewed). (code-15 6)
- SC34. `demo-video.mts:22-24` fixtures from `scripts/demo.ts`: books whoever is Available. CONFIRMED STALE per reader. (code-15 7)
- SC35. `demo-edit.mts:348, 361-362, 554-555, 735` film copy with superseded prices, Stripe payouts, "sixty seconds", "Notes for free", summary by email. CONFIRMED STALE per reader. (code-15 8)
- SC36. `check-live.ts:219` `includes("check-live")` guard, weaker than the banned `endsWith` form; `:99-131` hand-typed `LIVE_PAGES`. CONFIRMED (line read). (code-14 17)

### scripts/verify-* (checks)

- V1. `verify-actuals.ts:115-116` "Balancing pairs are used anyway": planted txn sums to -8,940. CONFIRMED STALE per reader. (code-13)
- V2. `verify-c285.ts:23-24,197-198` surfaces never exercised; partner endpoint gone. CONFIRMED STALE per reader. (code-13)
- V3. `verify-cast.ts:227` "the three seeded people": reads seven. CONFIRMED STALE per reader. (code-13)
- V4. `verify-email-dns.ts:252-258` SPF fails on every transactional message vs `:84-99` aligns under `aspf=r`. UNSURE (DNS external). (code-13)
- V5. `verify-boundary.ts:41-42` bare function identifier refused: no code does it. CONFIRMED STALE per reader. (code-13)
- V6. `verify-money-edges.ts:606` "sixteen scenarios": thirteen sections plus one numbered 16. CONFIRMED STALE (label read). (code-13)
- V7. `verify-reachable.ts:94-99` 87 vs 96. See D21. CONFIRMED STALE. (code-13)
- V8. `verify-reachable.ts:215,217,232` `MUST_WIRE` reasons describe a past state if the check passes. UNSURE (depends on a run). (code-13)
- V9. `verify-principals.ts:690-697` C205 comment reads as covering the file; guard scan reads `s.body` raw. CONFIRMED STALE per reader. (code-13)
- V10. `verify-palette.ts:98` ramps copied from `globals.css`, compared to nothing. CONFIRMED STALE per reader (MAP Suspect 12 context). (code-13)
- V11. `verify-machines.ts:259-260` "not an exit if no screen offers it": a verb regex. CONFIRMED STALE per reader. (code-13)
- V12. `verify-served.ts:29-30` "IT READS ONLY ... production included": runs `verify:contrast`, which signs in. CONFIRMED STALE per reader (production safety claim). (code-13)
- V13. `verify-sprint37l2` T1 enforcement. See TR2. (code-14 2)
- V14. `verify-sprint13.ts:234-243` near miss: record renamed `verify13-patient` (`:161`). CONFIRMED STALE. (code-14 3)
- V15. `verify-sprint17.ts:508-517` OFF control greps "holding your earnings"; copy is "While we hold your earnings" (`messages.ts:193`). CONFIRMED STALE (the control cannot fail). (code-14 4)
- V16. `verify-sprint29.ts:67-72` `ALLOWED` exempts files the scan never walks (`app`, `components` only). CONFIRMED STALE. (code-14 5)
- V17. `verify-sprint13r.ts:296-300` "Exercised through the real action": two plain selects. CONFIRMED STALE per reader. (code-14 6)
- V18. `verify-sprint25.ts:8-10` C121 asserted via the screen's reader: no such call. CONFIRMED STALE per reader. (code-14 7)
- V19. `verify-sprint26.ts:128` "a second clinician ADDS a version": same actor. CONFIRMED STALE per reader. (code-14 8)
- V20. `verify-sprint21.ts:280-286` "a new string falls back": uses an existing key. CONFIRMED STALE per reader. (code-14 9)
- V21. `verify-sprint20.ts:513-517`, `verify-sprint47.ts:126-130`, `verify-sprint2.ts:55-59,116-120`, `verify-sprint29.ts:300-304`, `verify-sprint28.ts:320-324`: labels whose assertions cannot fail. CONFIRMED per reader (checks that cannot fail). (code-14 10 to 14)
- V22. `verify-sprint37r.ts:261-265` pin count must equal vs `verify-sprint30.ts:181` `<=`. CONFIRMED per reader. (code-14 15)
- V23. `verify-sprint4.ts:164-168` asserts source `static`: red the day a live feed exists. CONFIRMED (line read; stale by design). (code-14 16)
- V24. `verify-sprint53.ts:1623` null crisis reader "the Egyptian one": a UK number since C350 (`:1570-1581`). CONFIRMED STALE per reader. (code-15 2)
- V25. `verify-sprint7.ts:95-108` `COUNT(recording_started_at) = 0` over all sessions. CONFIRMED STALE per reader (true only of a database never recorded since sprint 7). (code-15 3)
- V26. `verify-sprint7.ts:388-394`. See D6. CONFIRMED STALE. (code-15 4)
- V27. `verify-synthetic.ts:47-52`. See D7. CONFIRMED STALE. (code-15 9)
- V28. `verify-traps.ts:319-324` CONTROL that makes nothing fire; `:162` baseline 19 counts a spelling. CONFIRMED per reader. (code-15 10, 13)
- V29. `verify-sprint65.ts:682-686`, `verify-sprint55.ts:216-221`, `verify-sprint57.ts:281-287`: tautological controls. CONFIRMED per reader. (code-15 11)
- V30. `verify-sprint59.ts:195` requires `egypt_gateway` in `RENEWAL_RAILS`: Egypt has no gateway. UNSURE (future work or stale name; MAP contradiction 2). (code-15 12)

### evals/, tests/, harness, config

- EV1. `evals/grounding.ts:26-27,185-187,204` 18 terms, 9 poisoned facts, five cases: now 16 sessions, 27 poison facts, 12 contradiction cases. CONFIRMED STALE per reader. (code-16 1)
- EV2. `evals/suites/notes.ts:22,112,123,158` three cases, one Arabic: 16 sessions, 6 Arabic. CONFIRMED STALE per reader. (code-16 2)
- EV3. `evals/suites/risk-model.ts:14-15` 17 positives, 13 negatives: 36 and 29. CONFIRMED STALE (line read). (code-16 3)
- EV4. `evals/suites/risk.ts:88-90` "a list of English phrases": carries Arabic and Arabizi. CONFIRMED STALE per reader. (code-16 4)
- EV5. `evals/suites/attribution.ts:63` "forty-line set": about 440. CONFIRMED STALE per reader. (code-16 5)
- EV6. `evals/run.ts:21-24` "Three of the four suites": six suites in `evals/suites/`. CONFIRMED STALE. (code-16 6)
- EV7. `evals/report.ts:27-29` tolerance stated in the baseline: `compare` uses the code's. CONFIRMED STALE per reader. (code-16 7)
- EV8. `evals/cases.json` high-water mark 15/48 vs 16/65. CONFIRMED STALE per reader. (code-16 8)
- EV9. `evals/production-baseline.json` describes production on 2026-09-17 (H36). CONFIRMED STALE (production wiped 2026-09-20). (code-16 27)
- TS1. `tests/.hydration-zone.29342.ts` committed temp file. CONFIRMED (file exists). (code-16 9)
- TS2. `tests/hydration.test.tsx:113` unused temp dir; `tests/coverage.test.ts:74` dead ternary; `tests/safety.test.ts:659-708` stacked JSDoc; `tests/e2e.test.ts:493,696-716`. CONFIRMED per reader. (code-16 10, 13, 15, 18)
- TS3. `tests/money.test.ts:124-130` title says the opposite of the assertion. CONFIRMED STALE per reader. (code-16 11)
- TS4. `tests/routing.test.ts:302-310` "clinic and partner rows carry no prefixes yet": `lib/routing.ts:304,321` give both. CONFIRMED STALE. (code-16 12)
- TS5. `tests/people.test.ts:110-116` title "never reveals the length" vs code encoding length. CONFIRMED STALE per reader (a privacy claim in a test title). (code-16 14)
- TS6. `tests/physics.test.ts:100` "microcents" (H13). CONFIRMED (known). (code-16 16)
- TS7. `tests/ingest.test.ts:142` boundary not tested. CONFIRMED per reader. (code-16 17)
- HN1. `.walkthrough/run.sh:3`, `.walkthrough2/up.sh:3`. See D20. CONFIRMED STALE. (code-16 19)
- HN2. `.walkthrough2/f15-start.mjs:8` clicks `Video`, `f17-approve.mjs:7` "Approve note": UI changed. CONFIRMED STALE per reader. (code-16 20)
- HN3. `.walkthrough2/routes.mjs` hand-typed route list, no sponsor/clinic/partner/join routes. CONFIRMED per reader. (code-16 21)
- HN4. `.walkthrough/lib.mjs:3` writes to deleted `docs/walkthrough`. CONFIRMED STALE per reader. (code-16 22)
- CF1. `.env.example:13` CRON_SECRET "Strongly recommended": required in production. CONFIRMED STALE per reader (line present, empty value). (code-16 23)
- CF2. `.nvmrc` says 20; `package.json:7` engines 22.x. CONFIRMED STALE. (code-16 24)
- CF3. `package.json:37` `db:generate` is `drizzle-kit generate` without `--custom`, which H19 says cannot be used here. CONFIRMED (line read). (code-16 25)
- CF4. `vercel.json` five crons vs README three, TAKEOVER six. See D2. (code-16 26)

---

## Tally

| Verdict | Count |
|---|---|
| CONFIRMED STALE (includes "per reader": line opened or grep matched, deeper claim taken from the note; includes entries that are CONFIRMED in part) | 299 |
| NOT STALE | 10 |
| UNSURE (includes mixed entries where part is UNSURE) | 75 |
| Cross-references only (V13, CF4) | 2 |
| **Entries in Part 2 after merging** | **386** (24 of them expanded in Part 1) |

Counted by grep over Part 2 entry lines. "CONFIRMED per reader" means I opened the cited line, or a grep matched, and the rest of the reader's claim is consistent with it but I did not re-trace every caller. Entries marked UNSURE with "not reopened" were not opened by me at all.

NOT STALE: T2 (TAKEOVER 18 of 106), PL3 (Phase 0 rule still the rule), DL1 (crisis lines are in `country_settings`, MAP Stale 7 answered), PN11 and LD4 (the redacted name really is still shown on the sprint 6 route), PN35 (verification truth now enforced by trigger 0083), LD15 (clinic.ts states what the code does; the promise C2 is what conflicts), M7, AP13 (card checkout still prices from `price_cents`), AP39 (past tense).

Found while checking, not in any note: `scripts/verify-sprint7.ts` is a fourth unguarded verifier and it deletes rows (D1, D6).
