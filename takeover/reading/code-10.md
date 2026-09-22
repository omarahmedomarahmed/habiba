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

### components/copilot/chat.tsx (988 lines)
- For: the per-patient case copilot: ask questions about one patient, citations, voice dictation of questions, read-aloud, per-patient answer language, standing corrections, reset.
- Decides: optimistic question removed on error or quota exhaustion (180-190); live-session indicator polled every 15 s from `/copilot/live?patient=` (108-132), failed polls silent; dictation audio posted to `/api/copilot/voice`, text dropped into the box, never auto-sent (228-230); read-aloud posts the answer text to `/api/copilot/speak` (266-271); reset keeps `session_note` messages (549-557); language control reverts on error (808-816); corrections listed so they can be checked (902-934).
- Assumes: `askCopilot` in `app/(app)/copilot/actions` enforces the grant (T5), the quota and citation building; `Citation` carries `sessionDate`, `atSeconds`, `speaker`, `quote`.
- Promises: T5 "the copilot answers with the sentence it came from attached": PARTLY. Each citation renders as a chip showing only date and timestamp (622-638); the source sentence is shown only after the clinician clicks a chip (659-677), one at a time. An answer with zero citations is still rendered, with an amber "no source" badge (640-642), so an uncited answer can reach the screen. Revocation: nothing client side; a revoked grant surfaces only as whatever `result.error` says on the next ask (186-189), which matches "stops on the next question" if the action checks every call (cannot tell from here).
- Notes: `correctCopilot` failure is silent (973-978): no error state in `CorrectionBox`, the box just stays open with the text, so a clinician may think it saved. `removeCorrection` failure also silent (922-924). `setCopilotLanguage` failure reverts without a message (814). `locale` declared and unused in `ResetBox`, `LanguageBox`, `CorrectionBox` (693, 803, 859). Send is Ctrl/Cmd+Enter only (394). Therapist bubble uses physical `rounded-br-sm` (584), so in RTL the tail corner is on the wrong side; `justify-end` is logical. `"العربية"` literal (829) is correct as a language self-name. Voice speed saved `onPointerUp`/`onKeyUp` with the closure's `speed` (503-504), may save the previous value if no re-render happened between the last change and release. 390px: aside stacks under the chat below `lg`; composer is `sticky bottom-0` (374) and on a phone the patient bottom nav is not here (clinician side), fine. English: none in JSX besides the self-name.

### components/documents/add-document.tsx (226 lines)
- For: clinician adds a document to a patient: upload a file, type, or dictate with the browser's Web Speech API.
- Decides: dictation runs on the device, stored as `dictated`; editing by hand after dictating flips it back to typed (176-182); dictation button hidden where the API is absent (186); recognition language is the page's `lang` (110).
- Assumes: `onUpload`/`onNote` bound by `document-panel.tsx` to server actions with the patient id in a closure.
- Promises: P4 adjacent (provenance on the record).
- Notes: Cancel/`reset` (74-80) does not stop an active recognition; results keep arriving and refill `body` after cancel, and `listening` stays true until the browser ends it. File input not cleared on reset (fine, it unmounts). `recognition.lang` of `ar` for an Arabic page, so an English-speaking clinician on the Arabic UI dictates in Arabic mode (commented as the honest failure). RTL: `file:me-3` logical (165). English: none.

### components/documents/diagnosis-list.tsx (188 lines)
- For: diagnoses proposed from documents, with the source sentence quoted above the confirm button, and clinician confirm/reject.
- Decides: the sentence is rendered for proposed and confirmed rows (106, 126); confirm and reject only when `canDecide` (128); "read documents" re-proposes (65-81).
- Assumes: `decideDiagnosis`, `proposeFromDocuments` check the grant.
- Promises: none of the 25 (source-sentence discipline like T5).
- Notes: HARD-CODED ENGLISH: reject button "No" (146); flag reasons rendered as `flag.reason.replace("_", " ")` (102), raw English enum and only the first underscore replaced. Rejected diagnoses are dropped from the view entirely (46-47), no way to undo a mistaken No. Confirmed-row header `flex` without wrap (94) holding label, code, badge and every flag badge: overflows at 390px when flags exist. RTL: `border-s-2 ps-2.5` logical (175).

### components/documents/document-list.tsx (299 lines)
- For: a person's documents, same list for clinician and patient: provenance, searchability label, read-aloud, flag, open with watermark.
- Decides: bytes always via `/api/documents/<id>` (consent check and audit per comment 25-29); read-aloud posts an id, not text (126-139); watermark overlaid on images (250-273); flag never deletes (214-221).
- Assumes: `/api/documents/[id]` and `/api/documents/[id]/speak` check consent and audit (not in slice).
- Promises: P4 adjacent.
- Notes: "The label is the feature" (15-21) and the label is English: `searchabilityLabel` in `lib/documents/formats.ts:102-120` returns literal English ("Searchable", "Image, not searchable", ...), rendered at 167 on both the clinician's and the PATIENT's screen. HARD-CODED ENGLISH also: `Flagged: {reason}` (170), `Open {document.title}` (290). DEFECT: `speak()` sets `speaking` true and on a non-OK response returns without resetting it (131-132), so the button stays disabled on "Reading..." until reload. Object URL never revoked (133). Non-image files open in a new tab with no watermark (284-291), which the copy admits (282). RTL: `me-1.5`, `ms-auto` logical (157, 204). 390px: buttons wrap; the image viewer `overflow-auto` with `max-h-[70vh]`, fine.

### components/documents/document-panel.tsx (53 lines)
- For: clinician wrapper binding upload, note and flag actions with the patient id in a closure.
- Decides: patient id is a closure argument, not a form field (14-18).
- Assumes: actions re-check server side (comment 18).
- Promises: none directly.
- Notes: `canAdd` hides only the add control; flagging is always offered to the clinician (47-49).

### components/documents/own-profile-panel.tsx (70 lines)
- For: the patient's own documents, read and flag only; points to the journal instead of uploading.
- Decides: patient upload removed (17-29); zone from `useReaderZone` after mount (39-44).
- Assumes: `flagOwnContent` in `app/(patient)/patient/profile/actions`.
- Promises: P4 (the patient sees what was added about them, with who added it).
- Notes: the English searchability label (see document-list) lands here on a patient's screen. First render in UTC then the reader's zone, so dates may visibly shift after hydration (40-43).

### components/feedback/rating-form.tsx (517 lines)
- For: the public `/feedback/[token]` page: patient rates the therapist, the session and (if not already) the app, gives an email, then sees their summary; also the report box (no-show refund, or abuse report to 24Therapy).
- Decides: summary only after the form is sent (`done`, 130-181), and the form requires both star ratings, the app rating unless already given, AND an email containing "@" (185-186); the done screen chooses "on its way" / "still writing" / "keep the link" copy (141-145); brief rendered through `PatientBriefCard`, the same component the clinician approved on (154-162); no-show button only when `paid` (435); reports go to 24Therapy, not the clinician (390-398).
- Assumes: `lib/data/feedback.ts:155-159` passes `brief` only when the note is signed and `notePending = !signed` (checked: handled there); `rateSession`/`reportSession` in `app/feedback/[token]/actions.ts`.
- Promises: P3 PARTLY: no unsigned text reaches the patient here (brief is null until signed, handled in `lib/data/feedback.ts:155`), and the "still writing" state names the clinician's first name (144); but the summary itself carries NO clinician name and NO credentials (156-165), which P3's proof requires. P2: the summary is on the page, not only in email, kept, but only after the patient gives stars and an email address (186): somebody who will not rate cannot read their own summary on this page. A1: see Broken below.
- Notes: HARD-CODED ENGLISH, much of it on a public page a patient reads after a session: "How was your session with {name}?" (199), the session-vs-therapist explanation (212-214), button "Sending…"/"Send me my summary" (289), star `aria-label` "`${star} out of 5`" (341), both report confirmations (466-467), report headings (475), report explanations (479-480), buttons "Sending…"/"Refund me"/"Send to 24Therapy" (509). Tag options `THERAPIST_TAGS`/`SERVICE_TAGS` rendered raw (383). The abuse copy says "We can look at the session record, including any period the recording was paused" (480): this is a claim that paused (off-the-record) periods are available to staff, which contradicts T2 ("nothing in that minute is kept") unless it means only the timestamps of the pause. The no-show confirmation says "Your payment has been refunded ... The refund reaches your card in a few days" (466) UNCONDITIONALLY; see Broken. `brief` falls back to the clinician's `noteContent.summary` when `patientBrief` is absent (`lib/data/feedback.ts:155`), so the patient may be shown the clinical summary line written for the chart. RTL: `text-start` on report buttons (439, 447); `PatientBriefCard` gets `rtl` from the NOTE's language (131), not the page's locale, and carries the `text-end` defect. 390px: stars are 5 x 44px tap targets, fine; report buttons `flex gap-2` without wrap (507), two buttons fit.

### components/homework/clinician-homework.tsx (287 lines)
- For: clinician's homework panel: trend counts, skip streak, drafted steps from the last note, add/withdraw steps.
- Decides: trend and streak only on the clinician side (14-21); completion rate null shows "-" not 0% (132-137); streak badge at 3 or more (106); withdraw only for open steps and only with `canAssign` (210).
- Assumes: `lib/data/homework.ts` returns a different query to the patient; `setStep`/`removeStep` check the grant.
- Promises: none of the 25.
- Notes: drafted steps keyed by title (152), duplicate titles collide. RTL: `border-s-2 ps-2.5` (204). English: none. 390px: fine.

### components/homework/patient-steps.tsx (145 lines)
- For: the patient's open homework steps with "I did this" and "I could not" buttons and an optional note.
- Decides: no counts, no rate, no streak in props (16-19); both answers equal weight (123-134).
- Assumes: `answerStep` in `app/(patient)/patient/homework/actions` revalidates the list.
- Promises: none.
- Notes: HARD-CODED ENGLISH: "Saving…" / "Send" (101). After a successful answer the component does nothing locally (68-73): the step, its note box and the Send button stay on screen unless the action revalidates the page, so a second press can answer twice. RTL: fine. 390px: fine.

### components/join/consent-controls.tsx (135 lines)
- For: the patient's two in-room controls (record this session, share my profile), one-way on.
- Decides: a granted control renders as a statement, not a switch (20-22, 118-122); only "turn on" exists (44-50); footnote says recording cannot be stopped part-way (84-90, key `jconsent.cannotUndo`).
- Assumes: `turnOnConsent` in `app/join/[token]/actions.ts:659` (read: it un-pauses and restamps `recordingStartedAt`).
- Promises: T2 adjacent; consent (brief priority 3).
- Notes: STATUS CONTRADICTION ON ONE SCREEN. `jconsent.cannotUndo` = "Recording cannot stop part-way. Ask your therapist to end the session, and answer no next time." (`lib/i18n/messages.ts:1152`), rendered in the same panel as `RecordingStrip`'s patient "Stop recording" button (`patient-room.tsx:343-357`, 48.10) a few hundred pixels above. The comment block "Why they are one-way" (12-18) predates 48.10 and is stale. Also `jconsent.changeAnyTime` ("You can change these at any time", 56) contradicts the one-way rule it sits above. Local `state` seeded from props once (40), never updated from later props, so a consent granted by another path (the therapist, a second tab) is not reflected; the parent's 5 s poll passes new props that this `useState` ignores. HARD-CODED: `"…"` pending label (130), fine. RTL: flex, fine.

### components/join/join-flow.tsx (506 lines)
- For: the whole `/join/[token]` patient surface: name (or "Joining as"), price and pay redirect, AI/recording consent gate, waiting and live room via polling, ended screen linking to the rating.
- Decides: `knownName` replaces the first-name field with a hidden input and "Joining as {name}" (298-309, 79.2); consent is its own screen for every path (`ConsentGate`, 190-201, 377-435), nothing preselected, radios `required`, both options styled alike (437-506); room consent state seeded from the row (111-114) and updated from the gate's answer (194-198); 5 s poll in waiting and live (147-180); after Stripe return, `resumeAfterPayment` resumes (133-137); pay is a redirect to `state.payUrl` (141-143).
- Assumes: `app/join/[token]/page.tsx` sets `knownName` only when the signed-in person IS the session's patient by a `patients` row (comment 85-88); `submitJoin` sets `needsConsent`; `checkJoinState` (`actions.ts:472`).
- Promises: T4 PARTLY: a signed-in patient sees "Joining as" and no name field (kept), but when money is owed the same patient is still asked for a receipt email (311-322), so "asks nothing" is not literally true. CV2 (figure equals the price screen): the price banner uses `<Money cents>` formatted in the page locale (272), the button uses `formatUsd` hard-wired to `en-US` (37, `lib/billing/plans.ts:275`): same number, but on the Arabic page the banner and the button print it in different digit systems/format. P1: the flow is name -> (pay) -> consent gate -> waiting room, so a paid guest has at least three submits before the room.
- Notes: HARD-CODED ENGLISH: "Payment cancelled. Nothing was charged. You can try again below." (278). Unused imports `rateOnArrival` and `Star` (5, 10). The pay flow comment and code are Stripe (`success_url`, 130-132); nothing here offers the Egyptian manual transfer rail; the button says "opening checkout" (34). A poll failure (`checkJoinState` throws) is unhandled inside `setInterval` (149-157), an unhandled rejection each 5 s but the page keeps going. `ended` screen links to `/feedback/${feedbackToken ?? token}` (217); falling back to the JOIN token gives a feedback URL that `feedbackContext` cannot resolve (it looks up `feedbackToken`, `lib/data/feedback.ts:99-104`), only when `feedbackTokenForJoin` returned null. RTL: fine. 390px: single column form.

### components/join/patient-room.tsx (746 lines)
- For: the patient's live room: video iframe (or audio-only card), recording strip with the patient's own stop button, consent controls, clock note, who you are with, app rating plus summary email, "do not close", reassurance with the crisis sentence, in-room report box; minimise to an orb.
- Decides: one iframe element reused across minimised and open shells so the call never unmounts (143-175); minimised orb `fixed end-3 bottom-40 z-[65]`, "above the payment orb at 60 and BELOW the SOS orb" (181-191); open room `fixed inset-0 z-50` (223); minimise only while live (240-249); tells the server on minimise, fire and forget (126-132); recording strip only while live (311); stop button while running (343-357).
- Assumes: `stopRecording` (`app/join/[token]/actions.ts:747`) only sets `recordingPausedAt` and withdraws a meeting bot; consent stays `granted`, so the clinician can resume. SOS orb z-index (see sos-orb.tsx).
- Promises: T2 (off the record), P5 (stacking), P3 (summary), consent.
- Notes: SEE BROKEN: (1) `TroubleBox` posts the JOIN token to `reportSession` (733), which files by `sessions.feedbackToken` (`lib/data/feedback.ts:351`), and the two are separate secrets (`lib/data/feedback.ts:81-88`); the report fails with "This link is no longer valid." and the component ignores the result and shows "sent to us" (733-734). (2) `RecordingStrip` latches `stopped` locally (309, 313, 350) and never clears it, so after the patient stops recording and the clinician resumes it (the pause is only `recordingPausedAt`, `actions.ts:760-763`), the patient's strip keeps saying "Recording has stopped" while the poll reports `recording: true`. The minimised orb's red dot (208) uses `recording` directly, so the orb and the strip can disagree. (3) `rateOnArrival` result ignored, "thanks, your summary will come" shown even on error (593-594). HARD-CODED ENGLISH: clock sentence with English plural (413-418), "just started" / "min so far" (451), `"Licensed clinician"` fallback credential (467), summary waiting copy (519-520), done copy (531-532), app-rating explanation (543-544), star aria-label (555), "Saving…"/"Save" (598), "You get to rate {name} ..." (626-627), "Sending…"/"Send" (738). The in-room summary promise is email-only ("we will ask where to send it", 519; "will come to that address", 531), a P2 tension, although the feedback page shows it too. Initials from `name.split(" ")[1]` (462) mis-handles titles and one-word names. Minimise button has no `tap-target` and is about 24px tall (244). RTL: orb `end-3`, dot `end-1.5`, icon `start-1.5` logical (191, 209, 211); `text-start` on the trouble button. 390px: `aspect-[3/4]` video on phones, panel stacks below; orb 96px at `bottom-40`.

### components/onboarding/verification-form.tsx (534 lines)
- For: clinician verification: country, regulator, licence number and expiry, languages, specialties, document uploads, submit for review.
- Decides: three independent saves (53-60); country is client state that relabels slots and re-suggests the regulator, replacing only our own prefill (112-145); `locked` when submitted or approved (153); submitted state shows only an "under review" card (155-169); submit disabled while `missing` is non-empty (389), with a sentence saying the list reads the SAVED row (339-362); image-only uploads (486).
- Assumes: `saveVerificationDetails`, `uploadVerificationDocument`, `submitForReview` in `app/(app)/onboarding/actions`; `regulatorsFor`, `documentRequirements` in `lib/regulators`; `users.verification_status` derived (trigger 0083, MAP).
- Promises: C1 adjacent (verification state before the radar).
- Notes: rejected with a null `reviewNote` shows no rejection card at all (173): a rejected clinician sees the plain form with no word that they were rejected. `approved` is locked but the submit card still renders and, with `missing` empty, its Submit button is enabled (385-401); whether `submitForReview` refuses an approved user is server side (Suspect). `missing` items rendered raw (364-369), probably English labels from the server. Licence and ID accept only `image/*` (486), no PDF, although a licence is often a PDF. `placeholder="2028-04"` literal (284), a format hint, fine. Optimistic object URL never revoked (431). RTL: flex, fine. 390px: regulator chips wrap; `grid sm:grid-cols-2` stacks.

### components/patient/access-banner.tsx (126 lines)
- For: clinician-side banner on a patient page stating their access state and letting them ask for access with a typed reason.
- Decides: never says "revoked" (17-21) (the words come from `message`); request requires a non-empty note (99), max 500 chars (90); already-asked state (72-73).
- Assumes: `askForAccess` in `app/(app)/patients/actions`; `AccessState` from `lib/access/state`; `message` composed server side.
- Promises: P4 (patient decides who reads), T5 (only chosen clinicians).
- Notes: despite being in `components/patient/` this is clinician-facing (imports an `(app)` action). The `state === "revoked"` branch still exists for tone (61), fine. English: none. RTL: fine.

### components/patient/add-to-history.tsx (31 lines)
- For: clinician adds to a patient's history from the profile, reusing `AddDocument` and the same two actions.
- Decides: nothing; the server's `writable()` decides (18-22).
- Assumes: profile page hides it when revoked.
- Promises: P4 adjacent.
- Notes: clinician component in the patient folder. None.

### components/patient/ask-history.tsx (141 lines)
- For: patient asks a previous clinician to add their history; shows each ask's state and decline reason.
- Decides: the verb is "ask" (14-20); a decline shows its reason (83); DB refuses a decline with no reason (22-24, 61-63).
- Assumes: `askPreviousTherapist` in `app/(patient)/patient/consent/actions`; the DB constraint on decline reason.
- Promises: P4.
- Notes: `consent.askDeclined` with `declineReason ?? ""` (83) would render an empty reason if the DB rule ever failed. RTL: fine. English: none.

### components/patient/auth-form.tsx (179 lines)
- For: patient sign in (one handle field, email or phone) and sign up (name, phone optional or locked from invite, timezone, optional password).
- Decides: sign-in handle decided by shape server side (82-88); invite phone shown read-only and sent as hidden input, rechecked server side (98-112); password optional on signup (140-163); phone country default from `navigator.language`, else EG (51-56).
- Assumes: `patientSignIn`/`patientSignUp` in `lib/patient-auth/actions`.
- Promises: none directly.
- Notes: `useState` initialiser reads `navigator` (52-55): on the server pass it is EG, on the client it may differ; only initial state so no hydration mismatch in markup unless `PhoneField` renders the country. A signed-up person with no password relies on codes (see code-signin-form). RTL: the locked phone is `font-mono` LTR digits inside an RTL page without `dir="ltr"` (106-108); a `+20...` number may render with the plus on the wrong side in Arabic.

### components/patient/avatar.tsx (59 lines)
- For: a patient's photo from `/api/patient/avatar/:personId`, or their initial.
- Decides: no request when `hasPhoto` is false (11-13); the route checks the caller on every request (6-9).
- Assumes: the avatar route's authorisation.
- Promises: none.
- Notes: initial via `slice(0,1).toUpperCase()` (43) is fine for Arabic. None.

### components/patient/back.tsx (66 lines)
- For: Back on every non-tab patient screen: `router.back()` if history exists, else a named fallback.
- Decides: `window.history.length > 1` (47-53).
- Assumes: nothing.
- Promises: none (P5 adjacent: no dead control on a screen opened in distress).
- Notes: the comment (30-33) says the cost of a wrong `history.length` is "one extra tap"; the actual cost is `router.back()` LEAVING the site for a tab that visited another site first, which is exactly the WhatsApp deep-link case the comment names (23-28). RTL: arrow mirrored with `rtl:-scale-x-100`, `-ms-2` logical (59-62). Good.

### components/patient/benefit-form.tsx (346 lines)
- For: patient activates an employer benefit (code, then identifier), confirms an emailed code, picks the primary sponsor; `AskAboutEmployer` constant-answer lookup.
- Decides: unverified enrolments shown as waiting, not active (49-56, 104-108); paused and unverified rows get the same "answer the code" remedy (117-156); the three privacy sentences shown before enrolment (266-285); employer lookup always returns one message (291-307).
- Assumes: `payFromPot` requires `last_verified_at IS NOT NULL` (comment 51-53); DB refuses a shape hint with four digits or an @ (39-41); `askAboutEmployer` constant-time.
- Promises: E1/E2 (what the sponsor sees, stated to the employee): the copy here matches (`lib/i18n/messages.ts:1389-1391`). E4 (0% is not removal): "Only the payment changes" matches.
- Notes: a successful `activateBenefit` or `confirmCode` renders NOTHING (73-88): `state.ok` has no branch, the fields clear, and the benefits list above is a prop, so unless the action revalidates the person sees an empty form and no confirmation. After `checkCode` finds a sponsor, editing the code does not clear `state.found` (68-71, 203), so the identifier label names the first sponsor while the new code is sent. HARD-CODED ENGLISH: "Ask" and "…" (337). RTL: fine. 390px: `max-w-xs` input plus button wrap, fine.

### components/patient/bottom-nav.tsx (216 lines)
- For: the patient bottom bar (Home, Sessions, radar globe, Therapists, You), plus a locked "session" tab and a leave-confirmation during a live session.
- Decides: nav `fixed bottom-0 z-30` (101); during a live session nothing else is marked current and every tap asks first (83-95); leave sheet `fixed inset-0 z-[60]` (150), below the SOS orb at `z-[70]` (sos-orb.tsx:163), so the SOS orb stays tappable over the "leave the session?" question.
- Assumes: `PatientChrome` passes `liveSession`.
- Promises: P5 (stacking kept here), P1 (the globe is one tap to the radar).
- Notes: Steps and Billing were removed from the bar and are said to live on Home and You (42-45), which that page code must keep (not in slice). RTL: `inset-x-0`, flex order follows direction, so in Arabic Home sits on the right, fine. 390px: `max-w-md` bar, five items plus a sixth during a live session (104-112): six `flex-1` items with 11px labels at 390px, tight, the globe keeps `h-14 w-14`. English: none.

### components/patient/category-grid.tsx (94 lines)
- For: explore-by-category icon grid on the patient home, from the admin taxonomy.
- Decides: prefix/substring icon match with neutral `Tag` fallback (67-77); counts not shown (37-41).
- Assumes: `IconGrid` from `components/visual/primitives`; labels translated upstream.
- Promises: none.
- Notes: `key.includes(candidate)` (75) is substring, not prefix as the comment says (70-74): a code like `childbirth_grief` matches `child` first by key order. `href` searches by the code, not the label (90). None else.

### components/patient/change-number.tsx (107 lines)
- For: patient asks to change their phone number (human check, then a code to the new number; 90-day lock).
- Decides: locked state shows the date instead of the form (63-66); reason `minLength={10}`, consent checkbox required (88-95).
- Assumes: `askToChangeNumber` in `app/(patient)/patient/account/actions`.
- Promises: none.
- Notes: the country `select` is not `required` (71-76) while the number is; server decides. Current number `font-mono` without `dir="ltr"` (57), same RTL `+` placement risk as auth-form. 390px: `w-32` select plus input in one row, fine.

### components/patient/checkin-switch.tsx (54 lines)
- For: two buttons turning unprompted check-in messages on or off.
- Decides: optimistic `setCurrent` before the action (22-26).
- Assumes: `setCheckins` in `app/(patient)/patient/messages/actions`.
- Promises: none.
- Notes: `setCheckins` result ignored and the optimistic state never reverts (25), so a failed "off" shows off while check-ins continue, on the screen the comment says somebody reaches when messages have become too much (12-15).

### components/patient/chrome.tsx (89 lines)
- For: the patient app chrome: children, bottom nav (signed in or live session), the session orb, and the SOS orb, used by the `(patient)` layout and by `/join/[token]` (radar renders `SosOrb` alone).
- Decides: SOS orb is unconditional (42-46, 81-86), dimmed over a live session (82); session orb rendered before SOS "UNDER the SOS orb" (75-80); `pb-24` only when a nav is shown (65).
- Assumes: `app/(patient)/layout.tsx:77` passes `openSession`, `phone`; the join page passes `country` for guests.
- Promises: P2 (orb on every screen while money is owed or a door is open): the orb is on every screen that uses this chrome; pages outside it (`/pay/[token]`, `/feedback/[token]`, `/t/[id]`, `/radar`) render `SosOrb` directly and no session orb. P5: DOM order is not what decides stacking; z-index does: session orb `z-[60]` (session-orb.tsx:63) under SOS `z-[70]` (sos-orb.tsx:163). Kept here.
- Notes: the comment "UNDER the SOS orb, which is why it is rendered before it" (76) implies order decides it; it is the z-index that does, and both are `fixed` in the same stacking context, so the claim holds but for the other reason.

### components/patient/claim-challenge.tsx (161 lines)
- For: a recycled-number check: "have you seen {therapist}?" then "what first name did you give them?", one record at a time.
- Decides: only the therapist's name is shown (14-19); "No" is final (93-97); a wrong name may lock and move on (134); skip leaves it for later (141-148).
- Assumes: `saySeen`/`sayName` in `app/(patient)/patient/claim/challenge-actions`; `answerSeen` writes `rejected`.
- Promises: P4 (claiming a record).
- Notes: "No" is one tap, no confirmation, and final (89-103), and its result is ignored (96): a mis-tap permanently refuses the person's own record for this account. When every challenge was answered No or skipped, the component returns `null` (46-57): the screen goes blank, no word about what happened. HARD-CODED ENGLISH: `${done.length} records are yours now.` (53), "Next you will be asked what your therapist may still see." (54), `Question ${index + 1} of ${challenges.length}` (64), "Yes" (87), "What first name did you give {name}?" (109). RTL: fine.

### components/patient/claim-flow.tsx (219 lines)
- For: claiming a record matched on email or phone: redacted name, code, the keeps-access choice (default off), done.
- Decides: keeps-access unchecked by default (44-45, 114-122); redacted name before proof (173-180); the clinician's name never shown (23-28); "not me" declines (149-161).
- Assumes: `sendClaimCode`, `confirmClaim`, `declineClaim` in `app/(patient)/patient/claim/actions`; `KeepsAccess`.
- Promises: P4 ("the patient decides who may read the history"): kept, default off.
- Notes: `sendClaimCode(s.personId, "email")` is hard-wired to email even when `s.matchedOn === "phone"` (196), and the heading then says "check your email" unless the server reports WhatsApp (91). `claimId!` non-null assertion (137): if the action returned no id, `confirmClaim` gets null. The shared `error` renders in EVERY suggestion card (183-187). `placeholder="000000"` (110). `declineClaim` result ignored (154). RTL: `font-mono` redacted name, fine.

### components/patient/code-signin-form.tsx (129 lines)
- For: sign in with a six-digit code sent to a handle; offered to everybody so the page does not reveal who has a password.
- Decides: two action states, request then confirm (42-43); redirect to `/patient` on success (45-47).
- Assumes: `requestSignInCode`/`signInWithCode` in `lib/patient-auth/code-signin`.
- Promises: none.
- Notes: `router.replace` is called during render (45-47), a side effect in render that repeats on every render while `entered.sent`. The success flag of a sign-in is named `sent` (45), confusing. No "send again" or "change handle" once the code screen shows (49-93): a mistyped handle leaves the person on a code screen for a code that went nowhere, with no way back except reload. `⚠️` emoji literal (64).

### components/patient/consent-list.tsx (304 lines)
- For: the patient's "who is asking" and "who can read my history" lists: grant for 24 hours or open-ended, decline with an optional preset reason, stop a live grant.
- Decides: no confirmation on decline or on stop (16-21); 24 hours offered first (23-27, 182-189); a grant is live when `granted` and not expired, computed in the browser at render (240).
- Assumes: `answerRequest`, `revoke` in `app/(patient)/patient/consent/actions`; grant trigger 0060.
- Promises: P4 ("the patient decides who may read the history"): kept here, one tap to stop. T5 ("a revoked grant stops it on the next question"): the revoke is here; the stop is server side.
- Notes: HARD-CODED ENGLISH: "Asked on {date}" (134); the decline reasons are `REJECTION_REASONS` from `lib/access/state.ts:243-247`, three literal English sentences rendered as radio labels (149-160) AND sent as the stored reason, so an Arabic patient declines their therapist in English. After answer or revoke nothing changes locally (121-126, 283-288) unless the action revalidates. `live` uses `new Date()` in render (240), a server/client disagreement for a grant expiring between the two passes. RTL: `border-s-2 ps-3` (139). 390px: three buttons wrap.

### components/patient/explore-rail.tsx (75 lines)
- For: horizontal rail of therapist cards on the patient home: face, name, first specialty, "free now".
- Decides: no rating shown below the bar (13-18); rail direction follows the document (20-25).
- Assumes: `exploreTherapists` in `lib/data/discover`.
- Promises: P1 adjacent.
- Notes: `-mx-4 px-4` (31) assumes a 16px page gutter; a parent with a different gutter makes the rail overflow horizontally at 390px. `snap-start` is logical. `●` glyph in the live dot (66). None else.

### components/patient/export-record.tsx (108 lines)
- For: "send me everything": emails the patient a copy of their record, or points them to add an email first.
- Decides: with no email on file the button becomes a link to add one (17-21, 28-44); after sending, disabled and shows the cover code (78-104).
- Assumes: `exportMyRecord` in `app/(patient)/patient/record/actions`.
- Promises: P2 ("nothing only in an email"): the export itself exists only as an email, there is no in-app download. P4 (the patient's own record).
- Notes: the comment says most patients here have no email (17-21), so for most patients the export path starts with adding an email address. English: none.

### components/patient/identity-editor.tsx (143 lines)
- For: patient's own name and photo.
- Decides: no `capture` attribute, so camera or gallery (23-25); refresh after upload (69).
- Assumes: `saveOwnName`, `saveOwnPhoto`, `removeOwnPhoto` in `app/(patient)/patient/account/actions`.
- Promises: none.
- Notes: `removeOwnPhoto` result ignored (88). Photo buttons have no `tap-target`, text-sized hit areas (74-95). English: none.

### components/patient/invite-flow.tsx (110 lines)
- For: patient redeems a therapist's invite link to take their record; keeps-access defaults off.
- Decides: no code step, the invite is the verification (17-19); keeps-access off by default (21-24, 29); leaves the page at once after success to avoid the "link no longer valid" flash (88-102).
- Assumes: `acceptInvite` in `app/(patient)/patient/claim/actions`.
- Promises: P4, kept.
- Notes: sets `done` and immediately `router.replace`s (87-102), so the done card is effectively dead code. English: none.

### components/patient/invite-therapist.tsx (155 lines)
- For: patient mints a six-character code to invite a therapist; lists live codes and their state; cancel.
- Decides: the word is invite and the patient is asked again before anything moves (18-24); a code, not a link (26-31).
- Assumes: `inviteMyTherapist`, `cancelInvite` in `app/(patient)/patient/consent/actions`.
- Promises: P4.
- Notes: HARD-CODED ENGLISH: "Read it to your therapist. It works until {date}, once, and you will be asked to approve before they can read anything." (127-128). After minting, the new code shows in the brand box AND, after `router.refresh()`, in the list above (121-131, 147). `cancelInvite` result ignored (107). Cancel button has no `tap-target` (111). `expiresOn` is a preformatted string from the server.

### components/patient/invite-to-session.tsx (141 lines)
- For: CLINICIAN component (imports `app/(app)/patients/actions`) on a patient profile: one tap creates a paid session invitation and shows the link and price.
- Decides: price not an input, read from the clinician's settings server side (21-29); the link is always shown whether or not it was sent (30-35); disabled when the patient has no phone and no email (58, 123).
- Assumes: `inviteToPaidSession` returns `{url, priceCents, sent, channel}`.
- Promises: E3/CV2 (one source for the price, kept by design here); P2 (the invitation reaches the patient in app: not decided here).
- Notes: `channel` returned and unused (55). Figure shown via `<Money>` (92).

### components/patient/journal-writer.tsx (131 lines)
- For: patient writes or dictates a journal entry.
- Decides: no "somebody is watching" copy (14-21, C123); dictation on device, editing makes it typed (22-28, 89-92).
- Assumes: `addJournal` in `app/(patient)/patient/journal/actions`; journal crisis scanning elsewhere (MAP Unclaimed 5).
- Promises: none of the 25. The journal is scanned for crisis and alerts clinicians (MAP), and this screen deliberately says nothing about it (C123): a person writing here is not told their words may raise an alert.
- Notes: recognition `lang` not set (63-65), browser default. A running recognition is not stopped on submit. English: none.

### components/patient/keeps-access.tsx (61 lines)
- For: the shared "does your therapist keep access?" checkbox with both outcomes shown.
- Decides: controlled checkbox; both states described via `BeforeAfter` (49-56).
- Assumes: callers default `checked` to false (claim-flow.tsx:45, invite-flow.tsx:29).
- Promises: P4.
- Notes: none.

### components/patient/linked-platforms.tsx (118 lines)
- For: partner platforms that can identify the patient, and ending each link.
- Decides: hidden when there are none (44-50); no confirmation on unlink (28-33).
- Assumes: `unlinkPlatform` in `app/(patient)/patient/consent/actions`.
- Promises: none of the 25 (partner/EHR is Unclaimed, MAP 2).
- Notes: after a successful unlink the row stays unless revalidated (104-106). Error `<p>` without `role="alert"` (79). "…" pending label (111). `Plug`/`PlugZap` icons lack `aria-hidden` (55, 110).

### components/patient/notices.tsx (119 lines)
- For: the patient's benefit notices, current and dismissed ("Earlier"), bodies from message keys.
- Decides: dismissed notices stay visible under "Earlier" (13-19); every body is a `MessageKey` (21-27); no employer can be named because the row has no sponsor column (29-33).
- Assumes: `dismiss` in `app/(patient)/patient/notices/actions`; the notices table shape.
- Promises: E1/E2 adjacent (no employer name on the patient's own screen); P2 (notices in app).
- Notes: `dismiss` result ignored; optimistic move never reverts (54-58). `notice.when` is a preformatted server string (82). English: none.

### components/patient/patient-editor.tsx (163 lines)
- For: CLINICIAN component (imports `app/(app)/patients/actions`): edit a patient row's name, email, phone, diagnoses and goals; no delete.
- Decides: phone country from the stored number first (42-50); no delete capability anywhere (145-155).
- Assumes: `savePatient` checks the grant.
- Promises: P4 adjacent (no deleting a record).
- Notes: HARD-CODED ENGLISH: `setFeedback("Saved")` (60); the "Saved" line never clears after later edits. Diagnoses and goals as comma-split free text (114-136), so a trailing comma stores an empty string unless the server filters. The clinician can set the patient's email and phone (89-107), which are exactly what `/patient/claim` matches on (claim-flow.tsx:171), so a clinician's typo offers this record to whoever owns the mistyped address (behind a code and the redacted name). `grid-cols-2` names at 390px (72).

### components/patient/prove-handle.tsx (109 lines)
- For: before the claim screen lists anything, prove the handle with a code.
- Decides: says "not checked yet" rather than "nobody wrote you down" (14-23).
- Assumes: `requestHandleCode`/`confirmHandleCode` in `lib/patient-auth/handle`.
- Promises: P4 adjacent.
- Notes: `router.refresh()` called during render while `entered.verified` (43-45), a side effect in render repeated on every render until the page stops rendering this component. No "send again" once the code field shows (65-85). `⚠️` literal (61).

### components/patient/record-access.tsx (259 lines)
- For: CLINICIAN component (imports `app/(app)/patients/actions`): hand a record to its patient by a one-time link; release a claim lock; see claimed state.
- Decides: token shown once, only its hash stored (27-32); release lock needs a reason of 3+ chars (133); cancel then issue new (206-232).
- Assumes: `createInviteLink`, `cancelInviteLink`, `releaseClaimLock`.
- Promises: P4.
- Notes: HARD-CODED ENGLISH: the claimed sentence "This person took ownership of their record on ... Your notes stay yours; what they see is their own profile and the briefs you share." (172-174), and "A link issued on ... is still unused. It expires ... We cannot show it again." (211-212). "Issue new" with an open invite (224-231) calls `issue` without cancelling the old one; whether the server revokes the previous link is not visible here. The comment's measurement "56 of 66 patients have no email ... none has a phone" (21-22) is an undated database claim.

### components/patient/reset-form.tsx (173 lines)
- For: patient password reset by a code to either handle, then a new password.
- Decides: says when the channel is down, with a contact link (21-26, 77-88).
- Assumes: `requestPatientReset`/`completePatientReset` in `lib/patient-auth/reset`.
- Promises: none.
- Notes: "Ask for another code" is a `Link` to `/patient/forgot-password` (124-127), the page this form is on; a client navigation to the same route keeps this component's `asked.sent` state, so the link probably leaves the person on the same code screen (Suspect). Success flag again named `sent` (51). `⚠️` literal (82).

### components/patient/residency-notice.tsx (102 lines)
- For: where the patient's record is kept and their cross-border consent (agree or withdraw).
- Decides: fact first, then button (13-18); not agreeing is supported, no dismissal (20-23).
- Assumes: `agreeToCrossBorder`, `withdrawCrossBorder` in `app/(patient)/patient/residency/actions`; `wording` from the server.
- Promises: none of the 25 (cross-border residency is Unclaimed).
- Notes: HARD-CODED ENGLISH: "Your record is kept in {serving}, not {home}" (57), "You agreed to this on {date}." (69). `withdrawCrossBorder` result ignored (75); withdraw button has no `tap-target` (79). `wording` null renders an empty paragraph (59).

### components/patient/session-list.tsx (159 lines)
- For: the patient's own sessions in four groups (today, booked, past booked, past from the radar), with price in the session's own currency, transcription provenance, the signed brief, or "still writing".
- Decides: `PatientSession` carries no note, transcript or diagnosis (25-30); brief only once signed (29-30, from `lib/data/patient-view.ts`); currency from the row, not USD (104-122); provenance on past sessions (126-136).
- Assumes: `lib/data/patient-view.ts` sets `brief` only when signed and `briefPending` otherwise.
- Promises: P3 PARTLY: "still writing" is shown before signing (144-149) and the brief is signed text; the card carries the therapist's name (99) but no credentials. P4: one list across therapists, each row named. P2: sessions visible in app.
- Notes: brief rendered as one `<p>` (138-142), so newlines in the brief collapse, unlike `PatientBriefCard` which splits paragraphs; the same brief looks different here and on the feedback page. RTL: fine. English: none.

### components/patient/session-orb.tsx (89 lines)
- For: the orb showing a session the patient has open (owes, ready, live), on every chrome screen.
- Decides: `fixed end-3 bottom-24 z-[60]` (63), under SOS `z-[70]`; states only "pay", "ready", "join now", no name, time or price (29-35); live gets a red dot (84-86).
- Assumes: `openSessionForPatient` in the `(patient)` layout (`app/(patient)/layout.tsx:69-77`); `payment-popup.tsx` uses the same corner and z.
- Promises: P5 KEPT for this orb (z 60 < 70). P2 KEPT for signed-in chrome screens (orb when money is owed or a door is open).
- Notes: the payment-popup orb (`components/billing/payment-popup.tsx:305`) is ALSO `fixed end-3 bottom-24 z-[60]`, the same box; the comment calls this agreement (59-61), but if both render on one screen one hides the other exactly. They are on different routes today (`/pay/[token]` renders the popup outside the chrome), so no overlap found. Icons drawn with CSS, fine in RTL (`border-e-0` logical, 74; dot `-end-0.5`, 85).

### components/patient/session-started.tsx (76 lines)
- For: the red "your session has started, Go in" strip at the top of every signed-in patient screen (rendered by `app/(patient)/layout.tsx:80`).
- Decides: in page flow at the top, not an orb, so it "cannot overlap" the SOS orb (24-29); the whole strip is one link (46-74).
- Assumes: the layout does not render it inside the room (31-35).
- Promises: P1 (the door is one tap), P2 (a session starting appears in the app).
- Notes: TASK 122 CANDIDATE. The strip is the first thing in the chrome's flow with no top margin (49; `chrome.tsx:65`), and the same layout renders `LanguageCorner` as `fixed top-0 end-0 z-50` with a `pointer-events-auto` pill (`components/i18n/language-corner.tsx:37-41`, rendered at `app/(patient)/layout.tsx:79`). At 390px the strip is full width (`max-w-md` exceeds the viewport) and its "Go in" pill sits at the inline END (71-73), which is exactly the corner the language pill occupies. The language switch paints over the "Go in" control and takes the tap there. The rest of the strip is still a link, so it is covered, not unreachable. The comment's "they cannot overlap" is true of SOS and says nothing about the corner switch.

### components/patient/sos-orb.tsx (258 lines)
- For: the SOS orb and its sheet: the reader's own country's verified crisis line (from their phone, else the page's country), the practice number if any, and the "call your local emergency number" sentence.
- Decides: `fixed z-[70]` orb (163), sheet `fixed inset-0 z-[80]` (172); plain `tel:` links, no network (19-24); only the reader's line, never the table (29-32, 114-139); draggable, snaps to start or end, remembered in localStorage (34-40, 92-112, 146-160); dimmed to 55% over a live session unless open (165).
- Assumes: `lib/crisis/line.ts` (`lineForNumber`, `countryForNumber`, `crisisLine`).
- Promises: P5: the orb is on top of everything money-related INSIDE the patient chrome (session orb 60, payment popup 50/60, leave sheet 60, room 50, minimised room 65). BUT `components/radar/booking-sheet.tsx:172` is `fixed inset-0 z-[100]`, portalled to `body`, and carries the price and "Pay {amount} and start now" (booking-sheet.tsx:55, 309, 335); `/radar` renders `SosOrb` (app/(public)/radar/page.tsx:55). While that sheet is open the SOS orb is covered by a money screen. See Broken.
- Notes: SEE BROKEN: the orb opens ONLY on `onPointerUp` without a drag (157-160); there is no `onClick`, so Enter or Space on the focused button (which fire `click`, not pointer events) does nothing: the crisis button is not keyboard operable. And any `pointermove` with the button pressed sets `dragging` (149-151) with no movement threshold, so a tap with a trembling finger that moves one pixel becomes a "drag" and the sheet does not open. `remember({ side, top })` (158) saves the state from before the last move event (stale closure), so the stored position lags. Close button has no `tap-target` (181-188). Labels: `COUNTRY_LABEL.US = "United States"`, `HELP_WORD.US = "Help"` and fallback `"Help"` (136, 248, 256) are English, fine for the US line; Egypt is Arabic by design. RTL: `start-3`/`end-3` logical (164), `me-1.5` (237).

### components/patient/therapist-card.tsx (77 lines)
- For: one clinician in a list (home, browse): photo or initial, name, free now, demo badge, headline, rating only when there is one.
- Decides: absent rating shown by absence (61-73); a demo account is labelled beside the name (42-54).
- Assumes: `DiscoverTherapist` from `lib/data/discover` with `demo` (MAP Suspect 2: `.demo` is a label, never a decision; here it is a label).
- Promises: C1 adjacent.
- Notes: name row `flex` without wrap holding name, "free now" and "demo" badges (35-55); name is `truncate`, so at 390px a long name is cut to make room for two badges. No credentials on the card.

### components/patients/add-patient.tsx (149 lines)
- For: clinician writes down a new patient (first name, phone required with its reason, email optional), with a duplicate-number override.
- Decides: phone required and the reason shown before typing (26-31, 87-93); a duplicate number needs a deliberate tick and links the existing chart (109-134).
- Assumes: `addPatient` in `app/(app)/patients/actions` enforces the phone rule and the duplicate check.
- Promises: P4 adjacent.
- Notes: `state.ok` has no branch: after a successful add the form stays open and filled unless the action redirects or revalidates (46, 103-134). The submit label key is `tap.saving` whose text is "Add patient" (38; `lib/i18n/messages.ts:3470`), a misleading key name. `grid-cols-2` names at 390px (69).

### components/patients/import-patients.tsx (195 lines)
- For: clinician imports patients from a CSV in two steps, preview then commit; notes columns never imported.
- Decides: the "notes are never imported" sentence is above the picker (15-24, 71-74); ignored columns listed by name (94-104); nothing written until the second submit (26-30); rows re-validated server side (141-142).
- Assumes: `preview`/`commit` in `app/(app)/patients/import/actions`.
- Promises: T1 adjacent (no unapproved clinical text in a record).
- Notes: HARD-CODED ENGLISH: "Working…" (37). `problem.reason` rendered raw (120), probably English from the server. `"->"` arrow (89) reads backwards in RTL. Row `key={row.phone}` (129): two rows sharing a phone (the parent's number case add-patient allows) collide as React keys. Country list names from `COUNTRY_NAMES` (174-177), probably English.

### components/scheduling/availability-editor.tsx (325 lines)
- For: clinician publishes bookable hours on the `/on-call` page: pick days in the next two weeks, from/until whole hours, publish; list slots with withdraw (open) or cancel (booked).
- Decides: whole hours only, no minute field (17-22); booked hours get cancel, not delete (24-30, 250-265); times in the clinician's stored zone, else the browser's, which the server adopts on first publish (32-39, 61-81, 165-170); skipped non-existent (DST) hours said out loud (171-178); days computed in the zone by 24h steps with dedupe (294-325).
- Assumes: `publish`, `withdraw`, `cancel` in `app/(app)/on-call/schedule-actions`; DB CHECK on whole hours.
- Promises: none of the 25 directly.
- Notes: `held` and `blocked` slots render like open ones with the bin (236-240, 266-281), so a clinician can try to withdraw an hour a patient is holding mid-booking; the server's conditional withdraw decides (Suspect). No success message on publish, withdraw or cancel. `fromHour >= toHour` is not prevented client side (54-55, 124-153). `formatTime(slot.startsAt, zone)` without the locale (242). Cancelling a booked hour is one tap, no confirmation and no message box, although the comment says cancel is "a different act with a message attached" (28-30, 250-265); any message is composed server side.

### components/scheduling/booking-calendar.tsx (256 lines)
- For: public profile booking calendar (`/t/[id]`): pick an hour in the reader's zone, give name and email or phone, confirm; confirmation says whether a message was actually sent.
- Decides: reader's zone after mount, therapist's zone as the first-render fallback, and the zone is sent to the server only when it is really the reader's (57-83, 195); one of email or phone required (166-172, 184); confirmation text rendered by the server in the same zone (199-205).
- Assumes: `book` in `app/(public)/t/[id]/book/actions`.
- Promises: P2 (tells the person when nothing was sent, 100-102). T4-like: a signed-in patient booking here is asked for a first name and a contact like a stranger (139-164); nothing reads the session.
- Notes: HIDES BOOKABLE HOURS: only the first 10 days with slots are shown (`days.slice(0, 10)`, 224) with no "more" control and no sentence saying so. HARD-CODED ENGLISH: "Booked with {name}" (96), both confirmation sentences (101-102, the second starting with a literal "🔴"), "{name} has not published any hours yet. If this is urgent, they may be on the Crisis Radar right now." (116-117), "One hour with {name} · {rate}" (130), "Booking…"/"Confirm" (211). The header comment says times use `toLocaleTimeString` with no locale (19-21); the code uses `formatTime`/`formatWhen` with an explicit zone (stale comment). "The Resend domain is not verified and there is no WhatsApp key" (25-26) is an undated environment claim. Inputs have placeholders but no labels (139-151, 173-178). 390px: fine.

### components/scheduling/calendar.tsx (434 lines)
- For: the clinician's `/bookings` calendar: day, week, month views of their availability slots, open hours on selected days, invite an existing patient into an open hour, withdraw an open hour.
- Decides: one selection across views (25-30); day keys in the clinician's zone (32-38); only open hours can be withdrawn or given to a patient (40-45, 330-375); month view shows counts, not lists (231-242).
- Assumes: `app/(app)/bookings/page.tsx:65-66` passes `zone={actor.timezone ?? "UTC"}` and 60 days of slots (`myHours(actor, 60)`, page.tsx:48); `openHoursOn` publishes in the PASSED zone (`app/(app)/bookings/actions.ts:24-36` into `publishHours`, `lib/data/scheduling.ts` `zonedHourToUtc(day, hour, input.zone)`).
- Promises: none of the 25.
- Notes: CALENDAR HIDING BOOKINGS: (1) the grid shows counts only (236-242); who is booked is visible only after SELECTING a day (299-383), and selecting is the same act as choosing days to publish, so looking at a booking opens the "open hours" form. (2) The calendar shows availability SLOTS only (`myHours`); a session scheduled any other way (new-session form, `inviteToPaidSession`, the radar) never appears here, so the "what does my Thursday look like" page omits appointments that are not slot bookings (Suspect, check `myHours`). (3) Data is 60 days (page.tsx:48) while "next" steps 30 days and the month view draws 35 (98-101, 421): two taps of Next in month view show empty cells that may hold bookings. (4) "Week" and "month" start at the anchor day, not at a week or month boundary (420-434). (5) There is NO cancel control for a booked hour on this page (330-337 says "cancelled with a message, elsewhere"); the only cancel is on `/on-call` (availability-editor.tsx:250-265). SEE BROKEN: a clinician with no stored timezone publishes here in UTC (page.tsx:66), while `/on-call` adopts the browser's zone for the same person; the zone is printed (196-198), so it is visible, but 18:00 published from Cairo becomes 21:00 Cairo. Other: no success message for publish, invite or withdraw (108-126); one shared `invitee` select value across every open row (76, 342-353); day card heading prints the raw key `2026-09-24` (307); `anchor = new Date()` in state initialiser (72) differs between server and client passes around midnight. HARD-CODED: none, but `t(\`portal.book.status${cap(slot.status)}\` as never)` (325) casts away the key check. 390px: month view `grid-cols-7` (205) puts `formatWeekday` labels into ~48px cells, which will wrap or clip.

### components/session/ask-panel.tsx (202 lines)
- For: the clinician's in-room copilot question panel, free during the session, with a once-per-session "prepare me".
- Decides: bound sentence shown before the first question (119-126); "prepare me" hidden after one press (154-170); free window enforced server side by `liveSessionForPatient` (35-38).
- Assumes: `askCopilot` in `app/(app)/copilot/actions` (the same action as `/copilot`) enforces the grant and the free window.
- Promises: T5 BROKEN IN THE ROOM: answers are rendered as plain text only, `result.answer?.content` (72-75); the citations the same action returns (copilot/chat.tsx:198) are dropped, so an in-room answer never shows the sentence it came from and never says it has no source.
- Notes: "Once per session" is client state only (56, 159): a reload offers "prepare me" again, and the flag is set before the ask, so a failed prepare cannot be retried (159-160). The comment says the costly thing is "a button somebody can hold down" (150-152); the per-session bound is not server enforced as far as this file shows (Suspect). Error `<p>` without `role="alert"` (143). Enter sends (185-188). English: none.

### components/session/cancel-session.tsx (73 lines)
- For: clinician cancels a session started by mistake, free, via `abandonSession`.
- Decides: two clicks: arm, then confirm (29-35, 42-72).
- Assumes: `abandonSession` in `app/(app)/sessions/actions` cancels, releases the radar claim, bills nothing.
- Promises: T3 adjacent (a mistaken session costs nothing, the pricing FAQ claim).
- Notes: the comment says "clicking anywhere else disarms it" (34-35); there is no such handler, only the Back button (64-70). Stale comment. `abandonSession` result or throw is ignored (60): a failure leaves the armed state with no message. Arm button has no `tap-target` (47).

### components/session/copilot-toasts.tsx (188 lines)
- For: in-session copilot suggestion cards at the top of the transcript, stacked newest first, auto-expiring after 15 s except risk cards.
- Decides: `TOAST_MS = 15_000`, `MAX_VISIBLE = 3` (37-38); risk cards never time out (28-30, 102-103); `aria-live="assertive"` to avoid queueing behind the transcript (81-89); `top-11` so no card covers the recording indicator (74-79); dedupe by normalised text (163-188).
- Assumes: the room keeps `toasts` state and calls `mergeToasts`.
- Promises: T1 adjacent; crisis handling (risk suggestion visibility).
- Notes: SEE BROKEN: `mergeToasts` puts fresh suggestions on top and keeps `slice(0, MAX_VISIBLE * 2)` (183), and only the first three render (69). A risk card that "does not expire ... goes when they dismiss it" (28-30) drops below the visible three as soon as three newer suggestions arrive and is DELETED once six have. RTL DEFECT: `rtl && "text-end"` inside `dir="rtl"` (138-142) aligns Arabic suggestions to the LEFT, the same defect as `PatientBriefCard`. HARD-CODED ENGLISH: `aria-label="Dismiss"` (151).

### components/session/new-session-form.tsx (481 lines)
- For: the clinician's "start a session" form: where (in person, 24Therapy room, connected Zoom/Meet/Teams), the Record tick, existing or new patient (name, mobile, email), optional charge with the fee split and the patient's VAT-inclusive total.
- Decides: in person is preselected (31-34, 88); modality derived from "where" (84-90); only connected providers offered (46-54, 162-171); the Record tick defaults ON (89) and is said to decide only whether the patient is ASKED, "on their own screen" (181-189); charging only for video and only when ticked, price zero otherwise (306-311, 109); split bar from server-provided fee bps, VAT total shown on the transfer rail (355-416); "we hold your share" note (419-428).
- Assumes: `startNewSession` in `app/(app)/sessions/actions`; `platform_settings` figures passed as `payments`.
- Promises: TASK 123: the comment says the patient decides recording "on their own screen" (184-186), but the default "where" is IN PERSON (88), where the patient has no join link and no screen, and the Record tick is on by default (89). How an in-person patient is asked is not in this form; see session-room. E3/CV2: the price the clinician types is the price; the VAT total is computed here with the same half-up rounding as `vatOn` (99-108), a second computation of a figure the pay page also computes (Suspect: two formulas). T3 adjacent: "you keep / our fee" split.
- Notes: price input has a literal `$` prefix (336-338) and `formatUsd` everywhere (381-413): USD only, `en-US` formatting on an Arabic page. `placeholder="+20 100 123 4567"` and `"60"` literals (283, 349). Charging cannot be turned on for an in-person session (313). Comment "Absent when the therapist has not finished Stripe onboarding" (55) sits above a different doc comment, orphaned. RTL: `start-3.5`, `ps-7` logical (336, 348). 390px: `grid-cols-2` where-options (147) with body text, fine.

