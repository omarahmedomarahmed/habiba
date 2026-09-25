# The month: seven rounds, who acts, and how time passes

## How a month happens in a few sessions

Agents act live, at real speed, through the real product. Between rounds the **clock** moves:
`sim:clock` shifts every timestamp and date in every table back by the simulated gap, so the
product's "now" becomes the next round's day. Past records become older, and deadlines that were
in the future come closer or pass, exactly as they would if the days had gone by. An invitation
with seven days left on day 1 has expired by day 14; a 30-day notice given on day 1 runs out on
day 30. Nothing is special-cased.

```
npm run on:production -- sim:clock -- --start          once, at the start of round 1
npm run on:production -- sim:clock -- --to-day 7       between rounds
npm run on:production -- sim:clock -- --show           which day it is
```

`npm run verify:clock` proves the move on a scratch table: past, future and date columns all
move by the same amount, and no trigger stamps the real time.

### Three rules for the clock

1. **Never move it with a session in progress.** Every room is ended and every agent has
   posted `DONE` for the round before the lead moves the clock. A session left live would come
   back days long.
2. **Fire every job at the end of each round, and again after every move, in this order**, then
   run `npm run on:production -- verify:migrations`. Before the move, so what the round did is
   charged and reminded inside the jobs' own windows (`ME61`); after it, so the new day's
   deadlines are acted on:

   | Job | What it must show after the move |
   |---|---|
   | `/api/cron/crisis` | Waiting patients warned, overrun sessions closed, crisis follow-ups kept in the outbox |
   | `/api/cron/reminders` | Session reminders, unpaid bookings released, wallet holds swept, payment reminders |
   | `/api/cron/billing` | Bills due, plans lapsed or renewed, pot alerts, the one-person digest, payouts released |
   | `/api/cron/retention` | Expired carts, tokens and grants cleared |
   | `/api/cron/extract` | Notes' facts extracted for the record and the copilot |
   | `/api/cron/licences` | Licences near or past expiry flagged |
   | `/api/cron/radar` | Radar presence and claims tidied |
   | `/api/cron/webhooks` | Partner webhook deliveries retried |

   Each is `curl -s -H "Authorization: Bearer $CRON_SECRET" https://24therapy.app/api/cron/<job>`,
   run by the lead from the terminal with the secret from the environment, never written down.
   The scheduled Vercel runs keep firing on real time too, which is consistent with the moved
   clock.
3. **Everyone signs in again at the start of every round.** Moving the clock ages every login;
   staff second steps last 12 hours in any case. Invented staff read their code with
   `npm run on:production -- sim:inbox -- <address>`. The founder's code arrives in the
   founder's real inbox and is pasted into the chat.

## The rounds

| Round | Day | Clock | What the round is about |
|---|---|---|---|
| R0 | before | not started | Setup (`00-START-HERE.md`), the founder signs in, the website walked |
| R1 | 1 | `--start` | Arrivals: therapists apply, the first patients sign up, applications approved, first sessions |
| R2 | 3 | `--to-day 3` | The practice and the first company come alive; enrolment; a second rejection |
| R3 | 7 | `--to-day 7` | Follow-up sessions, the copilot, homework, history access, two more companies, the partner |
| R4 | 14 | `--to-day 14` | Mid-month: payouts, refunds, a risk session, no-show recovery, a cheaper replacement, in-person paid |
| R5 | 21 | `--to-day 21` | Change of employer, a pot runs dry, a clinician leaves, the vault, support queues |
| R6 | 28 | `--to-day 28` | Late arrivals, the month's bills, money back to a company, partner usage |
| R7 | 31 | `--to-day 31` | The month closed: the coverage notice from day 1 in force, reports read, every proof in `07-THE-RECORD.md` |

The simulated month is the thirty days before the real date of the last round, so it crosses
the start of a real calendar month. Monthly bills, the partner bill and monthly allowances turn
over at that boundary, in whichever round's jobs first run after it; the lead notes which in
`ROUNDS.md`.

A re-run round for failed flows is named after the round it repeats (`R3b`) and runs at that
round's day, after the fix is deployed.

## The agents

Eight agents and the lead. Each agent plays the cast members in its row, one browser context per
person (a phone-sized context for patients), and posts every step to the board.

| Agent | Plays | Portal |
|---|---|---|
| LEAD | The founder (`omarabdelgawad001@gmail.com`), the clock, the jobs | Console, terminal |
| OPS | `OP`, `OP2`, `SU1` to `SU5` | Console |
| THERAPISTS-A | `T1`, `T2`, `T3` | Therapist portal |
| THERAPISTS-B | `T4`, `T5`, `T6` | Therapist portal |
| CLINIC | `C1-M`, `C1-S`, `C1-A` | Clinic portal, and the therapist portal for `C1-A` |
| COMPANIES | `E1-HR`, `E2-HR`, `E3-HR` | Company portal |
| PATIENTS-A | `P1`, `P2`, `P3` | Patient app |
| PATIENTS-B | `P4`, `P5`, `P6`, `P7` | Patient app |
| PARTNER-WEB | `D1`, and an anonymous visitor | Partner portal, API, public website |

## Every flow, placed

The first round a flow runs in, and who plays it. A flow that recurs (sign-in, sessions, the
transfer queue) runs again in later rounds as the story needs, and the board shows each run.

| Flow | Round | Played by | Waits on or is waited on by |
|---|---|---|---|
| `WB1` to `WB9`, `WB13`, `WB14`, `WB19` | R0 | PARTNER-WEB visitor | nobody |
| `AD1` | R0, every round | LEAD | the founder pasting the code |
| `AD2` | R0 | LEAD, OPS | `SU1` to `SU5` sign in |
| `AD3` | R0 | OPS as `SU2` | nobody |
| `AD14` | R0 | LEAD | nobody; settings checked, rates as expected |
| `TH1` | R1 | THERAPISTS-A `T1` `T2` `T3`, THERAPISTS-B `T4` | nobody |
| `TH2`, `AD4` | R1 | `T1` to `T4` submit; OPS `SU4` approves `T1` `T2` `T3`, rejects `T4` | `T4` resubmits in R2, rejected again in R3, approved in R4 |
| `TH3`, `TH4` | R1 | `T1` `T2` `T3` | patients book the hours they open |
| `TH5`, `PA7`, `PA1`, `PA6` | R1 | `T1` invites `P1` and `P2`; they sign up and claim | `P1` `P2` wait on `T1`'s invite |
| `PA2`, `PA3`, `PA4`, `PA5` | R1 | `P1`, `P2` | `PA3` reads its code from the outbox |
| `PA9`, `PA10` | R1 | `P1` books `T1`, `P2` books `T2` | `T1` `T2` hours from `TH4` |
| `PA12`, `AD5` | R1 | `P2` pays by transfer; OPS `SU1` confirms | `P2` waits on `SU1` |
| `TH8`, `PA16`, `PA18` | R1 | `T1` with `P1` (`ar-first.wav`), `T2` with `P2` (`first-en.wav`) | each side waits on the other at the door |
| `CL1`, `AD12` | R1 | OPS `OP` activates Nile Practice; CLINIC `C1-M` sets the password | `C1-M` waits on `OP` |
| `CO1`, `AD7` | R1 | `OP` activates Cairo Foundry and opens its pot; COMPANIES `E1-HR` signs in | `E1-HR` waits on `OP` |
| `CO7` | R1 | `E1-HR` tops up by transfer; OPS `SU3` confirms | `E1-HR` waits on `SU3` |
| `CO8` | R1 | `E1-HR` sets 100% coverage, then lowers it to 80% with 30 days' notice (`EE14`): 100% all month, 80% from day 31 | checked in R7 |
| `PT1`, `PT2`, `PT3`, `PT4` | R1 | PARTNER-WEB `D1` applies; LEAD approves | `D1` waits on the founder |
| `CL3`, `CL4`, `CL5`, `CL6`, `CL8`, `TH20` | R2 | `C1-M` invites `C1-A`, cancels a second invite, sets seats, delegates to `C1-S` | `C1-A` waits on the invite |
| `CL2`, `CO2` | R2 | `C1-S`, `E1-HR` reset their passwords | the reset code from the outbox |
| `CO3`, `CO4`, `CO5`, `CO6` | R2 | `E1-HR` adds a teammate, makes a joining code, uploads the staff email list, tries a domain | `P3` `P4` wait on the list |
| `PA25`, `WB15` | R2 | PATIENTS-A `P3`, PATIENTS-B `P4` enrol; `P4` is refused by staff number first | `E1-HR`'s list |
| `PA13` | R2 | `P3` books `T1` covered 100% | the pot from R1 |
| `PA19`, `TH18` | R2 | `P2` changes one booking and cancels another; `T2` cancels one with a reason | each other |
| `TH6` | R2 | `T3` holds an in-person session, paid directly, recorded with consent | nobody |
| `TH9` | R2 | `T1` invites `P3` to a paid video session from the chart | `P3` |
| `TH8`, `PA16` again | R3 | `T1` with `P1` and `P3` (`follow-up-en.wav`) | the door |
| `TH10` | R3 | `T1` asks the copilot about `P3` across two sessions | `P3` granted access |
| `TH11`, `PA21` | R3 | `T1` sets homework and a questionnaire; `P1` `P3` answer, journal | each other |
| `PA20` | R3 | `P3` grants `T1` access "until I change my mind", `P1` grants 24 hours | `T1` |
| `PA22`, `PA26`, `PA27` | R3 | `P1` (in Arabic), `P3` | nobody |
| `CO1` again | R3 | `OP` activates Alexandria Textiles and Delta Logistics; `E2-HR`, `E3-HR` sign in | `OP` |
| `PA25` again | R3 | `P5` enrols with Alexandria Textiles at 10% | `E2-HR` |
| `ME74` to `ME78` | R3 | `P5` books `T2`; `SU1` confirms the patient's share; `E2-HR` reads the ledger | each other |
| `PA28`, `WB10`, `WB11`, `WB12`, `WB16`, `WB17`, `WB18` | R3 | `P6` joins by link with no account; `P2` uses a support reply link | `T2` sends the link |
| `PT5` to `PT15`, `PT17`, `PT18`, `PT20` | R3 | `D1` makes keys, calls the API, sets webhooks, adds a teammate | LEAD for production approval (`PT6`) |
| `PA11`, `TH16`, `AD15` | R3 | `P1` books through the crisis radar; `T3` is on call; OPS `OP2` reviews a report | `T3` online first |
| `TH12` | R3 | `T1` reads notifications and writes to support | `SU5` answers in `AD17` |
| `TH15`, `AD9` | R4 | `T1` requests a payout; `SU4` approves and marks it sent | `SU4` |
| `AD10`, `ME82` to `ME86` | R4 | `SU1` refunds `P2` for a cancelled paid session; `P5`'s split refund | `P2`, `P5` |
| `TH8` with `risk-en.wav` | R4 | `T2` with `P3`: the note flags risk; crisis follow-up kept in the outbox | the door |
| `PA17`, `TH13` | R4 | `P4` waits for `T3`, who does not come, and moves to cheaper `T2`; `T1` hands `P2` over to `T2` | each other |
| `PA15`, `PA8`, `TH7`, `TH17` | R4 | `T1` runs an in-person session paid through us, by wall QR; `P4` scans and pays | each other |
| `PA14` | R4 | `P2` sees the card option; the card rail is off in Egypt, so the page must say so | nobody |
| `TH14`, `ME80`, `ME83`, `ME84` | R4 | `T2` subscribes to a plan by transfer; `T3` pays part of the bills and cancels one payment | `SU2` confirms |
| `TH2` again | R4 | THERAPISTS-B `T4` approved after two rejections; `T5` signs up with the wrong country, corrects it | `SU4` |
| `ME87`, `CL6` | R4 | `C1-M` adds a seat mid-month for `T5` and reads the quote first | `T5` |
| `CO11`, `PE13`, `PE14` | R5 | E1's pot runs low, then dry, as `P3` and `P4` book within a minute | `E1-HR` reads the alerts |
| `CO9`, `AD13` | R5 | `E2-HR` ends `P5`'s benefit; `P5` enrols with Delta Logistics | `E3-HR` |
| `CL7`, `CL9`, `CL11` | R5 | `C1-M` removes `C1-A`; reads the week and exports it | `C1-A` |
| `AD11`, `AD6` | R5 | `OP` and `OP2` post a ledger adjustment (two people); `SU1` matches money with no claim | each other |
| `AD16`, `AD17` | R5 | LEAD reviews clinician accounts; `SU5` works the support and number-change queues | `P1` asks to change the phone number |
| `AD18` | R5 | LEAD posts an announcement (every active clinician is invented by now), edits a string, a content page, a check-in | nobody |
| `PA23`, `PA24` | R5 | `P1` switches to Arabic then back, adds an email; `P2` reads receipts and wallet | nobody |
| `PA20` again | R5 | `P1` revokes `T1`'s access; the copilot stops on the next question | `T1` |
| `TH19`, `WB6`, `WB7` | R5 | `T5` reads their public page; the visitor books from it | nobody |
| `TH1`, `TH14` for `T6`; `PA1` for `P7` | R6 | `T6` arrives on pay as you go; `P7` books `T6` three times | each other |
| `ME82` | R6 | `T6` pays the first bill by transfer, over the amount | `SU2` |
| `CL10` | R6 | `C1-M` pays the practice bill by transfer | `SU2` |
| `CO10`, `CO12`, `AD8` | R6 | `E3-HR` reads published figures and asks for unspent money back; `OP` and `OP2` send it | each other |
| `CO13` | R6 | `E1-HR` opens the hidden integrations page as a viewer | nobody |
| `PT16`, `PT19` | R6 | `D1` reads usage and the overview | nobody |
| `PA29` | R6 | `P7` looks for a way to delete the account | nobody |
| `AD19` | R7 | LEAD reads every observation page and the jobs panel | nobody |
| `AD20` | R7 | LEAD confirms `/dev` pages are shut on production | nobody |
| Every flow's month-end screens | R7 | Everyone reads their own portal's month | nobody |

Every edge case in `04-THE-EDGES.md` runs in the round its flow runs in, by the same agent,
unless its row names another round.

## What each day must show

The lead checks these after each clock move and the jobs, before the round's agents start.

| Day | Must be true |
|---|---|
| 3 | Reminders for the day's sessions kept in the outbox; an unpaid booking older than 24 hours released |
| 7 | Staff invites older than 7 days refused; wallet holds from cancelled bookings returned |
| 14 | Licence warnings for any licence within 30 days; payouts past their window flagged overdue |
| 21 | Company pot alerts sent once each; old carts cleared by retention |
| 28 | Plans due in the next days listed in billing; the reduced coverage still pending |
| 31 | The coverage reduction from day 1 in force; the vault shows the month's income and model spend |
