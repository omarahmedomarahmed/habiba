# Demo

Every person on production is invented. Two casts exist, and a database holds whichever was
seeded last. Production holds the **event cast** (ruling N23).

| Cast | Source | Logins | Seed and prove |
| --- | --- | --- | --- |
| Event cast: Cairo Foundry, Mariam Hassan, Dr Karim Nabil and 20 more, all shareable | `scripts/_event-cast.ts` | `docs/DEMO-LOGINS.md` (generated, safe to hand to strangers) | `npm run on:production -- seed:demo -- --scenario=event`, then `npm run on:production -- verify:event-demo` |
| Everyday cast: twelve logins used for the five test positions below | `scripts/_demo-cast.ts` | The block at the end of this page (generated) | One of the five positions below |

`seed:demo` deletes every person on the database it is pointed at and keeps configuration,
prices and the published website (it counts those tables before and after). Take a Neon
snapshot of production first. `npm run logins` rewrites `docs/DEMO-LOGINS.md`, the block below
and `docs/simulation/01-THE-CAST.md` from the cast files; edit the cast files, not the output.

Three everyday logins never take the published password: the platform admin, the support
account and the company. Their password is `DEMO_PRIVATE_PASSWORD` in the operator's
`.env.local`; without it the seed gives them a random one. Console logins also ask for a code
from an authenticator app.

## The five test positions

Each position is a complete starting state for the everyday cast, built to prove named
promises from `scripts/_value-statements.ts` (`npm run prove` prints all 25 with where we make
each claim and what proves it). Sign everybody out before reseeding, and always run the
verifier with the same name: it is the only proof the seed did what was asked.

| Position | Puts the product into | Proves | Seed, then verify |
| --- | --- | --- | --- |
| `live` | A clinician invites a patient to a paid session, and they meet | P1, P2, P3, T1, T2, T4, A1 | `npm run on:production -- seed:demo -- --scenario=live`, then `npm run on:production -- verify:demo -- --scenario=live` |
| `money` | The covered employee, the part payment, and money nobody can match | E1, E2, E3, T3, A2, A3, A4 | `npm run on:production -- seed:demo -- --scenario=money`, then `npm run on:production -- verify:demo -- --scenario=money` |
| `continuity` | A record moving between clinicians, and one nobody has claimed | P3, P4, T5, C2, C5 | `npm run on:production -- seed:demo -- --scenario=continuity`, then `npm run on:production -- verify:demo -- --scenario=continuity` |
| `crisis` | Somebody in trouble with an unpaid bill, and every dead end | P5, A3, A5 | `npm run on:production -- seed:demo -- --scenario=crisis`, then `npm run on:production -- verify:demo -- --scenario=crisis` |
| `growth` | A practice taking somebody on, a pot running dry, a seat leaving | C1, C3, C4, E4, E5 | `npm run on:production -- seed:demo -- --scenario=growth`, then `npm run on:production -- verify:demo -- --scenario=growth` |

The same commands without `on:production --` seed and verify the dev database.

| Promise | Says |
| --- | --- |
| P1 | Pick someone free and pay, and the session opens once the payment is confirmed |
| P2 | Nothing the product tells you is only in an email |
| P3 | Nothing written by a machine reaches you unsigned |
| P4 | One record, however many therapists; every version stays under its author's name |
| P5 | A crisis path that never depends on money |
| T1 | The note, before you stand up, written from what was actually said |
| T2 | Take it off the record for a minute and nothing in that minute is kept |
| T3 | What you owe comes out of what you earn before it reaches your account |
| T4 | An invite link works for a stranger or for a patient already signed in |
| T5 | Only a clinician the patient chose can ask the copilot, only about them, only while allowed |
| C1 | Add a clinician and they reach the radar once their licence is verified |
| C2 | The practice sees a first name and last initial, and nothing clinical |
| C3 | One bill for the practice, not one per clinician |
| C4 | A seat leaving mid-month lowers the next bill by exactly one seat |
| C5 | Earnings per clinician |
| E1 | Who is enrolled, what you funded and every session's money; never who, which therapist or the day |
| E2 | No screen could show a note, a session time or an attendance list |
| E3 | A price somebody was shown is a price they are owed |
| E4 | Setting coverage to zero is not removing somebody |
| E5 | When the pot runs out the patient is told to ask HR, not shown a payment error |
| A1 | Nothing is granted before a person confirms it |
| A2 | Pressing Confirm twice moves the money once |
| A3 | A rejection is a sentence in the operator's own words, read verbatim by the payer |
| A4 | Money with no claim is a line somebody decides about, never silently kept |
| A5 | A role is a list, not a rank, and every read is written down |

### What these positions cannot prove

Every person in them is seeded, with history and a known password. They cannot prove a
stranger's sign-up, Arabic on a small phone, or what a screen says when something fails on
purpose; those need their own walk. Logins at `example.com` receive no email, so anything that
must arrive in an inbox is walked on one of the cast's real addresses.

## The everyday cast

<!-- logins:demo-cast:start -->

Generated by `npm run logins` from `scripts/_demo-cast.ts`, between the two markers. Edit
that file, not this block.

Seeded by `seed:demo` in any of its five positions. The event cast (`--scenario=event`)
replaces it; which one a database holds is whichever was seeded last.

One password for every patient, clinician and the clinic:

    Demo2026!Therapy

🔴 **Except three, which never take it:** the platform admin, the support account and the
company. This repository is public, so a password written here is a password every reader
holds, and those three open the production console and a company's money. Their password
is `DEMO_PRIVATE_PASSWORD` in the operator's own `.env.local`, which is never committed;
without it the seed gives each a random password nobody is told.

`npm run on:production -- verify:demo` reads every row back out of the database, checks
the password actually opens it (and that the published one does NOT open the three),
and checks that what each portal would show is not
empty. The second half is the one that matters: a seed can write every row correctly and
still produce a caseload the clinician cannot see.

#### Who they are

| Who | Sign-in page | Address |
| --- | --- | --- |
| Platform admin (private password) | `/staff/sign-in` | `omarabdelgawad001@gmail.com` |
| Support, not a founder (private password) | `/staff/sign-in` | `staff.demo@example.com` |
| Company (Habiba Holdings) (private password) | `/sponsor/sign-in` | `habiba@24therapy.app` |
| Clinic manager (Nile Practice) | `/clinic/sign-in` | `habibaheikal27@gmail.com` |
| Therapist, solo practice | `/login` | `dr.omar.demo@example.com` |
| Therapist, clinic, 2 patients | `/login` | `dr.sara.demo@example.com` |
| Therapist, clinic, 1 patient | `/login` | `dr.kareem.example@example.com` |
| Clinician still applying | `/login` | `dr.yasmin.example@example.com` |
| Patient, not enrolled | `/patient/login` | `mr.3omar.a7mad@gmail.com` |
| Patient, company pays | `/patient/login` | `mariam.demo@example.com` |
| Patient, record handed on | `/patient/login` | `tarek.demo@example.com` |
| Patient, Dr Kareem's | `/patient/login` | `nadia.demo@example.com` |

#### The one with no way in, which is a state rather than a gap

`laila.demo@example.com` has a record on Dr Omar's list with her address on it, a session
behind her and **no account**. She has never claimed it. That is the state the whole
claim flow exists for and the one nobody ever has on a test database, so it is seeded
deliberately and `verify:demo` fails if anything gives her a login.

#### What each one opens onto

| Login | Not empty because |
| --- | --- |
| Platform admin | a verification waiting, a confirmed transfer, a payout to send, a support ticket, 20 ledger entries |
| Company | a pot with money in it, three sessions it paid 60 per cent of, one employee enrolled |
| Clinic manager | two clinicians on seats, eight sessions between them |
| Therapist, solo | three patients, nine completed sessions with approved notes, one booked ahead |
| Therapist, clinic (Sara) | two patients, four sessions, one record handed to her by another practice |
| Therapist, clinic (Kareem) | one patient, four sessions |
| Clinician still applying | **nothing, deliberately.** This is the screen between applying and being let in |
| Patients | sessions, an approved summary, homework and a journal each |
| Patient, not enrolled (Omar) | 500 cents in his wallet, spent automatically on his next booking (ruling 7) |
| Every clinician | mornings bookable online or in person at an invented practice, afternoons online (ruling 5c) |

#### Console accounts ask for a second step

After the password, the admin and support accounts ask for a code from an authenticator
app; there is no emailed code. An account with no app sets one up on that page at its first
sign-in (scan the QR code, keep the recovery codes). With `DEMO_TOTP_SECRET` (base32) in
`.env.local` when seeding, the support account starts enrolled and `npm run -s totp:now`
prints its current code.
<!-- logins:demo-cast:end -->
