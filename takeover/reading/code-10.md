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

