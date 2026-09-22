# Slice 10: components-care

Read in slice order. Findings sections (Stale, Suspect, Broken, ...) are at the end and were
appended to as the read went on.

## Files

### components/assessments/clinician-assessments.tsx (289 lines)
- For: clinician's panel on a patient page to send an instrument (live "room" or homework), poll progress, see score/band and per-item timings.
- Decides: live-room send offered only when `liveSessionId` is set (143-152), so no `mode=room` with null session; whole send area hidden unless `canSend` (123, revoked access sends nothing); band shown only from a poll result (216-220); timings only after `status === "completed"` (241) and only on click (272-279). Polling is manual, by button (221-228), not a timer.
- Assumes: `pollAssessment` returns a null band until completed (comment 30-32); `sendAssessment`/`timingsFor` check the grant server side (`app/(app)/patients/[id]/assessments/actions`). `canSend` is only a UI hide.
- Promises: none of the 25 directly (T5 adjacent: revoked access). Unclaimed instruments feature (MAP Unclaimed 7).
- Notes: `send()` (96-105) shows nothing on success, no confirmation and no new row appears unless the action revalidates the page; a clinician may press it twice. RTL: layout uses flex/gap and `justify-between`, no physical left/right; fine. 390px: `flex-wrap` on the select row and on the row header; the timings `li` puts instrument text beside `shrink-0` value, fine. English: none in JSX; `" · "` separators only.

### components/assessments/patient-questionnaire.tsx (230 lines)
- For: patient answers an instrument one question at a time, with timing per answer.
- Decides: resumes at first unanswered question (68-71); forward goes to next unanswered, not index+1 (140-141); finish called automatically when every key answered (125-133); never shows a score, band or running total (29-35); question and option text come verbatim from the instrument in the locale, falling back to English (97); timing held in a ref, reset per question shown (82-88).
- Assumes: `answerQuestion` clamps >5 min as absent (comment 42-43, server side); `instruments_translation_reviewed` constraint refuses an unreviewed Arabic translation (93-95).
- Promises: none directly.
- Notes: if `finishAssessment` errors (126-129) the patient sees the error on the last question with every option already answered; pressing an option again re-answers and retries finish, so there is a way out. Progress label shows `index + 1` while the bar shows `answered` (154 vs 159/165), which can disagree when revisiting. RTL: `text-start` on options (188-189), bar fills from the start side via width (in RTL a plain width div in an LTR-less container still starts at the inline start, fine). 390px: full-width buttons, fine. English: none in JSX; the fallback to `text.en` means an Arabic viewer sees English questions when no reviewed Arabic exists, deliberately.

### components/assistant/assistant-chat.tsx (243 lines)
- For: the clinician's general copilot chat with threads, patient-name links built from server-stored mentions.
- Decides: links rendered only from `message.mentions` the server stored (`Linked`, 223-243, comment 16-22), so a hallucinated name is plain text; remaining quota shown as "left" (148).
- Assumes: `ask`, `startThread`, `removeThread` in `app/(app)/assistant/actions` enforce ownership and quota; `linkRoster` in `lib/assistant/roster`.
- Promises: T5 adjacent (a clinician asking about patients); this is the general assistant, not the per-patient copilot, and nothing here shows a source sentence.
- Notes: HARD-CODED ENGLISH: `{remaining} left this month` (148). On `ask` error the optimistic question stays with no answer (64-67), fine. `removeThread` of a non-current thread (121-126) does not remove it from the list unless the action revalidates, since `threads` is a prop. `startThread` failure is silent (94-95). Delete icon `text-slate-300` (127) is low contrast. RTL: bubbles use `ms-auto` (163), logical. 390px: grid is one column below `lg`, the thread list sits above the chat, fine.

### components/assistant/prefs-prompt.tsx (141 lines)
- For: one-time card asking the clinician copilot answer language, voice and speed.
- Decides: both "Save" and "These are fine" call the same `save` with current values (122-137), so skipping stores defaults and stamps prefs set (comment 29-35).
- Assumes: `savePrefs` clamps speed (see prefs-settings comment 27-29).
- Promises: none.
- Notes: HARD-CODED ENGLISH: `Speed · {speed.toFixed(1)}×` (107). `NOTE_LANGUAGES` labels rendered raw (84), whatever language they are in the schema. `savePrefs` result ignored, card dismissed even on failure (56-57). RTL: grid, fine; range input direction flips in RTL natively.

### components/assistant/prefs-settings.tsx (135 lines)
- For: the same three copilot prefs on the settings page.
- Decides: same `savePrefs` action as the prompt (123).
- Assumes: as above.
- Promises: none.
- Notes: HARD-CODED ENGLISH: `Speed · ...×` (100). Shows "Saved" even if the action failed, result ignored (123-124). Duplicates `VOICES` map from prefs-prompt.tsx (12-17 in both).

### components/auth/auth-shell.tsx (225 lines)
- For: the shared chrome for the four self-serve sign-in/sign-up doors (`AuthShell`) and the two quiet doors, staff and partner (`QuietAuthShell`).
- Decides: door switcher from `doors(t, kind)` with the current door as a non-link span with `aria-current` (89-107); flip link to the same principal's other kind (127-132); quiet shell has no switcher (186-192).
- Assumes: `lib/auth/doors` (`doors`, `otherWay`) lists four doors; `SiteHeader`/`SiteFooter` from `components/public/site-chrome`.
- Promises: A5 adjacent (staff door has no public link).
- Notes: `QuietAuthShell` ALWAYS renders `<h1>{title}</h1>` (216). The comment at 199-204 says omit `title` because an empty string renders an empty h1, but omitting it still renders an empty h1; and `app/(auth)/staff/sign-in/page.tsx:35` passes `title=""` anyway, while `StaffSignInForm` renders its own h1 (forms.tsx:133). Staff sign-in therefore has an empty h1 followed by a second h1. RTL: grid and flex only, `px-1`, no physical sides; `lg:grid-cols-[1fr_22rem]` flips naturally. 390px: one column below `lg`, the promise column falls under the form; `px-4`, fine. English: none, all `t()`.

### components/auth/forms.tsx (310 lines)
- For: clinician sign-in, staff sign-in, clinician sign-up, forgot and reset password forms.
- Decides: staff form posts hidden `audience=staff` (152) to the same `signIn` action; `withLinks` splits a dictionary row on `{slot}` so translators keep clause order (36-45); `PatientDoor` link to `/patient/login` on forgot and reset forms (280, 307).
- Assumes: `lib/auth/actions` (`signIn`, `signUp`, `requestPasswordReset`, `resetPassword`) enforce lockout, timing equality, audience routing.
- Promises: A5 adjacent.
- Notes: the `PatientDoor` comment (56-64) says "every one of them carries the way out" for "these four pages"; only Forgot and Reset render it; SignIn and SignUp rely on AuthShell's switcher instead (stale comment). Staff form links `/forgot-password` (181), the clinician reset; comment says "It is the same one", so a staff reset lands back on `/login` via "Back to sign in" (275), not `/staff/sign-in`. `/login` literal inside the staff body (140) is fine as a path. RTL: `text-center`, grids; fine. 390px: sign-up puts first and last name in `grid-cols-2` (197) at every width, two ~170px inputs at 390px, tight but workable. English: `placeholder`-free; none.

### components/clinical/attribute-transcript.tsx (179 lines)
- For: after-session transcript where the clinician marks each line you / them / not sure.
- Decides: lines owned by a separated voice (`voiceBound`) are a label, not a control (126-141), since the DB refuses a per-line disagreement; optimistic update reverted on error (60-75); "one microphone" explanation when more than 60% of at least 4 lines are unknown (102-103); dotted "guessed" marker cleared by a local correction (168).
- Assumes: `attributeLine` in `app/(app)/sessions/[id]/actions` checks ownership; DB trigger refusing per-line attribution on voice-bound segments.
- Promises: T1 (note written from what was said, attribution honesty).
- Notes: `guessed` marker reappears after reload if the server keeps `inferred` true after a correction; comment says a clinician's correction clears it (165-166), which is the server's job. Buttons `text-[11px]` with `py-1`, tap targets around 24px tall on a phone (152), under the 44px rule the rest of the slice uses `tap-target` for. RTL: flex-wrap, fine. English: none.

### components/clinical/connect-panel.tsx (150 lines)
- For: clinician redeems a patient's invite code (`RedeemInvite`), and answers patients' requests for their history (`HistoryAsks`).
- Decides: copy never implies the code grants access, it asks (10-16); decline and add are equally cheap buttons, reason optional (119-143).
- Assumes: `useInviteCode`, `answerHistoryAsk` in `app/(app)/connect/actions`; `state.waitingOnVerification` when the clinician is not yet approved (56-60, grant trigger 0060).
- Promises: P4 (patient decides who reads), kept as far as this component goes: nothing is granted here.
- Notes: `HistoryAsks` shares ONE `useActionState` across all rows (91), so one error shows at the top for whichever row failed, no per-row feedback, and after answering nothing on the row changes unless the action revalidates. `placeholder="ABC-DEF"` (35) is a literal, fine. `useInviteCode` is named like a hook but is a server action (ESLint rules-of-hooks would flag if there were a linter). RTL: fine. 390px: `min-w-[10rem] flex-1` with wrap, fine.

### components/clinical/evidence-panel.tsx (260 lines)
- For: the clinician's "why the system believes this" list of clinical facts, each with its quote, source, age, contradictions, and confirm/dispute.
- Decides: quote always visible under the fact (152-161); AI facts show confidence together with "unverified" (140-146); contradictions shown, not resolved (187-198); dispute requires going through a textarea (202-232).
- Assumes: `confirmFact`/`rejectFact` in `app/(app)/patients/[id]/evidence/actions` check the grant.
- Promises: T5 adjacent (source sentence attached); here the sentence is attached to facts, not to copilot answers.
- Notes: HARD-CODED ENGLISH on the most important disclosure: `"confirmed by you"` and `` `confidence ${...}, unverified` `` (143-144). Raw identifiers rendered: `domain` as a heading (100), `field` (128), `other.sourceType` (193), probably English enum strings. After confirm the card does not change locally (242-244) unless revalidated. Dispute sends an empty reason if the textarea is empty (217); whether the action refuses is server side. Error `<p>` has no `role="alert"` (200). RTL: `border-s-2 ps-3` and `me-1.5` logical (153, 247), good. 390px: header wraps, fine.

### components/clinical/note-card.tsx (187 lines)
- For: read-only SOAP note card, used in the portal and on the marketing site with fixtures.
- Decides: a missing SOAP section renders "not written" in amber rather than vanishing (104-110); status pill draft / approved / generating (166-187); `status` defaults to `"draft"` (17).
- Assumes: callers pass the real status.
- Promises: T1 ("says draft on every screen until signed"): the default is draft, so a caller that forgets the prop shows Draft, the safe failure. Kept here.
- Notes: no author name or credentials on the card at all; P3 needs those on the patient's summary, which is a different component (`PatientBriefCard`), see below. RTL: flex and gap, fine. English: none.

### components/clinical/patient-brief-card.tsx (87 lines)
- For: "what the patient actually receives" (brief, steps, next line), rendered on the clinician's review screen and on the patient's page.
- Decides: `dir` set from an `rtl` boolean (49); paragraphs split on newline (46).
- Assumes: callers pass translated labels.
- Promises: P3: this component carries NO clinician name, credentials, or signed/unsigned state. Whether the summary "carries a clinician's name and credentials" depends entirely on the caller.
- Notes: RTL DEFECT: `rtl && "text-end"` (49) inside `dir="rtl"`: `text-end` is the END side, which in RTL is the LEFT. Arabic paragraphs, which would right-align by default, are forced to align left. HARD-CODED ENGLISH: "Nothing written for the patient yet." (58), defaults `stepsLabel = "Before we next meet"` and `nextLabel = "Next session"` (34-35). The comment at 7-15 says both call sites must never disagree; if either omits the labels, English appears there.

### components/clinical/risk-assessment.tsx (185 lines)
- For: server component; the clinician's per-session risk assessment card: level, source, quoted findings, protective factors, prior history, discarded unquoted findings.
- Decides: prior history shown to the clinician but not to the classifier (19-27, 156-175); findings quoting text not in the transcript are counted and dropped (177-182); date formatted with the reader's locale and the server-given zone (77-87).
- Assumes: `priorRiskFor` elsewhere; classifier module does not import it.
- Promises: none of the 25 (crisis scanning is Unclaimed, MAP 5).
- Notes: ALMOST ENTIRELY HARD-CODED ENGLISH on a crisis screen: `INDICATOR_LABEL` map (32-44), "Risk assessed for this session · {level}" (98), source sentences (112-113), "confidence" (125), "Matched:" (139), "Also said, for the safety plan:" (145), "Before this session" (160), history disclaimer (171-172), the discarded-findings sentence with English pluralisation (179-180). Level, source and prior `row.level`/`row.source` rendered as raw enum strings (98, 166). The comment at 77-86 fixed the date locale and left every sentence around it in English. RTL: flex, gap; fine. 390px: fine.

### components/clinical/risk-banner.tsx (159 lines)
- For: clinician-facing live risk alert (`RiskBanner`) and the patient-facing support notice on a join link (`PatientSupportNotice`), which share no props.
- Decides: crisis line per reader's country or null, never `tel:988` (42-50); null renders a sentence, not a number (89-94); patient variant shows no level, no phrases (111-115); menu steps in `ar` or `en` only (19).
- Assumes: `CrisisLine` from `lib/crisis/line`; a test asserting the patient invariant.
- Promises: P5 adjacent (crisis line reachable).
- Notes: `t("risk.detected", { level })` interpolates the raw enum (`elevated`, `critical`) into a translated sentence (67), so Arabic reads with an English word. `CrisisSteps` falls back to English for any locale other than `ar` (19), fine for two locales. `\u0000` split trick (140-151) works only if the translated row keeps the `{label}` slot. RTL: `-m-2` symmetric, fine.

### components/clinical/transcript-panel.tsx (173 lines)
- For: presentational live transcript (portal and marketing), auto-scroll only when pinned to the bottom.
- Decides: scroll dependency is a signature of count, last id and last length (77-88), fixing 76.67; unpins when scrolled up more than 28px (90-95).
- Assumes: nothing fetched.
- Promises: T2 adjacent (shows Paused vs Recording when `live`).
- Notes: HARD-CODED ENGLISH: "Transcript" header (102). Dead ternary: both speaker colours are `text-brand-300` (147). `aria-live="polite"` on a panel that updates every few seconds (131); HAZARDS H8 says one polite region per screen, and the room also has other live regions (check session-room). RTL: fine.

