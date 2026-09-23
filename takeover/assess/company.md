# Company (sponsor) portal, assessed screen by screen

Assessor: `assess-company`. Account: `habiba@24therapy.app` (Habiba Holdings). Walked 2026-09-22 on https://24therapy.app.
Screenshots: `evidence/assess/assess-company/NNN-...-after.png` (the `-before` of each is the page as it loaded).

**STOP: A PATIENT'S NAME IS ON SCREEN. `/sponsor/people` shows "Mariam Demo" (the demo patient the company pays for), with a per-person date "Last checked 22 Sept 2026" and an "End their benefit" button (screenshots 020, 021). The same page, in the sidebar beside it, says "THIS PORTAL WILL NEVER SHOW YOU: Any individual, ever", and its own subtitle says "no date, in any form".**

**STOP: ATTENDANCE IS DERIVABLE, BY NAME. `/sponsor` shows "Sessions paid for 6" and "Spent so far $270" as live ledger totals (`potTotals` in `lib/billing/pot.ts:997` is a plain `COUNT(*)`/`SUM` over `ledger_entries`, no floor, no publication), while the roster on `/sponsor/people` has exactly one name. One name plus a session count is that person's attendance: an employer reads "Mariam Demo has had 6 sessions", and by reloading daily reads the day each new one happened (012, 013, 020).**

Numbers and whether they move live, in brief (details under each page):

| Screen | Figure | Value seen 23:43 UTC | Live or published |
|---|---|---|---|
| /sponsor | Left in your pot | $2,330 | published (`potBalance`, republished only after `activityFloor` more sessions) |
| /sponsor | "You have used 10%" and the bar | 10% | MIXED: live spent / (published balance + live spent), so it moves with every session even while the balance is frozen |
| /sponsor | Spent so far | $270 | **LIVE** (`potTotals`) |
| /sponsor | Sessions paid for | 6 | **LIVE** (`potTotals`) |
| /sponsor | Expires | 22 Sept 2027 | static |
| /sponsor | Weekly spend heatmap | suppressed ("Not enough activity") | floored per week |
| every page | top-up banner | EGP 142,500, Paid | event (changes when a transfer is confirmed) |
| /sponsor/pot | Balance | $2,330 "of $2,500 last added" | published |
| /sponsor/pot | What you cover | 60% / 40% | setting |
| /sponsor/pot | Invoices | 22 Sept 2026 $2,500; 22 Sept 2026 $100 | top-up events, not sessions |
| /sponsor/people | "1 people" | 1 | live roster count |

The balance's publication rule is undone by the two figures beside it: spent moves by one session's share ($45 here: 60% of $75) at every session, and the session count moves by one. Publishing the balance every five sessions protects nothing while those two are live.

---

### /sponsor/sign-in  (screenshots: 001, 002, 005, 006, 007)
- For: the organisation's own sign-in. Does the screen itself say so? yes, "Your organisation's account", with "I run a company" selected in the role switch.
- Next: type email and password, press Sign in. Obvious.
- Missing: nothing structural. "No account yet? Create one" leads to `/sponsor/apply`, which is an enquiry ("we will call you"), not account creation, so the link text over-promises; "Ask us to call" would be honest.
- Decoration: the navy promise card with three ticks is marketing on a sign-in page; the full public footer (20 links) under a sign-in form.
- 390px: works. Form first, promise card below, no sideways scroll (002).
- Arabic RTL: works. dir=rtl, all strings translated, role pills mirror (006, 007).
- Promise: E2 in words ("Nobody at the company ever sees a clinical note"). But the second tick says "Watch the pot, the spend and the take-up, month by month", while `/sponsor/apply` says "A weekly figure, never a daily one" and the dashboard is a weekly heatmap. Three different cadences claimed across three screens.
- Defects: wording mismatch above; "Create one" is not what happens.

### /sponsor/apply  (screenshots: 003, 004, 008, 009)
- For: an organisation asks to be called so an account can be set up. Does the screen say so? yes, "Tell us who you are and we will call you. Nothing is set up until we have spoken."
- Next: fill six fields, press "Ask us to call". Obvious. (Not pressed.)
- Missing: no header, no logo, no language control, no footer and no way back. A person who lands here from `/for-companies` or from the sign-in "Create one" has only the browser back button; a person already on Arabic cannot switch back from this page, nor switch to Arabic from here. No hint of what "Best time to call" wants (free text, no example, no time zone). No "already have an account? sign in" link.
- Decoration: none; the "AN EMPLOYER HERE" sees / never sees card is information and is the best statement of E1/E2 in the portal.
- 390px: works, single column, list card stacks (004).
- Arabic RTL: works; radio pair and ticks mirror correctly (008). "Pot" is rendered as "المحفظة" (wallet) here, and "محفظتك" (your wallet) on the portal tab: consistent, though "wallet" suggests a personal account rather than a company fund.
- Promise: E1 and E2, stated clearly ("Whether somebody attended, so attendance cannot be required through us"). Kept as words.
- Defects: orphan page with no chrome (003, 004); desktop has a large empty band on both sides and the card sits on bare grey, looks unfinished (003).

### /sponsor  (screenshots: 011, 012, 013; Arabic below)
- For: the employer's overview of the pot: what is left, what was spent, how often it is used. Does the screen say so? no. There is no page title at all; the first thing is the green top-up banner, then an unlabelled card whose small caps label is "LEFT IN YOUR POT".
- Next: nothing. No control on the page (INVENTORY: 0 controls). The only action a funder takes, topping up, lives on `/sponsor/pot` and is not linked from the balance or the bar.
- Missing: a page title; a link from the balance to the pot; any explanation that the balance is a published figure that lags (it says nothing about when it was last updated, so a reader takes it as live); the weekly empty state has no hint of when it will fill.
- Decoration: the "THIS PORTAL WILL NEVER SHOW YOU" list repeated on every page in the sidebar (desktop) or the page foot (mobile). Useful once, noise on eight pages, and false on `/sponsor/people`.
- Numbers: $2,330 left (published); 10% used and bar at 90% (mixed live/published, see top); $270 spent (live); 6 sessions (live); expires 22 Sept 2027; heatmap suppressed. Put in = $2,330 + $270 = $2,600, which matches the two invoices ($2,500 + $100), so at this moment the published balance equals the live one.
- 390px: works as a stack, but the tab bar is cut off at "Doma..." with no fade, arrow or scroll hint; Domains, Integrations and Settings are invisible until you swipe a bar that does not look swipeable (013). "Sign out" is the first control under the name, above everything, and closer to the thumb than any tab.
- Arabic RTL: translated, but three numeral styles on one screen (Eastern digits for money, Western for % and session count, Western in the banner) and "$US" (033, 034). Details in the Arabic pass section.
- Promise: E1 ("What you funded, what has been spent, and how many people used it. Never who they are and never when"). Broken: "how many sessions" is shown live, the balance is published but "spent" beside it is live, and with a one-person roster the session count is one named person's attendance (see top).
- Defects: top-up banner is EGP 142,500 while every figure on the page is USD, with no conversion shown (012); the banner is a saturated green (not the palette teal) that touches the card below with no gap (012, 013); "Dismiss" on the banner changes state (not pressed); the bar on this page is drawn as what is LEFT (90% full) and the bar on `/sponsor/pot` as what is USED (7% full), same pot, opposite senses (012 vs 014); `/sponsor` metadata title "Your account" vs tab "Overview".

### /sponsor/pot  (screenshots: 014, 015; Arabic below)
- For: the pot itself: balance, what share of a session the company covers, top-ups and invoices. Does the screen say so? no page title; the first card is just "$2,330 of $2,500 last added".
- Next: "Pay now" (top up) or "Edit what you cover". Neither pressed. "Pay now" has no amount, no currency and no sentence saying it is a top-up; next to "Your invoices" it reads like paying an outstanding invoice.
- Missing: page title; what "Pay now" pays; which rail and currency (the banner says EGP, the pot says USD); invoice rows have no number, status or "view" affordance, only a date and an amount (they are links, but look like plain text).
- Decoration: none really; the three coverage paragraphs are information, but in grey 12px (founder's "grey and thin text" complaint confirmed, 014).
- Numbers: $2,330 (published balance); "of $2,500 last added" (the last top-up, although $2,600 has been put in; the ratio is against the last top-up only, so the bar is not "how much of what you put in is used"); 60% covered, 40% paid by the person; invoices 22 Sept 2026 $2,500 and 22 Sept 2026 $100. None of these are per-session, so none move with a session except the balance at publication.
- 390px: works; single column, no sideways scroll; tab bar clipped as on every page (015).
- Arabic RTL: the whole "What you cover" card is untranslated English (035, 036). Details in the Arabic pass section.
- Promise: E3 and E4 in words ("Lowering it takes 30 days", "0% is allowed. Your people stay on your list"). Kept as text; I did not change coverage to prove it. E1 kept here (no per-person figure).
- Defects: invoice rows open a dead end (see next); bar sense opposite to overview; EGP/USD mismatch; "Pay now" unlabelled in purpose.

### /sponsor/pot/[txn]  (screenshots: 016, 017, 018, 019; Arabic below)
- For: one invoice for a top-up, printable. Does the screen say so? no: both real invoices (`1d675c7b...`, `9e5b2177...`) show only "We cannot issue this document yet. Ask us for it and we will send it to you."
- Next: "Ask us" but there is no link, address, button or form to ask with. Dead end.
- Missing: a way back to the pot (only the tab bar); a contact link; the invoice number, amount and date the person clicked (the page does not even repeat what row they came from); the reason it cannot be issued (it is `invoiceFor` returning `missing`, i.e. the company's legal details for the invoice header are not set).
- Decoration: none.
- 390px: works (018).
- Arabic RTL: translated; same dead end (037, 038).
- Promise: none of E1..E5 directly; C3-style "one bill" does not apply. A screen serving no promise that is also a dead end.
- Defects: both invoices unavailable (016, 017); an unknown id gives the public 404 with "Back to home", which leaves the portal entirely (019).

### /sponsor/people  (screenshots: 020, 021; Arabic below)
- For: the list of people whose therapy the company funds, with a way to end someone's benefit. Does the screen say so? yes, "Who is on your list" and "Who is enrolled".
- Next: "End their benefit" (not pressed; it is the remove action). Adding people is not here: it happens through the joining code, and the page does not say so.
- Missing: a link to the joining code for "how do I add someone"; an empty-state-to-populated explanation; what "Last checked" means (only the foot line explains the 6 month re-check).
- Decoration: sidebar "never show you" list, which here is contradicted by the row beside it.
- Numbers: "1 people" (live roster count, and the grammar is wrong: "1 person"); "Last checked 22 Sept 2026" per person.
- 390px: works; the "End their benefit" button is grey text with no border, reads as a label, not a control (021). The green banner again sits flush on the heading.
- Arabic RTL: "1 أشخاص" and a gendered "أنهِ ميزته" (039, 040).
- Promise: E1 "never who they are" and E2 "If a patient name appears anywhere, the walk stops there." **Broken: a patient's name is shown.** The subtitle "No session, no booking, no therapist and no date, in any form" is also contradicted by "Last checked 22 Sept 2026": `lastVerifiedAt` is set at enrolment, so for anyone never re-checked it IS the join date the roster query comment (`lib/data/sponsors.ts:98`) says must never be shown. E4 "at 0% the employee keeps their place on the roster" is served here as a place.
- Defects: named individual beside "Any individual, ever" (020); per-person date beside "no date, in any form" (020); "1 people" (020); remove button styled as plain text (021).

### /sponsor/code  (screenshots: 022, 023, 041, 042)
- For: the joining code (and QR poster) employees use to enrol. Does the screen say so? yes, "Your joining code. Circulate this internally."
- Next: nothing. It says "You have no joining code yet." and offers no button, no link and no reason. The reason (from `/sponsor/domains`: "Two proofs for each one. Neither on its own issues a joining code") is on a different page and is not linked. Dead end.
- Missing: the route to a code (prove a domain, link to Domains); a note that one person is nevertheless already enrolled, so the reader wonders how.
- Decoration: none.
- Numbers: none shown in this state (the code card, when present, shows attempt counts; not seen).
- 390px: works (023).
- Arabic RTL: translated and mirrored (041, 042).
- Promise: none of E1..E5 directly; it is the door employees come in by. Not kept: the door is shut and the page does not say how to open it.
- Defects: dead-end empty state (022, 023). Print and rotate buttons listed in INVENTORY are not rendered in this state, so they were not seen.

### /sponsor/domains  (screenshots: 024, 025, 043, 044)
- For: proving the organisation owns its email domain, one of two proofs before a joining code can exist. Does the screen say so? partly: "Two proofs for each one. Neither on its own issues a joining code." It never names the two proofs or says what they unlock in plain words.
- Next: type a domain, press Add (not pressed). Obvious.
- Missing: what the two proofs are, in order; a link on to `/sponsor/code` once done.
- Decoration: the "No domains yet" empty state takes a whole tall card (founder complaint "empty states taking a whole card" confirmed, 025).
- 390px: works; the page body is indented further than every other page (extra inner padding, 025 vs 023), so the heading does not line up with the banner.
- Arabic RTL: **entire page untranslated**: "Your domains", "No domains yet", "Add a domain", "Add" all English inside an RTL layout, with full stops jumping to the start of lines (".joining code", ".its own") (043, 044).
- Promise: none directly; prerequisite for the joining code.
- Defects: untranslated page (043); oversized empty state (025); inconsistent padding (025).

### /sponsor/domains/confirm/[id]  (screenshots: 030, 031, 045, 046 failed with "upstream request failed" from the proxy, retried as 051)
- For: the person at the company's domain confirms their mailbox is real, from a link in an email. Does the screen say so? yes.
- Next: "Yes, this mailbox is ours" (not pressed).
- Missing: validation of the id. A made-up id (all zeros) shows the full page and the confirm button; nothing tells the reader the link is wrong until they press. Also, from code, `lib/routing.ts:299` opens only `/sponsor/apply` to strangers, so this page sits behind the sponsor sign-in, while the email goes to "somebody at that domain" who may have no sponsor account (not observed, I was signed in).
- Decoration: none.
- 390px: works (031).
- Arabic RTL: **hardcoded English** (title and subtitle are literals in `app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx`, body in the component), punctuation displaced in RTL (045).
- Promise: none directly.
- Defects: untranslated (045); accepts any id (030); probably unreachable for its intended reader.

### /sponsor/integrations  (screenshots: 026, 027, 047, 048)
- For: connect an HR system to answer "does this person work here". Does the screen say so? yes, "Connect your HR system. One question, answered from your own system".
- Next: pick an HR system, press "Turn it on" (not pressed). What happens after is not said: no mention of credentials, who at IT does it, or what "on" looks like.
- Missing: what turning it on requires and what it costs; a status line (is anything connected now?).
- Decoration: none; "What this does not do" is information and good.
- 390px: works (027).
- Arabic RTL: translated; the select shows "Workday" with the chevron correctly on the left (047).
- Promise: E2 in spirit ("never store a staff list"). But `/sponsor/people` IS a staff list with names, which makes "There is no table one could go in" read as untrue to the person who just looked at their list.
- Defects: contradiction with the roster; no status.

### /sponsor/settings  (screenshots: 028, 029, 049, 050)
- For: what an employee must give to enrol (domain email or staff number), and whether the company is findable without a code. Does the screen say so? yes, "How people join".
- Next: choose a requirement, fill it, "Add this"; or press "Reachable only with your code" (a toggle whose label is the current state, not the action; not pressed, because it changes a setting).
- Missing: the current configuration: nothing on the page says what employees are asked today (no list of existing gates is shown, although someone did enrol); "How would you describe a valid one" is shown under the email-domain choice where it makes no sense.
- Decoration: none.
- 390px: works, but neither Integrations nor Settings is visible in the tab bar, so on this page no tab is highlighted at all (029, 049).
- Arabic RTL: translated and mirrored (049).
- Promise: none of E1..E5 directly; a screen to argue for. E2 is supported ("never anything about health").
- Defects: toggle labelled with its state; missing current configuration; active tab not visible on mobile.

### Arabic pass on the pages above (screenshots 033 to 040)
- `/sponsor` (033, 034): translated. Money is set in Eastern Arabic digits ("٢٬٣٣٠") with the symbol printed "$US", while "10%", "6" (sessions) and the banner's "142,500 ج.م." are Western digits: three numeral styles on one screen. Bar fills from the right, correct.
- `/sponsor/pot` (035, 036): **the whole "What you cover" card is untranslated English** ("What you cover", "of a session. Your people pay the other 40%", "Edit what you cover", the three rules), with "0%" and the full stops thrown to the wrong ends of lines. The top card mixes "من US$ ٢٬٥٠٠ أضيفت آخر مرة". "Pay now" and invoices are translated.
- `/sponsor/pot/[txn]` (037, 038): translated; same dead end.
- `/sponsor/people` (039, 040): translated, but "1 أشخاص" (plural with one) mirrors the English "1 people"; the remove button reads "أنهِ ميزته" ("end HIS benefit"), gendered; the name stays Latin.
- Mobile tab bar in Arabic is clipped on the left: Integrations and Settings are off screen (033).

## Did anything move live during the walk?
Figures read at 23:43 and again at 23:49 UTC on `/sponsor`: $2,330 / 10% / $270 / 6, unchanged. No session came out of this pot during the walk, so I could not see a movement on screen. The live/published verdicts above are from the code the page calls (`app/(sponsor)/sponsor/page.tsx`, `lib/billing/pot.ts:997`, `lib/data/sponsors.ts:241`), and the arithmetic on screen agrees with it: 6 sessions x $45 = $270, $2,330 + $270 = $2,600 = the two invoices. The balance republishes at session 11 (floor 5, `lib/settings/defs.ts:659`); sessions 7 to 10 would each move "Spent so far" by $45, "Sessions paid for" by 1 and "used %" upward while the balance stays at $2,330.

## The five screens most in need of redesign
1. `/sponsor/people`: shows a patient's name and a per-person date under a promise that it never will. The redesign has to decide whether an employer sees names at all (E1 says never who); if it must, the "never show you" copy has to be rewritten to be true, and the date has to go.
2. `/sponsor` (overview): two live totals beside a published balance undo the publication rule; with a small roster they are a named person's attendance. Show only published figures, say when they were published, and link to the pot. Add a title.
3. `/sponsor/pot`: untranslated coverage card, a "Pay now" with no amount or purpose, a bar drawn the opposite way to the overview's, EGP banner against a USD pot, invoice rows that look like text and lead nowhere.
4. `/sponsor/code` + `/sponsor/domains` as one flow: a new company lands on "You have no joining code yet" with no way forward; the way forward is two tabs away, untranslated, and never names its two proofs. This is one onboarding flow split across three pages.
5. `/sponsor/pot/[txn]`: every invoice is "We cannot issue this document yet. Ask us" with nothing to ask with.

## Screens with no door
- `/sponsor/domains/confirm/[id]`: only from an email; no link in the portal (expected), but it sits behind a sign-in its intended reader may not have.
- `/sponsor/apply`: reached from `/for-companies` and the sign-in "Create one", but it has no door OUT (no header, no footer, no back link).
- `/sponsor/pot/[txn]`: reached only by clicking an invoice row that does not look like a link.
- The sign-in "Create one" does not lead to account creation, so the self-serve door the words promise does not exist.

## Patterns across the portal
- Good: every page states its limits in plain words; the weekly-only heatmap explains why ("A single day's spend can identify a person"); coverage rules (raise now, lower in 30 days, 0% is not removal) are said where the control is; no sideways scroll on any page at 390px in either language.
- Bad: no page on the overview or pot has a title; the saturated green "top-up paid" banner with "Dismiss" sits on every page, flush against the content below, in EGP; the "THIS PORTAL WILL NEVER SHOW YOU" list is repeated on every page and is false on one; the mobile tab bar hides three of seven tabs with no scroll cue and often hides the active one; grey 12px body copy for the rules that matter most; empty states either take a whole card (Domains) or are dead ends (Code, invoice); Arabic coverage is patchy: Domains, Confirm and the Pot's coverage card are English; numerals mix Eastern and Western on one card; the cadence promised changes by page (month by month on sign-in, weekly on apply and overview).

## Founder complaints (TAKEOVER s10), as seen here
- Grey and thin text everywhere: confirmed (pot rules, overview captions, settings hints; 014, 029).
- Teal reading as green: the teal buttons read as teal here; the green that reads as green is the top-up banner, which is not teal at all (012).
- A price badge reading as part of the price: not seen in this portal.
- Radar globe empty: not in this portal.
- `/for-patients` repetition, five heroes: not in this portal.
- Empty states taking a whole card: confirmed on `/sponsor/domains` (025); `/sponsor/code` and the invoice page are the opposite fault, a one-line card with no way on.
- Therapist calendar, session room: not in this portal.
- Two overlays in front of a form: not seen; the banner sits above every form but does not cover it.
