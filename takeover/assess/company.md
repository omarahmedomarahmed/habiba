# Company (sponsor) portal, assessed screen by screen

Assessor: `assess-company`. Account: `habiba@24therapy.app` (Habiba Holdings). Walked 2026-09-22 on https://24therapy.app.
Screenshots: `evidence/assess/assess-company/NNN-...-after.png` (the `-before` of each is the page as it loaded).

STOP CHECK (patient name, session time, attendance): see the verdict line directly below, filled in once every screen was opened.

VERDICT: (pending)

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

