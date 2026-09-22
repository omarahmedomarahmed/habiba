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
- Arabic RTL: works; radio pair and ticks mirror correctly (008). "Pot" is rendered as "المحفظة" (wallet) here; check it is the same word on /sponsor/pot.
- Promise: E1 and E2, stated clearly ("Whether somebody attended, so attendance cannot be required through us"). Kept as words.
- Defects: orphan page with no chrome (003, 004); desktop has a large empty band on both sides and the card sits on bare grey, looks unfinished (003).

### /sponsor  (screenshots: 011, 012, 013; Arabic below)
- For: the employer's overview of the pot: what is left, what was spent, how often it is used. Does the screen say so? no. There is no page title at all; the first thing is the green top-up banner, then an unlabelled card whose small caps label is "LEFT IN YOUR POT".
- Next: nothing. No control on the page (INVENTORY: 0 controls). The only action a funder takes, topping up, lives on `/sponsor/pot` and is not linked from the balance or the bar.
- Missing: a page title; a link from the balance to the pot; any explanation that the balance is a published figure that lags (it says nothing about when it was last updated, so a reader takes it as live); the weekly empty state has no hint of when it will fill.
- Decoration: the "THIS PORTAL WILL NEVER SHOW YOU" list repeated on every page in the sidebar (desktop) or the page foot (mobile). Useful once, noise on eight pages, and false on `/sponsor/people`.
- Numbers: $2,330 left (published); 10% used and bar at 90% (mixed live/published, see top); $270 spent (live); 6 sessions (live); expires 22 Sept 2027; heatmap suppressed. Put in = $2,330 + $270 = $2,600, which matches the two invoices ($2,500 + $100), so at this moment the published balance equals the live one.
- 390px: works as a stack, but the tab bar is cut off at "Doma..." with no fade, arrow or scroll hint; Domains, Integrations and Settings are invisible until you swipe a bar that does not look swipeable (013). "Sign out" is the first control under the name, above everything, and closer to the thumb than any tab.
- Promise: E1 ("What you funded, what has been spent, and how many people used it. Never who they are and never when"). Broken: "how many sessions" is shown live, the balance is published but "spent" beside it is live, and with a one-person roster the session count is one named person's attendance (see top).
- Defects: top-up banner is EGP 142,500 while every figure on the page is USD, with no conversion shown (012); the banner is a saturated green (not the palette teal) that touches the card below with no gap (012, 013); "Dismiss" on the banner changes state (not pressed); the bar on this page is drawn as what is LEFT (90% full) and the bar on `/sponsor/pot` as what is USED (7% full), same pot, opposite senses (012 vs 014); `/sponsor` metadata title "Your account" vs tab "Overview".

### /sponsor/pot  (screenshots: 014, 015; Arabic below)
- For: the pot itself: balance, what share of a session the company covers, top-ups and invoices. Does the screen say so? no page title; the first card is just "$2,330 of $2,500 last added".
- Next: "Pay now" (top up) or "Edit what you cover". Neither pressed. "Pay now" has no amount, no currency and no sentence saying it is a top-up; next to "Your invoices" it reads like paying an outstanding invoice.
- Missing: page title; what "Pay now" pays; which rail and currency (the banner says EGP, the pot says USD); invoice rows have no number, status or "view" affordance, only a date and an amount (they are links, but look like plain text).
- Decoration: none really; the three coverage paragraphs are information, but in grey 12px (founder's "grey and thin text" complaint confirmed, 014).
- Numbers: $2,330 (published balance); "of $2,500 last added" (the last top-up, although $2,600 has been put in; the ratio is against the last top-up only, so the bar is not "how much of what you put in is used"); 60% covered, 40% paid by the person; invoices 22 Sept 2026 $2,500 and 22 Sept 2026 $100. None of these are per-session, so none move with a session except the balance at publication.
- 390px: works; single column, no sideways scroll; tab bar clipped as on every page (015).
- Promise: E3 and E4 in words ("Lowering it takes 30 days", "0% is allowed. Your people stay on your list"). Kept as text; I did not change coverage to prove it. E1 kept here (no per-person figure).
- Defects: invoice rows open a dead end (see next); bar sense opposite to overview; EGP/USD mismatch; "Pay now" unlabelled in purpose.

### /sponsor/pot/[txn]  (screenshots: 016, 017, 018, 019; Arabic below)
- For: one invoice for a top-up, printable. Does the screen say so? no: both real invoices (`1d675c7b...`, `9e5b2177...`) show only "We cannot issue this document yet. Ask us for it and we will send it to you."
- Next: "Ask us" but there is no link, address, button or form to ask with. Dead end.
- Missing: a way back to the pot (only the tab bar); a contact link; the invoice number, amount and date the person clicked (the page does not even repeat what row they came from); the reason it cannot be issued (it is `invoiceFor` returning `missing`, i.e. the company's legal details for the invoice header are not set).
- Decoration: none.
- 390px: works (018).
- Promise: none of E1..E5 directly; C3-style "one bill" does not apply. A screen serving no promise that is also a dead end.
- Defects: both invoices unavailable (016, 017); an unknown id gives the public 404 with "Back to home", which leaves the portal entirely (019).

### /sponsor/people  (screenshots: 020, 021; Arabic below)
- For: the list of people whose therapy the company funds, with a way to end someone's benefit. Does the screen say so? yes, "Who is on your list" and "Who is enrolled".
- Next: "End their benefit" (not pressed; it is the remove action). Adding people is not here: it happens through the joining code, and the page does not say so.
- Missing: a link to the joining code for "how do I add someone"; an empty-state-to-populated explanation; what "Last checked" means (only the foot line explains the 6 month re-check).
- Decoration: sidebar "never show you" list, which here is contradicted by the row beside it.
- Numbers: "1 people" (live roster count, and the grammar is wrong: "1 person"); "Last checked 22 Sept 2026" per person.
- 390px: works; the "End their benefit" button is grey text with no border, reads as a label, not a control (021). The green banner again sits flush on the heading.
- Promise: E1 "never who they are" and E2 "If a patient name appears anywhere, the walk stops there." **Broken: a patient's name is shown.** The subtitle "No session, no booking, no therapist and no date, in any form" is also contradicted by "Last checked 22 Sept 2026": `lastVerifiedAt` is set at enrolment, so for anyone never re-checked it IS the join date the roster query comment (`lib/data/sponsors.ts:98`) says must never be shown. E4 "at 0% the employee keeps their place on the roster" is served here as a place.
- Defects: named individual beside "Any individual, ever" (020); per-person date beside "no date, in any form" (020); "1 people" (020); remove button styled as plain text (021).

