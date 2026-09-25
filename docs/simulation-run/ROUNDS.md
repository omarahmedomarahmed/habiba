# Rounds

## R1, day 1 (clock started 2026-09-25 18:39 UTC)

| Agent | Steps done | Blocked | Bugs |
|---|---|---|---|
| THERAPISTS-A | 15 | 3 | 11 |
| THERAPISTS-B | 12 | 0 | 4 |
| CLINIC | 7 | 0 | 6 |
| COMPANIES | 9 | 1 | 7 |
| PATIENTS-A | 16 | 3 | 11 |
| OPS | 15 | 1 | 11 |
| PARTNER-WEB | 17 | 3 | 11 |

**What did not run, and why.** The two recorded sessions (`TH8` with `PA16`, `PA18`). The workflow runs about two agents at once on this machine, so THERAPISTS-A finished and left before PATIENTS-A started, and each waited on the board for the other and stood down. A run-design fault, not a product one: from R1b on, one agent plays both sides of every session.

### Facts later rounds need

- THERAPISTS-A: T1 Dr Amira Demo public id cc4f3d11-457b-4401-9b19-a3b6df5deea8, profile https://24therapy.app/t/cc4f3d11-457b-4401-9b19-a3b6df5deea8, 1000 EGP, licence EG-PSY-10041
- THERAPISTS-A: T2 Dr Yassin Demo public id 79e0c954-dd77-4fa7-a185-2a71570c96f9, profile https://24therapy.app/t/79e0c954-dd77-4fa7-a185-2a71570c96f9, 600 EGP, licence EG-PSY-10042
- THERAPISTS-A: T3 Dr Karim Demo public id 3a6eee6c-82f8-4590-a5a2-c1ecd622a7ec, profile https://24therapy.app/t/3a6eee6c-82f8-4590-a5a2-c1ecd622a7ec, 800 EGP, licence EG-PSY-10043, portal language Arabic
- THERAPISTS-A: All three are approved, time zone Africa/Cairo, region eg, with online hours Fri 25 23:00 and Sat 26 to Mon 28 10:00-19:00 (last start)
- THERAPISTS-A: P1 Layla record on T1: /patients/9f341400-9a08-463f-a25a-44c4030cc741; claim link https://24therapy.app/patient/invite/ZPgvEuhKkDMg-QsEAzgX_Q1PN39NFqV7 (the first link was cancelled)
- THERAPISTS-A: P2 Salma record on T1: /patients/f3ac17eb-6182-4d97-80a2-7239fb343299; claim link https://24therapy.app/patient/invite/Y4v8FFmj5_OsH-3_sUrYMFxlG0AgYdM5
- THERAPISTS-A: No session ids: neither TH8 session was created
- THERAPISTS-A: Scratch scripts are in /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/THERAPISTS-A/ (signup, th2, th2up, submit, th3, th4, addp, reinvite, lang, peek); generated documents are in its docs/ folder
- THERAPISTS-A: Board rows 11-85 are this agent's; DONE R1 is row 85
- THERAPISTS-B: T4 Dr Omar Demo: omar.demo@example.com / Simulation2026! (the reset set it back to the same password). Cookies are in .sim-state/T4.json
- THERAPISTS-B: T4 public page id / user id in the URL: e52c0885-9b00-41c8-a366-204d58ff7db8
- THERAPISTS-B: T4 verification after R1: rejected once (rejection 1) at 19:53:16. Note: 'The licence photo is blurred and the licence number on it cannot be read. Please upload a sharp photo of the whole syndicate card.' The 4 documents are still stored. Not resubmitted
- THERAPISTS-B: R2 plan: Replace the licence document (TH2.6), Submit (TH2.7), then SU4's second rejection clears the documents (TH2.8)
- THERAPISTS-B: The country select value is uppercase 'EG', not 'eg' as 00-LESSONS says
- THERAPISTS-B: Document PNGs are in /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/THERAPISTS-B/{id-front,id-back,licence,headshot}.png. Scripts are in the same folder
- THERAPISTS-B: One page load returned 'upstream request failed' once (a proxy error, not the product); the retry worked
- THERAPISTS-B: Page timings: /onboarding 3.3-5.3 s, /dashboard->/onboarding redirect 6.5 s, /login?reset=1 showed a skeleton for about 4 s before the notice. None went over 8 s
- THERAPISTS-B: Board rows posted: #86-#104
- CLINIC: Nile Practice is active. Hana (C1-M) password is Simulation2026! and her signed-in state is saved in .sim-state/C1-M.json
- CLINIC: Welcome link (now spent): https://24therapy.app/welcome/ae7GLP-FzbSBZeyxFx7X78hoyjTGqoh2uHIv6oNnhwI
- CLINIC: Nile Practice has 0 seats, 0 filled, 0 invited. Slider range is 0-20.
- CLINIC: Seat quote for 1 seat: EGP 4,000 a month and EGP 800 now for the 6 days left this month. Proration uses the days left in the month, not the 30 days predicted in CE13.
- CLINIC: /clinic/people invite form shows 'No free seat: this adds one. EGP 4,000 a month, EGP 800 now.'
- CLINIC: Hana's language preference is set back to English
- CLINIC: Screenshots are in /home/user/habiba/docs/simulation-run/shots/R1/C1-M-*.png. Scripts are in /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/CLINIC/
- CLINIC: No clinical content appeared on any clinic page. Empty states explain themselves: 'No appointments this week.', 'Nobody has joined yet.', 'Nothing billed yet.', 'Nothing earned here yet.', 'You have no roles yet...'
- COMPANIES: E1-HR Dalia signed in; cookies in .sim-state/E1-HR.json; password Simulation2026!
- COMPANIES: Cairo Foundry pot: $100 welcome credit + $500 net top-up = $600 (console Pot = Ledger 'Agrees.'); expires 25 Sept 2027
- COMPANIES: Top-up declared: $500, EGP 25,000 + VAT EGP 3,500 = EGP 28,500, reference CF-TOPUP-0925-001, receipt image /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/COMPANIES/receipt.png
- COMPANIES: Payment receipt txn: /sponsor/pot/43af6783-aa3d-4e04-9aac-691de6391790 (EGP 25,000); tax invoice EGP 28,500 'Being issued' (tax details not yet filled, CO7.3 is still open)
- COMPANIES: FX rate shown: EGP 50 per USD; session price used in the preview EGP 1,000
- COMPANIES: Coverage: 100% now; pending 80% from 25 Oct 2026 (day 30 of the month)
- COMPANIES: An open, unwanted EGP 5,700 pot top-up cart exists for Cairo Foundry (from the default Pay now step)
- COMPANIES: No joining code, no domain, no staff list, 0 people yet
- PATIENTS-A: P1 Layla: invite token ZPgvEuhKkDMg-QsEAzgX_Q1PN39NFqV7 (spent), T1 patient file 9f341400-9a08-463f-a25a-44c4030cc741, claimed with the profile kept visible to T1, language saved as Arabic (ar)
- PATIENTS-A: P2 Salma: invite token Y4v8FFmj5_OsH-3_sUrYMFxlG0AgYdM5 (spent), T1 patient file f3ac17eb-6182-4d97-80a2-7239fb343299, claimed without sharing her profile; password reset once (still Simulation2026!)
- PATIENTS-A: P1 booking: T1 Dr Amira (cc4f3d11-457b-4401-9b19-a3b6df5deea8), Sat 26 Sep 2026 10:00 Cairo, EGP 1,000, PAID by transfer ref LAYLA-IP-0925-001, join token 9UUhZat91y_Pl06LRICwBhoUggaS9mPT
- PATIENTS-A: P2 booking: T2 Dr Yassin (79e0c954-dd77-4fa7-a185-2a71570c96f9), Sat 26 Sep 2026 10:00 Cairo, EGP 600, PAID by transfer ref SALMA-IP-0925-001, session id 803bbdeb-8e81-48f3-9a0a-e42aa002193f, join token rY_MX-y00zEUIeVsugsUlu53CLSIrySw
- PATIENTS-A: PA16/PA18 still to run: room.mjs in /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/PATIENTS-A/ (args: key locale audio token maxMin; P1 ar-EG ar-first-p, P2 en-GB first-en-p)
- PATIENTS-A: Signed-in state in .sim-state/P1.json and .sim-state/P2.json
- PATIENTS-A: Board rows for PATIENTS-A: #139-#176; DONE R1 at #176
- PATIENTS-A: Screenshots: /home/user/habiba/docs/simulation-run/shots/R1/P1-*.png and P2-*.png (65 files)
- PATIENTS-A: Transfer receipts: scratchpad/sim/PATIENTS-A/receipt-P1.png, receipt-P2.png
- OPS: Nile Practice is active, region eg; its manager is hana.example@example.com (admin).
- OPS: Cairo Foundry id is c4ccf3ae-ab46-4296-98bf-f060032a7c16. It is active, entity EG, with pot $600 = ledger (the $100 welcome credit plus the $500 top-up from reference CF-TOPUP-0925-001), and dalia.example@example.com is admin. There is no joining code yet. Alexandria Textiles (262effbb-d93d-4370-af8e-6ea82446d94a) and Delta Logistics are still held.
- OPS: A stray awaiting_proof cart of $114 (EGP 5,700) for Cairo Foundry is still in the transfers 'opened and never submitted' list.
- OPS: Verifications: T1 Amira, T2 Yassin and T3 Karim are approved. T4 Omar is rejected once (rejection_count 1); a second rejection will clear his documents.
- OPS: The paid sessions are P2 Salma with T2 on Sat 26 Sep 10:00, EGP 600, join token rY_MX-y00zEUIeVsugsUlu53CLSIrySw, and P1 Layla with T1 on Sat 26 Sep 10:00, EGP 1,000, join token 9UUhZat91y_Pl06LRICwBhoUggaS9mPT.
- OPS: Helio Health is active and not approved for production; tamer.example@example.com is admin, with a /welcome link in his outbox (21:09:33).
- OPS: Staff cookie state is saved in .sim-state/{OP,OP2,SU1..SU5}.json, with the second factor passed (valid 12 hours, idle timeout 2 hours).
- OPS: The scripts are in /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/OPS/ (signin.mjs, visit.mjs, clinic*.mjs, sponsor.mjs, verify.mjs, transfer.mjs, partner.mjs, sponsordetail.mjs).
- OPS: Screenshots are in /home/user/habiba/docs/simulation-run/shots/R1/ under OP-*, OP2-*, SU1-* to SU5-*, and FOUNDER-*.
- OPS: Stale doc: flows PT6 says nothing writes partners.documents_url, but /admin/partners now has 'Where their documents are / Save the link'.
- PARTNER-WEB: Helio Health partner is active; D1 Tamer signs in at /partner/sign-in with tamer.example@example.com / Simulation2026!; cookies are saved in .sim-state/D1.json (the browser's locale was left at Arabic by the /ar portal walk; /en/partner did not switch it back)
- PARTNER-WEB: D1 is the only team member (Admin). No keys, webhooks or usage limit exist yet; keys are for R3
- PARTNER-WEB: D1 applied with phone +20 100 900 0061 (not in the cast file)
- PARTNER-WEB: Contact ticket from the visitor run: reference JAXBB6, from tamer.example@example.com, topic billing, entity eg (for SU5)
- PARTNER-WEB: Clinician public ids: T3 Karim /t/3a6eee6c-82f8-4590-a5a2-c1ecd622a7ec ($16 / EGP 800), T2 Yassin /t/79e0c954-dd77-4fa7-a185-2a71570c96f9, T1 Amira /t/cc4f3d11-457b-4401-9b19-a3b6df5deea8 ($20 / EGP 1,000)
- PARTNER-WEB: Published pricing: pay as you go $1 (EGP 50) + $3 AI; Therapist $80 (EGP 4,000); Clinic $72 a seat ($144 for 2); 15% cut; first session free; credit lasts 12 months
- PARTNER-WEB: sitemap.xml lacks /for-therapists, /for-companies, /for-clinics, /developers, /integrations, /verify; robots.txt is 'Disallow: /'
- PARTNER-WEB: The only link to /design is the console's /admin/content 'UI reference' card; /design returns 404 to a visitor
- PARTNER-WEB: Scratch scripts: /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/PARTNER-WEB/ (sweep-d.json and sweep-m.json hold the per-page results)
- PARTNER-WEB: Board rows 177-208 are this agent's; row 207 corrects 206

### Blocked steps

- THERAPISTS-A `TH8 (T1 with P1, ar-first)`: PATIENTS-A never appeared on the board (no PA7/PA10/PA16 rows, no .sim-state/P1.json) after about 50 minutes of waiting. No session was created or started. Run it again when PATIENTS-A is live: P1 claims with the link in board row 66 and books T1's hours.
- THERAPISTS-A `TH8 (T2 with P2, first-en)`: No P2 booking and no payment step (PA12.2 or AD5). SU1 also posted BLOCKED on the same step. No session was created.
- THERAPISTS-A `TH8.7 note check and transcript labels`: No session ran, so there was no note or transcript to check.
- COMPANIES `CO7.3`: Not in the R1 assignment; tax details were left empty, so the ETA document stays 'Being issued'
- PATIENTS-A `PA16.1-PA16.10, PA18.1 (P1 with T1, P2 with T2)`: THERAPISTS-A had already posted DONE R1 (row #85) before PATIENTS-A started. No T1 or T2 row came in 35 min after both bookings were paid (WAIT #173, BLOCKED #175). No hour was left today, so both bookings are Sat 26 Sep 10:00 Cairo. I did not join early because the room marks a session abandoned after 10 min of waiting. Rerun with /tmp/claude-0/-home-user-habiba/89298ea1-e9ec-57f4-b3b1-1c844ea86570/scratchpad/sim/PATIENTS-A/room.mjs <key> <locale> <audio> <token> <maxMin>, which joins, consents, waits for start and end, and opens the summary.
- PATIENTS-A `PA5.1 session expiry`: Needs 4 hours idle; cannot be reached in round 1
- PATIENTS-A `PA10 'an hour today'`: T1's and T2's last hour today was 23:00 Cairo. PATIENTS-A started at 23:17, and by the time of booking the earliest slot was Sat 26 Sep 10:00
- OPS `AD4.4 / AD5.1 / AD7.7 / PT2 (temporary)`: For about 45 to 60 minutes, THERAPISTS-B, PATIENTS-A, COMPANIES and PARTNER-WEB posted nothing, so I posted BLOCKED rows 79 to 82. All four agents came live later and every step was then completed. Nothing is left open.
- PARTNER-WEB `WB8`: /radar shows 'Nobody is online right now' and /api/radar returns therapists:[], so there is no 'Book now'. Retry once T3 is on call (R3).
- PARTNER-WEB `WB9`: 'Email me directions' appears only in the booking sheet of a clinician who is online (components/radar/booking-sheet.tsx), and nobody is online.
- PARTNER-WEB `WB7`: The form was opened but not confirmed on purpose. 02-THE-MONTH plays WB7 in R5, and an unpaid visitor hold would take an hour on a cast clinician's calendar. The lead decides whether to confirm one.
