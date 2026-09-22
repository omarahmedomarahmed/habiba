# PLAN.md digest

Source: `/home/user/habiba/PLAN.md`, 5,432 lines, 839 KB, read in full. Promise ids from `docs/VALUE-STATEMENTS.md` (P1..P5, T1..T5, C1..C5 clinic, E1..E5, A1..A5). To avoid clashing with PLAN's own concern ids, clinic promises are written **VS-C1..VS-C5** below; bare `C123` always means a PLAN concern row.

## 0. Read this first: how PLAN.md lies about itself

1. **The header says it is a dated ledger** and lists dead paths: `lib/ai/crisis.ts` (now `lib/crisis/`), `lib/ai/descriptors.ts` (now `lib/transcript/descriptors.ts`); deleted: `lib/ai/patient-copilot.ts` (renamed `case-copilot.ts` in 24.3), `scripts/_fk.ts`, `docs/screens/`, `docs/walkthrough/` (held 22R's `FINDINGS.md`), `docs/walkthrough-2/` (held 37R's `REPORT.md` and 334 screenshots). Header baseline: 116 migrations `0000..0115`, 33 test suites; highest migration named in the body is `0104`. It points to `docs/ORIENTATION.md` for current truth.
2. **Tick boxes are not evidence.** §5 admits that on 2026-09-14, 318 boxes were ticked retroactively by the rule "ticked when that sprint's acceptance verifier passes, unless the ticket says incomplete"; 59 remain open. A `[x]` means a sprint-level verifier passed, not that the ticket was built as written (e.g. 55.4/55.5 ticked though C397 deleted them; 23.x ticked though absorbed by 48).
3. **C-number collisions.** (a) C61..C66 were duplicated and renumbered C61a..C66a in sprint 12. (b) C182 and C183 each appear twice as §2 rows with different content (C183 = admin design verdicts AND a duplicate of C184's 988 finding). (c) C102 (contact address) vs C102b (patient-initiated share). (d) **Sprints 69 to 73 reuse C349..C367 with new meanings** in their ticket text and build log: C349 income definitions, C350 Egypt crisis number 105, C351 double rejection deletes documents, C352 verification follows clinician, C353 `/pricing` 500, C354 `npm run smoke`, C355 `verify:sprint7` fixture, C356 `check-live.ts`, C357 `verify:sprint21r` limiter, C358 admin console committed, C359 two-term cost, C360 finance cannot move price, C361 GrowthStep, C362 churn never measured, C363 deepest deficit, C364 prose `--write`, C365 smoke busy port, C366 `savePayouts` overlay, C367 `0102` SET NULL vs CHECK. The §2 table rows C349..C367 mean something else entirely (domain enumeration, provisional N, retroactive seats, two principals, closed capability list, radar label, seat start date, reachability transitive, hasNoRail, patientSignOut, abandonSession, adjustLedger, three orphan pages, skip list, allowlist, server-action boundary, capability auth, principal matrix, liveSince). **Any code comment citing C349..C367 must be disambiguated by date/sprint.**
4. **Build-log sprint titles do not match §4 sprint content** for several numbers, so `verify:sprintNN` may not test what §4 sprint NN specifies: build log 43 = "clinical wall, table by table" (§4 43 = SMART on FHIR); 47 = "portability and record extract" (§4 47 = note provenance); 48 = "assessments" (§4 48 = in-room copilot; assessments are §4 56); 49 = "sponsors, first cut" (§4 49 = Total View); 51 = "can a human reach every table" (§4 51 = content and design); 54 = "clinic portal, seats" (seats are §4 62); 59 = "Arabizi crisis register and anti-differencing floor" (§4 59 = currencies). Rows 38..64 are "reconstructed after the fact".
5. **Dates are not monotonic with sprint numbers.** 37R is dated 2026-09-16 and 37L 2026-09-17, after sprints 57..73 (2026-09-13..15). Rulings C209..C300 (sprints 45..57) are dated 2026-09-12..13.
6. **Production migration lag recorded and never closed in-text:** 0061 (sprint 30), 0062 (33), 0063 (35), 0064 (36), 0065 (37) each "WAITING FOR THE PLANNING SESSION", applied only to the working DB.
7. **PLAN.md never mentions** `verify:notices`, `verify:edges`, `verify:demo`, `seed:demo`, `npm run prove`, `docs/simulation/09-THE-EDGES.md` or `docs/PROVE-IT.md`, all of which VALUE-STATEMENTS relies on (it does mention `docs/simulation/` with docs 04, 05, 07, 08 and `verify:rail`). No `#N` or "Task N" numbers appear anywhere in PLAN.md (VALUE-STATEMENTS' "Task 109" is not from here).

## 1. Sprint index

| id | date | decided / built (<=25 words) |
|---|---|---|
| Header | n/d | Dated ledger; dead paths listed; truth is ORIENTATION.md plus code. |
| §1 Verdict | 09-04 | Audit @2a3965d: proceed with changes; fee 10% not 15%, PAYG $6, cap $1000; platform already holds balances. |
| §2 Concerns | 09-04..09-15 | C1..C427 plus C61a..C66a, C102b; never delete a row; ruling format what/why/cost/date. |
| §3 Model | 09-04 | Unclaimed vs claimed records; 8-step claim; invite route; four copilot states; consent controls; money table; sprint-1 prices (historical). |
| §3b Identity | 09-06 | Phone mandatory, email optional, sign in with either; one phone one account; challenge: seen therapist? then name, never shown first. |
| §3c Money | 09-06, amended 09-12, 09-13 | Founder reverses 1.8: platform holds money on 2 of 4 crossings; two entities; later split fee $1+$1..3; later $99/$179 plans. |
| §3e Corporate | 09-12 | Sponsor pot is payment method; joining code, no roster; payer never sees who/when; weekly granularity; 3-month re-verification. |
| §3d Back office | 09-06 | Phone change 90-day lock (24h grace); support tickets 24h clock pausing; staff/manager roles; no impersonation; manual EGP payout queue, two-person. |
| §3f Six portals | 09-12 | Patient, therapist, clinic, sponsor, partner, admin; clinic IS organization, sponsor is NOT; clinic sees patient names and times. |
| §4 intro | 09-06..09-12 | Sprints 1..11R live; order by who waits; 45 blocks 46..52; 52 last on purged DB. |
| 1 Settings | 09-04 | platform_settings/country_settings; reprice $4/$3/$2, 15%, cap $500; all to PAYG; 1.8 stop custody (refuse w/o Connect). |
| 2 Room/shell | 09-04 | Two-column room at lg; orb five states; /on-call history with frozen price; viewing-signal stand-down. |
| 3 Attribution | 09-05 | Diarise batching 120/8; pause cutting; never label straddle; descriptors, no affect column; dropped-track handling. |
| 4 Paid links | 09-05 | Price with cut, VAT, currency; /pay/[token] separate from /join; FX quote 1 hour; session_type. |
| 5 Person layer | 09-05 | `people` above `patients`; claimed_at; never auto-merge; suggest-only matching; assertClaimed. |
| 6 Patient accounts | 09-05 | Separate patient identity tables (0034); no "patient" role; requirePatient; eight-step claim; invite link never sent by us. |
| 7 Consent | 09-05 | history_grants; 24h or open-ended; two requests/day; one-tap revoke; audit actor_account_id; consent one-way in room. |
| 8 Profile/docs | 09-05 | person_documents 25MB; chunking; [D7:3] citations; flags never delete; diagnoses need source sentence; audited viewer. |
| 9 Memory/homework | 09-05 | person_profiles regenerated only; observations dated; conflicts surfaced; homework only person closes; no rates to patient. |
| 10 General copilot | 09-05 | /assistant imports no clinical table; names to ids; 50/month from settings. |
| 11 Scheduling | 09-06 | Whole-hour CHECK; scheduled_at; booking calendar; auto-offline in reachable(); notify seam, unkeyed. |
| 11R Repair | 09-06 | One tz formatter; reminded_at; claim via notify; E.164; hourly reminders; verify-migrations; C50 built; C46 grandfathered. |
| THE RESET | 09-06 | All prod rows are test data; purge before launch; voids grandfather/backfill decisions. |
| 12 Sweep | 09-06 | Copilot gate on for all; C26 exclusion removed; required zone; patients.phone NOT NULL; reset.ts. |
| 13 Claim by phone | 09-06 | Phone unique NOT NULL; therapist sends WhatsApp invite; two-question challenge; per-record answers; patient timezone. |
| 13R Two handles | 09-06 | Email nullable NULLS DISTINCT; attempts per (account, record); locked status; therapist release audited. |
| 14 No-show | 09-06 | 5-min recovery, equal/lower price replacement, refund, patient credit 12 months, reliability score. |
| 15 Patient app | 09-06 | Five tabs; patient never sees transcript/clinical note via patient-view select list. |
| 16 Money rails | 09-06 | Two rails/currencies/entities; payout queue; two-person CHECKs; netting built; FX frozen; reconciliation; PROVIDERS empty. |
| 17 Pricing story | 09-06 | Pricing block from settings; slider; netting sentence conditional; C25 deferred to 23. |
| 18 Public revamp | 09-06 | Patients section; crisis page one tap; live components; screens sweep synthetic only; C17 fixed. |
| 18R Contact | 09-08 | Contact form as support ticket (0048); both companies as content; never in prompt. |
| 19 Arabic/English | 09-08 | Skip-with-reason verifiers; staging render; locale parameter; nothing hardcodes two languages. |
| 20 / 20R Back office | 09-08/09 | Staff/manager roles; phone changes; two support queues; attachments; every figure admin-editable; margin per session. |
| 21 Strings/languages | 09-09 | ui_strings, locales; AI drafts human publishes; crisis/consent/recording never from draft; launch-not-life completeness. |
| 21R Loose ends | 09-09 | Separate admin/patient sign-in; patient reset over WhatsApp; live pricing page fixed (cache); 988 removed (C98). |
| 22R Walkthrough | 09-09 | First human walk; seven defects (claim did not move account, invite dead end); many flows not walked. |
| 22 Purge/launch gate | 09-09 | Production purged, 0054 validates all CHECKs; keys, Resend, Meta, Stripe live, legal review NOT done. |
| 23 Room copilot | 09-06 | In-room copilot after launch; 23.3 shared counter STRUCK by C210; absorbed by 48. |
| 24 Content law | 09-09 | Em/en dash ban; import-graph guard patient to lib/ai; case-copilot rename; settings page rebuilt. |
| 25 Patient app as app | 09-11 | Home, chrome everywhere, SOS orb, password optional, claim order corrected, therapist QR, avatar route. |
| 26 Record patient owns | 09-11 | Append-only versioned summary; one approval screen; journals replace patient uploads; journals risk-scanned; export extract; /verify. |
| 27 Portability | 09-11 | Grant needs approved verification (trigger); patient invite code; ask-my-therapist with decline reason. |
| 28 Honest site | 09-11 | honesty.ts refuses "sessions cover our fee" and earnings promises; integrations/developers pages; demos of unbuilt features not shipped. |
| 29 Identity docs | 09-12 | /api/uploads/[id] audited; same-org colleague refused. |
| 30 Region seam | 09-12 | dbFor(region)/controlDb; chart routes on patient; Egypt points at US; provider not chosen; data NOT in Egypt. |
| 31 Arabic URLs | 09-13 | /ar/* prefix via middleware rewrite; hreflang; host checks over HTTP. |
| 32 AI evals | 09-13 | evals/ with baseline; Arabic crisis 0% found and fixed; per-language numbers; unmeasured-call ratchet. |
| 33 Evidence layer | 09-13 | patient_clinical_facts with DB-enforced provenance; AI never verified at insert; source order changed (C164). |
| 34 Notes read evidence | 09-14 | Filters: no diagnoses, no re-measured domains, no unverified AI facts to note generator. |
| 35 Risk intelligence | 09-14 | Classifier structures, levelFor arithmetic, keyword floor never lowered; model cannot adjudicate. |
| 35R Eval set | 09-14 | 15 sessions, 44 risk cases; single fold module; baseline shape refusal; re-record blocked on OpenAI credit. |
| 36 Session sources | 09-15 | session_sources schema forbids pasted links/calendars; session-scoped ingestion token; no bots. |
| 37 Diarisation offline | 09-15 | No elimination rule; bound_by track/operator only; provider call and DER NOT built (37.4); voice screen unbuilt. |
| 37R Second walkthrough | 09-16 | SOS orb showed US 988 to Egyptians (C184); product not localised (C182); duplicate patient refused (C186). |
| 37L Product Arabic | 09-17 | Patient app Arabic; therapist 105 and admin 312 English literals left; ratchet; 988 in three more places. |
| 38 Note templates | n/d | NOT BUILT (all open). |
| 39 Before/after session | n/d | NOT BUILT (prep absorbed as 48.3 Prepare me). |
| 40 Verification adapters | n/d | NOT BUILT (Vezeeta/Syndicate registry). |
| 41 Meeting bots | 09-12 rulings | Recall.ai; bot only on meetings we create; patient gets our link; sequence text stale (see §2). Declared blocked on 37.4 yet ticked. |
| 42 Partner plane | n/d | partners, keys, subjects, webhooks event+id, widget, CSV importer; no own verifier. |
| 43 SMART on FHIR | n/d | ehr_connections owned by organization; DocumentReference writeback; shadow-copy decision "decide and write down". |
| 44 Check-ins | n/d | Personalised check-ins; never interprets; worrying reply to crisis path. |
| 45 Strings editable | 09-12 | NUL bytes out of facts.ts; client provider override-aware; every new word a MessageKey en+ar. |
| 46 Split fee | 09-12 | $1 platform every session + AI fee on consent; invoice_lines; payerName off therapist ledger; crisis independent of billing. |
| 47 Honest record | 09-12 | Note provenance transcript/partial/clinician; journals never support conclusions. |
| 48 Room copilot free | 09-12 | Free uncounted in-room copilot and Prepare me; bound at startedAt; patient off-record button. |
| 49 Total View | 09-12 | Globe-scoped operating dashboard; cost from cost_microcents; no sponsor-to-session join. |
| 50 Switches | 09-12 | Money switch vs visibility switch per country; queryBoard filter; cache invalidation. |
| 51 Content/design | 09-12 | Rewrite CMS; bookings page; ratings floor; one price; no 24/7 response promise. |
| 54 Clinics | 09-12 | Clinic org + manager with zero clinical access; self-verification; aggregated invoice; names and times only. |
| 55 Partner portal | 09-12 | Router for six principals; seven use cases incl employment and clinician verification (later cut by C397). |
| 56 Assessments | 09-12 | PHQ-9/GAD-7 as content; no verdict to patient; timings as data. |
| 52 Last walkthrough/films | n/d | NOT DONE (all open). |
| 53 Corporate | 09-12 | Sponsors table/auth; pot; joining code; floors; notification log; crisis never gated on money. |
| 57 Price/plan/claims | 09-13 | Practice $99, Clinic $179 unlimited; verify:claims; writesTo guards; entitlement by period. |
| 58 Reachability | 09-14 | verify:reachable, verify:principals; orphans found (patient sign-out, cancel session, ledger adjust). |
| 59 Many currencies | 09-14 | Corroborated VAT country; per-currency prices; renewal obligations; entity on held balance; FX account; many review fixes. |
| 60 Coverage % | 09-14 | coverage_bps frozen at booking; VAT on patient share; capture by coverage; therapist sees one amount. |
| 61 Domain proof | 09-14 | Email code + DNS TXT or agreement; constant-time enumeration defence; provisional HR enrolment N=1. |
| 62 Seats | 09-14 | Retroactive seat ladder $179/$90/$80; proration; seat starts after own period. |
| 63 Clinic staff | 09-14 | Capability layer on clinic_managers; first name + last initial; handover switching. |
| 64 Egyptian rail | 09-14 | Only seam `lib/billing/egypt.ts` (refuses); 7 of 8 tickets open, blocked on entity/merchant/contract. |
| 66 Sponsor HR | n/d | employment:verify moved to /sponsor/integrations; live indicator; log names no employee. |
| 67 Clinic EHR | n/d | Clinic-plan only; last_success_at; writeback log visible. |
| 68 Partner platform | n/d | Telehealth-only API; consent endpoint first; limits stop our product not theirs. |
| 65 Show not write | 09-14 | Prose ratchet; visual primitives; four heroes; accept line NOT met (public 30% vs 80%). |
| 69 Simulation needs | 09-14 | Egypt crisis 105; /pricing had 500'd in prod 7 sprints; verify:boundary, smoke, spend budget. |
| 70 Cost physics | 09-14 | Cost = fixed + per-minute; admin console screenshots committed after synthetic check. |
| 71 Financial model | 09-14 | lib/finance/model.ts pure; provenance labels; forecast cannot move a price. |
| 72 Operating plan | 09-14 | Cohort engine; Egypt forecast prices (1,000/3,000 EGP, 15%, no flat fee); video costs more than AI. |
| 73/73b/73c Manual rail | 09-15 | Egyptian bank-transfer rail confirmed by an operator; CHECKs; receipt uploads; 0102..0104. |
| §5 Build log | 09-04..09-17 | Reverse-ish chronological; 38..64 reconstructed; four sprints without verifiers (22, 22R, 42, 52). |
| §6 Standing rules | cumulative | Hard/process rules incl. the "check that passed while broken" family. |
| §7 Direction | pre-24 | Record layer above existing tools; three doors; three hard patient rules; economics; bot rule. |

## 2. Rulings later overridden or contradicted

Format: **earlier** -> **later**; ADMITTED (the file says so) or SILENT (stale text left standing).

1. **Custody of therapist money.** 1.8: "Stop taking custody... refuse the payment"; Accept: "no code path can put a patient's payment anywhere but a clinician's own Stripe account"; build log 1.8 "only one capture value reachable ('destination', as const)"; C6 resolved on that basis. -> §3c (2026-09-06) platform holds money on 2 of 4 crossings; C69 netting from held earnings built (16); C314/60.9 "capture becomes a function of coverage... 1.8's rule is amended in writing rather than quietly contradicted for a third time"; pot payments `capture: "platform"`. ADMITTED in §3c, C73, C314; SILENT in the 1.8 ticket, its accept line and its build-log row. Residual: §3c table still says Connect destination "we never touch it", false for any partly sponsored session after C314 (SILENT).
2. **Per-session price schedule.** §3/1.6/C2/C20: PAYG $4, Starter $3 (min 10), Growth $2 (min 30), bundles as session credits; `unlimited $99` removed (C2, 1.7). -> C209/C223/46.2..46.4 (09-12): platform fee $1 + AI fee $3 PAYG, $2 at $30 unlock, $1 at $60 unlock, "the rate does not expire with the credit". -> C292/57 (09-13): PAYG $1 + $3, Practice $99/mo and Clinic $179/mo unlimited, "Rate locks are gone"; 57.3 `growth` rows fall back to free door, "no migration" (rate-lock buyers silently lose their rate; called "a refund question"). ADMITTED in §3 note and §3c amendment. SILENT: sprint 17 copy ("$4... No subscription, no seat fee"), 17.4 (slider on Growth, min 30), 17.6 ("never choose a plan, there are no plans"), 46.4 still ticked, 73.6 prices the plan at "$100", §7 and VALUE-STATEMENTS still argue against a "$4 fee".
3. **Free and in-person sessions.** §3 Money: "In-person: Always free... we take nothing"; "Free links take no cut"; §7 "The platform is free. A session costs the therapist, first one free"; 17 copy "Your first completed session is free". -> C209: platform fee "on every session, always, including free ones, in person ones and declined ones". ADMITTED in C209; SILENT in §3 table and §7. Whether "first session free" still exists is unresolved (sprint 70 lists "The free first session" as validated).
4. **Copilot allowance.** C14/§3: 10 messages per session per patient, rolling; 23.3: in-room spends the same counter. -> C210/48.2: in-room and Prepare me free and uncounted (23.3 struck, ADMITTED). C224 amended: rate limit one in flight + cooldown; 48.6 text ("free window is the session") not updated (SILENT). C269 adds a free read-only allowance for grants without sessions.
5. **Copilot unlock gate.** C46/11R.24: grandfathered on `copilot.gateActiveFrom`. -> THE RESET/12.1: key deleted, gate on for everyone (ADMITTED).
6. **Who sends the invite.** §3 invite route step 3: "We do not send it"; 6.10: "never sent by us". -> §3b step 2, 13.3, 25.18: a WhatsApp invite is sent by us. SILENT.
7. **Name challenge.** §3 step 4: confirm "first and last name on file, shown redacted H••••• A•••••". -> §3b/13.6: "What name did you give them?", never shown first; C121/25.15: first-letter hint that spends an attempt. SILENT in §3.
8. **Identity and password.** §3 step 1 and 5.4: match on "email or phone"; 13 built on required email. -> §3b/C86: phone required, email optional. -> §3b/13R.0 "a password is set either way". -> C119/25.11: password optional, a code always signs in ("edits 13R", ADMITTED). SILENT in §3b table and in §6 rule "Sign-in accepts either handle plus the password".
9. **Turning consent off mid-session.** §3 consent table: "Wants to turn it off: Cannot. End the session"; 7.8 "one-way by design". -> 41.7 "consent revoked mid-session" edge case; C211/48.4 "granted, declined or withdrawn mid-session"; 48.10 patient's own off-record button; C370 mute stops both recorders; VALUE-STATEMENTS T2. SILENT: §3 rule never amended.
10. **Payment vs consent order.** C216 and sprint 41 sequence: "pay, then the AI question, then in". -> C281: keep shipped consent-first order in `submitJoin`; "the plan's own sequence in §7 and sprint 41 is amended rather than the code". The sprint 41 prose still says pay first: SILENT in text despite the admission. C282 adds a separate AI-question screen (53).
11. **Bot dispatch timing.** Sprint 41 table and 41.8: "Joins at the moment consent is given". -> C216 AMENDED: consent authorises, scheduler dispatches at a fixed lead time. SILENT in 41's text.
12. **In-room copilot sentence.** 48.5 single sentence "This session is not being recorded". -> C211 AMENDED: three sentences by consent state. SILENT in 48.5.
13. **Journals and risk.** C214 original and 47.6 and §6: journals may never produce "a risk level". -> C214 REWRITTEN: C123 (journals scanned, `journals.riskLevel`, alert grant holder, 26.7) stands; bound is only on `facts.ts` domain diagnosis/risk and copilot conclusions. ADMITTED in C214; SILENT in 47.6 and §6 row, which still literally forbid a risk level.
14. **What a clinic sees of a patient.** §3f, C260, 54.9: "patient names and appointment times". -> C327/63.12: first name plus last initial, disclosed to patient, every read audited; C416 `shortenForClinic`. SILENT in §3f and 54.9. Both conflict with VALUE-STATEMENTS VS-C2 ("no... patient name, on any screen") and VS-C5 ("each clinician's patients are not" visible).
15. **How a clinic pays.** §3f, C261, 54.7: clinic billed platform fee + AI fee per session like a solo therapist; C263 aggregated invoice. -> C292 Clinic plan $179/mo; sprint 62/C323 retroactive seat ladder (1..2 $179, 3..4 $90 each, 5+ $80 each). SILENT in 54.7/§3f. VALUE-STATEMENTS VS-C4 ("lowers the next bill by exactly one seat", clinician "lands on pay-as-you-go") conflicts with retroactive ladder (3 to 2 drops $91, 5 to 4 drops $40) and 62.5 (removed therapist "keeps unlimited to period end").
16. **Seventh principal.** §3f six portals; 55.1 partner "sixth principal"; C324/63.1 clinic staff new table, "never a users row". -> C412: `clinic_managers` was already the seventh principal since 54; capability layer built on it (ADMITTED). 58.7 still lists six.
17. **Principal matrix.** C336/58.6: every principal x every exported data function, missing entry fails build. -> C366: replaced by 55-module declaration (36 clinical) (ADMITTED); 58.6 text unchanged (SILENT).
18. **Sponsor enrolment design.** C227 v1 approval queue, v2 bulk roster -> v3 joining code, no queue, no roster (ADMITTED). SILENT residues: §3e "Gets: a pot of money, a roster"; §3e "payer may see who is enrolled"; 53.1 "payer sees the roster"; 53 Accept "approves a roster". Tension: C227 "sponsor never sees an enrolment event" vs C256/61.12/§3e: sponsor sees each enrolled person's name and last-verified date.
19. **Sponsor reporting floor.** 53.3: below a headcount setting the sponsor sees "the balance and nothing else". -> C229 REWRITTEN: suppress every figure including the balance below N sessions (default 5); C377 published balance (0084). SILENT in 53.3.
20. **Pot overdraft.** §3e and 53.14: "one session negative per patient". -> C239 AMENDED: per-sponsor overdraft setting. SILENT in both.
21. **Sponsored patient pays nothing.** §3e "sessions that cost them nothing"; 53.21 "pays nothing". -> C311/60.1: `coverage_bps` 0..100%, patient pays their share plus VAT. SILENT.
22. **VAT on sponsored sessions.** §3e "VAT is handled as it always is"; a planning ruling "VAT on the full price, apportioned". -> C312: VAT on the patient's share only (pot zero VAT, `pot.ts:196`). ADMITTED ("the first ruling was WRONG"); SILENT in §3e.
23. **Pot ledger footprint.** §3e/53.10: "no new ledger accounts beyond the pot". -> C339 FX difference, C347 liability for refunds into closed pots, C391 `vat_payable`. SILENT.
24. **Re-verification cadence.** C247 and 53.19b: default six months. §3e, C257, 61.11: every three months. UNRESOLVED, both stand.
25. **HR verification and clinician verification via partner API.** §3e tier 1 "the reason the partner API exists for this audience"; 55.4 employment verification; 55.5 clinician verification lookup. -> C397: partner API is telehealth-only; employment:verify moved to the sponsor portal (66); clinician:verify deleted. ADMITTED in C397; 55.4/55.5 still ticked, §3e unchanged (SILENT).
26. **Egypt crisis number.** C98: only `US -> 988`, "deliberately did not add Egypt's 122/123"; C399: crisis columns seeded empty. -> 69.2 (collided id "C350"): Egypt 105, press 1 Arabic, press 1 mental health, added 2026-09-14 in `lib/crisis/line.ts`; seed still null. ADMITTED. Also 25.5's per-country flag layout is what produced C184 (US 988 shown to Egyptians).
27. **VAT on refunds.** §3 Money: "Our cut is refunded. VAT is not". -> C396: `refundSession` refunds the whole charge including tax; behaviour kept, comment removed; Egyptian ETA credit note owed (sprint 64). ADMITTED in C396, SILENT in §3.
28. **Currency model.** §3c/16.4/16.5/16.6a: "Currency is a display choice", USD default with EGP toggle everywhere, therapist prices in either, patient pays in either, "every therapist chooses". -> C304 (each currency its own admin price), C337/59.10 (subscription currency follows verified country, never a choice), C393 (currency derived from entity, only EGP and USD in `lib/billing/money.ts`), C394 (collection follows patient, payout follows clinician). SILENT in §3c and 16.x. 59.1/59.5 (patient chooses country for display currency; therapist prices in own country currency via `users.rate_currency`) sit awkwardly with C393 (GBP/EUR countries price in USD).
29. **FX feed.** C37 (sprint 16 ruling): `PROVIDERS` empty, static rate refused in production, EGP rail cannot take real money. vs 16.4 `[x]` "Live or near-live rate. Kills C37's hardcoded ~48". Contradiction inside the same sprint; the build log admits PROVIDERS empty. Later: 64.2..64.8 open; 73 builds a manual bank-transfer rail instead of §3c's "local collection provider".
30. **Closing a support ticket.** §3d "correspondence is emailed to the patient"; C82 "the closing email... carrying the correspondence". -> 20.22: patient gets a link to an authenticated page, never plaintext correspondence. ADMITTED-ish in 20.22's reasoning; SILENT in §3d.
31. **Adding a language.** 19.7, 21.9 `[x]` ("Admin can add a language. Not a code change, a row"), §6 "admin can add a locale (C77)". vs C77 ruling: "`LOCALES` is still a compile-time list, so adding a language today is a deploy"; 19 build: `--locale=es` fails "Shipped languages: en, ar"; 21 build adds a `locales` table (0051). State unclear. 21.11 "nothing goes live until 100%" -> 21.12/C78 (ADMITTED).
32. **Evidence source order.** 33.1: clinician, document, AI, patient. -> C164: shipped clinician, document, patient, AI (ADMITTED).
33. **Verification source of truth.** C106/27.1 (trigger on `history_grants`, per C285 it reads `therapist_verifications.state`) vs 20 files reading `users.verification_status` (radar, `lib/partner/api.ts`, `lib/partner/launch.ts`, `lib/data/clinic.ts`); production had 1 "verified" user and 0 "approved" verifications. C285 rules derivation from the enforced column. Live contradiction until proven fixed.
34. **§6 vs C219.** §6 row "Two switches... Remove the loser, never wire both" preserves C219's original wording; C219 REWRITTEN rules "two switches, each named for the question it answers, and one admin action that sets both". SILENT contradiction inside §6.
35. **Patient notification log.** 53.20: one append-only log, nothing ever deleted. -> C231 AMENDED: two logs; removal reads "your benefit has ended", no employer, no reason; payer acts only in audit. SILENT in 53.20.
36. **Duplicate patients.** C101 (22R): "not fixed... deliberately", needs clinical wording, open. -> C186 (37R): `addPatient` refuses duplicates by phone/email with a deliberate tick. C101 row still "open" (SILENT).
37. **Admin screenshots.** C80/18.12: admin screens gitignored, never committed. -> 70.6 (collided "C358"): console committed after `verify:synthetic` passes (ADMITTED, conditional).
38. **Patient uploads.** Sprint 8: patient-uploaded documents (`uploaded_by_account_id`). -> 26.5: patient upload and dictate-history actions deleted, journals replace them (ADMITTED).
39. **Room copilot sprint.** C25 deferred to sprint 23 "after launch"; 23.1/23.2/23.4 ticked; "Sprint 48 absorbs and replaces this whole sprint". Ambiguous which sprint built it.
40. **Check-ins.** 22R.11/22R.12 open "not built" -> 44.1/44.2 ticked.
41. **C22 vs C46.** C22 (12.1) "no date and no grandfather" vs C46 (11R) grandfathered; the reset resolves in C22's favour.
42. **Clinic invite visibility.** 54.5: clinic "sees that verification is pending and can chase". vs 63.10: "The invite is visible only after approval" and 63.9 clinic sees nothing until acceptance. Minor tension.
43. **Take rate description.** §3c "The patient never pays us... We take the platform fee and the tax" omits the 15% cut, while C313/60.7 "our 15% is on the full price" and §3e "our commission comes out of it". 72.7's Egypt forecast prices are "15% and no flat fee", unlike the shipped $1 platform fee.
44. **Sprint 41 status.** 37 says "41 stays blocked on 37.4 being MEASURED"; 37.4 is open ("No diarisation provider is called anywhere"), yet 41 is ticked and build log says `verify:sprint41` 23 PASS.
45. **Verification "for partners" (C285) vs 55.5** already covered; also §7 table says partner API = keys/docs/webhooks, then C397 narrows scope.

## 3. Every claim of enforcement

VS = related value statement. "verifier" names are npm scripts `verify:sprintNN` or files `scripts/verify-sprintNN.ts` as written.

| rule | claimed enforcer | sprint / C | VS |
|---|---|---|---|
| Platform cut 15% | `platform_settings.session` 1500bps; `verify:sprint1` asserts live rows | C1, 1.6 | T3 |
| No pricing constant in code | typed accessor `lib/settings` with per-field fallback | 1.3 | |
| Price cap $500 / floor $5 | settings + `settingsProblem` refuses cap below floor | C3, 20R | |
| PLANS keys only | migration 0030 moved subscriptions | C4 | |
| Transcribe cost per model, dearest fallback | `lib/ai/client.ts`; 3 tests in `safety` | 1.4, H12 | |
| Session clock 50 + 10 countdown, stop 60 | `lib/session-clock.ts`; 12 `clock` tests | C13, 1.5 | |
| Only destination capture (historical) | `createSessionCheckout` refuses; `capture = "destination" as const` `connect.ts:439`; `verify:sprint1` 0 platform rows | 1.8, C6 | |
| Copilot quota per session per patient | `checkQuota` in `lib/data/copilot.ts` | C14 | T5 |
| In-room copilot uncounted | `checkQuota` stops counting in-room | 48.2, C210 | T5 |
| Credits 12 months, oldest first | `session_credits` table | C20 | |
| Orb five states | `verify-sprint2.ts` accessible names | C9 | |
| /on-call price frozen | `verify-sprint2.ts` moves rates +999 | 2.5 | |
| No straddle labels | prompt above schema (H2) + `straddlesTurnBoundary` refuses at write | C35, 3.5 | T1 |
| No affect/tone column | test asserts none added | 3.3 | |
| FX quote 1 hour, one clock | `fx_quotes` (0032); `verify-sprint4.ts` 17 checks | 4.4, C38 | |
| Static FX refused in production | `quoteFor` (`lib/billing/fx.ts`), `PROVIDERS` list; child process at NODE_ENV=production in `verify-sprint16` | C37 | A1 |
| Never auto-merge people | `verify-sprint5.ts` asserts duplicate emails stayed separate | C39, 5.3 | P4 |
| Partial unique on claimed people only | `people.claimed_at` partial indexes (0033) | 5.2 | |
| assertClaimed gate throws | `assertClaimed` | 5.5 | |
| Matching returns no contact details | 5.4 suggest-only function | 5.4 | |
| Patient not an Actor | `PatientActor` has no organizationId; `verify-sprint6` asserts `users.organization_id NOT NULL` | C41 | |
| No "patient" role | `ROLES` comment in `schema.ts` | C42 | |
| Duplicate patient email refused by DB | `patient_accounts` unique (0034), `verify-sprint6` | 6.2 | |
| Patient session cookie | `requirePatient()` / `optionalPatient()`, cookie `24t_patient`, 4h idle / 7d | 6.4 | |
| Routing segment-safe | `lib/routing.ts` pure fn, 4x2 cookie states; later `routeDecision` `middleware.ts:69`, `lib/routing.ts:80` | C45, C264 | |
| Step 7 default off | `verifyClaim` has no default (type error) | 6.8 | P4 |
| Claim upsert on partial index | `startClaim` `targetWhere` on `person_claims_open_unique` | C44 | |
| Invite link single use, 30 days, hash | conditional UPDATE; hash only | 6.10 | T4 |
| One pending grant | `history_grants` partial unique (0035) | 7.1 | P4 |
| Grant window fixed at agree | written at decision time | 7.2 | |
| Two requests/day per pair | 7.3 limiter | 7.3 | |
| One actor per audit row | `audit()` throws if both; later count incl sponsor/clinic columns (0086) | C49, C387 | A5 |
| Four copilot states | `lib/access/state.ts` (16 tests) | 7.7 | T5 |
| Revoked cannot write diagnosis | `updatePatient` refuses | C47 | T5 |
| Grant created only on yes | `applyClaimDecision` | C48 | P4 |
| Late recording stamp | `recording_started_at`, `lateRecordingStamp` | 7.8 | T2 |
| Document bytes gated | `/api/documents/[id]` consent re-check, audit every read, no blob URL | 8.10, C52, H14 | T5 |
| Diagnoses need verbatim sentence | `person_diagnoses.source_sentence NOT NULL`, `verbatimIn` | 8.9 | |
| Flags never delete/edit | `content_flags` | 8.8 | |
| Citations resolve or are deleted | `resolveRef`, `[D7:3]` ordinal | 8.5, 8.6 | T5 |
| Revoked clinician gets 0 chars | `documentsFor` (then `lib/ai/patient-copilot.ts`, now `case-copilot.ts`); `verify-sprint8` | C47 | T5 |
| Unsafe PDF layouts not searchable | `unpdf`, `mammoth`, `lib/documents/layout.ts`, `STORED_ONLY_TYPES`, `extractText` | C50, C71 | |
| Profile never hand-edited | `person_profiles` unique; `regenerateProfile`; `lib/data/memory.ts` read-only | C55 | |
| Patient homework has no rates | `nextStepFor` / `openStepsFor` key set asserted in `verify-sprint9` (`id,title,detail,dueAt,othersWaiting`); `homeworkTrend` clinician-only | C53 | |
| Answered step cannot be withdrawn | `withdrawStep` refuses | C54 | |
| General copilot reads no clinical text | `lib/ai/assistant.ts` import block checked by `verify-sprint10`; `session_notes` only in COUNT | C58, 10.2 | |
| Roster selects only scheduled_at | sprint 14 verifier on `buildRoster` | C57 | |
| Links from names only | name->id matching, mentions stored | C59 | |
| General chat 50/month | settings, only `therapist` rows count | 10.5 | |
| Whole-hour slots | CHECK `availability_slots_whole_hour` (`date_part('minute', starts_at) = 0`) | C61a, 11.1 | |
| Booked clinician offline whole hour | `reachable()` NOT EXISTS; `inBookedWindow`; `verify-sprint11` | C62a, 11.5 | P1 |
| One formatter, zone required | `lib/scheduling/tz.ts`; `formatDate`/`formatDateTime`/`relativeDay` required zone; `tests/hydration.test.tsx` | C61, C70 | |
| Hours published in own zone | `publishHours` (IANA); `hoursOn`, `byDay` deleted | C62 | |
| Never edit patient text | `availability_slots.reminded_at` (0040) | C63 | |
| E.164 only | `lib/phone/e164.ts` `toE164`; `sendWhatsapp`, `whatsapp:check` refuse | C64 | |
| Reminders hourly with quiet hours | cron `app/api/cron/[job]/route.ts`, `reminded_at IS NULL` | C65 | P2 |
| Migration ledger = journal = schema | `scripts/verify-migrations.ts`, zero unvalidated CHECKs | C66, 22.9 | |
| Booking needs contact; ceilings | 12/hr/slot, 40/hr/clinician; unconfirmed paid bookings reopen at 24h | C67 | |
| Channel fallback told on screen | `notify()`; `claim.code` in `TEMPLATES`; `ClaimState` carries channel | C68 | P2 |
| No runtime Intl/toLocale in client render | `verify-sprint12` construct ban; `useReaderZone()` exception | C84 | |
| Feedback token / patient phone required | CHECKs in 0042, validated 0054; `sessions.feedback_token NOT NULL` | 12.4, 22.9 | |
| One phone per patient account | `patient_accounts.phone` unique NOT NULL | 13.1 | |
| Claim needs both answers | `challengePassed`; `verify-sprint13` | 13.8 | |
| Attempt budget per (account, record) | `claim_attempts` unique; status `locked`; `verify-sprint13r` | C87 | |
| Email unique only when present | index `NULLS DISTINCT` | C86 | |
| Therapist can release lock | audited action via `getPatient` tenancy | C88 | |
| Replacement cannot cost more | price ceiling at write, `verify-sprint14` | 14.3 | |
| Credit never negative/overspent | `patient_credits` CHECKs (0046) | 14.6 | |
| Patient never sees transcript/note | `lib/data/patient-view.ts` `sessionsForPatient` select list, sentinel test + control in `verify-sprint15`; identifier ban in `app/(patient)`, `components/patient` | 15.8, C16 | P3 |
| Unsigned brief withheld | patient-view reports pending | 15 | P3 |
| Two-person payout | CHECKs `payout_requests_approver_not_payee`, `_approver_not_editor`, `_sent_was_approved`; `payouts.twoPersonThresholdCents` | C74, 16.3d | |
| Payout alert to phone and email | `notify()` all channels | 16.3b | |
| Netting all-or-nothing | `chargeForSession` `fee_netted`, `payouts.netFeeFromHeldEarnings`, control clinician in `verify-sprint16` | C69 | T3 |
| FX shown with rate | `egpSettlement()` returns amount, rate, market rate, timestamp; `payouts.egpSpreadBps` default 0 cap 1000 | C76 | |
| Held money reconciles to zero | 16.8 reconciliation report; `ledger_entries.entity` | 16.8, 16.9 | T3 |
| Prices on pages from settings | pricing block; `verify-sprint17` renders component; C60 sentence control | 17.10 | |
| Netting sentence conditional | `verify-sprint17` flips setting off | C69 | T3 |
| No page implies we read records | 18.7 forbidden-shape scan | 18.7 | |
| Screens sweep synthetic only | `scripts/screens.ts` refuses non-demo DB | 18.11 | |
| Spend from microcents | `lib/data/vault.ts`; `verify-sprint18`; later no reporting query uses `cost_cents` (49.15) | C17, C279 | |
| Support ticket shape | `support_tickets_one_handle` CHECK; queue key set without body; never app log | C91, 18R | |
| Support text never in a prompt | import-graph ban on `lib/data/support.ts` with planted file in `lib/ai`; nothing outside `support.ts` touches attachments | C82, 20R | |
| Content-dependent checks deferred | `scripts/_verify.ts` `skipUnless`; `withPublishedContent` | C90, C93 | |
| Staging render proof | `republish.ts --staging`, `scripts/render-check.ts`, `BlockRenderer`; `readNav` excludes staging | C89 | |
| Money locale explicit | `formatMoney` required locale | 19.4 | |
| Staff pages no clinical data | import graph over `requireStaff`/`requireManager` pages | 20.9 | A5 |
| Support clock pauses | ticket state, `verify-sprint20` | C83 | |
| Ticket close by link+code | 20.22 two factors, same failure message | 20.22 | |
| Phone change unfinishable by staff | 20.16 hash | 20.16 | |
| Strings never blank | `ui_strings_not_blank`; clear restores default | 21.5 | |
| Machine translation cannot publish crisis copy | bulk approval refused; safety strings by prefix; machine row needs model | 21.17..21.19 | |
| Patient reset guess budget | `patient_auth_tokens` CHECK `attempts <= 5` | C94 | |
| Admin door not linked | planted-link control; role checked after password (`/staff/sign-in`) | 21R.1 | A5 |
| No em/en dash | `verify:sprint24` scan (comments stripped, three files allowed) | C117, 24.1 | |
| Patient pages cannot reach lib/ai | transitive import-graph guard, planted two hops away | C113, 24.2 | P3 |
| lib/ai means "talks to a model" | moves to `lib/transcript/`, `lib/data/transcript.ts`, `lib/crisis/alerts.ts` | C137, C140 | |
| Avatar never emitted | `/api/patient/avatar/:personId` (404 to strangers); scan no page emits `people.avatar_url` | C139 | |
| Wall QR carries one clinician | `therapist_codes` has no patient column; `therapist_codes_shape` CHECK | C120 | |
| Ratings shown only after 5 | `RATINGS_VISIBLE_AFTER`; `verify:sprint25` | C138 | |
| Summary append-only, versioned | `clinical_summaries` BEFORE UPDATE OR DELETE trigger; unique (person_id, version) | C141, 26.1 | P4 |
| Silence publishes nothing | approval panel defaults off; three audits | C112 | P3 |
| Summary not clinical register | shape refusal ("patient presents", "differential", "rule out") | 26.4 | P3 |
| Journal page never implies watching | scan with planted reassurance; `writeJournal` returns id only | C123 | |
| Export is extract not certificate | rendered-document scan for "certified" | C127 | |
| Export email only | `phone: null` passed; admin alert | 26.10 | |
| /verify reveals counts only | `/verify` page | C143 | |
| Grant only to approved clinician | trigger on `history_grants` (0060); later C285 says it reads `therapist_verifications.state` | C106, C144 | P4, T5 |
| Patient invite code | `patient_invites` single use, 30 days, max 3 live | C145 | P4 |
| Revocation never asks why | signatures along revoke path, `verify:sprint27` | C146 | T5 |
| Decline carries reason | CHECK on `history_asks` | 27.7 | |
| No false fee/earnings claims | `lib/content/honesty.ts` in `savePage`; verifier on published rows | C109, C110 | T3 |
| Claims vs product | `scripts/verify-claims.ts` (`verify:claims`), dictionary harvested, seat figures vs `seatMonthlyCents` | C288, C296, C374, C411 | |
| Identity docs gated | `/api/uploads/[id]`, audit before fetch; same-org refused; `localUploadAllowed` | C151, C153 | |
| No bare database | `lib/db` exports none; `dbFor(region)`/`controlDb`; planted tsc failure; no `new Pool()` | 30.1 | |
| Region pins ratcheted | `scripts/_region-pins.ts`, `_region-pins.json` (85) | C157 | |
| Chart routes on patient | `regionOfPatient`; `acrossRegions` | C154, C155 | |
| Cross-border consent real | `cross_border_consents` CHECK regions differ | 30.3 | |
| Host-correct canonicals | `verify:sprint31` over HTTP | C162 | |
| Evals regress-gated | `evals/baseline.json`, spread, shape refusal; `evals/unmeasured.json` ratchet | C160, C172, C174, 32.2 | |
| Facts carry provenance | `patient_clinical_facts` CHECKs: quote NOT NULL, `source_priority` vs `source_type`, immutability, AI not insertable verified, no lower supersede, deleted source marks `unsupported` | 33.x, C165 | P4 |
| Currency gates ladder | `rankFacts` in TS | C166 | |
| Note generator filters | no unverified AI facts, no diagnoses, no presentation/function/risk; `verify:sprint34` on rendered block | C167, C168, C170 | T1 |
| Risk level is arithmetic | `levelFor`; no quote no finding; keyword floor minimum; classifier import graph cannot reach `lib/data/facts.ts` | 35.x, C171 | |
| Folding safe | `lib/crisis/fold.ts`, `contains()` refuses empty needle, `foldsToNothing()`; `foldArabizi` | C173, C400 | |
| Bot only on our meetings | `session_sources` no link/calendar columns; CHECK provisioned_at/by; unique per session; immutable trigger; amended CHECK no `://` | C175, C215, 41.1 | |
| Ingestion token narrow | per-session hash on row, SHA-256 CHECK, expiry, no transcript in response | C176 | |
| No identity by elimination | `session_voices.bound_by` in ('track','operator'); unbound voice lines only `unknown`; unbind resets (0065) | C177, C178 | |
| Crisis number for the reader | `lineForNumber(e164)`; `verify:sprint37r`; `verify:sprint37l` scans for bare crisis numbers | C184, C198 | P5 |
| Arabic ratchet | `scripts/_i18n-coverage.ts`/`.json`; `verify:sprint37l` | 37L.6, C286 | |
| No hook in server component | check "no server component calls the client hook" | C199 | |
| Formatters require language | `verify:sprint37l2` via `Function.length` | C201 | |
| Labels are not identifiers | chips `{code,label}` | C203 | |
| No NUL bytes | verifier over `.ts`/`.tsx` | C245, 45.0 | |
| No literal strings | 45.8 verifier | C217 | |
| Two invoice lines, idempotent | `invoice_lines`; `invoices_session_unique` kept; `invoice_lines_invoice_kind_unique`; `reconcileMissingCharges` per kind (`lib/billing/service.ts:520`) | C251, C293 | |
| No currency on consent surfaces | 46.16 verifier | C209 | |
| Crisis independent of billing | 46.17 test (no credit, unpaid, suspended, empty pot); 53.23 | C253, C235 | P5 |
| Therapist ledger shows patient not payer | `payerName`/`payerEmail` removed (`components/billing/ledger.tsx:273`) | C243 | |
| Note provenance | `session_notes` provenance stamped at save, `offRecordGaps()` (`lib/data/feedback.ts:474`) | C212, C213 | T2 |
| Journal facts bounded | write-time domain check in `lib/data/facts.ts` | C214, 47.6 | |
| Room copilot bound | record as of `startedAt`; `liveSince` on `started_at`; `before` threaded into `documentsFor`, `profileFor` | C211, C367, C373 | T5 |
| Country switches | `getCountrySettings` (`lib/settings/index.ts:102`), `connect.ts:449`, `app/pay/[token]/actions.ts:50`; `queryBoard` (`radar.ts:245`); `invalidateRadarBoard()`; 50.5 verifier | C218, C219, C254 | |
| No sponsor join in admin | 49.13 / C244 scan by join target (`audit_log.actor_sponsor_user_id` allowed) | C244, C419 | E1, E2 |
| Sponsor cannot reach individuals | `verify:sprint53` as sponsor; therapist-side on rendered output | 53.1, 53.24 | E2 |
| Sponsor never an Actor | no `require*` in `lib/auth/guard.ts` returns sponsor/partner | C230, C264 | E2 |
| Identifier used once across sponsors | `enrolments_identifier_unique` + second hash column (0085); checked through `hashIdentifier` | C384, C385 | |
| Published pot balance | `potBalance` republished only past floor (0084) | C377, C229 | E1 |
| Pot debit safe | `payFromPot` debits first conditional on balance + overdraft; claim = INSERT `session_payments` unique | C382, C404 | |
| Pot refunds | `refundToPot` walks ledger | C383 | |
| Clinic sees no clinical content | verifier as clinic-manager principal on rendered output | 54.9, 63.11 | VS-C2 |
| Clinic invoice aggregated | 54.8 | C263 | VS-C3 |
| Plan entitlement by period | `entitledTier` pure; later reads renewal obligation | C294, C341 | |
| Free door exists | `settingsProblem`; `tierForSpend` filters `monthlyCents === 0` | C289, C290 | |
| Writers refuse production | `writesTo()` in `scripts/_verify.ts`; `demo.ts`, `seed.ts`, `republish.ts`, `settings.ts`, `shoot-room.ts`; exceptions `seed --refresh-content`, `republish --staging` asserted by `verify:sprint57` | C147, C291, C295 | |
| Everything reachable | `verify:reachable` (actions, API routes, pages, stale allowlist fails); `uncalledExports` ratchet + `MUST_WIRE` | C335, C356, C363, C369 | |
| Entry points authenticate as declared principal | `verify:principals` 55 modules; capability auth recognisers | C365, C366 | A5 |
| Portal actions audited | gate 58.7 | C387 | A5 |
| Rail required to book | `hasNoRail` gate refuses radar and booking | C357 | |
| Local price floor | `settingsProblem` floor rail | C337 | |
| Destination charge carries no tax | `postSessionPayment` throws | C392 | |
| VAT collected is a liability | `vat_payable` account, reversed on refund | C391 | |
| Only EGP and USD | `lib/billing/money.ts` list; `collectionCurrencyFor`, `collectionRailFor`, `payoutRailFor`, `isCrossBorder` | C393, C394 | |
| Egypt manual payout first | `payoutRailFor` reads `therapist_verifications.country` | C395 | |
| Unsupported country refused | `collectionProblem`, `IMPLEMENTED_COLLECTION_PROVIDERS` | C381 | |
| Export only approved notes | mapping gates on `status='approved' AND approved_at IS NOT NULL` (`lib/data/export.ts`) | C372 | P3 |
| Off-record mutes recording | `RecorderOptions.muted` to both recorders | C370 | T2 |
| Cancel only from legal states | `cancelSession` `CANCELLABLE_FROM` from `TRANSITIONS` | C368 | |
| Crisis lines as data | `country_settings` four columns, pairing constraint (0088) | C399 | P5 |
| Partner link revocable | `partner_subjects.revoked_at` in `resolveSubject` (0087); `subject.unlinked` | C389 | |
| Partner writeback scoped | `writeBackSession` like `whoMayRead`, 409 on ambiguity | C388 | |
| Webhooks actually emitted | `queueWebhook` from `grant.revoked`, `record.claimed` paths | C390 | |
| Coverage frozen | `coverage_bps` frozen on session; reduction notice 30 days | C311, C342, C344 | E3, E4 |
| Therapist sees one amount | capture function of coverage; verifier plants partial session | C314, 60.17 | |
| VAT on patient share | `pot.ts:196` reasoning | C312 | |
| C244 scan by column type | `sponsor_share_cents` allowed | C405 | |
| Domain confirm link | HMAC over id with `AUTH_SECRET`, constant-time | C406 | |
| Domain enumeration defence | constant message and timing | C349 (row) | |
| Seat billing | `takeSeat` requires `ownOrganizationId`; `joinWithExistingAccount` refuses caseloads | C408, C409 | VS-C4 |
| Clinic scoping | `scopeToAssigned` returns `string[] or null`; `verify:sprint63` empty list zero rows | C414 | VS-C2 |
| Capabilities closed, subset | closed list in code; subset at write | C353 (row), C326 | |
| Principal switch is a handover | revoke before mint, audited | C413 | |
| Admin reads clinics separately | `clinicsForAdmin` behind `requireRole`; `getClinic`, `clinicManagersFor` deleted | C415 | |
| Clinic name shortening | `shortenForClinic` | C416 | VS-C2 |
| Egypt rail honest | `lib/billing/egypt.ts` adapter `uncontracted`, `railIsReady()`, `whatTheRailNeeds()` | 64.1 | |
| Sponsor keys | `partner_api_keys.partner_id` nullable + owner CHECK; `authenticateKey`; `withKey`; `last_success_at`; `setEmploymentVerification(false)` revokes | C421..C423 | |
| HR question only fresh | `enrolment_attestations` consumed once | 66.3, C265 | |
| EHR status truthful | `last_success_at`, `last_error`; `approved_by_user_id` LEFT join | C425, C426 | |
| Partner usage limits | `partner_sessions` CHECKs (stopped never billable; sandbox never billable nor real person) | C420 | |
| Partner route cannot reach clinical modules | `lib/ai/note-writer.ts` pure | C418 | |
| Server->client boundary | `verify:boundary`; `npm run smoke`; `npm run gates` | 69.8, 69.9 | |
| AI spend budget | `npm run spend -- --budget 10` | 69.11 | |
| Forecast cannot bill | `verify:finance`, `verify:plan` import scans | 71.7, 72.7 | |
| Synthetic-only captures | `verify:synthetic` | 70.6 | |
| Manual payment rules | `manual_payments` CHECKs (one payer, rejection needs reason, decision names who, nobody pays zero), partial unique index; `num_nonnulls(...) <= 1`; `verify:rail` | 73.2, 73.3, 73.15 | A1, A2, A3 |
| Transfer details safe | locked while transfers in flight; audit labels not values; `savePayouts` read-then-overlay | 73.11, 73.12 | A4 |
| One rail per sponsor | `sponsorNeedsTransfer` reads `entity`; `topUpPot` refuses `eg` | 73.13 | |

## 4. Task numbers

PLAN.md contains **no `#N` or "Task N" identifiers**. Work is identified by ticket ids `sprint.item` (e.g. 22.8b, 37R.23a). Unticked tickets (the honest open list, ~60): 13R.10 (WhatsApp password reset, pending Meta), 18.12 (admin screens gitignored), 18R.3 (support queue, later built per C91/20), 22R.3, 22R.4, 22R.6, 22R.10, 22R.11, 22R.12, 22.2 (rotate every key: OpenAI, Deepgram, Daily, Resend, Stripe, DB, `CRON_SECRET`, `admin@24therapy.ai` password, Neon URL), 22.3 (Resend domain), 22.4 (Meta: five templates), 22.5 (single deploy), 22.6 (Stripe live, both bank accounts), 22.7 (full real pass), 22.8 (legal review of consent and §3c), 22.8b partial, 22.8c (screens), 30.2 and 30.4 (Egypt DB provider, unsigned), 35R.4 (eval re-record, no OpenAI credit), 37.4 (no diarisation provider, DER unmeasured), 37.5 (voice binding screen), 37L.9 (dates, later fixed via C201), 38.1..38.3, 39.1..39.4, 40.1..40.5, 52.1..52.9 and 52.4b, 60.20 (timing leak, accepted), 64.2..64.8 (EGP rail), 65.5, 65.14, 65.18, 65.5R, 65.14R, 65.18R. Partial `[~]`: 6.9, 7.7, 10.6, 11.7, 21R.8, 22R.5, 22R.7, 26.6, 28.6, 37R.3, 37L.2 (105 literals), 37L.3 (312), 37L.4.

## 5. C-numbers (one line each; `a`/`b` suffixes included)

C1 fee 10% -> 1500bps. C2 PAYG $6 -> $4/$3/$2, unlimited removed. C3 cap $500, floor $5. C4 PlanKey migration 0030. C5 Neon branch for DB checks. C6 platform-held balances; "resolved" by 1.8. C7 room copilot gap, dup of C25. C8 room layout already done. C9 orb built. C10 money-model migration 0032. C11 paid links existed. C12 people before preferences. C13 clock constants. C14 copilot per session per patient. C15 organizationId reads; dissolved by C41. C16 patient app reuses no clinician data layer. C17 vault summed lossy cost_cents. C18 DB measurement unblocked. C19 patients without contact; therapist record needs phone. C20 session_credits widening. C21 invoices.kind 'subscription'. C22 five-credit unlock gate. C23 extendedAt dead. C24 stale radar test. C25 in-room copilot deferred. C26 sessions with no feedback_token. C27 access state on /on-call. C28 copilot questions session attribution. C29 stale quota copy. C30 duplicate toast removed. C31 setAcceptsWalkIns. C32 cut baseline unmeasurable. C33 mock labels. C34 H11 cap never bit. C35 straddling lines unlabelled. C36 payment preferences on people. C37 static FX refused in production, PROVIDERS empty. C38 FX two clocks. C39 never auto-merge. C40 ensurePersonForPatient outside tx. C41 patient not an Actor. C42 no patient role. C43 WhatsApp claim not built. C44 upsert on partial index. C45 middleware segment matching. C46 copilot gate grandfathered. C47 degraded state removes material. C48 claim decision creates grant. C49 patient as audit actor. C50 PDF/Word extraction. C51 no OCR. C52 read-only viewer. C53 homework asymmetric queries. C54 skipped outcome. C55 profile never hand-edited. C56 drafted steps not promoted. C57 next appointment in roster. C58 general copilot separate. C59 names to ids. C60 CMS pricing stale. C61 two time renderings. C61a whole-hour CHECK. C62 UTC availability. C62a auto-offline in reachable(). C63 reminder marker in patient words. C63a nothing delivered. C64 Egyptian numbers not E.164. C64a WhatsApp via Meta, untested. C65 reminder timing. C65a no Arabic pricing row. C66 0039 unrecorded, DO-block trap. C66a bookSlot writes session first. C67 stranger fills calendar. C68 claim code not via notify. C69 netting mechanic (built). C70 timestamps without zone. C71 two-column heuristic refuses tables. C72 /ar/pricing fallback. C73 money transmitter risk, open forever. C74 manual payout fraud rules. C75 one phone one account exclusion. C76 who absorbs FX (therapist). C77 languages half-states. C78 completeness gates launch not life. C79 AI drafts, human publishes. C80 screenshots synthetic, admin gitignored. C81 phone lock after 24h. C82 support attachments clinical, never prompt. C83 clock pauses on patient. C84 guard banned helper not construct. C85 patient timezone. C86 email optional. C87 attempt budget reset hole. C88 release ships with tightening. C89 staging render proof. C90 skip with reason. C91 contact form as ticket. C92 live pricing page contradicted §3c. C93 skip-with-reason as rule. C94 separate sign-ins, patient reset. C95 hero icon. C96 human walkthrough. C97 check-ins. C98 US 988 removed. C99 account follows claimed record. C100 invite link broken for patients. C101 duplicate phone patients (open). C102 editor instruction as address. C102b patient-initiated share. C103 Arabic URLs. C104 verifiers pinned to scaffolding. C105 ledger misreported. C106 grant only to approved clinician. C107 coercion. C108 "ask" not "get". C109 "sessions cover our fee" false. C110 no earnings promises. C111 summary versioned append-only. C112 approval fatigue. C113 patient never converses with model. C114 name vs therapist record. C115 patient photo. C116 no app store badges. C117 dash ban. C118 Egyptian data residency. C119 password optional. C120 therapist QR. C121 code before any record info. C122 lookup by proven handle. C123 journals risk-scanned. C124 dictated journals. C125 SOS orb verified numbers only. C126 orb over session. C127 extract not certificate. C128 export email only. C129 session tab locked. C130 honest guest copy. C131 invite to unverified waits. C132 bot never reads calendars. C133 patient link always ours. C134 identity from session. C135 diarisation blocks bots. C136 legal pages English with Arabic preamble. C137 lib/ai boundary. C138 top-rated rail floor. C139 avatar route. C140 crisis scanner moved out of lib/ai. C141 append-only trigger. C142 journal citations incomplete. C143 /verify counts only. C144 grant trigger. C145 six-char code. C146 revoke signatures. C147 writesTo/required. C148 reseed where merged; ship:content. C149 integrations registry states. C150 demo locale. C151 identity docs route. C152 headshot label. C153 dev upload route. C154 region on person. C155 acrossRegions. C156 Arabic region label. C157 region pins counted statically. C158 negative proof placement. C159 crisis Arabic 0%. C160 eval noise. C161 empty equality. C162 wrong APP_URL host. C163 Egyptian register. C164 source order deviation. C165 refusal paired with allow. C166 currency gates ladder. C167 no model output as evidence. C168 no diagnoses to note writer. C169 note language vs script. C170 model cannot arbitrate. C171 keyword floor false alarms. C172 WORSE? inside spread. C173 fold bug recurred. C174 baseline shape. C175 session_sources schema. C176 ingestion token. C177 no elimination rule. C178 0065 voice rules. C179 no voice binding screen. C180 second walkthrough. C181 design verdicts. C182 product not localised (two rows). C183 admin design numbers AND duplicate 988 finding (two rows). C184 SOS orb US 988. C185 nav for signed-out. C186 duplicate patient refused. C187 eight small fixes. C198 988 in three more places. C199 hook in server component. C200 copy gates vs dictionary. C201 formatters need language. C202 dateTag vs localeTag. C203 label vs identifier. C204 MessageKey constants. C205 stripComments. C206 no locale default. C207 English copy bodies open. C208 verify:sprint7 not rerunnable. C209 split fee. C210 in-room copilot free. C211 room bound startedAt. C212 note provenance. C213 partial recording duration. C214 journals cannot conclude. C215 we create meetings. C216 bot dispatched by consent. C217 client strings override-blind. C218 country switch not dead. C219 two switches. C220 Total View rebuild. C221 extend ai_request_logs. C222 three revenue figures. C223 tiers as thresholds. C224 free window rate-limited. C225 films synthetic. C226 pot as payment method. C227 joining code. C228 weekly granularity. C229 denominator floor. C230 sponsors not organizations. C231 patient notification logs. C232 pots and counsel. C233 unspent pot terms. C234 removal leaves record. C235 crisis never gated on money. C236 sponsors unlisted by default. C237 sponsor QR. C238 identifier field limits. C239 started session always paid; overdraft. C240 attendance never confirmed. C241 corporate invoices, ETA. C242 therapist cannot tell sponsor pays. C243 payerName leak. C244 wall is property of data. C245 NUL bytes in facts.ts. C246 shape vs identity. C247 periodic re-verification. C248 no specimen identifier. C249 multiple sponsors, one primary. C250 enrolment not retroactive. C251 invoice_lines, reconciler. C252 rename rateCents. C253 crisis test in 46. C254 radar cache. C255 HR never enumerates. C256 fixed-calendar re-verification. C257 re-verification messaging. C258 removal reasons fixed list. C259 clinic inside, sponsor outside. C260 clinic sees name and time. C261 no private patients under clinic. C262 clinic reporting floor. C263 clinic invoice aggregated. C264 router for six principals. C265 employment endpoint scoped. C266 EHR connection org-owned. C267 clinic cannot vouch licence. C268 six-portal walkthrough. C269 grant-only allowance. C270 couples one chart. C271 supervisors are grantees. C272 dormant caseloads. C273 rating floor. C274 one price, no geo-pricing. C275 no response-time promise. C276 co-treatment visible. C277 partner patients own record. C278 free instruments, no verdict. C279 cost_cents in admin sums. C280 per-patient cost internal. C281 consent-first order kept. C282 AI question own screen. C283 recordConsent race. C284 verifier every branch. C285 two verification truths. C286 label/hint uncounted. C287 JSX expression strings uncounted. C288 four false claims, verify:claims. C289 settingsProblem wrong condition. C290 tierForSpend. C291 unguarded writing scripts. C292 $99/$179 plans. C293 zero invoice lines. C294 entitlement by period. C295 guard exceptions. C296 copy vs product. C297 content ship required. C298 typed key list. C299 reprice sweep. C300 Stripe receipt copy. C301 environment-dependent verifiers. C302 stale render control. C303 entity + currency axis. C304 per-currency prices. C305 payout button label. C306 held balance entity. C307 pot currency literal. C308 corroborated VAT country. C309 Egypt payouts normal path. C310 renewal obligation. C311 coverage frozen. C312 VAT patient share. C313 therapist paid full price. C314 capture by coverage. C315 refunds in frozen ratio. C316 sponsor covers patient price only. C317 employer change mid-treatment. C318 two proofs for sponsor. C319 banner opt-in. C320 delivery status. C321 sequential HR then email. C322 employment email column. C323 retroactive seats. C324 clinic staff principal. C325 capability on resource. C326 subset roles. C327 first name + initial, disclosed. C328 acceptance enumerates. C329 no double pay on join. C330 whole clinic drops. C331 departure keeps financial record. C332 seat manager replaces pricing. C333 proration. C334 clinic export audited. C335 verify:reachable. C336 principal matrix. C337 currency arbitrage floor. C338 two balances. C339 FX difference account. C340 VAT re-checked at settlement. C341 renewal obligation read. C342 reschedule keeps %. C343 series reservation. C344 increase vs decrease. C345 0% coverage. C346 timing leak accepted. C347 refund into closed pot. C348 DNS or agreement. C349 domain enumeration (row) / income definitions (69.1). C350 provisional N sessions (row) / Egypt 105 (69.2). C351 retroactive remainder (row) / second rejection (69.3). C352 two principals (row) / verification follows clinician (69.4). C353 closed capability list (row) / /pricing 500 (69.7). C354 radar label (row) / smoke (69.9). C355 seat start date (row) / verify:sprint7 fixture (69.10). C356 reachability transitive (row) / check-live (69.14). C357 hasNoRail gate (row) / 21r limiter (69.15). C358 patientSignOut (row) / console committed (70.6). C359 abandonSession (row) / two-term cost (70.1). C360 adjustLedger (row) / forecast cannot price (71.7). C361 three orphan pages (row) / GrowthStep (71.5). C362 skip list (row) / churn never measured (71.4). C363 allowlist from memory (row) / deepest deficit (71.6). C364 server action boundary (row) / prose --write (71.8). C365 capability auth (row) / smoke busy port (73.8). C366 principal matrix measure (row) / savePayouts (73.12). C367 liveSince started_at (row) / 0102 SET NULL (73.14). C368 cancelSession guard. C369 uncalled exports ratchet. C370 mute stops recording. C371 plan switch cancels old. C372 export unapproved notes. C373 before bound everywhere. C374 claims harvest dictionary. C377 pot balance floor. C380 application fee currency. C381 collectionProblem. C382 pot debit first. C383 refundToPot. C384 identifier unique across sponsors. C385 check via hashIdentifier. C386 /admin/benefits unpause. C387 sponsor/clinic acts audited. C388 writeBackSession scope. C389 partner link revocable. C390 webhooks emitted. C391 vat_payable. C392 destination charge no tax throw. C393 two currencies. C394 collection vs payout rail. C395 Egypt manual payouts. C396 VAT refund comment. C397 partner API telehealth-only. C398 cut leftovers. C399 crisis lines in country_settings. C400 Arabizi. C401 Arabizi guard. C402 un-exported helpers. C403 cron finding rejected. C404 pot idempotency by insert. C405 column scan by type. C406 HMAC confirm link. C407 email-linked page reachable. C408 takeSeat own period. C409 join with existing account. C410 body extraction. C411 seat price claims. C412 clinic_managers already principal. C413 switch is handover. C414 empty assignment means nobody. C415 admin reads clinic separately. C416 name shortening. C417 partner copilot unmeasured. C418 note-writer extracted. C419 sponsor audit join. C420 partner limits no overage. C421 sponsor keys in one table. C422 last_success_at keys. C423 disabling revokes keys. C424 reworded timing copy. C425 EHR last success. C426 writeback clinician. C427 disconnect count. (No rows C188..C197, C375, C376, C378, C379; C197 is cited by C183 but has no row.)

## 6. Suspected dead or never-built

**Paths/features described that may not exist:** `docs/walkthrough/FINDINGS.md`, `docs/walkthrough-2/REPORT.md` (design verdict table; also internally inconsistent: 13+34+14 = 61 of "81"), `docs/screens/` (header says deleted); `lib/ai/patient-copilot.ts` (renamed); `copilot.gateActiveFrom` (deleted in 12.1); `hoursOn`, `byDay`, `InvoiceList`, `PricingCards`, `PRICE_IN_PROSE`, `getClinic`, `clinicManagersFor`, `scripts/_fk.ts` (deleted); `ehr_writebacks` (43.1) vs `ehr_deliveries` (67.5), naming drift; `copilot_threads` (C58) vs `assistant_threads` (10.x); `users.verification_status` still read by 20 files (C285); `lib/data/documents.ts` pinned, cannot route (C155).
**Decided but never (or not provably) built:** sprints 38, 39 (except Prepare me), 40 (build log: NOT BUILT); 52 (films, last walkthrough, no verifier); 37.4 (no diarisation provider, DER unmeasured) and 37.5 (voice binding screen), while 41 is ticked despite being declared blocked on 37.4; 64.2..64.8 (EGP card/gateway rail; `railIsReady()` false); 30.2/30.4 (Egypt data residency; Egypt data sits in the US, "not resident" per patient screen); C37 rate feed (`PROVIDERS` empty); 22.2..22.8 (key rotation, Resend, Meta templates, Stripe live mode, legal review); 13R.10/21R.4 WhatsApp password reset (pending Meta); WhatsApp overall (C64a, 22.4); 35R.4 eval re-record; 60.20; 65 accept line (public text 30% not 80%); 37L.2/37L.3 (therapist 105 and admin 312 English literals; i18n floors later RAISED to 459/524/544); C207 (partly absorbed by 45.6); C101/C186 conflict; 43.4 shadow-copy retention ("decide and write down", no record); 42 has no own verifier; 18R.3 unticked though C91 says built; 22R.3/22R.4/22R.6 walked only in 37R; ETA credit note for Egyptian refunds (C396) and ETA e-invoicing (C241) need counsel; counsel question on pots before 53.10 (C232) with no recorded answer; C73 licensing risk open permanently; Stripe fees, Daily video cost, churn never measured (sprint 70 table); dunning email absent (57, later 59.16 ticked).
**Live defects the file records as having existed in production:** `/pricing` 500 for seven sprints (69.7); live pricing page claiming "we never hold it" (C92); US 988 on SOS orb and three other surfaces (C184, C198); `patientSignOut` unreachable (C358 row); `abandonSession` unreachable while FAQ promised it (C359 row); cost_cents vs microcents disagreement on two admin screens (C279).

## 7. Money rules

- Fee history: 10% (prod) -> 15% cut (`platform_settings`, 1.6); still "our 15% on the full price" in 60.7/C313. PAYG $6 -> $4/$3/$2 bundles (1.6) -> $1 platform + $1..3 AI (C209, 46.2) -> PAYG $1 + $3, Practice $99/mo, Clinic $179/mo unlimited (C292, 57). Subscribed sessions still raise both lines at $0 (C293). No credit reaches a plan (C290). Entitlement = period paid, via renewal obligation (C294, C310, C341). Plan switch cancels old at period end first (C371). Proration to the day (59.17, C333).
- Platform fee on every session including free, in-person, declined (C209); AI fee only on `recording_consent = 'granted'` (46.1); in-room copilot and Prepare me carried by platform fee (C210). No currency symbol on any consent surface (46.16). Consent answer never changes being seen or price (C282).
- Credits: 12-month expiry (C20); credit is money on any line (46.4); therapist chooses order: credit, held earnings, card (46.5, §3c).
- VAT: by country, Egypt 14%, patient pays on top (§3); worked example $30 -> $34.20 / $4.20 VAT / $4.50 cut / $25.50 therapist (verify-sprint4, 1641.60 EGP). VAT from corroborated country (card, IP, sponsor), re-checked at settlement, mismatch flags admin (C308, C340). VAT only on patient share for sponsored sessions (C312). `vat_payable` liability (C391). Destination charges never carry tax, `postSessionPayment` throws (C392). Refund returns VAT too (C396; contradicts §3). ETA credit notes/e-invoices owed (C396, C241).
- Price cap $500, floor $5 (C3). One price per clinician, no geo-pricing (C274). Patient paid price frozen on session (2.5).
- Currency: two only, EGP (Egypt) and USD (rest), derived from entity (C393); collection follows patient, payout follows clinician (C394); every currency has its own admin price (C304) with a floor fraction of USD (C337); subscription currency follows verified country (C337); FX rate frozen on transaction (16.6, C76); FX quote held 1 hour (4.4); therapist absorbs FX when choosing EGP, spread `payouts.egpSpreadBps` default 0 cap 1000 (C76); application fee converted at quote rate (C380); static FX refused in prod (C37); FX difference ledger account (C339).
- Holding money: §3c four crossings; held cent traces to one payment in, at most one payout out; entity per transaction; daily reconciliation to zero (16.8, C73); held balance carries entity; inter-entity move is a ledger transaction `entity_transfer` (C306, C394); Egypt clinicians always manual payout (C395); Egypt gateways settle to us so payout queue is normal path (C309); `holdsMoney` false only for `usd_stripe_to_connect` (C395).
- Payouts: states requested/approved/sent/confirmed, audited (16.2); age, owner, alert via `notify()` to phone and email (16.3b); screenshot of transfer shown to therapist (16.3c); two-person above `payouts.twoPersonThresholdCents` ($500), never payee or editor, as CHECKs (C74); held and Connect balances never summed, only held has "Request a payout" naming rail, entity, currency, rate (C338, C305); "available" never includes unmovable money (16.10). Clinic sees withdrawal log, never withdraws (63.14).
- Netting: fee taken from held earnings all-or-nothing, `payouts.netFeeFromHeldEarnings` default on (C69); copy may only say it conditionally; "paid sessions cover our fee" banned (C109, honesty.ts).
- Ledger: `adjustLedger` balanced pair with reason, `LedgerAdjust` on vault page (C360 row); `ledgerSummary` vs `monthlyLedger` income definitions unified (69.1); every Total View figure a ledger query (49.11); cost from `cost_microcents`, round once (C17, C279).
- Invoices: `invoices_session_unique` kept; `invoice_lines` child table; reconciler per line kind (C251); admin discount picks a line (46.18).
- No-show: replacement at equal or lower price, full refund if none, difference to patient credit expiring 12 months, applied after VAT (14.x).
- Pots: payment method, not billing system (C226); min top-up $5,000 setting (53.11); one entity and currency per pot (§3e); spendable only on sessions, no cash-out (53.12); refundable less spent with stated expiry shown at top-up (C233); started session always completes; per-sponsor overdraft (C239); series reserve against pot (C343); debit first and conditional (C382); claim by inserting `session_payments` (C404); refunds apportioned in frozen ratio, chargeback never claws sponsor share (C315); refund into closed pot to liability account, never patient (C347); `refundToPot` (C383); coverage % frozen at booking, decreases after 30-day notice and never on booked sessions, increases may apply to unstarted, reschedule keeps % (C311, C342, C344); 0% keeps badge (C345); therapist paid full price, never learns split, capture forced to platform when sponsor share exists (C313, C314); sponsor covers patient-facing price only, never platform/AI fees or therapist subscription (C316); pot currency conversions frozen (C307); top-up VAT split before crediting pot (C391); counsel on whether unspent pot is a liability before ticket 53.10 (C232); Egyptian pots cannot be card-topped (`topUpPot` refuses `eg`), bank-transfer rail instead (73).
- Seats: retroactive ladder 1..2 $179, 3..4 $90, 5+ $80 (C323); remainder recomputed as one figure (C351 row); seat unbilled until joiner's own period ends (C355 row); joiner's own subscription cancelled at period end (C329); removed seat not refunded, keeps unlimited to period end (62.5); failed renewal drops whole clinic together (C330); only `clinic_admin` buys seats (63.7).
- Clinic billing (pre-seats): clinic pays platform + AI fees, invoice aggregated never per session (C261, C263).
- Partner billing: per session, partner-set limit, 80/90% alerts, at limit our product stops and no bill (68.14..68.18, C420); `billing_mode = 'partner_billed'` monthly aggregate (42.6).
- Manual Egyptian rail: bank transfer details are operator data; action only after operator confirmation; CHECKs; one row per tap; details locked during transfers; two support staff at $500 each in plan (73.x).
- Forecast-only (not billing): Egypt 1,000 EGP therapist, 3,000 clinic, 15%, no flat fee, 50 EGP AI (72.7); `lib/finance/` cannot import money writers (71.7).

## 8. Privacy walls

- **Sponsor/employer:** never sees who booked, when, with whom, about what; no name beside a session; no day/hour/date tied to a person; no therapist, specialty or session type; no small breakdowns (§3e); never an enrolment event, rejection or join date (C227); only individual power is removal from enrolled list (C234); sees enrolled names and a fixed-calendar last-verified date (C256, 61.12); weekly finest granularity, spend not counts (C228); every figure suppressed below N sessions incl balance (C229, C377); never attendance (C240); never an identifier it did not already hold (C238); identifier fields capped, no national ID, health or free text (C238); work email never used to contact (53.18b); employment verification email never shown to therapist (C322); spike alerts as numbers only (C246); HR integration never enumerates or syncs (C255); verification endpoint scoped to fresh self-submitted identifiers (C265); removal reason never shown to person, never in record/export (C258); removal leaves record, grants, journals, summaries, history (C234, C257); multiple sponsors never learn of each other (C249); sponsor table is not `organizations`, sponsor user never an Actor (C230, C264); unlisted by default, banner opt-in, domain enumeration answered identically (C236, C319, C349 row); partner-in-portal: HR connection log names no employee (66.9).
- **Therapist about sponsorship:** no surface distinguishes a sponsored session (C242); `payerName`/`payerEmail` off therapist ledger (C243); one settled amount and status (60.17); residual timing inference accepted (C346).
- **Our own admins:** no screen joins a sponsor to a session, booking, date or patient name; sponsor totals or per-patient figures, never both in one filtered view (C244, 49.13); per-patient AI cost internal only, never patient, clinic or sponsor facing (C280); no admin impersonation (§3d, 20.9); staff see tickets not patient accounts (§3d); staff pages import no clinical module (20.9); passports readable only by the clinician and super admin, not same-org colleagues (C151); admin screenshots gitignored unless synthetic proven (C80, 70.6).
- **Clinic:** zero clinical access for manager/staff: no note, transcript, journal, summary, risk, diagnosis, evidence panel or copilot (C260, 54.9, 63.11); sees schedules, usage, bills, and patient identity as first name + last initial, disclosed and audited (C327; earlier "names" in C260/54.9); invoice never itemised to session (consent leak, C263); reporting floor (C262); sees nothing of an invited therapist until acceptance, which enumerates what is visible (C328); loses live views on departure, keeps financial record (C331); exports audited and watermarked (C334); cannot vouch licences (C267); supervision only via patient grant (C271); EHR page shows references and status, never note content (67.8); clinic staff never a `users` row (C324). VALUE-STATEMENTS VS-C2/VS-C5 promise no patient name at all, stricter than PLAN.
- **Partner:** webhooks carry event and id only (42.4); never flips an approval bit (40.3, §6); partner clinician is an ordinary grantee, patient can claim and leave (C277, 68.10); partner links revocable (C389); sandbox never touches a real patient (68.22); partner routes cannot reach clinical modules (C418); partner server is never the approving clinician (68.6).
- **Other clinicians:** co-treatment visible, other clinician's identity private (C276); revoked clinician gets nothing new (C47, 7.x); grant requires patient's own action (C107) and approved verification (C106).
- **Strangers/public:** nothing about a record before handle proven (C121); lookup never by name (C122); duplicate-number signup still reveals account existence (C187, recorded); `/verify` counts and date only (C143); provenance never on verification surface (C212 amendment); avatar 404 to strangers (C139); QR carries identity only (C120, C237); no third-party widgets on contact/help pages (C91, 18R.5); support messages never logged and never in prompts (C82, C91); nothing public names a patient or implies we read records (18.7).
- **Patient-facing limits:** patient never sees transcript or clinical note (15.8); never converses with a model; no unsigned model text (C113); no score verdicts (C278); no homework rates (C53); journals never claim anyone is watching (C123).
- **Channels:** no clinical content over WhatsApp (C64a); export never via WhatsApp (C128); ticket close via authenticated link (20.22); Egyptian data residency not yet achieved (30.4).
