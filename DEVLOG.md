# Dev log — Personal Profile programme

Running record of the multi-sprint build that turns a per-clinic patient record
into a person who carries their own history. Written so another session can pick
this up cold, or audit it without trusting a word of it.

**Spec:** https://claude.ai/code/artifact/f239c137-b334-46f3-9839-636367cea2b6
**Branch:** `claude/24therapy-rebuild-research-fkjen7` (restarted from `origin/main` @ `0173017`)

---

## How to verify anything in this log

Every claim below is meant to be re-checkable. The commands are the point.

```bash
set -a; . ./.env.local; set +a        # every db-touching command needs this

npx tsc --noEmit                      # types
npm run build                         # the real check
npm run test                          # safety      (23)
npm run test:alarm                    # alarm       (7)
npm run test:ledger                   # ledger      (9)  — needs DATABASE_URL
npm run test:clock                    # clock       (12)
npm run test:toasts                   # toasts      (8)
npm run test:transcribe               # transcribe  (10) — added in Sprint 0
```

`npm run lint` is not usable — it drops into Next's interactive ESLint setup
prompt and hangs. Use `tsc` + `build` instead until that is configured.

### Verifying a migration actually applied

`db:migrate` prints "Migrations applied." whether or not it did anything. A
`.sql` file that is not listed in `drizzle/meta/_journal.json` is **silently
skipped**. This has already cost this project three migrations that the console
said had been applied. Always check the column exists:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = '<table>' and column_name = '<column>';
```

---

## Sprint 0 — done

**Goal:** three changes that need no architectural decisions and are worth
shipping while the foundation is still being argued about.

### 0.1 — The transcription language bug

This is the one that mattered.

`lib/ai/transcribe.ts` sent `language: "en"` on **every** transcription request,
hardcoded, unreachable from any caller. Every Arabic session on the platform was
therefore decoded by a model that had been told the audio was English. The
request succeeded, plausible English text came back, and a clinical note was
written from it — so nothing in the system could observe the failure. Only a
clinician who actually speaks Arabic could tell the words were wrong.

Worth being precise about two things this was **not**:

- It was not Whisper. `MODELS.transcribe` is `gpt-4o-mini-transcribe`.
- It was not a medical-vocabulary problem, which is what it was reported as.

| Change | File |
|---|---|
| `transcribeChunk` takes `language?: string \| null`; the key is **omitted** when null so the model detects one | `lib/ai/transcribe.ts` |
| `normaliseLanguage()` — strips region tags (`ar-EG` → `ar`), rejects unknown codes to null, treats `"auto"` as absence | `lib/ai/transcribe.ts` |
| `chunkPrompt()` — the anti-hallucination hint now follows the language | `lib/ai/transcribe.ts` |
| Arabic hallucination artefacts added to the filter | `lib/ai/transcribe.ts` |
| `sessions.transcriptLanguage` column | `lib/db/schema.ts`, `drizzle/0028_transcript_language.sql` |
| Route passes the session's language through | `app/api/sessions/[id]/transcribe/route.ts` |
| Dictation deliberately passes nothing — auto-detect | `app/api/copilot/voice/route.ts` |
| `setTranscriptLanguage()` server action, validated + audited | `app/(app)/sessions/actions.ts` |
| Spoken-language control in the room (Detect / English / العربية) | `components/session/session-room.tsx` |

**Two things found while fixing it, both worth keeping:**

1. **The prompt was also English.** `"Clinical therapy session. Conversational
   speech."` is a decoding hint, so on Arabic audio it pulls output toward
   English on exactly the ambiguous chunks where it does most damage. Same bias
   as the hardcoded tag, different door. Fixing one without the other would have
   left half the problem in place.

2. **The hallucination filter was English-only.** With `"en"` forced, Arabic
   silence hallucinated as English stock phrases and the existing list caught
   them. Now that the model can hear Arabic, it emits the Arabic
   subtitle-credit and subscribe-to-the-channel phrases instead, which none of
   the English entries match. Added those.

   **`الحمد لله` is deliberately NOT filtered.** It appears in subtitle training
   data often enough to look like an artefact, and it is also one of the most
   ordinary things an Arabic-speaking patient says out loud. Filtering it would
   delete real clinical content from a chart to remove one line of noise. If a
   future session is tempted to add it, this is why not.

**Why the language is pinned per session rather than auto-detected every time:**
chunks are ~8 seconds and transcribed independently, so detection re-runs on
each one. A chunk that is mostly a pause detects as anything, and a transcript
whose language changes every third line is harder to read — and harder to write
a note from — than one that is wrong in a steady direction. Null still means
detect; the control exists for the bilingual clinician the default fails.

**Not done, deliberately:** existing sessions are not re-transcribed. Re-running
finished audio through a second model would produce two versions of what
somebody said, with no honest way to choose between them in a clinical record.

### 0.2 — In-session notes pinned in the copilot thread

**Already correct. No code changed.** Verified rather than assumed:

- `copilotMessages.role = "session_note"` renders as its own card with no
  dismiss control — `components/copilot/chat.tsx:507`
- Reset excludes them server-side — `lib/data/copilot.ts:425`
- Reset excludes them client-side — `components/copilot/chat.tsx:476`

They are shown, they cannot be dismissed, and they survive a reset. That is what
was asked for. They are interleaved chronologically rather than stuck to the top
of the thread; if "fixed" was meant as "pinned above the scroll", that is a
separate change and has **not** been made.

### 0.3 — Corrections box relabelled

The box was labelled "Correct the copilot", which reads like the place to put
things the copilot got wrong *about the patient*. Clinicians therefore type
facts into it — and a fact stored there cannot be cited, is invisible to every
other therapist, and never reaches the patient's record.

- Button: "Correct the copilot" → **"Change how I answer"**
- Header: "Correct me" → **"How I answer"**
- Body copy now states the boundary and points at the patient's record
- **Placeholder changed** — it was `"The sister reference is a different
  client."`, which is a *fact*, i.e. exactly what the box is not for. The
  example teaches the rule harder than the paragraph does. Now:
  `"Keep answers to three sentences. Stop suggesting homework."`

### Sprint 0 verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | passes |
| Migration 0028 journalled | idx 28 present in `_journal.json` |
| Column actually exists | `sessions.transcript_language · text · nullable=YES` — confirmed via `information_schema` |
| `npm run test:transcribe` | **10/10** new |
| safety / alarm / ledger / clock / toasts | 23 / 7 / 9 / 12 / 8 — all pass |

---

## Sprint 0 postscript — the measurement, and a correction

The A/B ran immediately after the commit. **It disproved the reason the commit
was written.** Recording it in full because the wrong conclusion is already in
the commit message and in the spec artifact.

### What was claimed

That `language: "en"` was the cause of the reported Arabic accuracy problem.

### What the measurement shows

Five Arabic clips through `gpt-4o-mini-transcribe`, old settings vs new:

| Clip | `language:"en"` (old) | omitted (detect) | `language:"ar"` |
|---|---|---|---|
| long clinical sentence | Arabic ✓ | Arabic ✓ | Arabic ✓ |
| `أيوه.. مش عارف.` | Arabic ✓ | Arabic ✓ | Arabic ✓ |
| `آه، صح.` | Arabic ✓ | Arabic ✓ | Arabic ✓ |
| `يعني... ممكن...` | Arabic ✓ | Arabic ✓ | Arabic ✓ |
| Arabic + English loanword | Arabic ✓ | Arabic ✓ | Arabic ✓ |

**Chunks where the old forced-English setting produced non-Arabic: 0 / 5.**

`gpt-4o-mini-transcribe` overrides a wrong `language` hint when the audio
clearly disagrees with it. The hardcode was a lie in the request, but it was a
lie the model ignored.

Differences were small and went both ways. `language:"ar"` recovered `كام`
where the others produced `كم`. But on the code-switched clip, **detect
preserved the English word `anxiety` as Latin text while both `en` and `ar`
transliterated it to `أنكزايتي`** — and for a clinical transcript the real
English term is the better output.

### So the commit is still right, for a different reason

Keep it, but understand what it is: **a prerequisite, not a fix.** Deepgram
respects the `language` parameter. Sending `language=en` on Arabic audio through
Deepgram would produce genuine garbage. Sprint 1 is unsafe without this change;
Sprint 0 did not fix a live accuracy problem.

### What the real problem looks like

Session `452f8851-7206-4558-a449-a1747daf8e7f` — 95 real Arabic segments:

| Symptom | Evidence |
|---|---|
| **No speaker attribution at all** | **95 of 95 segments are `unknown`** |
| Two speakers merged into one segment | seg 3 contains the clinician's question *and* the patient's answer |
| Sentences cut at the chunk boundary | seg 10 ends `...في إسكندرية for me it feels` |
| Heavy Arabic↔English code-switching | seg 8: `كملي. What feelings come up for you?` |

A separate boundary test (one sentence, cut mid-word, halves transcribed
independently) recovered 22/26 source words versus 23/26 whole — so fixed
8-second windows cost roughly one word per boundary. Real, cumulative, modest.

**Ranked by damage, the actual causes are:**

1. **No diarization.** 95/95 unknown. A clinical transcript where nobody can
   tell who spoke is the single largest quality problem in the product, and it
   is what the LLM is currently being asked to guess from context.
2. Time-based chunking that cuts on the clock rather than on speaker turns.
3. Mid-word boundary loss, ~1 word per 8 seconds.
4. Model size — untested against Deepgram or `gpt-4o-transcribe`.

Language was not on the list.

### 🔴 A consequence for the control shipped in 0.1

Real sessions code-switch constantly — a Cairo clinician moves between Arabic
and English inside one sentence. **Pinning a language is actively worse for
them**, and the measurement shows why: pinning forces English clinical terms
into Arabic transliteration, while detect keeps them.

`Detect` is the correct default and must stay the default. The pin exists for a
clinician working strictly in one language; it should not be presented as an
accuracy improvement, because for this user base it usually is not.

---

## Sprint 1 — next

Do **not** start a vendor migration until the Sprint 0 fix has been measured on
real Arabic audio. The reported problem may already be gone.

1. Bake-off on real sessions: current `gpt-4o-mini-transcribe` (now with correct
   language) vs Deepgram Nova-3 vs AssemblyAI. Vendor WER figures are English
   benchmarks and say nothing about Egyptian Arabic.
2. Provider abstraction behind `STT_PROVIDER`.
3. Real diarization — replaces the LLM guessing who spoke. Probably the largest
   remaining accuracy gain.
4. **`lib/ai/client.ts:140` hardcodes `RATES["gpt-4o-mini-transcribe"]` and
   ignores `input.model`.** Adding a second provider without fixing this bills
   Deepgram audio at the OpenAI rate, silently. Fix before wiring, not after.
5. Acoustic descriptors (pace, pause length) — **not** emotion labels.

---

## Standing traps

Hard-won. Each of these has already cost this project real time.

| ID | Trap | Rule |
|---|---|---|
| T1 | Migration journal silently skips unlisted `.sql` files while printing success | Verify with `information_schema` every time |
| T2 | An instruction placed after the JSON schema loses to context — "reply in Arabic" was obeyed 0/6 | Corrections go first, framed as overriding |
| T3 | One-sided language rules over-switch — "if Arabic → Arabic" broke English into Spanish 8/8 | Name both directions, forbid a third |
| T4 | Fixing forward breaks backward | Always re-measure the case that already worked |
| T5 | `-0 !== 0` under `Object.is` | Normalise anything produced by negation |
| T6 | `audit()`'s `resourceId` is a `uuid` column | Descriptive strings go in `reason` |
| T7 | `sql.raw` with data-derived values is an injection vector | `inArray` |
| T8 | Two `aria-live="polite"` regions compete; the short-lived one is announced after it has gone | One polite region per screen; short-lived is `assertive` |
| T9 | **Wrong-person merge** — not yet made, and unrecoverable | Patient confirms every identity link. Never the algorithm |
| T10 | Text sent to the browser for read-aloud is text you have given away | Synthesise audio server-side; never ship document text |
| T11 | A generated rolling profile becomes authoritative and rots | Regenerate from sources; never hand-edit; date and cite |
| T12 | A therapist without history access cannot flag a document they cannot see | Flagging lives inside the granted window |
| T13 | Vercel functions cap at 300s (800s Fluid) | Long jobs go to a worker or a resumable cron |

---

## Housekeeping owed

Not blocking, but real.

- **`npm run test:ledger` writes to the production database.** It inserts
  organisations and users named `ledger-test-*`. They are never cleaned up.
- ~35 `demo.nadia.*` / `e2e-*` accounts still in the production database.
- API keys still need rotating (user's task).
- Resend domain unverified — only `omarabdelgawad001@gmail.com` is deliverable.
- Neon: set history retention to 0 before any bulk load. Instant-restore storage
  bills at $0.20/GB-month, ~10× the row cost.
