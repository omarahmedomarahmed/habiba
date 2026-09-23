# The clinician: what the code lets them do

Derived from source, not from docs or comments. Every claim below names the file and function it was read from. Where a finding comes only from reading a code path (not from a browser), it says "code path" and needs a walk to confirm.

## 1. Summary

A clinician reaches **30 pages**: 4 auth pages (`/signup`, `/login`, `/forgot-password`, `/reset-password`), 24 workspace pages under `app/(app)` (onboarding, dashboard, sessions, notes, patients and three sub pages, copilot and a thread page, assistant, connect, bookings, on-call radar, earnings, billing, settings and three sub pages, support), the live room `app/(room)/sessions/[id]/room`, and the clinic invitation `/clinic/join/[token]`. All of it sits behind one shell (`app/(app)/layout.tsx`) that sends anybody not yet approved by an operator to `/onboarding` and lets them reach only `/onboarding`, `/settings`, `/billing` and `/earnings`. Once approved, a clinician can: start an in-person or video session (24Therapy room, or Zoom/Meet/Teams if connected), optionally priced; run the room with patient-led recording consent, an off-record switch, live transcript, risk flag and an in-room copilot; get an AI SOAP draft, edit it, sign it, release the patient's copy and publish a versioned summary; keep a caseload (add, import CSV, edit, invite to claim their record, request access, documents, homework, questionnaires, diagnoses, evidence); ask a per-patient copilot and a practice-wide assistant; publish bookable hours and invite patients into them; go live on the public Crisis Radar with an alarm; see earnings, request withdrawals (Egypt manual rail) or use Stripe payouts; pay platform bills; manage profile, rate, timezone, QR codes, meeting accounts, EHR connection, password; and file support tickets. A clinician on a clinic seat uses the same pages, but their `organizationId` is the clinic's, so billing, EHR and pending-payment surfaces show and act on the clinic's account (see gaps).

## 2. The table

### Portal shell (every page under `app/(app)`)
`app/(app)/layout.tsx`, `components/nav/bottom-nav.tsx`, `components/radar/presence.tsx`, `components/radar/orb.tsx`, `components/billing/pending-bar.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Verification gate | Nothing: redirect | `layout.tsx` redirects to `/onboarding` unless `isCleared` (`lib/data/verification.ts`), except paths in `OPEN_TO_UNVERIFIED` | none stated | `/support` and `/connect` are not in `OPEN_TO_UNVERIFIED`, so an applicant cannot file a ticket. |
| Desktop sidebar (lg and up) | Name, email, initials; "LIVE"/"IN SESSION" badge on Crisis Radar from `getRadarProfile` | Links: New session, Home, Sessions, Your calendar (`/bookings`), Patients, Notes, Copilot, Crisis Radar, Earnings, Billing, Settings. Sign out (`lib/auth/actions.ts:signOut`). Switch to your practice account (`switch-principal/actions.ts:switchToClinic`), only if `clinicManagers.linkedUserId` matches | none stated | `/assistant`, `/connect`, `/support` are not in the sidebar. Unverified: only Finish verification, Earnings, Billing, Settings. |
| Mobile bottom nav | Home, Sessions, raised "+" (`/sessions/new`), Patients, More sheet | More sheet: Copilot, Assistant, Notes, Connect, Crisis Radar, Earnings, Billing, Settings | none stated | `/bookings` is missing on mobile. The practice switcher is missing on mobile. Unverified bar has Verify, Billing, Settings but no Earnings (the sidebar has it). Hidden in the room. |
| Pending payment bar | Money in flight from `pendingPaymentFor({kind:"organization"})` | Open the payment sheet (`PendingBar`) | A1 (nothing granted before confirm) | Organisation-level: a clinic seat clinician sees the clinic's in-flight bill. |
| Radar presence and orb (floating) | Radar status, rate, walk-ins, alarm cards ("Go in now", "Open the room") | Go on the radar / Go off the radar (`on-call/actions.ts:toggleRadar`); toggle walk-ins (`toggleClinicVisits`); silence alarm; arm sound; poll `radarPing` | `auth.therapist.p3` "take a session in the next minute" | Only rendered for cleared therapists. |
| Language corner | Language switch | `app/actions/locale.ts` | `ft.also5` Arabic and English | Many strings below are hard-coded English. |
| Loading / error | Nothing | none | none | No `loading.tsx` or `error.tsx` under `app/(app)` or `app/(room)`; a thrown error falls to `app/global-error.tsx` (whole page). |

### /signup
`app/(auth)/signup/page.tsx`, `components/auth/forms.tsx:SignUpForm`, `components/auth/auth-shell.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Auth shell | "Start your first session", "Four fields, then you are in. Your first session is free.", three promise lines, four-door switcher | Switch to patient/clinic/company doors | `auth.therapist.p1..p3` | "Four fields, then you are in" is false: `signUp` redirects to `/onboarding` and nothing clinical opens until an operator approves. |
| Form | First name, last name, work email, password | Create account (`lib/auth/actions.ts:signUp`): creates org + user + `payg` subscription, redirects `/onboarding?welcome=1` | none stated | Errors English only. No email verification, no SSO. Terms sentence rendered twice (page `belowForm` and inside `SignUpForm`). `?welcome=1` is ignored by `/onboarding`, so `tnew.welcome` "You are in." on `/sessions/new` is never shown to a new signup. |

### /login
`app/(auth)/login/page.tsx`, `components/auth/forms.tsx:SignInForm`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Notices | Reset / changed / expired notices from `?reset`, `?changed`, `?expired` | none | none | `NOTICES` are hard-coded English. |
| Form | Email, password | Sign in (`signIn`): lockout, throttle, redirect to `next` or `/dashboard`, unverified to `/onboarding`; Forgot link | none stated | All errors English. No 2FA. |

### /forgot-password
`app/(auth)/forgot-password/page.tsx`, `ForgotPasswordForm`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Form / sent state | Email field; after send "check your inbox" | Send reset link (`requestPasswordReset`); Back to sign in; patient door link | none | Relies on email: `example.com` demo clinicians can never reset. |

### /reset-password
`app/(auth)/reset-password/page.tsx`, `ResetPasswordForm`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| No token | "Link not valid" | Request a new link | none | Both strings hard-coded English. |
| Form | New password | Update password (`resetPassword`) | none | none found |

### /onboarding
`app/(app)/onboarding/page.tsx`, `components/onboarding/verification-form.tsx`, `app/(app)/onboarding/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | "Verify your practice" or verified text by `ensureVerification().state` | none | none | super_admin redirected to `/admin`. |
| Why we ask | `SeesWhat` two columns (who sees, cannot see) | none | none | Hidden once approved. |
| Rejected banner | `reviewNote` in red, `tver.rejected` | none | none | Only when state is rejected and a note exists. |
| Uploads disabled | `tver.noUploads` when `uploadsConfigured()` false | none | none | Dead end: cannot submit without uploads. |
| About your practice | Country, regulator (auto suggested), licence number, expiry, languages, specialties from `activeTaxonomy` | Save details (`saveVerificationDetails`) | none | Locked after submit or approval: an approved clinician cannot update a renewed licence. `licenseExpiry` is stored and never checked by any job. |
| Documents | Slots per country from `documentRequirements` | Upload / Replace (`uploadVerificationDocument`) | none | none found |
| Submit | Missing list from `missingFrom`, or "everything here" | Submit for verification (`submitForReview`) | none | `missingFrom` labels ("Photo ID", "Headshot"...) and all action errors are English only. |
| Under review (state submitted) | Spinner card `tver.underReview` | nothing | none | Dead end: no estimate, no withdraw, no edit, no support link (support is gated). |

### /dashboard
`app/(app)/dashboard/page.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Greeting | Date in own zone, "Hello {name}" | none | none | none found |
| Start card | "Start a session", "In person or video, recording begins straight away" | Link `/sessions/new` | T1 | Blurb contradicts the room: recording waits for the patient's yes. |
| Rail problem | "The radar is not open in your country yet" + `radarProblem()` | none | none | Heading hard-coded English. |
| Radar card | Online / pending / in session / off state from `getRadarProfile` | Link `/on-call` | `ft.f6` fill a free half hour | none found |
| Crisis alerts | Count of `unreadNotifications(actor,3)` where kind is crisis | "Review" link to `actionUrl` | none | Non-crisis notifications are fetched and dropped; no notifications list anywhere. |
| Drafts | "{count} notes waiting for you" from `countOpenDrafts` | Link `/notes` | T1 | Hidden at zero. |
| Recent sessions | 5 rows from `listSessions` (ordered by `createdAt`), LIVE badge | Row: completed to `/sessions/[id]`, else to room; "All" to `/sessions` | none | Empty state "Nothing here yet". No "today" agenda: a session booked for Thursday sorts by when it was created. |
| Plan card | Tier name, sessions this month, outstanding from `billingSummary(org)` | Link `/billing` | T3 | On a clinic seat this is the clinic's plan and outstanding. |

### /sessions
`app/(app)/sessions/page.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | "Sessions" | New (desktop only, `hidden lg:block`) | none | Mobile relies on the nav "+". |
| List | Up to 50 from `listSessions`, name, relative day, minutes, Video, `SessionBadge` | Scheduled / in progress rows open the room; others open `/sessions/[id]` | none | No search, filter, paging past 50, or upcoming vs past split. " min" and " · Video" are English literals. |
| Empty | "No sessions yet" | Start a session | none | none found |

### /sessions/new
`app/(app)/sessions/new/page.tsx`, `components/session/new-session-form.tsx`, `app/(app)/sessions/actions.ts:startNewSession`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Welcome | `tnew.welcome` when `?welcome=1` | none | none | Unreachable from signup (see `/signup`). |
| Where | In person, The 24Therapy room, plus connected Zoom/Meet/Teams from `listConnections` | Pick one | `ft.also3` in-person sessions | If `createMeeting` fails the session silently falls back to the 24Therapy room (`log.warn` only). |
| Transcribe | "Transcribe this session" checkbox + consent rules `SeesWhat` | Toggle; off sets `recordingPausedAt` | T2 | none found |
| Patient | Existing patient select (from `listPatients`) or first name, mobile, email | Fill | T4 | Mobile triggers `createInviteLink` only for a new patient. |
| Charge (video only, when payable) | Price, `SplitBar` you keep / our fee, VAT line for Egypt, "We hold your share" | Tick "Ask the patient to pay before joining", enter price | `ft.also1` prices with VAT; T3 | Only "Start session now": no way to schedule a future time here (that is `/bookings`). |
| Submit | Errors from `startNewSession` | Start session now: creates session, Daily room, sends invite email, redirects to room | T1 | Error strings English. Unnamed patient label "Unnamed" hard-coded. |

### /sessions/[id]/room (live room, clinician side)
`app/(room)/sessions/[id]/room/page.tsx`, `components/session/session-room.tsx`, `video-call.tsx`, `ask-panel.tsx`, `copilot-toasts.tsx`, `session-clock-bar.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Entry | Completed/cancelled redirect to `/sessions/[id]`; `ensureRoom` builds a Daily room; owner token minted | none | none | Fallback labels "Therapist", "New patient" English. No way out except End session (full-bleed, no nav). |
| Header | Patient label, Video/In person, elapsed, LIVE or Off record pill | none | T2 | none found |
| Clock bar | Stage and remaining from `sessionClock` | none | none | none found |
| Next booking | "Your next appointment starts in N minutes" | none | none | Hard-coded English. |
| Patient minimised | "Your patient minimised the session..." | none | none | Hard-coded English. |
| Consent: in person, unanswered | `troom.consentAsk` | Yes, you may record / No, do not record (`answerInPersonConsent`) | T2, `ft.also3` | none found |
| Consent: video, unanswered | "Waiting for {name}'s yes on their screen." | none | T2 | Code path: `offRecord = consent !== "granted"` and `VideoCall micMuted={offRecord}` calls `setLocalAudio(false)`, so the clinician's call microphone is off until the patient says yes. |
| Consent: declined | "{name} asked not to be recorded..." | none | T2 | Hard-coded English. Code path: in a video session the clinician's call mic stays muted for the whole session, and Resume is blocked ("Needs their yes"). Needs a browser walk urgently. |
| Video | Daily call, local preview, camera toggle, mic indicator; or "Video is not configured" / setting up | Turn camera on/off | none | Camera aria labels English. For Zoom/Meet/Teams sessions the room still builds a Daily room; the external join URL is stored (`setSessionSource`) and shown on no screen. |
| Patient joined | "{name} is in the room, waiting for you to start." | none | T4 | Hard-coded English. |
| Waiting for patient | "Waiting for your patient · paid / $X to pay before they can join" | Copy join link | T4 | Hard-coded English. Join token lasts 12h (`createSession`); no resend, regenerate, or send by SMS/WhatsApp from the room. |
| Risk | `RiskBanner` when transcribe returns `crisis` | Dismiss | `ft.f3` risk flagged in session | none found |
| Mic denied / errors | `troom.noMic`, error text | none | none | none found |
| Copilot suggestions | `CopilotToasts` while live | Dismiss | T5 | none found |
| Ask the copilot (live, with chart) | `AskPanel`, "free" badge | Ask the copilot, Prepare me, Ask (`copilot/actions.ts:askCopilot`) | T5, `ft.f4` | Not shown for guest sessions with no chart. |
| Transcript | Live lines, "Listening"/"Paused", "nothing kept" | none | T1, T2 | none found |
| Spoken language | Detect / English / Arabic chips | `setTranscriptLanguage` | `ft.f1` Arabic or English | none found |
| Controls | Start session / Off record / Resume / End session | `goLive`, `setRecordingPaused`, `endSession` (then note generation in `after`) | T1, T2 | `setRecordingPaused` result is ignored (`void`), so a failed write leaves the UI saying off record while the server still records. |

### /sessions/[id]
`app/(app)/sessions/[id]/page.tsx`, `note-review.tsx`, `session-approval.tsx`, `notes/provenance.tsx`, `clinical/risk-assessment.tsx`, `source-panel.tsx`, `voices-panel.tsx`, `clinical/attribute-transcript.tsx`, `cancel-session.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | Name (links to `/patients/[id]` if charted), date, minutes, Video/In person, auto-ended reason, `SessionBadge` | Back to Sessions | none | "Unnamed patient", " · Video", " · In person", auto-ended sentences English. Auto-end text says "50 minute limit" while the cap is configurable (`settings.clock`). |
| Unfinished (scheduled / in progress) | "unfinished" card | Open room; Cancel this session, Yes cancel it (`abandonSession`) | pricing "cancel and nothing is charged" | Cancel sends the patient nothing and refunds nothing on this path. |
| Risk assessment (ended) | Level, findings, recommended action, prior risk from `latestAssessment`, `priorRiskFor` | none | `ft.f3` | Read only: no acknowledge, no follow-up, no safety plan despite "Also said, for the safety plan". All labels hard-coded English. |
| Approval card | Sign the clinical note, Release {name}'s copy, Add a version to their clinical summary (previous version by author) | Publish what is ticked (`approveSession`) | P3, P4 | Result messages ("chart signed, their copy released") English. |
| Provenance | `NoteOriginNote`: From the recording / Partly from the recording (off-record minutes) / From the clinician's notes | none | T1, T2 | none found |
| Note: writing | "Writing your note", polls every 3s | none | T1 | Code path: a cancelled session (or any `noteStatus` "none" with no note) matches `!note && noteStatus !== "failed"` and shows "Writing your note" forever. |
| Note: failed / not recorded | "The note could not be written" or "Not recorded" | Try again (`regenerateNote`), Write it yourself (`startOwnNote`) | T1 | "Try again" hard-coded English. Regenerate is offered only on failure. |
| Note: clinical tab | SOAP fields, follow-up, steps; English translation toggle | Edit, Save changes (`saveNote`); Sign button hidden here (`approvals={false}`) | T1, `ft.f2` | Edit stays available after signing and `saveNote` does not check status: a signed chart can be silently rewritten, no version kept (P4). English translation note prints an English sentence fragment before the translated key. Only SOAP. No print, PDF or copy. |
| Note: their summary tab | Patient brief, steps (max 4), next | Edit their copy, Save (`savePatientNote`); Approve and send (`approvePatientNote` then `releaseBrief`) | P3 | none found |
| Source | Where the audio came from, ingest credential state | Issue a credential / Revoke it (`issueUploadCredential`, `revokeUploadCredential`) | none | Credential is issued but no screen uses it (see section 3). |
| Voices | Detected voices, speaking time | This is me / This is the patient / take the name off (`nameVoice`, `unnameVoice`) | none | Correcting voices does not re-run the note. |
| Transcript | Collapsible, "{n} segments", per-line speaker | You / Them / Unsure per line (`attributeLine`) | T2 | "segments" English. |

### /notes
`app/(app)/notes/page.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | "Everything approved" or waiting counts, held patient copies | none | T1, P3 | none found |
| List | 50 from `listRecentNotes`, `NoteBadge`, 2-line summary | Row to `/sessions/[id]` | T1 | `provenance` is selected but not shown. No filter to "unsigned only". |
| Empty | "No notes yet" | none | none | none found |

### /patients
`app/(app)/patients/page.tsx`, `components/patients/add-patient.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | Count | none | none | none found |
| Add a patient | Collapsed button, then first name, last name, phone, email; duplicate warning | Add a patient (`patients/actions.ts:addPatient`), "Open existing", "different person" tick | none | none found |
| Import link | "Import from another platform" | Link `/patients/import` | none | none found |
| List | `listPatients` (own caseload), initials, sessions, last seen | Row to `/patients/[id]` | none | No search, sort, archive, discharge or delete. "session(s)", "last" English literals. |
| Empty | "No patients yet" | none | none | none found |

### /patients/import
`app/(app)/patients/import/page.tsx`, `components/patients/import-patients.tsx`, `patients/import/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Upload | File (.csv), country | Show me what is in it (`preview`) | none | No template download. |
| Preview | Rows found, matched columns, ignored, already here, problems by line | Add these {count} people (`commit`) | none | "notes never imported" warning only. |
| Done | Created, skipped, failed counts | none | none | none found |

### /patients/[id]
`app/(app)/patients/[id]/page.tsx` and `components/patient/*`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Who | Avatar if claimed, name, session count, source, last seen, files you added, claimed or unclaimed line | Back to Patients | P4 | none found |
| Access banner | `explain(accessFor().state)` | Ask for access, Send request (`askForAccess`) | T5 | none found |
| Invite them to a session | Whether it can send | Invite to a session (`inviteToPaidSession` then `inviteToSession`), Copy link | T4 | Video only, at the standing rate only, no time: a "now" invite. Refuses when rate is 0. |
| Patient editor | Name, email, phone, diagnoses, goals | Save (`savePatient`) | none | Diagnoses and goals are comma text, separate from the confirmed `DiagnosisList`. |
| Copilot card | Same thread as `/copilot/[id]` (`copilotViewFor`) | Open the thread; full chat (see `/copilot/[patientId]`) | T5 | Hidden when `copilotViewFor` is null. |
| Add to their history | File or text/dictation | Add a file (`uploadDocumentFile`), Write or dictate, Save (`addNote`) | P4 | Hidden when revoked. |
| Links | Profile and documents; What we believe, and why | Links to `/documents`, `/evidence` | none | none found |
| Record access | Claimed badge, open invite, locked-out state | Create an invite link, Issue a new one, Cancel that link (`createInviteLink`, `cancelInviteLink`), Let them try again (`releaseClaimLock`) | P4 | none found |
| History | Sessions with provenance badge and summary | Row to `/sessions/[id]` | T1 | Summary is shown with no draft/signed marker (T1 says "draft on every screen"). Live sessions link to detail, not the room. |

### /patients/[id]/documents
`app/(app)/patients/[id]/documents/page.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | "Profile" | Back to patient | none | Title "Profile" collides with "Patient profile". |
| Access banner | as above | Ask for access | T5 | none found |
| Standing profile | Sections, conflicts, timeline, "behind" badge (`profileFor`, `timelineFor`, `isStale`) | none | P4 | No rebuild button when stale. |
| Journals | Patient journal entries if `patientFiles` granted | none | none | Read only. |
| Documents | `DocumentPanel`, watermark, added by | Open, read aloud (`/api/documents/[id]/speak`), flag (`flagContent`), add | P4 | "Added by the patient / you / {name}" English. No withdraw flag, no delete. |
| Homework | Trend, drafted steps from last note, list | Set this, Set it (`setStep`), Withdraw this step (`removeStep`) | none | none found |
| Assessments | Instruments, assignments, score, band | Ask them now (room), Send for later (`sendAssessment`), Refresh (`pollAssessment`), How long each answer took (`timingsFor`) | none | none found |
| Diagnoses | Proposed from documents with source sentence | Read documents (`proposeFromDocuments`), That is what it says / reject (`decideDiagnosis`) | none | Only when `diagnosisChanges`. |
| No person | `portal.docs.noRecord` | none | none | none found |

### /patients/[id]/evidence
`app/(app)/patients/[id]/evidence/page.tsx`, `components/clinical/evidence-panel.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| No access / no person | Refusal card | Back | T5 | Both sentences hard-coded English. |
| Facts | Each fact, the sentence it came from, speaker, contradictions | This is right (`confirmFact`), I disagree, Record my disagreement (`rejectFact`) | T5 "sentence it came from" | "From the session transcript" English. |

### /copilot
`app/(app)/copilot/page.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Allowance | Messages per patient per session, credit months | none | none | none found |
| Threads | `listThreads`, last message | Row to `/copilot/[patientId]` | T5 | "{n} sessions on record" English literal. |
| Start one | Patients with no thread | Row to thread | T5 | "{n} sessions" English. |
| Empty | `portal.copilot.none` | none | none | none found |

### /copilot/[patientId]
`app/(app)/copilot/[patientId]/page.tsx`, `components/copilot/chat.tsx`, `app/(app)/copilot/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Header | Name, sessions, "corrected" flag | Open profile | T5 | none found |
| Access banner | as above | Ask for access | T5 "revoked grant stops it" | none found |
| History | Sessions with summaries | Row to session | none | No draft marker on summaries. |
| Live now | "Open the room" when `/copilot/live` reports a live session | Link to room | none | none found |
| Chat | Answers with citations (date, time, who said it), "no source" badge, quota | Ask, Dictate a question, Read aloud, voice settings (`saveVoicePreference`), prompt templates (copy), Change how I answer (`correctCopilot`, `removeCorrection`), answer language (`setCopilotLanguage`), Start this chat over / Clear the chat (`resetCopilot`) | T5, `ft.f4` | Quota exhausted state links to "See Unlimited" `/billing`. |

### /assistant
`app/(app)/assistant/page.tsx`, `components/assistant/*`, `app/(app)/assistant/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Prefs prompt (first use) | Language, voice | These are fine (`savePrefs`) | none | none found |
| Chat | Threads, messages, patient names as links (roster matched), allowance | New chat (`startThread`), Delete (`removeThread`), Send (`ask`) | none stated | Mobile-only entry (More sheet). A GET render creates a thread (`createThread`) on first visit. |

### /connect
`app/(app)/connect/page.tsx`, `components/clinical/connect-panel.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Their code | Code field, result "asked {name}" / not cleared | Ask them (`useInviteCode` then `redeemInvite`) | P4 | Mobile-only entry. |
| History asks | Former patients asking to add their history | I have added it / Decline, with that reason (`answerHistoryAsk`) | P4 | "A former patient" English. No count badge anywhere. |

### /bookings
`app/(app)/bookings/page.tsx`, `components/scheduling/calendar.tsx`, `app/(app)/bookings/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| View controls | Week/month views, zone label | Previous, Today, Next, view options | `ft.also2` publish hours | Desktop-only entry. |
| Open hours | Selected days, from/to | Open them (`openHoursOn` then `publishHours`) | `ft.also2` | Second editor for the same data as `/on-call` Availability. |
| Day detail | Hours with status and booked name | Invite them (`invitePatient` then `bookSlot`, `notify`), Close this hour (`closeHour`) | T4 | A booked hour cannot be cancelled here (only on `/on-call`). The patient notification is English, formatted with "en", and links to `/sessions/{id}`, a clinician route that sends a patient to `/login`. |
| Footer | Reminder and radar-blocking notes | none | none | none found |

### /on-call (Crisis Radar)
`app/(app)/on-call/page.tsx`, `components/radar/*`, `components/scheduling/availability-editor.tsx`, `app/(app)/on-call/actions.ts`, `schedule-actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Status card | On / pending / in session / off, rate, you keep, held note, country closed | Go on the radar / Go offline (`toggleRadar`, verified only to go online) | `ft.f6`, `auth.therapist.p3` | Country closed or no rail blocks going live. |
| Alarm arming | "Can we ring?", sound refused | Turn the alarm on and go live, Go without sound, Cancel | `ft.f6` | none found |
| Radar profile | Headline, photo, country, languages, specialties | Save radar profile (`saveRadarSetup`) | `ft.f6` "your languages, what you work on, your price" | Photo is a URL text field. |
| Alert sounds | Two toggles | `saveAlertPreferences`; Hear a booking; Hear a patient waiting | none | none found |
| Availability | Hours list, booked marker, zone | Publish (`publish`), Remove this hour (`withdraw`), Cancel this appointment (`cancel` then `cancelBooking`), Change zone (to `/settings`) | `ft.also2` | Cancelling a booked appointment asks no reason, notifies no patient, refunds nothing (`cancelBooking`). |
| Session history | Radar sessions, price, VAT, fee, received, copilot use, own bill | Row to patient | T3 | none found |
| Ratings | Averages and recent (`feedbackForTherapist`) | none | none | Read only, no reply. |
| Practice | Name, address search, map link, walk-ins | Find (`findPracticeLocation`), Save practice / Remove (`savePractice`) | none | none found |
| Footer | Link to public `/radar` | Link | none | No link to the clinician's own `/t/[id]` page. |

### /earnings
`app/(app)/earnings/page.tsx`, `components/billing/earnings.tsx`, `withdraw.tsx`, `payment-history.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Billing off | `portal.earnings.noPayments` | none | none | none found |
| Earnings card | Available, clearing, this month, paid sessions, held, lifetime, settled from earnings | Pay out now (`payOutNow`), Stripe dashboard (`openPayoutDashboard`), Finish setup / Set up payouts (to `/settings`) | T3 | none found |
| Held earnings | "held pays your bill" | See what you owe (to `/billing`) | T3 | T3 asks for held and owed as two halves of one number; owed is on another page. |
| Withdraw (held, requested, or transfer rail) | Held, requested, sent, available now (`held - requested - sent` computed in the page), payout method | Save payout details (`savePayoutDestination`), Request (`requestWithdrawal`) | `ft.also6` withdraw what you earned | Available does not subtract what is owed. |
| History | Payments with receipts, transfers, failure reasons | Receipt link | `ft.also6` itemised | No export, statement or tax document. |

### /billing
`app/(app)/billing/page.tsx`, `components/billing/*`, `app/(app)/billing/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Checkout notices | Paid / cancelled from `?checkout` (`confirmCheckout`) | none | none | none found |
| Seat manager (org has seats) | Seats and monthly | Change seats (`quoteSeats`, `saveSeats`) | C3, C4 | Only `requireUser`: any clinician on a clinic seat is shown the clinic's seat control and can change it. "Number of seats" aria English. |
| Plan card | Tiers, credit, platform and AI spend, held, renews/ends | Cancel the plan (`cancelPlan`), Keep my plan (`resumePlan`), upgrade (`upgradeAndPay`) | T3 | Same: a seat clinician can cancel or change the clinic's plan. |
| Transfer bill (Egypt) | Amount due, invoice picker, bank details, popup | Pick invoices, open (`openBillPayment`, `quoteInvoices`), declare transfer (`declareBillTransfer`), cancel (`cancelBillPayment`) | A1, T3 | none found |
| First free / credit waiting | `portal.billing.firstFree`, discount reason | none | pricing "first session free" | Discount reason is raw text. |
| Earnings pointer | Held and earned this month | Link `/earnings` | T3 | none found |
| Ledger | Invoices of the org and own patient payments | Select all, Pay (`payInvoices`) | T3 | Invoice descriptions ("Completed session"...) English from `lib/billing/service.ts`. Org-wide: a seat clinician sees every clinic invoice. No invoice PDF. |

### /settings
`app/(app)/settings/page.tsx`, `components/settings/*`, `app/(app)/settings/actions.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Section nav | You, Get paid, Hours, Copilot, Security (Admin for super_admin) | Anchor links | none | No link to `/settings/records` or `/support` anywhere. |
| Stripe expired | `portal.settings.stripeExpired` on `?payouts=refresh` | none | none | none found |
| You: practice state | Approved / submitted / rejected / none from `practiceState` | Open verification | none | none found |
| You: profile | Name, credentials, licence type, state, number | Save details (`updateProfile`) | none | Licence fields here are separate from the verified ones and editable after approval with no review. |
| You: QR code, meeting accounts | Blurbs | Open your codes, Meeting accounts | none | none found |
| Get paid | Region (solo only), Stripe state or Egypt rail, held, available, rate + currency, fee split, auto-settle | Set up payouts / Finish (`connectPayouts`), Pay out (`payOutNow`), Stripe dashboard, Save payment settings (`updatePaymentSettings`), payout method link to `/earnings` | T3, `ft.also1` | Clinic seat: region selector hidden (null). |
| Hours | Timezone | Save (`saveTimezone`) | none | Hours themselves are on `/on-call` and `/bookings`. |
| Copilot | Assistant language, voice, speed | Save (`savePrefs`) | none | none found |
| Security | Change password | Change password (`changePassword`), Sign out | none | No 2FA, no active sessions, no account deletion or data export. |
| Admin (super_admin) | Link | Open admin | none | none found |

### /settings/codes
`app/(app)/settings/codes/page.tsx`, `components/settings/wall-codes.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Explainer | What the code carries, revoke note | Back to Settings | none | The page it points to, `/j/[code]`, is hard-coded English. |
| New code | "What is this one for?" | Create (`newWallCode`) | none | none found |
| List | QR SVGs, revoked ones | Revoke this code (`killWallCode`) | none | No print layout or download. |

### /settings/integrations
`app/(app)/settings/integrations/page.tsx`, `components/settings/meeting-accounts.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Accounts | Providers, "may be blocked", connected label/date; unavailable when `features.meetingBots` off | Connect {name} (`/api/meetings/connect/[provider]`), Disconnect (`disconnectMeetingAccount`) | none | none found |

### /settings/records
`app/(app)/settings/records/page.tsx`, `components/ehr/records-panel.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Solo | Upsell "on the clinic plan" | none | none | Orphan: nothing links here. |
| Clinic plan | Connections, last success, errors, filings | Connect vendor (`begin`), Disconnect (`disconnect`, org-wide) | none | Dates rendered in UTC, not the clinician's zone. A seat clinician can disconnect the whole clinic's EHR. |

### /support
`app/(app)/support/page.tsx`, `components/support/therapist-support.tsx`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Form | Topic, optional payout, optional session, message | Send (`raiseTicket`); reference and pickup hours shown | none | Orphan: no link to `/support` anywhere in the portal. Blocked for unverified clinicians. Payout labels "$x · status" English. |
| Your tickets | Reference, topic, status | none | none | Replies are read only via emailed `/support/[token]`; not in the app. |

### /clinic/join/[token] (clinic seat)
`app/(clinic)/clinic/join/[token]/page.tsx`, `components/clinic/join-form.tsx`, `lib/data/clinic-admin.ts`

| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| Invalid | `clinic.join.expired` | none | none | none found |
| What the practice sees | Sees: calendar, patient first name and last initial, radar, prices, earnings, withdrawals log. Never: notes, risk, copilot, consent | none | C2, C5 | Contradicts C2 "no patient name on any screen" in the clinic portal. |
| New here | First, last, password | Set my password and join (`accept` then `acceptInvitation`) | C1 | Done state "You are in. Verify your licence next." with no link and no session created: dead end. Radar needs verification first (C1 "same hour" depends on review). |
| Have an account | Email, password | Sign in and join (`joinWithAccount` then `joinWithExistingAccount`, cancels own subscription) | C1 | Refused if the account has any patients. |

### Other places a clinician lands
| Section | What they see | What they can do | Value it delivers | Gaps |
|---|---|---|---|---|
| `/session-expired` (`app/session-expired/route.ts`) | Redirect to `/login?expired` | none | none | none found |
| Own public page `/t/[id]` | Public profile | none | `ft.f6` | Never linked from the portal. |

## 3. Can do with no screen

- `app/api/sessions/[id]/transcribe/route.ts:POST` accepts a Bearer ingest token from `sessions/[id]/actions.ts:issueUploadCredential`, so audio can be pushed from an external recorder. No page offers an uploader or tells the clinician where to use the credential.
- `app/(app)/sessions/actions.ts:regenerateNote` works on any session; the UI shows "Try again" only when `noteStatus` is failed, so a clinician cannot redraft after fixing voices (`nameVoice`) or transcript lines (`attributeLine`).
- `lib/data/notifications.ts:markAllRead` has no caller; `unreadNotifications` is read on the dashboard and every non-crisis kind is discarded. There is no notifications list.
- `lib/data/documents.ts:withdrawFlag` has no caller: a clinician can raise a flag (`flagContent`) but not take it back.
- `lib/data/summaries.ts:summariesForPerson` (every summary version, by author) is used only on `/patient/summary`; the clinician sees only `latestSummary` inside the approval card.
- `lib/data/portability.ts:redeemInvite` returns `waitingOnVerification`, but `/connect` is not in `OPEN_TO_UNVERIFIED`, so that branch is unreachable from the UI.
- `lib/data/session-sources.ts:setSessionSource` stores the Zoom/Meet/Teams join URL; no clinician or patient page reads it back (only `sourceFor` for kind and dates).
- `lib/data/clinic-admin.ts:removeClinician` (clinic side) moves the clinician to a new solo org. Code path: no notice to the clinician, `therapistVerifications.organizationId` is not moved (the join path moves it), no subscription row is written (signUp writes one), and their patients and sessions stay under the clinic org, so `/patients` and `/sessions` (scoped by `organizationId`) go empty.
- `lib/data/patients.ts:findPatientByEmail`, `lib/data/grants.ts:applyClaimDecision`, `lib/data/scheduling.ts:inBookedWindow`, `lib/data/radar.ts:reserveTherapist` have no callers.
- Orphan pages (exist, no link): `/support`, `/settings/records`.

## 4. Promised but not built (or contradicted)

- `tauth.signUpBody` "Four fields, then you are in. Your first session is free.", `ft.closeBody`, signup metadata "Start documenting sessions in under a minute": `signUp` redirects to `/onboarding` and `layout.tsx` blocks every clinical page until an operator approves (`isCleared`).
- `tnew.welcome` "You are in.": only on `/sessions/new?welcome=1`; `signUp` sends `/onboarding?welcome=1`, which the page ignores.
- `portal.dash.startBlurb` "recording begins straight away": the room keeps capture off until the patient's yes (`applyConsent`).
- `ft.f2` "in the format you work in": notes are SOAP only (`lib/ai/notes.ts` `EMPTY_NOTE.soap`); no format choice exists.
- T1 / `ft.f2` "It says draft on every screen until it is signed": patient history and copilot history rows show the note summary with no draft/signed state.
- P4 "Every version stays, under its author's name" (for the chart): `saveNote` and `savePatientNote` overwrite in place, even after signing; only summaries are versioned.
- T3 "held earnings and what is owed as two halves of one number, and the payout is the difference": `/earnings` shows held and links to `/billing` for owed; `availableCents` ignores owed.
- `pricing.feature.baa` "HIPAA BAA included": no BAA document, acceptance or download anywhere in `app/(app)`.
- `ft.also5` "Arabic and English throughout, including the notes": hard-coded English in auth errors and notices, `missingFrom`, dashboard rail heading, room banners, risk assessment, session detail, patients and copilot lists, document attribution, evidence page, booking notification, invoice descriptions, `approveSession` messages, `/j/[code]`.
- `clinic.join.sees.names` and `sees.calendar` (told to a joining clinician) contradict C2 "no patient name on any screen" in the clinic portal.
- C4 "the clinician lands on pay-as-you-go by themselves. Nobody is suspended": the clinician side has no notice, and (code path) loses sight of their caseload (see section 3).
- `ft.f5` / T4 link works: true on `/join`, but the booking notification from `invitePatient` links to `/sessions/{id}`, a clinician route.
- pricing "Cancel it instead of completing it and nothing is charged": true for our fee; the patient's payment is neither refunded nor mentioned on `abandonSession` or `cancelBooking`.

## 5. Should exist in the redesign (PROPOSALS)

- **Proposal: a "Today" agenda on `/dashboard`.** `listSessions` orders by `createdAt`; booked sessions for later days are mixed with the past. A clinician's first question is who is next.
- **Proposal: one calendar.** Merge `/bookings` (`openHoursOn`, `closeHour`, `invitePatient`) and the `/on-call` Availability editor (`publish`, `withdraw`, `cancel`). Cancelling a booked hour should take a reason, notify the patient and handle their payment.
- **Proposal: signed notes lock, amendments are addenda with author and time.** Required by P4; today `saveNote` rewrites a signed chart.
- **Proposal: note format choice** (SOAP, DAP, BIRP, free) per clinician. Required by `ft.f2`.
- **Proposal: a notifications inbox** using `unreadNotifications` and the unused `markAllRead`.
- **Proposal: a "My practice" panel in Settings for seat clinicians**: which clinic, what it sees (`clinic.join.sees.*`), leave. Gate `/billing` seat and plan actions and `/settings/records` disconnect to the practice's manager.
- **Proposal: an applicant status page**: what is under review, typical time, support reachable while unverified, update a renewed licence after approval, licence expiry reminders from `licenseExpiry`.
- **Proposal: an earnings statement** that nets held minus owed into the payout (T3), with CSV/PDF export and invoice PDFs (`ft.also6`).
- **Proposal: search and filters** on patients, sessions and notes (unsigned only), plus archive/discharge a patient.
- **Proposal: room reliability controls**: separate "mute my call" from "off record" (today `micMuted={offRecord}`), resend or regenerate the join link, share by SMS/WhatsApp, show the external meeting link for Zoom/Meet/Teams sessions.
- **Proposal: risk follow-up** from `RiskAssessment`: acknowledge, plan, safety-plan fields it already names.
- **Proposal: pre-session prep outside the room**: "Prepare me" exists only inside the live `AskPanel`.
- **Proposal: redraft note** button always available (`regenerateNote`) after voice or line corrections.
- **Proposal: an upload recording flow** that uses the ingest credential from "Issue a credential".
- **Proposal: account security for a PHI workspace**: 2FA, active sessions, sign out everywhere, account deletion and data export.
- **Proposal: BAA acceptance and download** backing `pricing.feature.baa`.
- **Proposal: "View my public page"** linking `/t/[id]` and the booking page from `/on-call` and Settings.
- **Proposal: `loading.tsx` and `error.tsx`** for `app/(app)` and `app/(room)`, so a failure keeps the nav and the room survives.
- **Proposal: consistent navigation**: the same destinations on desktop and mobile (bookings, assistant, connect, support, practice switcher), and links to the orphan pages.
