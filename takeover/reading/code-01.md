# Slice 01: schema (drizzle config, 116 migrations, lib/db)

Reader notes, written as the read proceeds. Migrations are read in numeric order; each entry
records what it added (the running list the slice brief asks for), its CHECKs, triggers and
FKs, and any earlier rule it changed.

## Journal vs disk (checked before reading the migrations)

- `drizzle/meta/_journal.json` (817 lines): 116 entries, idx 0..115 contiguous. Disk: 116
  `drizzle/*.sql` files, 0000..0115. Tags match file names one to one, same order, no gap, no
  extra on either side.
- `when` is strictly increasing across all 116 entries. Pattern: 0000 = 1786282290532
  (a drizzle-generated value), 0001..0034 step 1e8 (1786300000000..1789600000000), 0035..0101
  step **1 ms** (1789600000001..1789600000067, hand-journaled, H19), 0102..0111 step 1e7
  (1789700000000..1789790000000), 0112 = 1789960000000, 0113 = 1789963000000,
  0114 = 1789966000000, 0115 = 1789966001000. No out-of-order `when`. H18 (a generated entry
  landing behind its predecessor) is not present in the journal as it stands.
- `drizzle/meta/` holds only `0000_snapshot.json` and `_journal.json` (confirms H19).
- Every `when` is a synthetic ms timestamp between 2026-08-09 and about 2026-09-20.

## Files

### drizzle.config.ts (12 lines)
- For: drizzle-kit config. schema `./lib/db/schema.ts`, out `./drizzle`, postgres, url from
  `DATABASE_URL` (falls back to empty string), strict, verbose.
- Decides: nothing at runtime.
- Assumes: `DATABASE_URL` in env. With the empty-string fallback a missing URL fails at connect
  time rather than at config load.
- Promises: none.
- Notes: config points kit at `DATABASE_URL`, i.e. whatever the shell has (H48 relevance: kit
  commands are the ones that may be run outside `npm run`'s env loading).

### drizzle/0000_abandoned_daredevil.sql (285 lines)
- For: the generated base schema.
- Added tables: ai_request_logs, audit_log, auth_sessions, auth_tokens, content_pages,
  notifications, organizations, patients, risk_assessments, session_charges, session_notes,
  sessions, stripe_events, subscriptions, transcript_segments, users (16).
- CHECKs: none. Triggers: none. Every enum-like column (users.role, users.status,
  users.verification_status, sessions.status, sessions.modality, sessions.note_status,
  session_notes.status, risk_assessments.level/source/alert_status, subscriptions.plan/status,
  content_pages.status/layout, auth_tokens.purpose, patients.source) is free text.
- FKs: ai_request_logs.{organization_id, user_id, session_id} SET NULL; audit_log.{organization_id,
  actor_user_id} SET NULL (audit_log.patient_id has NO FK); auth_sessions.user_id CASCADE;
  auth_tokens.user_id CASCADE; content_pages.updated_by SET NULL; notifications.user_id CASCADE;
  patients.organization_id RESTRICT, patients.therapist_id RESTRICT; risk_assessments.session_id
  CASCADE, organization_id/therapist_id/patient_id RESTRICT, acknowledged_by SET NULL;
  session_charges org/session CASCADE; session_notes.session_id CASCADE,
  organization_id/therapist_id/patient_id RESTRICT, approved_by SET NULL; sessions.{organization_id,
  therapist_id, patient_id} RESTRICT; subscriptions.organization_id CASCADE;
  transcript_segments.session_id CASCADE, organization_id RESTRICT; users.organization_id RESTRICT.
- Unique: auth_sessions.token_hash, auth_tokens.token_hash, content_pages.slug (dropped 0020),
  organizations.slug WHERE deleted_at IS NULL, session_charges.session_id, session_notes.session_id
  (one note per session), sessions.join_token, subscriptions.organization_id,
  transcript_segments(session_id, sequence), users(organization_id, email) WHERE deleted_at IS NULL.
- Patient identity: `patients` (first_name, last_name, email, phone, clinical jsonb);
  `sessions.guest_name`, `sessions.guest_email`; `audit_log.patient_id`.
- Notes: `users.email` unique only per organization at this point (see later migrations for
  global uniqueness). Transcript segments cascade from sessions, so deleting a session deletes
  the transcript; notes cascade too.

### drizzle/0001_invoices.sql (76 lines)
- Added: `invoices` (kind, session_id, amount_cents, discount_cents, discount_reason,
  discounted_by, status, stripe ids, period_start/end); FK organization_id CASCADE,
  session_id CASCADE, discounted_by SET NULL. Unique `invoices_session_unique` on session_id
  ("one bill per session", comment line 46). Copies session_charges rows ('pending' -> 'due')
  and DROPS `session_charges`. subscriptions.upcoming_discount_cents/reason.
  Index ai_request_logs(kind, created_at).
- CHECKs: none (invoices.kind, invoices.status free text).
- Changed earlier rule: removed session_charges (0000) entirely.
- Notes: invoices.session_id ON DELETE CASCADE: deleting a session deletes its invoice, i.e.
  the money record goes with the clinical one. Unique on session_id is a plain (not partial)
  unique over a nullable column, so many subscription invoices with NULL session_id coexist.

### drizzle/0002_copilot_chat.sql (56 lines)
- Added: copilot_threads (patient_id, organization_id, therapist_id, guidance), copilot_messages
  (thread_id, role, content, citations, session_id). FKs threads.patient_id/org/therapist
  CASCADE; messages.thread_id CASCADE, messages.session_id SET NULL. Unique copilot_threads
  (patient_id): one thread per patient, the stated isolation guarantee (line 3).
- CHECKs: none (copilot_messages.role free text).
- Notes: unique on patient_id alone means one thread per patient across ALL therapists; a
  second clinician asking about the same patient shares that thread (or is refused by code).
  Whether a later migration re-keys this is recorded below if found.

### drizzle/0003_connect.sql (60 lines)
- Added: users.stripe_account_id (unique), charges_enabled, payouts_enabled, session_rate_cents,
  auto_settle_from_earnings; sessions.price_cents, sessions.payment_status (default
  'not_required'); table session_payments (payer_name, payer_email, gross/fee/net cents, status,
  stripe ids) with FK org CASCADE, therapist RESTRICT, session CASCADE, unique session_id ("one
  live payment attempt per session").
- CHECKs: none. sessions.payment_status and session_payments.status free text.
- Patient identity: session_payments.payer_name, payer_email.
- Notes: comment line 13 says the join gate is `payment_status` read on the server.

### drizzle/0004_radar.sql (42 lines)
- Added: therapist_radar (user_id unique, status default 'offline', headline, photo, languages,
  specialties, country, pending_session_id, pending_until, last_seen_at). FKs user CASCADE, org
  CASCADE, pending_session_id SET NULL.
- CHECKs: none; status free text. Comment: double-booking guard is a conditional UPDATE in
  `claimTherapist`, not a constraint.

### drizzle/0005_rate_limits.sql (16 lines)
- Added: rate_limits (key pk, count, window_start, note, expires_at), index on expires_at.
  No FKs, no CHECKs.

### drizzle/0006_radar_reservation.sql (7 lines)
- Added: therapist_radar.reserved_by text (who holds the viewing lock). No constraint.

### drizzle/0007_note_language.sql (8 lines)
- Added: session_notes.language (default 'en'), session_notes.content_en jsonb. No CHECK.

### drizzle/0008_verification.sql (49 lines)
- Added: therapist_verifications (user_id unique, state default 'draft', country, licence
  fields, specialties, languages, id_front_url, id_back_url, license_doc_url, headshot_url,
  submitted/reviewed, review_note). FKs user CASCADE, org CASCADE, reviewed_by SET NULL.
- CHECKs: none at this point; state free text.
- Notes: the table holds ID document URLs (H14: blob URLs are secrets, not access control).
  `license_expiry` is text, not a date.

### drizzle/0009_data_exports.sql (47 lines)
- Added: data_exports (organization_id, patient_id, token_hash unique, delivered_to,
  requested_by, requested_by_role, expires_at, first_opened_at, open_count, revoked_at).
  FKs org CASCADE, patient CASCADE, requested_by SET NULL.
- CHECKs: none. Comment: nothing is snapshotted; the record renders when opened.
- Patient identity: data_exports.delivered_to (an email or phone, by the name).

### drizzle/0010_taxonomy.sql (27 lines)
- Added: taxonomy_entries (kind, code, label, enabled, sort_order, custom, updated_by SET NULL),
  unique (kind, code). No CHECK on kind.

### drizzle/0011_practice.sql (23 lines)
- Added: therapist_radar.region, city, practice_name, practice_address, practice_lat,
  practice_lon (text), practice_confirmed_at, accepts_walk_ins; index (country, region).

### drizzle/0012_radar_demo_ban.sql (15 lines)
- Added: therapist_radar.demo boolean, suspended_until, suspended_reason.
- Stale: comment lines 3-6 say `demo` "is exempt from the heartbeat expiry" and "the admin radar
  counts them separately". MAP Suspect 2 says `demo` became "a label and never a decision" on
  2026-09-22. The migration comment still describes the exemption. Recorded under Stale.

### drizzle/0013_feedback.sql (87 lines)
- Added: session_feedback (session_id unique, org, therapist, therapist_stars NOT NULL,
  service_stars NOT NULL, tags, comment, patient_email, brief_sent_at) and session_reports
  (session, org, therapist, kind, detail, patient_email, status default 'open', resolution,
  resolved_at/by). FKs session/org/therapist CASCADE, resolved_by SET NULL.
- CHECKs: none. Star values have no range CHECK (1..5) here; see later.
- Patient identity: session_feedback.patient_email, session_reports.patient_email.
- Notes: session_reports rows cascade away when the therapist user row is deleted; a complaint
  about a clinician disappears with the clinician (cascade on therapist_id).

### drizzle/0014_arrival_rating.sql (13 lines)
- Changed earlier rule: session_feedback.therapist_stars DROP NOT NULL (0013 required it).
  Added arrived_at.

### drizzle/0015_recording_paused.sql (11 lines)
- Added: sessions.recording_paused_at (null means recording). T2 relevant.

### drizzle/0016_session_stars.sql (13 lines)
- Added: session_feedback.session_stars integer (nullable, no range CHECK).

### drizzle/0017_recording_consent.sql (25 lines)
- Added: sessions.recording_consent text (null / 'granted' / 'declined' per comment),
  recording_consent_at, recording_consent_version.
- CHECKs: NONE. The three states in the comment (lines 12-17) are not constrained here.
- Notes: no `--> statement-breakpoint` between the three ALTERs (see Suspect on multi-statement
  files).

### drizzle/0018_error_events.sql (33 lines)
- Added: error_events (fingerprint, route, method, kind default 'server', message, stack,
  digest). Two indexes. No FK, no CHECK, no breakpoints.
- Notes: comment says an error "can carry a patient's words in a stack frame" and so is kept
  in-house. Retention for this table is not set here.

### drizzle/0019_usage_microcents.sql (44 lines)
- Added: ai_request_logs.cost_microcents bigint with backfill; index (user_id, created_at DESC).
- Notes: comment says "a thousandth of a cent" (H13: divide by 1e5 for dollars). Backfill
  hardcodes model rates.

### drizzle/0020_content_locale.sql (23 lines)
- Added: content_pages.locale default 'en'. Changed earlier rule: dropped
  content_pages_slug_unique (0000), replaced by unique (slug, locale).

### drizzle/0021_speaker_inferred.sql (13 lines)
- Added: transcript_segments.speaker_inferred boolean default false.

### drizzle/0022_feedback_token.sql (25 lines)
- Added: sessions.feedback_token (unique), backfill for sessions with a join_token.

### drizzle/0023_patient_note_approval.sql (27 lines)
- Added: session_notes.patient_status (default 'draft'), patient_approved_at,
  patient_approved_by (FK users SET NULL); sessions.rating_reminder_at. Backfill approved notes
  to patient_status 'approved'. No CHECK on patient_status.

### drizzle/0024_ledger.sql (63 lines)
- Added: ledger_entries (txn_id, txn_kind, account, organization_id SET NULL, user_id SET NULL,
  amount_cents, currency default 'usd', ref_type, ref_id, memo, created_by SET NULL) and
  earnings_transfers (org RESTRICT, therapist RESTRICT, amount, status default 'pending',
  stripe ids, failure_reason, released_by SET NULL, paid_at); unique stripe_transfer_id.
  session_payments.capture (default 'destination'), stripe_charge_id, payment_brand,
  payment_last4, receipt_url.
- CHECKs: none. No balance/zero-sum constraint on txn_id at this point (a later migration may
  add one; recorded if found).
- Notes: ledger rows lose their user_id / organization_id on user deletion (SET NULL), so a
  deleted clinician's ledger history becomes unattributed rather than blocking the delete.

### drizzle/0025_session_ladder.sql (17 lines)
- Added: sessions.extended_at, auto_ended_reason (free text).

### drizzle/0026_console_keys.sql (13 lines)
- Added: console_keys (slot pk, hash, updated_by SET NULL); auth_sessions.elevated_until. A5
  relevant (restricted admin reads).

### drizzle/0027_copilot_language.sql (12 lines)
- Added: copilot_threads.reply_language default 'auto'. No CHECK.

### drizzle/0028_transcript_language.sql (16 lines)
- Added: sessions.transcript_language (nullable).

### drizzle/0029_platform_settings.sql (29 lines)
- Added: platform_settings (key pk, value jsonb, updated_by SET NULL), country_settings (code
  pk, name, vat_bps, currency, payment_methods jsonb, enabled, updated_by SET NULL).
- Notes: `country_settings.enabled` is the H22 switch.

### drizzle/0030_session_credits.sql (29 lines)
- Added: session_credits (org CASCADE, tier_key, rate_cents, quantity, consumed, expires_at,
  status default 'pending', stripe ids). Unique on stripe_checkout_session_id.
- Data change: sets every non-payg subscription to 'payg' and clears the Stripe subscription id
  (line 24). A destructive data rewrite inside a migration; the rows' previous plans are lost.
- CHECKs: none (no consumed <= quantity CHECK here).

### drizzle/0031_acoustic_descriptors.sql (2 lines)
- Added: transcript_segments.words_per_minute, pause_before_ms.

### drizzle/0032_money_model.sql (41 lines)
- Added: sessions.session_type default 'direct'; session_payments.currency, vat_cents, vat_bps,
  payer_country, presented_cents, presented_currency, fx_rate_micro (integer), fx_quoted_at,
  platform_fee_bps; table fx_quotes (rate_micro integer). Backfill session_type 'paid_link'
  where priced; platform_fee_bps 1000 for old rows.
- Notes: `fx_rate_micro` / `rate_micro` are int4 (max about 2.1e9), so a rate above 2147 units
  per base unit overflows; fine for USD/EGP (about 50), not for a currency like IDR. Recorded
  as Suspect.

### drizzle/0033_people.sql (79 lines)
- Added: `people` (first_name, last_name, email, phone, claimed_at, claimed_by_user_id,
  preferred_country, preferred_currency). Partial unique email and phone WHERE claimed_at IS NOT
  NULL. patients.person_id FK people SET NULL. Backfill: one person per patient, no merging
  (comment 35-51 is explicit and the SQL matches: INSERT..SELECT with no GROUP BY).
- CHECKs: none. Patient identity: `people` is the cross-organisation identity table.
- Notes: the backfill pairs created people to patients by row_number over created_at, id on
  both sides; correct only because both sides filter on the same `person_id IS NULL` set
  inside one statement. Comment names a real address (`omarabdelgawad001@gmail.com`, the solo
  therapist's demo login) as the example of two patients sharing an email.

### drizzle/0034_patient_accounts.sql (81 lines)
- Added: patient_accounts (person_id, email NOT NULL, password_hash NOT NULL, email/phone
  verified, phone, deleted_at), patient_auth_sessions, person_claims (route default 'match',
  status default 'pending', token_hash, channel, therapist_keeps_access), person_invites
  (issued_by_user_id, token_hash, used_by_account_id). FKs (all inside ONE DO block, see
  Suspect): patient_accounts.person_id RESTRICT, patient_auth_sessions.account CASCADE,
  person_claims person/account CASCADE, person_invites person CASCADE, issuer CASCADE,
  used_by SET NULL. Unique email and person_id WHERE deleted_at IS NULL; person_claims open
  unique (person, account) WHERE pending.
- Changed earlier rule: people.claimed_by_user_id (FK users) renamed to claimed_by_account_id
  and repointed to patient_accounts SET NULL.
- CHECKs: none. person_claims.status, route, channel free text.

### drizzle/0035_consent.sql (66 lines)
- Added: history_grants (person_id CASCADE, therapist_user_id CASCADE, organization_id SET
  NULL, status default 'pending', shape, request_note, requested/decided/expires/revoked,
  rejection_reason). Partial unique (person, therapist) WHERE status IN ('pending','granted').
  audit_log.actor_account_id FK patient_accounts SET NULL. sessions.recording_started_at,
  profile_share_consent, profile_share_consent_at.
- CHECKs: none. history_grants.status free text here; sessions.profile_share_consent free text.
- Promises: P4 (patient decides readers), T5 (grant).

### drizzle/0036_documents.sql (107 lines)
- Added: person_documents (person, ordinal, source, title, uploader user/account, org,
  blob_url, body, extraction default 'none'), document_chunks (document_id, person_id,
  sequence, text), person_diagnoses (label, source_sentence NOT NULL, source doc/chunk, status
  default 'proposed', confirmed_by), content_flags (target_type, target_id, reason,
  raised_by user/account, withdrawn_at). FKs all in multi-ALTER DO blocks: person CASCADE,
  uploader SET NULL, org SET NULL, chunk.document CASCADE, diagnosis.document CASCADE,
  diagnosis.chunk SET NULL, confirmer SET NULL, flag raiser SET NULL. Unique (person_id,
  ordinal); (document_id, sequence).
- CHECKs: none (extraction, status, source, target_type free text).
- Notes: nothing ties document_chunks.person_id to its document's person_id; a chunk can be
  filed under a different person from its document with no constraint refusing it. Same for
  person_diagnoses.person_id vs its source document. The ordinal-uniqueness comment ("never to
  somebody else's") is only as good as that match. Suspect.
- content_flags.target_id has no FK (polymorphic).

### drizzle/0037_memory.sql (73 lines)
- Added: person_profiles (one per person, unique person_id), observations (person, observed_at,
  text, source, source_id, ref), homework_items (person, session SET NULL, assigned_by SET
  NULL, org SET NULL, status default 'open', completed_by_account SET NULL). FKs in one DO
  block. No CHECKs.

### drizzle/0038_assistant.sql (35 lines)
- Added: assistant_threads (user CASCADE, org CASCADE), assistant_messages (thread CASCADE,
  user CASCADE, role, content, mentions), quota index WHERE role = 'therapist'. No CHECK on
  role.

### drizzle/0039_scheduling.sql (64 lines)
- Added: availability_slots (therapist_user_id CASCADE, org CASCADE, starts_at, duration default
  60, status default 'open', held_until, session_id SET NULL, booked_by_account_id SET NULL,
  note). CHECK `availability_slots_whole_hour` (minute = 0 and second = 0). Unique (therapist,
  starts_at). sessions.scheduled_at.
- CHECKs: whole_hour only; status free text; duration_minutes unconstrained (a 120 minute slot
  at 19:00 and another at 20:00 overlap and both satisfy the unique index, so the "no
  overlapping hours" comment at 36-38 holds only while duration is 60). Suspect.

### drizzle/0040_repair.sql (104 lines)
- Added: users.timezone, patients.timezone, availability_slots.reminded_at; strips
  ' [reminded]' from notes; partial reminder index. Re-adds, one per block, the FKs from the
  multi-statement DO blocks of 0034, 0036, 0037, 0038, 0039.
- Stale / incomplete: the repair list omits two FKs from 0034's block:
  `person_invites_issuer_fk` and `person_invites_used_by_fk` (0034 lines 54-55). Comment
  line 57-62 says every FK from those blocks was measured present, so this is latent, but the
  "repair forward" is not complete for 0034. (patient_accounts_person_id_people_id_fk is the
  first in its block so it cannot have been skipped by the pattern.)

### drizzle/0041_requeue_documents.sql (27 lines)
- Data only: person_documents 'unsupported' PDF/docx back to 'pending'.

### drizzle/0042_sweep.sql (85 lines)
- Added CHECKs (all NOT VALID): sessions_feedback_token_present, patients_phone_present
  (source='therapist' implies phone), patients_phone_e164, patient_accounts_phone_e164,
  people_phone_e164.
- Validated later: all five in 0054.

### drizzle/0043_claim_by_phone.sql (96 lines)
- Added: unique patient_accounts.phone WHERE deleted_at IS NULL AND phone IS NOT NULL;
  CHECK patient_accounts_phone_present NOT VALID (validated 0054); patient_accounts.timezone;
  person_claims.seen_therapist, name_attempts, challenged_at, patient_id (FK patients
  CASCADE).
- Changed earlier rule: dropped person_claims_open_unique (person, account) and recreated as
  (account, person, patient_id) NULLS NOT DISTINCT WHERE pending.

### drizzle/0044_challenge_passed.sql (15 lines)
- Added: person_claims.name_confirmed_at.

### drizzle/0045_two_handles.sql (96 lines)
- Changed earlier rule: patient_accounts.email DROP NOT NULL (0034 had NOT NULL);
  patient_accounts_email_unique rebuilt NULLS DISTINCT WHERE deleted_at IS NULL AND email IS NOT
  NULL.
- Added: claim_attempts (account CASCADE, patient CASCADE, attempts, locked_at, released_at,
  released_by_user_id SET NULL, release_reason); unique (account, patient).
- CHECKs: none on claim_attempts (no attempts ceiling in the DB, unlike patient_auth_tokens in
  0053).

### drizzle/0046_no_show.sql (112 lines)
- Added: sessions.reassigned_from_user_id (FK users SET NULL), reassigned_at, no_show_at,
  recovery_offered_at, recovery_outcome with CHECK sessions_recovery_outcome_known (NULL or
  reassigned/refunded/abandoned) NOT VALID (validated 0054). Table patient_credits (person
  CASCADE, amount, currency, spent, from_session SET NULL, reason, expires_at) with CHECKs
  amount_positive and spend_within (0 <= spent <= amount).
- Notes: patient_credits cascade on the person; patient credit (money owed to the patient)
  disappears if the person row is deleted.

### drizzle/0047_two_rails.sql (331 lines)
- Added: ledger_entries.entity + CHECK entity_known ('us','eg') NOT VALID; users.rate_currency;
  sessions.price_currency; invoices.settled_currency, settled_amount_minor, fx_rate_micro,
  fx_quoted_at + CHECK invoices_fx_complete (all three or none) NOT VALID;
  session_payments.crossing + CHECK crossing_known (4 values) NOT VALID; session_payments.entity
  + CHECK NOT VALID. All four validated in 0054.
- Table payout_methods (therapist CASCADE, org CASCADE, edited_by SET NULL; CHECK named
  (account_name and identifier trimmed length > 2), CHECK method_known (instapay, wallet,
  stripe); partial unique default per therapist).
- Table payout_requests (org RESTRICT, therapist RESTRICT, method SET NULL, approver/sender/
  owner/editor SET NULL; CHECKs amount_positive, status_known (requested, approved, sent,
  confirmed, rejected), entity_known, approver_not_payee, approver_not_editor,
  sent_was_approved (sent_at implies approved_at)).
- Table payout_request_events (request CASCADE, actor SET NULL). No CHECK on to_status.
- Notes: no CHECK that `rejected` carries `rejected_reason`, and none that `sent_by` differs from
  `approved_by`. `rate_currency`, `price_currency` free text with no CHECK.

### drizzle/0048_support_tickets.sql (157 lines)
- Added: support_tickets (reference unique, source, name, email, phone, patient_account SET
  NULL, user SET NULL, topic, message, locale, entity, status, owner SET NULL, due_at,
  closed_by SET NULL). CHECKs one_handle (email or phone), message_present (>= 10 chars),
  topic_known (7 values), status_known (open, waiting_on_them, closed), entity_known,
  closed_dated. support_ticket_events (ticket CASCADE, actor SET NULL); kind free text.
- Patient identity: support_tickets name/email/phone/patient_account_id.

### drizzle/0049_back_office.sql (240 lines)
- Added: support_tickets.audience (+CHECK NOT VALID, validated 0054), related_session_id (FK
  sessions SET NULL), related_payout_request_id (FK SET NULL), moved_to_whatsapp_at,
  whatsapp_summary (+CHECK whatsapp_summarised NOT VALID, validated 0054), access_token
  (unique), access_code_hash, access_code_expires_at. Table support_attachments (ticket CASCADE,
  uploader SET NULL; CHECK type_known (jpeg/png/webp/heic/pdf), sized (0 < size <= 25 MiB)).
  Table phone_change_requests (account CASCADE, owner/approver SET NULL; CHECKs status_known,
  reasoned (>=10), consented (status refused or contact_consent), e164 both, actually_changes,
  done_was_verified, done_was_approved (status done implies approved_by_user_id NOT NULL));
  unique one open per account.
- Notes: comment lines 4-6 state `users.role` has no DB CHECK: "the check living in the
  application's union type". Recorded under enum-like unions without CHECK.
- Broken (latent, see 0082 below for whether handled): `phone_change_done_was_approved`
  requires approved_by_user_id NOT NULL on a done row, while its FK is ON DELETE SET NULL. Deleting
  the staff user who approved any completed phone change fails with a CHECK violation, so that
  staff row cannot be deleted. This is exactly the shape 0082 names ("set_null_vs_check").

### drizzle/0050_country_rails.sql (40 lines)
- Added: country_settings.collection_provider, payout_methods, entity (+CHECK NOT VALID,
  validated 0054), regulators, id_label_front/back, licence_label, sample_image_url. CHECK
  vat_sane 0..5000 bps NOT VALID (validated 0054).
- Stale: comment line 31-33 says "10,000bps is the whole payment" and "a country configured
  above that is a typo", but the CHECK ceiling is 5000. Not wrong, but the comment argues 10,000.

### drizzle/0051_strings_and_languages.sql (116 lines)
- Added: locales (code pk, direction CHECK ltr/rtl, code_shaped CHECK, public_implies_authoring
  CHECK, updated_by SET NULL), ui_strings (pk key+locale, status CHECK draft/published, source
  CHECK human/machine, not_blank CHECK, machine_attributed CHECK, updated_by SET NULL).
- Notes: ui_strings.locale has no FK to locales.code.

### drizzle/0052_audit_resource_key.sql (18 lines)
- Added: audit_log.resource_key text + index. Fixes H6 shape (resource_id is uuid).

### drizzle/0053_patient_reset.sql (46 lines)
- Added: patient_auth_tokens (account CASCADE, purpose, token_hash unique, channel, attempts,
  expires_at, used_at). CHECKs expires (> created_at), attempts_bounded (0..5), channel_known
  (whatsapp, email), purpose_known ('password_reset').

### drizzle/0054_validate.sql (51 lines)
- VALIDATEs the 15 NOT VALID constraints from 0042, 0043, 0046, 0047, 0049, 0050 (checked
  against my running list: all 15 accounted for). sessions.feedback_token SET NOT NULL.
- Notes: comment says "22.1 has just emptied every table". The NOT VALID list is complete as of
  0053.

### drizzle/0055_handle_verification.sql (24 lines)
- Changed earlier rule: dropped and re-added `patient_auth_tokens_purpose_known`, widening it to
  ('password_reset', 'handle_verify'). Loosening, deliberate.

### drizzle/0056_optional_password.sql (37 lines)
- Changed earlier rule: patient_accounts.password_hash DROP NOT NULL (0034 had NOT NULL). Comment
  says "This EDITS 13R". Added CHECK patient_accounts_reachable (phone or email) NOT VALID then
  VALIDATE in the same file.
- Notes: comment line 13-14: "a code to a proven handle is always a valid sign-in". The CHECK
  only asks that a handle exists, not that it is proven.

### drizzle/0057_patient_avatar.sql (14 lines)
- Added: people.avatar_url (storage path, comment says served only through
  `/api/patient/avatar/:id`), people.avatar_updated_at.

### drizzle/0058_therapist_codes.sql (34 lines)
- Added: therapist_codes (user CASCADE, org CASCADE, code unique forever, label, created_by SET
  NULL, revoked_at, revoked_by SET NULL). CHECK therapist_codes_shape `^[A-HJ-NP-Z2-9]{8}$`
  (NOT VALID then VALIDATE).
- Notes: "unique forever" (comment 10-11) is held by the unique index, but `user_id ON DELETE
  CASCADE` deletes the row with the clinician, so a deleted clinician's code becomes free
  again and could be re-minted for another clinician. The comment's promise does not survive a
  user delete. Suspect (low).

### drizzle/0059_summaries_and_journals.sql (117 lines)
- Added: clinical_summaries (person CASCADE, version, body, approved_by_user_id SET NULL,
  approved_by_name NOT NULL, credentials, licence body/number, org SET NULL, session SET NULL,
  approved_at). Unique (person, version). CHECKs version_positive, body_not_blank.
  **Trigger** `clinical_summaries_no_rewrite` BEFORE UPDATE OR DELETE raises (append only).
- Added: journals (person CASCADE, account_id NOT NULL with NO FK here, source CHECK typed/
  dictated, body_not_blank CHECK, risk_level CHECK low/moderate/high, risk_indicators).
- Added: data_exports.verification_code (partial unique), data_exports.person_id (FK SET NULL).
- Broken (see 0082 for whether handled): the append-only trigger fires on EVERY update and
  delete, including the ones Postgres performs for FK actions. clinical_summaries has
  `person_id ON DELETE CASCADE`, `approved_by_user_id ON DELETE SET NULL`, `organization_id ON
  DELETE SET NULL`, `session_id ON DELETE SET NULL`. So deleting a person with any summary,
  deleting a clinician who approved one, deleting their organization, or deleting the session a
  summary came from, each raises 'clinical_summaries is append only' and the whole delete
  fails. The FK actions declared here can never succeed once a summary exists. Promises: P4
  (every version kept) is kept by this, at the cost that a person cannot be erased.
- Promises: P3 (summary carries clinician name and credentials, snapshotted as text: kept by
  schema, NOT NULL only on the name, credentials nullable). P4 (append-only: kept).

### drizzle/0060_portability.sql (116 lines)
- **Trigger** `history_grants_verified_only` BEFORE INSERT OR UPDATE on history_grants: if
  NEW.status = 'granted', requires a therapist_verifications row with state 'approved' for the
  therapist, else raises 23514.
- Added: patient_invites (person CASCADE, account_id NOT NULL no FK, code unique, CHECK shape
  `XXX-XXX`, redeemed_by_user_id SET NULL, CHECK redemption_complete (redeemed_by null iff
  redeemed_at null), revoked_at, expires_at). history_asks (person CASCADE, account_id no FK,
  therapist CASCADE, status CHECK pending/added/declined, CHECK decline_has_reason, open-ask
  partial unique).
- Suspect: the trigger checks at write time only. A grant already `granted` stays granted
  when the clinician's verification later leaves 'approved'; the comment's "a grant can only
  be HELD by a clinician whose verification is approved" is true of the write, not of the
  holding. Any later UPDATE of that row (for example setting revoked_at or status 'revoked')
  passes because NEW.status is no longer 'granted', but an update that keeps status 'granted'
  (touching updated_at, expires_at) raises. Whether reads re-check verification is in
  lib/data (not my slice). T5.
- Broken (latent, pairs with 0059): `patient_invites_redemption_complete` requires
  redeemed_by_user_id and redeemed_at to be null together, while redeemed_by_user_id is ON DELETE
  SET NULL. Deleting a clinician who redeemed any invite nulls the id and leaves redeemed_at,
  violating the CHECK, so the delete fails. See 0082.

### drizzle/0061_region.sql (80 lines)
- Added: organizations.region, people.region (default 'us', CHECK us/eg, validated),
  cross_border_consents (person CASCADE, home/serving region CHECK us/eg, CHECK actually_crosses,
  wording (CHECK length > 40), locale, agreed_at, withdrawn_at).

### drizzle/0062_clinical_facts.sql (340 lines)
- Added: patient_clinical_facts (person CASCADE, org SET NULL, domain, field, value,
  source_type, source_priority, source_id, evidence_quote NOT NULL, segment_id / chunk_id /
  journal_id / entered_by_user_id / supersedes_id / verified_by all SET NULL, evidence_kind,
  confidence real, status default 'active', effective_at, sensitivity).
- CHECKs (all validated): source_type (clinician, document, patient, ai); status (active,
  resolved, historical, disputed, unsupported); sensitivity (normal, sensitive, restricted);
  evidence_kind (segment, chunk, journal, clinician); quote_not_blank; value_not_blank;
  priority_matches_source (1..4 by source); confidence_is_ai_only; verified_pair; no_self_supersede;
  evidence_matches_kind.
- **Triggers**: `clinical_facts_ai_unverified` BEFORE INSERT (ai fact cannot be born verified,
  and only active/disputed); `clinical_facts_no_rewrite` BEFORE UPDATE (value, quote,
  source_type, domain, field, person_id immutable); `clinical_facts_evidence_gone` BEFORE UPDATE
  (non-clinician fact whose three pointers are all NULL and status active/disputed becomes
  'unsupported'); `clinical_facts_check_supersession` BEFORE INSERT (same person/domain/field;
  lower priority may not supersede higher); `clinical_facts_retire` AFTER INSERT (superseded row
  to 'historical').
- Stale / Broken: comment lines 176-178 says "The evidence pointer must match the kind it
  claims ... A row claiming a transcript line and carrying no segment is a fact with a quote
  nobody can locate". The CHECK `clinical_facts_evidence_matches_kind` only tests the
  'clinician' branch (`ELSE true`). A 'segment', 'chunk' or 'journal' fact can be INSERTED with
  every pointer NULL, and because `clinical_facts_evidence_gone` is BEFORE UPDATE only, it is
  born `active` and stays active until something updates it. The code is weaker than the
  comment.
- Suspect: nothing checks that segment_id / chunk_id / journal_id belong to the same person as
  the fact's person_id. A fact about person A can cite a sentence from person B's transcript.
- Suspect: `clinical_facts_evidence_gone` also fires on a clinician's ordinary status update:
  harmless, but a fact that was verified and later loses its evidence becomes 'unsupported' only
  when some update touches it; the FK SET NULL action is such an update, so this path does work
  for deletions.

### drizzle/0063_risk_findings.sql (57 lines)
- Added: risk_assessments.findings jsonb, model, unquoted_findings. CHECKs model_named (source
  = 'model' iff model not null), unquoted_is_model_only. Both validated.
- Stale: comment line 10 calls `indicators` "(text[])"; the column is `jsonb` (0000 line 116).
- Notes: risk_assessments.source still has no value CHECK (only 'model' is named). level and
  alert_status still free text.

### drizzle/0064_session_sources.sql (136 lines)
- Added: session_sources (session CASCADE unique, org RESTRICT, kind, external_meeting_id,
  provisioned_at, provisioned_by_user_id RESTRICT, ingest token hash/expiry/revoked/uses).
  CHECKs kind (24t_room, google_meet, zoom, teams, in_person, upload), external_is_provisioned,
  token_pair, token_is_hashed (64 hex). **Trigger** `session_sources_no_repoint` BEFORE UPDATE:
  session_id, kind, external_meeting_id, provisioned_by_user_id fixed.
- Notes: provisioned_by_user_id RESTRICT: a clinician who provisioned a meeting cannot be
  deleted while the source exists.

### drizzle/0065_session_voices.sql (223 lines)
- Added: session_voices (session CASCADE, org RESTRICT, label, ordinal, role, patient_id FK
  patients RESTRICT, bound_by, bound_by_user_id FK users RESTRICT, bound_at, speaking_ms).
  Uniques: (session,label), (session,ordinal), one therapist per session, (session, patient_id).
  CHECKs role (therapist, patient), bound_by (track, operator: no model value), binding_is_whole,
  operator_is_named, patient_is_patient, ordinal_positive. transcript_segments.voice_id FK SET
  NULL.
- **Triggers**: `transcript_segments_voice_agrees` BEFORE INSERT OR UPDATE on
  transcript_segments (same session; unbound voice line must be 'unknown'; bound voice line is
  'unknown' or the role); `session_voices_no_repoint` BEFORE UPDATE (label, ordinal, session
  fixed; role cannot swap directly); `session_voices_unbind_clears_lines` AFTER UPDATE (unbind
  resets lines to 'unknown').
- Notes: patient_id / bound_by_user_id ON DELETE RESTRICT: a patient row or an operator user
  bound to any voice cannot be deleted. No check that session_voices.patient_id is the session's
  patient.

### drizzle/0066_split_fee.sql (48 lines)
- Added: invoice_lines (invoice CASCADE, kind, amount_cents, tier_key); unique (invoice_id,
  kind). session_credits.credit_cents (nullable), spent_cents.
- CHECKs: none. invoice_lines.kind free text; no CHECK that lines sum to invoices.amount_cents;
  no spent_cents <= credit_cents CHECK (contrast patient_credits in 0046). Money: therapist
  prepaid credit can be over-spent as far as the DB is concerned. Check 0084/0110 for a later
  floor.

### drizzle/0067_note_provenance.sql (70 lines)
- Added: session_notes.provenance default 'clinician', off_record_seconds; backfill
  'transcript' where consent granted and segments exist, 'partial' where gaps > 20000 ms.
- CHECKs: NONE on provenance. Values used here: clinician, transcript, partial. Recorded under
  unions without CHECK if schema.ts has a union.
- Notes: the backfill reads `recording_consent = 'granted'`, a free-text column (0017) with no
  CHECK. Threshold 20000 ms must agree with `OFF_RECORD_THRESHOLD_MS` in lib/data/feedback.ts
  (comment 56-58); cannot check from this slice. T2 relevance: provenance 'partial' is how a
  note admits an off-record gap.

### drizzle/0068_journal_inference.sql (46 lines)
- Added: CHECK facts_journal_never_concludes (evidence_kind 'journal' implies domain not in
  diagnosis, risk). Added without NOT VALID (validated on creation).
- Notes: domain is free text; the rule depends on the literal strings 'diagnosis' and 'risk'.
  A fact written with domain 'Diagnosis' or 'dx' from a journal passes. Suspect (low).

### drizzle/0069_usage_attribution.sql (46 lines)
- Added: ai_request_logs.patient_id FK patients SET NULL; index (patient_id, created_at).
- Privacy: comment lines 26-31 (C280) says this makes "a timestamped record of every model call
  concerning a person, queryable by person" and that it must never be sponsor-facing. This is
  a column that could link sponsor-covered care to timing if any sponsor query ever touched
  it. Recorded in the sponsor-linkage list.

### drizzle/0070_assessments.sql (165 lines)
- Added: instruments (key+version unique, name jsonb, attribution, licence, locales text[],
  questions, bands, translation_reviewed_by SET NULL, published_at). CHECKs instruments_free_only
  (published implies licence public_domain / free_with_attribution), instruments_translation_
  reviewed (published non-English needs reviewer). assessment_assignments (instrument RESTRICT,
  patient CASCADE, org CASCADE, assigned_by SET NULL, session SET NULL, mode, status default
  'assigned', score, instrument_version). assessment_responses (assignment CASCADE,
  question_key, value, answer_ms; unique (assignment, question_key)).
  patient_clinical_facts.assessment_id (uuid, NO FK).
- Changed earlier rule: clinical_facts_evidence_kind widened to add 'assessment';
  facts_journal_never_concludes widened to cover 'assessment' evidence too.
- CHECKs missing: assessment_assignments.mode and .status free text; no range CHECK on
  response value or score; comment "one instrument, given to one person, once" (line 76) has no
  unique constraint behind it (an instrument can be assigned to the same patient any number of
  times; perhaps intended per assignment). `translation_reviewed_by ON DELETE SET NULL` with the
  translation_reviewed CHECK: deleting the reviewer of a published Arabic instrument violates
  the CHECK, so the delete fails (set-null-vs-check family).
- Notes: clinical_facts_evidence_matches_kind still has no branch for 'assessment' and
  assessment_id has no FK, so an 'assessment' fact need not point at any assignment.
- Unclaimed (a): instruments with answer timing (answer_ms), per MAP Unclaimed 7.

### drizzle/0071_meeting_bots.sql (122 lines)
- Added: meeting_connections (user CASCADE, org CASCADE, provider CHECK zoom/google_meet/teams,
  access_token_sealed NOT NULL, refresh_token_sealed, expires_at, external_account_label,
  revoked_at; CHECK revoked_is_empty (revoked implies access '' and refresh null); partial unique
  live per (user, provider)). session_sources.bot_id (unique), bot_dispatched_at, bot_status,
  bot_left_at; CHECK session_sources_bot_only_if_ours (bot implies provisioned).
- Consent (priority 3): nothing in the schema ties a bot's dispatch to the session's
  `recording_consent`. The only DB rule is "a meeting we made". Whether consent is checked
  before dispatch is in lib/meetings (not my slice). Suspect.
- bot_status free text.
- Unclaimed (a/b): recording external meetings via a bot (MAP Unclaimed 1). No promise covers it.

### drizzle/0072_corporate.sql (324 lines)
- Added: sponsors (name, kind CHECK company/university, state CHECK held/active/suspended/
  closed, listed_publicly default false, entity, currency, contact_*, verify_cycle_started_at,
  verify_cycle_months default 3). sponsor_users (sponsor CASCADE, email unique where not deleted,
  role CHECK admin/viewer). sponsor_auth_sessions (user CASCADE). sponsor_codes (sponsor CASCADE,
  code unique). sponsor_identifier_fields (sponsor CASCADE, kind CHECK domain_email/id_number,
  CHECK no_specimen). enrolments (sponsor RESTRICT, person CASCADE, state CHECK active/paused/
  removed, is_primary, identifier_hash NOT NULL unique across ALL sponsors, identifier_kind
  CHECK, last_verified_at, removed_at, removal_reason CHECK fixed list, CHECK removal_complete,
  paused_at; partial unique (person, sponsor) where not removed; one primary per person).
  sponsor_pots (sponsor RESTRICT unique, balance_cents, overdraft_cents, refund_policy,
  expires_at; CHECK terms_before_money, CHECK overdraft_bounded balance >= -overdraft).
  patient_notifications (person CASCADE, kind CHECK 4 values, message_key; NO sponsor_id by
  design). session_payments.funding_source default 'card' CHECK card/pot.
- Privacy / sponsor linkage: `enrolments` (sponsor_id, person_id) is the one table joining a
  sponsor to a person. `session_payments.funding_source = 'pot'` marks a session as
  pot-funded; joined through session_payments.session_id -> sessions.patient_id ->
  patients.person_id -> enrolments.sponsor_id it names the sponsor for a session and its time.
  No column on session_payments names the pot or sponsor at this point (see later migrations).
- Notes: sponsors.entity, sponsors.currency: no CHECK here (entity is 'us'/'eg' elsewhere).
  `enrolments.state` and `removed_at` can disagree (state 'active' with removed_at set passes
  every CHECK: removal_complete ties removed_at to removal_reason only).
- Promises: E1/E2 (no roster by design, C227), E4 (0% is not removal: nothing here).

### drizzle/0073_pot_rails.sql (102 lines)
- Changed earlier rule: session_payments_crossing_known widened with pot_held_to_connect,
  pot_held_to_manual. sponsors.verify_cycle_months default 3 -> 6, and existing rows at 3 set to 6
  (data rewrite: an operator who had deliberately chosen 3 is overwritten; comment admits it
  cannot tell).
- Added: enrolment_verifications (enrolment CASCADE, code_hash unique, attempts CHECK 0..5,
  expires_at, used_at).

### drizzle/0074_clinics.sql (243 lines)
- Added: organizations.kind (CHECK solo/clinic), clinic_state (CHECK held/active/suspended/
  closed or NULL), CHECK clinic_state_matches_kind, contact_name/email/phone. clinic_managers
  (org CASCADE, email unique across clinics, role CHECK admin/viewer). clinic_auth_sessions
  (manager CASCADE). clinician_invitations (org CASCADE, email, phone, first/last name,
  token_hash unique, state CHECK sent/accepted/revoked/expired, terms_shown_at, accepted_at,
  accepted_user_id SET NULL, invited_by_manager_id SET NULL; CHECK terms_before_acceptance,
  CHECK accepted_complete (accepted implies accepted_at and accepted_user_id); partial unique
  live per (org, email)).
- Broken (latent, set-null-vs-check): `clinician_invitations_accepted_complete` requires
  accepted_user_id on an accepted row, while the FK is ON DELETE SET NULL. Deleting a clinician who
  joined through an invitation fails with a CHECK violation on clinician_invitations. See 0082.
- Notes: the comment (lines 17-22) says the clinic wall is `lib/data/clinic.ts`'s select lists,
  not the schema: a clinic manager carries an organization_id that keys every clinical query.
  C2 depends entirely on code outside this slice.

### drizzle/0075_partner_plane.sql (430 lines)
- Added: partners (state CHECK, slug unique), partner_users (partner CASCADE, role CHECK
  admin/developer, email unique), partner_auth_sessions (user CASCADE), partner_api_keys
  (partner CASCADE, sponsor_id FK sponsors CASCADE, key_hash unique, prefix, scopes jsonb,
  environment CHECK sandbox/live, CHECK employment_needs_sponsor, CHECK suspension_has_reason),
  partner_webhooks (partner CASCADE, url CHECK https, secret_sealed, events), partner_webhook_
  deliveries (webhook CASCADE, event CHECK session.completed/note.approved/grant.revoked/
  record.claimed, subject_id, attempts, last_status; no payload column by design),
  partner_subjects (partner CASCADE, external_ref, person_id SET NULL; unique (partner,
  external_ref)), enrolment_attestations (sponsor CASCADE, identifier_hash, expires_at,
  answered_at, answered_by_key_id SET NULL; CHECK answer_names_key).
  organizations.partner_id (FK SET NULL) and billing_mode (CHECK self/partner_billed, CHECK
  partner_billed_names_partner). audit_log.partner_id (FK SET NULL), via (CHECK partner_api/
  partner_launch). auth_sessions.partner_id (FK SET NULL), created_via (CHECK), CHECK
  launch_names_partner.
- Broken (set-null-vs-check, three more): (1) organizations.partner_id SET NULL vs
  partner_billed_names_partner; (2) auth_sessions.partner_id SET NULL vs launch_names_partner;
  (3) enrolment_attestations.answered_by_key_id SET NULL vs answer_names_key (fixed by 0078/0079).
  (1) and (2) mean deleting a partner fails if any practice is partner-billed or any launched
  session row exists. 0078's comment says partners have no delete path, so latent.
- Privacy / sponsor linkage: `partner_api_keys.sponsor_id` ties a partner key to a sponsor.
  `partner_webhook_deliveries` carry `session.completed` and `note.approved` events with a
  `subject_id`; `partner_subjects.person_id` maps a partner's external ref to our person. A
  partner that is BOTH a sponsor's HR integration (key with sponsor_id) and a holder of
  partner_subjects would receive per-person session completion events with timing
  (created_at). Nothing in the schema prevents one partner row holding both. Suspect, priority 1.
  Where to look: lib/partner (webhook fan-out) and whether session.completed is emitted only for
  sessions held on that partner's platform.
- Unclaimed (a): partner/EHR plane, MAP Unclaimed 2.

### drizzle/0076_partner_sessions.sql (49 lines)
- Changed earlier rule: session_sources_kind widened with 'partner_platform'; external_is_
  provisioned widened so partner_platform needs meeting id, provisioned_at and _by.

### drizzle/0077_partner_launch.sql (59 lines)
- Added: partner_launch_tokens (partner CASCADE, user CASCADE, key_id SET NULL, token_hash
  unique, target, expires_at, used_at). No CHECK on target, argued in comment 25-30.

### drizzle/0078_attestation_key_restrict.sql (42 lines)
- Intended change: answered_by_key_id FK SET NULL -> RESTRICT. Dropped by the drizzle default
  name, which did not exist (see 0079), so it ADDED a second FK.
- Claims (cross-slice): "there is no DELETE on partner_api_keys anywhere in the product" and
  "partners has no delete path either". To confirm in lib/partner.

### drizzle/0079_one_fk_per_column.sql (63 lines)
- Drops 0075's `enrolment_attestations_key_fk` (SET NULL), leaving 0078's RESTRICT; conditional
  re-add if neither exists.
- Stale title: file name "one_fk_per_column" reads as a schema-wide rule; it fixes one column.
  Other set-null-vs-check pairs (0049, 0059/0060, 0070, 0074, 0075) are not addressed here.

### drizzle/0080_ehr.sql (183 lines)
- Added: ehr_connections (org CASCADE, vendor CHECK epic/cerner/athena/smart_sandbox,
  fhir_base_url + issuer CHECK https, sealed tokens, scopes, revoked_at; CHECK
  revoked_holds_no_secret; partial unique live per (org, vendor)). ehr_launches (connection
  CASCADE, user CASCADE, fhir_patient_id, patient_id FK patients SET NULL, fhir_encounter_id,
  severed_at; CHECK severed_holds_no_foreign_id). ehr_writebacks (connection CASCADE, note_id FK
  session_notes CASCADE, state CHECK pending/filed/refused, CHECK filed_names_document, unique
  (note, connection)).
- Notes: no user_id on ehr_connections by design (C266). Unclaimed (a): EHR integration.

### drizzle/0081_checkins.sql (106 lines)
- Added: checkins (person CASCADE, channel CHECK email/whatsapp, body, locale, delivered),
  checkin_replies (checkin CASCADE, person CASCADE, body, crisis_alert_raised), checkin_mutes
  (person CASCADE, via CHECK reply/screen, CHECK unmute_after_mute, partial unique live mute).
- Notes: nothing ties checkin_replies.person_id to its checkin's person_id. Unclaimed (a):
  proactive check-ins with crisis routing (no promise covers messaging a patient unprompted).

### drizzle/0082_set_null_vs_check.sql (93 lines)
- Changed earlier rules: FK actions to RESTRICT for organizations.partner_id,
  clinician_invitations.accepted_user_id, instruments.translation_reviewed_by,
  patient_clinical_facts.entered_by_user_id, phone_change_requests.approved_by_user_id; to
  CASCADE for auth_sessions.partner_id.
- Looks broken, is handled: 0049 phone_change, 0070 instruments, 0074 invitations, 0075
  organizations/auth_sessions pairs recorded above are fixed here.
- Broken (latent, the audit missed them): the six listed are not the whole family. Still SET
  NULL against a CHECK after this file:
  (1) `patient_invites.redeemed_by_user_id` (0060, SET NULL) vs `patient_invites_redemption_
      complete` ((redeemed_by IS NULL) = (redeemed_at IS NULL)). Deleting a clinician who
      redeemed any patient invite fails.
  (2) `patient_clinical_facts.verified_by` (0062, SET NULL) vs `clinical_facts_verified_pair`
      ((verified_by IS NULL) = (verified_at IS NULL)). Deleting a clinician who verified any fact
      fails. Note the irony: 0082 hardens `entered_by_user_id` on the same table and misses
      `verified_by` beside it.
  (3) Written after this file: `sponsor_domains.agreement_approved_by` (0091) vs
      `sponsor_domains_agreement_pair`, and `partners.approved_by_user_id` (0095) vs
      `partners_approval_pair`. Both repeat the shape 0082 says a permanent sweep in
      `verify:sprint52` now catches. Either the sweep does not see the `(a IS NULL) = (b IS
      NULL)` form or it runs against a list. Worth checking scripts/verify-sprint52.ts.
  Also not a CHECK but the same shape: clinical_summaries' append-only trigger (0059) refuses the
  FK SET NULL / CASCADE writes, so deleting a person, an approving clinician, their organization
  or the originating session fails once a summary exists.
- Claim (cross-slice): "no hard DELETE on any of these parents anywhere in the code", product
  soft-deletes `users.deleted_at`. If true these are unreachable, which is the file's own
  argument; it also means a person-erasure request cannot be done by DELETE.

### drizzle/0083_verification_one_truth.sql (141 lines)
- Added functions: `derived_verification_status(uuid)` (approved -> verified, rejected ->
  rejected, submitted -> pending, else unverified). **Triggers**:
  `therapist_verifications_sync_user` AFTER INSERT OR UPDATE OR DELETE on therapist_verifications
  (pushes derived value to users); `users_verification_status_derived` BEFORE INSERT OR UPDATE
  on users (forces verification_status to the derived value). Data: reconciles every user row;
  comment says one production user stops reading verified.
- Changed earlier rule: users.verification_status (0000, free text written by code) becomes a
  derived column no code can set.
- Notes: the users trigger runs a subquery on every UPDATE of users (every sign-in stamp, every
  failed-login counter). therapist_verifications.user_id is unique (0008) so bool_or is over at
  most one row. Nothing here revokes a `granted` history_grant when verification leaves
  'approved' (see 0060 Suspect). C1 relevance: radar shows verification state from this column.

### drizzle/0084_pot_balance_floor.sql (25 lines)
- Added: sponsor_pots.published_balance_cents (nullable), published_sessions (default 0). COMMENTs
  say never read the live balance on a sponsor surface. No CHECK; the floor size is in code.
- Promises: E1 ("balance is a published figure"). Schema provides the column; whether every
  sponsor read uses it is lib/data/sponsors.ts (not my slice). Comment line 4-7 records that
  before this, both sponsor screens rendered the live balance.

### drizzle/0085_identifier_once_ever.sql (34 lines)
- Added: enrolments.identifier_hash_global (nullable) + partial unique index.
- Notes: nothing requires the new column on new rows (no CHECK, no NOT VALID NOT NULL), so "one
  identifier, once, ever" still depends on the enrol code always writing it. Old rows are
  admittedly unprotected. Stale: 0072's comment on `enrolments_identifier_unique` ("across every
  sponsor") has been false since hashIdentifier salted with the sponsor id.

### drizzle/0086_audit_the_other_principals.sql (48 lines)
- Added: audit_log.actor_sponsor_user_id (FK sponsor_users SET NULL), actor_clinic_manager_id
  (FK clinic_managers SET NULL), two indexes, comments.
- Notes: the COMMENTs say "Exactly one actor column is set on any row". No CHECK enforces it
  here (see 0104 for num_nonnulls). Comment line 16-20 records that `removeFromRoster` accepted a
  sponsor user id "for audit" and passed it to nothing.
- Privacy: comment says actor_sponsor_user_id is "Never joined to a session, a date or a
  therapist". audit_log also carries patient_id and resource ids; a sponsor act row with a
  resource_id that is an enrolment id is on the same table as clinical reads. A sponsor-facing
  audit view must select by actor only. Suspect, cross-slice.

### drizzle/0087_a_partner_link_can_be_cut.sql (62 lines)
- Added: partner_subjects.revoked_at, revoked_by_account_id (FK patient_accounts SET NULL).
- Changed earlier rule: partner_webhook_deliveries_event widened with 'subject.unlinked'.
- Notes: comment line 16-20 records that `writeBackSession` asked about no grant at all, and
  that revocation closes it only because `resolveSubject` filters on revoked_at (cross-slice).
  No CHECK pairs revoked_at with revoked_by_account_id (deliberately? a SET NULL would break a
  pair CHECK, so its absence avoids the 0082 family).

### drizzle/0088_a_crisis_line_per_country.sql (63 lines)
- Added: country_settings.crisis_line_label, crisis_line_tel, crisis_line_verified_at,
  crisis_line_verified_by (FK users SET NULL). CHECK crisis_line_paired, CHECK crisis_tel_shape
  `^\+?[0-9]{3,15}$`. Seeds nothing by design.
- Promises: P5 (crisis path). Schema gives Egypt no number until an operator enters one; the
  fallback is "call your local emergency number" (COMMENT). Answers MAP Stale 7: crisis lines
  live in `country_settings`.

### drizzle/0089_renewal_obligations.sql (93 lines)
- Added: renewal_obligations (org CASCADE, plan, amount_cents CHECK >= 0, currency CHECK usd/egp,
  period_start/end CHECK end > start, state CHECK due/paid/lapsed/void, due_at, paid_at CHECK
  paid iff paid_at, settled_via CHECK stripe/egypt_gateway/manual, settled_ref, CHECK settled
  pair). Partial unique (org, period_start) where state <> 'void'.
- Stale: comment line 37 "Two currencies exist and 0088's rule decides which": 0088 is the crisis
  line migration and decides nothing about currency.
- Money: `settled_ref` is not unique, so one gateway reference (one Stripe invoice, one manual
  transfer) can be recorded as settling two obligations. A paid obligation also has no CHECK
  that settled_via is set. Suspect.
- Notes: 'egypt_gateway' is a settlement value for a gateway MAP says does not exist; 'manual'
  is the real Egyptian rail.

### drizzle/0090_coverage_percentage.sql (106 lines)
- Added: sponsor_pots.coverage_bps (default 10000, CHECK 0..10000 step 500),
  pending_coverage_bps + pending_coverage_from (CHECK pair and step). session_payments.
  coverage_bps (default 0), sponsor_share_cents, patient_share_cents; CHECK shares_sum
  (coverage 0 or shares = gross), CHECK coverage_step.
- Promises: E3 (price shown is price owed): frozen coverage on the payment row is the schema
  half, kept. E4 (0% legal, not removal): the CHECK allows 0.
- Notes: `shares_sum` is skipped when coverage_bps = 0, so a coverage-0 row can carry any
  shares. No CHECK that a reduction's pending_coverage_from is in the future or that pending <
  current. The asymmetry (increase immediate, decrease after notice) lives in code.

### drizzle/0091_proving_a_company.sql (90 lines)
- Added: sponsor_domains (sponsor CASCADE, domain unique on lower(domain), mailbox_proved_at,
  dns_proved_at, agreement_approved_at, agreement_approved_by FK users SET NULL, CHECK
  agreement_pair, dns_token). enrolments_state widened with 'provisional'.
  enrolments.provisional_sessions_used (CHECK >= 0).
- Broken (latent, 0082 family, written after the sweep): agreement_approved_by SET NULL vs
  agreement_pair CHECK.
- Notes: "neither proof alone issues a code" (C318) is not in the schema (no CHECK); code.
  The provisional cap ("it is capped", line 70) has no upper bound in the DB.
- Changed earlier rule: enrolments_state (0072) loosened to add 'provisional'.

### drizzle/0092_seats.sql (65 lines)
- Added: organizations.seats (default 0, CHECK 0..500); clinic_seats (org CASCADE, user CASCADE,
  billable_from, released_at; partial unique live per (org, user)).
- Suspect (C3/C4): two sources for "how many seats": `organizations.seats` (the number the bill
  is a function of, per COMMENT) and the count of live `clinic_seats` rows. Nothing ties them.
  C4 (release lowers next bill by one) holds only if release decrements `seats` too. Check
  lib/billing / lib/data/clinic.
- Notes: clinic_seats.user_id CASCADE: deleting a clinician deletes the seat history "asked at
  renewal".

### drizzle/0093_clinic_staff.sql (136 lines)
- Added: clinic_roles (org CASCADE, slot CHECK 1/2, name, capabilities jsonb CHECK array, CHECK
  never_delegable (no seats.manage, clinicians.manage), created_by_manager SET NULL, deleted_at;
  partial unique (org, slot)). clinic_staff_assignments (org CASCADE, manager CASCADE, user
  CASCADE; unique (manager, user)). clinic_managers.role_id (FK SET NULL), linked_user_id (FK
  users SET NULL, partial unique). patients.clinic_visibility_shown_at.
- Promises: C2 broken by design as documented here: COMMENT on
  patients.clinic_visibility_shown_at says clinic administrative staff can see "first name,
  last initial and appointment times". That contradicts C2 ("no patient name on any screen")
  and matches README; MAP Contradiction 1 resolved in the schema's own words against C2.
- Suspect (auth boundary): clinic_staff_assignments has no rule that `user_id` is a clinician of
  `organization_id`, or that `clinic_manager_id` belongs to `organization_id`. A mis-scoped
  insert would grant a staff member a clinician in another practice. Check lib/clinic-auth.
- Notes: role_id SET NULL on a custom role deletion drops a manager back to the built-in
  `role` column's value silently (admin or viewer), which may be MORE access than the custom
  role. Suspect.

### drizzle/0094_clinic_application.sql (44 lines)
- Added: organizations.registration_number, registration_authority, intended_clinicians text[]
  (CHECK cardinality <= 100).

### drizzle/0095_partner_platform.sql (259 lines)
- Added: partner_consents (partner CASCADE, external_session_ref, external_subject_ref, state
  CHECK given/withdrawn, answered_at, offset_seconds CHECK 0..86400). partner_sessions (partner
  CASCADE, environment CHECK, external refs unique per partner, person_id FK people SET NULL,
  started/ended, recording_from_seconds, stopped_reason, billable; CHECKs sandbox_never_
  billable, sandbox_no_person, stopped_not_billed). partner_limits (partner pk CASCADE,
  monthly_session_limit CHECK 0..1e6, period_start, alert stamps, stopped_at).
  partner_clinicians (partner CASCADE, external ref unique, enabled_at). partners.documents_url,
  approved_at, approved_by_user_id (FK users SET NULL), CHECK partners_approval_pair.
- Broken (latent, 0082 family): partners.approved_by_user_id SET NULL vs approval_pair.
- Consent (priority 3): partner_consents is described as append-only but has no trigger
  refusing UPDATE or DELETE (contrast clinical_summaries). "An append-only log" is a
  convention here.
- Notes: a partner's session has no link to our `sessions`; partner_sessions.person_id is how
  a partner session reaches a real person.

### drizzle/0096_partner_content.sql (64 lines)
- Added: partner_sessions.transcript_text, note_draft, note_approved_text,
  note_approved_by_ref, note_approved_at (CHECK approval_whole), summary_text,
  summary_delivered_at (CHECK summary_after_approval).
- Suspect (P3 for partner patients): `note_approved_by_ref` is the partner's own id for a
  clinician, sent by the partner's server. The COMMENT says "a partner's server is not a
  clinician, and no header or field makes it one", but the only evidence of a human approval
  on this row is a field the partner's server supplies. The CHECK proves a name was sent, not
  that a clinician read it.

### drizzle/0097_sponsor_key.sql (72 lines)
- Changed earlier rule: partner_api_keys.partner_id DROP NOT NULL (0075 NOT NULL). Added CHECK
  partner_api_keys_one_owner (partner or sponsor), partner_api_keys.last_success_at,
  sponsors.employment_verification_enabled_at, sponsors.hr_system.
- Notes: comment 25-29 concedes "exactly one" owner cannot hold; a key may carry both.
  "which kind a key is" is `partner_id IS NULL`, and `mintSponsorKey` is claimed to be the only
  writer (cross-slice).

### drizzle/0098_sponsor_webhooks.sql (43 lines)
- Changed earlier rule: partner_webhooks.partner_id DROP NOT NULL. Added partner_webhooks.
  sponsor_id (FK sponsors CASCADE), CHECK one_owner, partial index.
- Privacy, priority 1 (Suspect): a sponsor can now own rows in `partner_webhooks`, and deliveries
  for sponsor-owned webhooks go through `partner_webhook_deliveries`, whose event CHECK allows
  'session.completed' and 'note.approved' with a `subject_id` and a `created_at`. Nothing in the
  schema restricts which events a sponsor-owned registration may subscribe to (`events` is
  unchecked jsonb) or emit. If any code path fans a session.completed event out to a sponsor's
  webhook, the sponsor learns "somebody (subject_id) completed a session at time T", which is
  E1/E2's "never who and never when". The COMMENT (lines 32-43) argues only that the delivery row
  has no payload; `subject_id` plus `created_at` is already a who-and-when if subject_id is an
  enrolment or person id. Answer is in the webhook fan-out code (lib/partner or lib/sponsor).

### drizzle/0099_clinic_records.sql (60 lines)
- Added: ehr_connections.last_success_at, last_error; ehr_writebacks.approved_by_user_id (FK users
  SET NULL), response_status.
- Notes: the COMMENT says the clinic's records page shows "which patient reference" per filing
  (line 33). A FHIR patient reference on a clinic manager's screen is a patient identifier in the
  clinic portal. C2 relevance, cross-slice.

### drizzle/0100_reapply_after_two_rejections.sql (32 lines)
- Added: therapist_verifications.rejection_count (default 0, no CHECK), documents_cleared_at.

### drizzle/0101_financial_model.sql (57 lines)
- Added: finance_benchmarks (label, measured, source, taken_by SET NULL), finance_scenarios
  (slug unique, assumptions, benchmark_id SET NULL, created_by SET NULL).
- Notes: "Never updated" (COMMENT on finance_benchmarks) has no trigger behind it, unlike
  clinical_summaries. Convention only.

### drizzle/0102_manual_rail.sql (110 lines)
- Added: manual_payments (purpose, ref_id, amount_cents, currency default 'EGP', user_id /
  patient_account_id / sponsor_id / organization_id all FK SET NULL, state default
  'awaiting_proof', reference, proof_url, submitted_at, decided_at, decided_by FK users SET NULL,
  reject_reason). CHECKs: `manual_payments_state_valid` (awaiting_proof, submitted, confirmed,
  rejected); `manual_payments_purpose_valid` (session, subscription, payg_session, pot_topup);
  amount_positive; one_payer (exactly one); rejection_has_reason (rejected implies non-blank
  reason); decision_is_attributed. Partial unique one live per (purpose, ref_id) while
  awaiting_proof/submitted and ref_id not null.
- Enum-union finding: the takeover names `manual_payments_state` and `manual_payments_purpose` as
  unions with no CHECK. **Both HAVE a CHECK, here, named `manual_payments_state_valid` and
  `manual_payments_purpose_valid`, and no later migration drops or widens either** (checked
  0103 to 0115: 0103 drops one_payer and decision_is_attributed; 0104 at_most_one_payer; 0105
  payer_kind_valid and kind_matches_id; 0106 settles_positive; none touch state or purpose).
  Whether they MATCH schema.ts's unions is checked in the schema.ts entry below.
- Promises: A1 (nothing granted before confirm: schema supplies the states, action is code); A3
  (rejection has a reason: kept by CHECK; verbatim display is code). A2 (confirm twice moves
  once): nothing in the schema makes the confirm transition idempotent; it is a conditional
  UPDATE in code if anywhere.
- Notes: currency default 'EGP' is uppercase while every other currency column uses lowercase
  'usd'/'egp' (0024, 0032, 0046, 0089 CHECK). No CHECK on manual_payments.currency. Readers that
  compare to 'egp' would miss 'EGP'. Suspect. Null ref_id rows (a pot-opening top-up) are outside
  the one-live index, so two live pot-opening top-ups can coexist.

### drizzle/0103_payment_survives_the_payer.sql (86 lines)
- Added: manual_payments.payer_kind NOT NULL (backfilled, 'unknown' fallback), CHECK
  payer_kind_valid (user, patient, sponsor), CHECK at_most_one_payer, CHECK kind_matches_id,
  CHECK decision_is_dated.
- Changed earlier rule: dropped one_payer (exactly one) and decision_is_attributed (who decided);
  loosened to at most one payer and "decided rows have a date". Who confirmed a transfer is now
  only in the audit log (comment line 76-77). A2/A5 relevance.
- Looks broken, is handled: the 0102 SET NULL vs exactly-one CHECK contradiction is fixed here.
- Notes: the backfill writes 'unknown' for a row with no payer and the very next CHECK forbids
  'unknown': on a non-empty table with such a row the migration would fail. Comment says table
  empty everywhere.

### drizzle/0104_num_nonnulls.sql (36 lines)
- Rewrote manual_payments_at_most_one_payer with num_nonnulls; same rule. Comment explains the
  0079/0082 detector matches the text `<col> IS NOT NULL`, which also explains why the
  `(a IS NULL) = (b IS NULL)` pairs listed under 0082 went unseen: the detector is textual.

### drizzle/0105_session_is_a_payer.sql (54 lines)
- Changed earlier rule: payer_kind_valid widened with 'session'; kind_matches_id rewritten so a
  session payer has no payer id and must have ref_id.
- Suspect (A3, MAP Suspect 4): a guest (payer_kind 'session') has no account to be told a
  rejection on; the only identification is the session. Reading the reason verbatim depends on
  the join page showing manual_payments by ref_id (cross-slice).

### drizzle/0106_what_it_settles.sql (44 lines)
- Added: manual_payments.settles_cents NOT NULL (backfilled = amount_cents), CHECK > 0.
- Money: comment lines 3-8 record the defect it fixes: an EGP amount credited to a USD pot
  balance 50x. Note the backfill `settles_cents = amount_cents` would reproduce exactly that
  defect on any pre-existing EGP row (comment says none existed).

### drizzle/0107_what_this_transfer_is_for.sql (44 lines)
- Added: manual_payments.line_items jsonb (nullable), comment gives shape [{label, cents}].
- Money Suspect: no CHECK that line_items is an array, or that its cents sum to settles_cents.
  More important: the double-payment guard `manual_payments_one_live_per_ref` covers only
  (purpose, ref_id). A transfer settling eight invoices names them only inside line_items (text
  labels, no ids per comment), so the same invoices can sit inside two live transfers at once and
  both be confirmed. Whether confirm re-checks each invoice's paid state is code (lib/billing/
  manual.ts).

### drizzle/0108_the_patient_stepped_away.sql (28 lines)
- Added: sessions.patient_minimised_at.

### drizzle/0109_we_tried_to_tell_them.sql (65 lines)
- Added: delivery_attempts (kind free text by design, had_phone, had_email, channels jsonb,
  reason, organization_id FK CASCADE). No person/patient column by design.
- Promises: P2 evidence table. Notes: organization CASCADE means a deleted practice takes the
  evidence of what we told its patients with it.

### drizzle/0110_what_the_people_cost.sql (102 lines)
- Added: employees (name, title, queue, started_on, ended_on), employee_salaries (employee
  CASCADE, monthly_cents CHECK >= 0, effective_from, created_by SET NULL, note; unique
  (employee, effective_from)).
- Notes: no CHECK ended_on >= started_on. queue free text.

### drizzle/0111_the_money_in_the_bank.sql (115 lines)
- Added: capital_contributions (amount_cents CHECK > 0, received_on, source, note, created_by SET
  NULL), other_costs (kind CHECK video/bank_charges/hosting/software/professional/marketing/
  other, month, amount_cents CHECK >= 0; unique (kind, month)).
- Notes: H36 names 0111 as the migration after the baseline snapshot.

### drizzle/0112_a_status_the_product_understands.sql (31 lines)
- Data repair: therapist_radar.status outside the four known values set to 'offline'. Added
  CHECK therapist_radar_status_known (offline, online, pending, in_session).
- Notes: the first CHECK on therapist_radar.status, 108 migrations after the column. Comment
  records `scripts/seed-demo.ts` writing 'available' through raw SQL (MAP Suspect 6: the seed
  used raw inserts, not product functions).

### drizzle/0113_a_room_that_outlives_the_appointment.sql (29 lines)
- Added: sessions.video_room_expires_at (no IF NOT EXISTS: not idempotent on replay, harmless
  under the journal).

### drizzle/0114_a_country_code_the_map_can_find.sql (85 lines)
- Data repair: uppercase therapist_radar.country and therapist_verifications.country; demo rows'
  region to 'Cairo Governorate'. Added CHECKs therapist_radar_country_iso and
  therapist_verifications_country_iso (`^[A-Z]{2}$` or NULL).
- Notes: the comment records a second raw-SQL seed defect in the same INSERT as 0112's, and that
  closing a country compares against uppercase codes (C1 / radar). No CHECK on
  country_settings.code or payer_country or people.preferred_country (the same mismatch can
  recur in those).

### drizzle/0115_the_notice_the_database_refused.sql (42 lines)
- Changed earlier rule: patient_notifications_kind widened with session_invited,
  session_started, payment_confirmed, access_requested (validated).
- Promises: P2. The comment records that from 79.1 until this migration, the in-app notice for
  an invite, a session start and a payment confirmation was refused by the DB and swallowed by
  `notify()` at warn, so P2 was broken on production in that window. It also claims
  `verify:migrations` now compares this CHECK to the TypeScript union; whether it does the same
  for every union is the question the enum list below answers.

### lib/db/directory.ts (85 lines)
- For: which region an entity lives in, read from the control plane (`controlDb`).
- Decides: `regionOfPerson` (line 43), `regionOfOrganization` (53), `regionOfPatient` (75):
  patient routes on its person, falls back to the organization when person_id is null; unknown
  region strings fall back to DEFAULT_REGION ('us') silently (lines 50, 60).
- Assumes: `people.region` / `organizations.region` CHECK (0061) keeps values to us/eg.
- Promises: none directly (C118 data residency).
- Notes: header says "Cached per request ... a per-request Map"; there is no cache in this file
  at all. Stale (lines 23-32).

### lib/db/index.ts (172 lines)
- For: database clients. No bare `db`; `dbFor(region)` (101) and `controlDb` (114), plus
  `acrossRegions` fan-out (137) and `isDatabaseUnavailable` (165).
- Decides: one Neon websocket `Pool` per URL with `max: 1` (63); clients cached per URL;
  pools cached on globalThis outside production (57).
- Assumes: DATABASE_URL (and optionally DATABASE_URL_EG) in env; region.ts mapping.
- Suspect (deadlock shape): `max: 1` means one connection per URL per instance. A
  `dbFor(r).transaction(...)` holds that connection; any `controlDb` call (or a second `dbFor(r)`
  call on the outer client rather than `tx`) made inside the callback while `eg` and `us` share
  one URL waits for a connection the transaction holds. `directory.ts` uses `controlDb`, so a
  `regionOfPerson` inside a transaction would hang until timeout. Whether any call site does
  that is outside this slice (grep for regionOf* inside `.transaction(`).
- Suspect: `isDatabaseUnavailable` (168) treats any `relation ... does not exist` as "database
  unavailable" so the public site degrades to defaults. That also swallows H16's failure (code
  deployed before its migration): a missing new table reads as a cold database, silently.
- Notes: `controlDb` is built at import time from `connectionStringFor(DEFAULT_REGION)`, which
  reads DATABASE_URL once; region.ts's "read from the environment every time" applies to
  `regionStatus`, not to the clients.

### lib/db/region.ts (157 lines)
- For: the Region type (us, eg), connection-string mapping, residency status, pins.
- Decides: `connectionStringFor` (53): eg uses DATABASE_URL_EG if set, else DATABASE_URL with
  resident false; `regionStatus` (79) reports it; `crossesBorder` (155) true for eg while not
  resident; `pinnedToDefaultRegion` (139) registers a module's pin in a process-local Map.
- Assumes: verify:sprint30 reads `regionPins()`.
- Suspect: the pin registry fills only when `pinnedToDefaultRegion` is CALLED at runtime, so
  "every call is registered ... `verify:sprint30` prints the list" (131-135) counts only pins
  that executed during the verifier's process. A pinned module the verifier never exercises is
  invisible, which is T2's shape (a count that can read low for looking at nothing). Check
  scripts/verify-sprint30.ts.
- Promises: none of the 25 directly. Consent screen (cross-border) reads regionStatus.
- Notes: today every eg query goes to the US database, and the code says so (27-34).

### lib/db/schema.ts (8944 lines)
- For: the Drizzle model of every table, and the TypeScript enum-like unions the code uses.
  It is NOT the source of truth for constraints: CHECKs and triggers live only in migrations,
  and several FK actions here disagree with the database (below).
- Decides at runtime: only `payableCents` (2338: amount minus discount, floored at 0) and the
  constants RESET_CODE_ATTEMPTS (4053), ENROLMENT_CODE_ATTEMPTS (7175), ATTESTATION_TTL_MINUTES
  (8060), LAUNCH_TOKEN_TTL_SECONDS (8304), EXPORT_TTL_HOURS (1339), FHIR/US Core versions.
- Assumes: migrations carry every CHECK; `lib/feedback-options.ts` re-exported (1441).
- Promises: see Promise evidence.
- Notes, schema vs database drift (the database wins; the TS model misleads a reader):
  - `payoutRequests.approvedByUserId` (5138-5141) says `onDelete: "restrict"` with the comment
    "0082 — a completed change names who approved it". 0082 never touched payout_requests; the
    DB FK `payout_requests_approver_fk` is still SET NULL (0047). Meanwhile
    `phoneChangeRequests.approvedByUserId` (5433-5435) says "set null" but the DB is RESTRICT
    since 0082. The 0082 edit was applied to the wrong table in schema.ts.
  - `sponsors.verifyCycleMonths` default 3 (6541); DB default is 6 since 0073.
  - `patientCredits.fromSessionId` (3622), `people.claimedByAccountId` (3820),
    `patientClinicalFacts.supersedesId` (5931) and `.assessmentId` (5913) have no `.references`
    here; the DB has FKs for the first three (0046, 0034, 0062) and none for assessment_id.
  - `manual_payments` model declares only the payer index; the DB also has
    `manual_payments_queue_idx` and the partial unique `manual_payments_one_live_per_ref`
    (0102). `delivery_attempts` lacks `delivery_attempts_unsent_idx` (0109). `session_voices`
    lacks the one-therapist and patient partial uniques (0065). Harmless at runtime, fatal to
    any future `drizzle-kit generate` (H19).
  - `sponsor_pots.balanceCents` comment (6972): "in the entity's currency, in minor units".
    0106's comment: "`sponsor_pots.balance_cents` is USD cents". One of them is wrong about what
    an Egyptian sponsor's pot balance is denominated in. Money Suspect.
  - `journals.riskLevel` typed `RiskLevel` (6 values, 5703); DB CHECK allows only low, moderate,
    high (0059). Looks broken, is handled: the only writer, `writeJournal`
    (lib/data/journals.ts:99-100), writes 'high' or null.
  - `EXTERNAL_SOURCE_KINDS` (5988) omits 'partner_platform', which 0076's CHECK treats as
    external. Looks broken, is handled: `setSessionSource` would write NULL provisioning for it
    and be refused, but the only writer of that kind is lib/partner/writeback.ts:139-146, which
    inserts the provisioning columns itself.
- File header "24Therapy schema — 22 tables" (22) is stale: the file defines about 100.

## Enum-like text unions in schema.ts, against migration CHECKs

The takeover names `manual_payments_state` and `manual_payments_purpose` as unions with NO
CHECK. That is wrong as of this read: `MANUAL_PAYMENT_STATES` (8846) and
`MANUAL_PAYMENT_PURPOSES` (8838) match `manual_payments_state_valid` and
`manual_payments_purpose_valid` in 0102 value for value, and no later migration drops them.
`payerKind` (8891) matches 0105's `manual_payments_payer_kind_valid`.

Unions (named const arrays or inline `$type<"a"|"b">`) with NO CHECK in any migration:
- users: `role` (ROLES, 96; 0049 comment admits it), `status` (296). `verification_status` has
  no CHECK but is forced by the 0083 trigger to one of four derived values.
- `console_keys.slot` (434), `auth_tokens.purpose` (449).
- `therapist_verifications.state` (VERIFICATION_STATES, 460). Consent/grant relevance: the 0060
  grant trigger and the 0083 derived status both key on the literal 'approved' in this
  unconstrained column.
- `patients.source` (613; comment 597-598 says so; 'walk_in' added with no migration).
- sessions: `modality` (MODALITIES), `session_type` (SESSION_TYPES, 2130), `status`
  (SESSION_STATUSES, 125), `payment_status` (730), `recording_consent` (802),
  `profile_share_consent` (831), `auto_ended_reason` (873), `note_status` (895).
  **`recording_consent` and `profile_share_consent` are the consent record and accept any
  string.** 0067's backfill and every reader compare to 'granted'.
- `transcript_segments.speaker` (935): constrained only by the 0065 trigger, and only when
  voice_id is set.
- session_notes: `status`, `patient_status` (1121, 1141), `provenance` (NOTE_PROVENANCES, 1084).
- risk_assessments: `level` (RISK_LEVELS, 1184), `alert_status` (1238); `source` (1203) only
  partially (0063 ties 'model' to the model column).
- `copilot_messages.role` (COPILOT_ROLES), `data_exports.requested_by_role`,
  `taxonomy_entries.kind` (TAXONOMY_KINDS), `session_reports.kind` (REPORT_KINDS) and `.status`.
- `ai_request_logs.kind` (1725) and `.status`.
- money: `subscriptions.plan` (PLANS; comment 112 says no CHECK on purpose) and `.status`;
  `invoices.kind` (INVOICE_KINDS) and `.status` (INVOICE_STATUSES); `invoice_lines.kind`
  (INVOICE_LINE_KINDS); `session_payments.status` (PAYMENT_STATUSES) and `.capture`;
  `ledger_entries.account` (LEDGER_ACCOUNTS) and `.txn_kind` (LEDGER_TXN_KINDS; comment 2445
  says no CHECK on purpose); `earnings_transfers.status`; `session_credits.status`
  (CREDIT_STATUSES); `payout_request_events.from_status/to_status`; `sponsors.entity` (the only
  `Entity` column without the us/eg CHECK every other entity column has).
- `audit_log.category` (AUDIT_CATEGORIES), `notifications.kind`, `content_pages.status/layout`,
  `error_events.kind`.
- claims and consent: `person_claims.status` (CLAIM_STATUSES), `.route`, `.channel`;
  **`history_grants.status` (GRANT_STATUSES) and `.shape` (GRANT_SHAPES)**. A status spelled
  anything but exactly 'granted' escapes both the 0060 verification trigger and the live-row
  partial unique; readers comparing to 'granted' would then not grant either, so the failure is
  closed, but no DB rule stops e.g. 'revoked' going back to 'granted' (the "a row never moves
  backwards" comment at 4280 is code-only).
- documents: `person_documents.source` (DOCUMENT_SOURCES), `.extraction` (EXTRACTION_STATES);
  `person_diagnoses.status` (DIAGNOSIS_STATES); `content_flags.target_type`, `.reason`.
- memory: `observations.source`, `homework_items.status` (HOMEWORK_STATES) and `.source`,
  `assistant_messages.role`.
- `availability_slots.status` (SLOT_STATES, 4888).
- `support_tickets.source`, `support_ticket_events.kind`.
- assessments: `assessment_assignments.mode` (ASSIGNMENT_MODES), `.status`
  (ASSIGNMENT_STATUSES); `instruments.licence` constrained only when published.
- Deliberately unconstrained and saying so: `delivery_attempts.kind` (2790), `bot_status`
  (6043), `partner_launch_tokens.target` (0077).
One union WIDER than its CHECK: `journals.risk_level` (above, handled).

## Per-table index: CHECKs, triggers, FKs (current state after 0115)

Format: table: CHECKs | triggers | FKs (action). "none" means none. Unique/partial indexes that
act as rules are in the migration entries above.
- organizations: region us/eg, kind, clinic_state, clinic_state_matches_kind, billing_mode,
  partner_billed_names_partner, seats 0..500, intended_clinicians <= 100 | none | partner_id
  RESTRICT (0082).
- users: none | users_verification_status_derived (0083) | organization_id RESTRICT.
- auth_sessions: created_via known, launch_names_partner | none | user CASCADE, partner CASCADE.
- auth_tokens: none | none | user CASCADE.  console_keys: none | none | updated_by SET NULL.
- therapist_verifications: country_iso | therapist_verifications_sync_user (0083) | user CASCADE,
  org CASCADE, reviewed_by SET NULL.
- patients: phone_present (source therapist), phone_e164 | none | org RESTRICT, therapist
  RESTRICT, person SET NULL.
- sessions: feedback_token_present (now also NOT NULL), recovery_outcome_known | none | org,
  therapist, patient RESTRICT; reassigned_from SET NULL.
- transcript_segments: none | transcript_segments_voice_agrees | session CASCADE, org RESTRICT,
  voice SET NULL.
- session_notes: none | none | session CASCADE, org/therapist/patient RESTRICT, approved_by and
  patient_approved_by SET NULL.
- risk_assessments: model_named, unquoted_is_model_only | none | session CASCADE,
  org/therapist/patient RESTRICT, acknowledged_by SET NULL.
- copilot_threads / copilot_messages: none | none | patient, org, therapist CASCADE; thread
  CASCADE, session SET NULL.
- data_exports: none | none | org, patient CASCADE; requested_by, person SET NULL.
- taxonomy_entries: none | none | updated_by SET NULL.
- session_feedback / session_reports: none (no star range CHECK anywhere) | none | session, org,
  therapist CASCADE; resolved_by SET NULL.
- therapist_radar: status_known (0112), country_iso (0114) | none | user, org CASCADE;
  pending_session SET NULL.
- ai_request_logs: none | none | org, user, session, patient SET NULL.
- renewal_obligations: amount >= 0, currency, period, state, paid_has_date, settled_via,
  settled_pair | none | org CASCADE.
- clinic_seats: none | none | org, user CASCADE.  subscriptions: none | none | org CASCADE.
- invoices: fx_complete | none | org CASCADE, session CASCADE, discounted_by SET NULL.
- invoice_lines: none | none | invoice CASCADE.
- session_payments: crossing_known, entity_known, funding_source, shares_sum, coverage_step |
  none | org CASCADE, therapist RESTRICT, session CASCADE.
- ledger_entries: entity_known | none | org, user, created_by SET NULL.
- earnings_transfers: none | none | org, therapist RESTRICT; released_by SET NULL.
- rate_limits, stripe_events, fx_quotes, platform_settings: none | none | platform_settings
  updated_by SET NULL.
- audit_log: via_known | none | org, actor_user, actor_account, actor_sponsor_user,
  actor_clinic_manager, partner all SET NULL; patient_id NO FK.
- notifications: none | none | user CASCADE.  delivery_attempts: none | none | org CASCADE.
- employees: none | none | none.  employee_salaries: not_negative | none | employee CASCADE,
  created_by SET NULL.
- capital_contributions: positive | none | created_by SET NULL.  other_costs: not_negative,
  known_kind | none | created_by SET NULL.
- content_pages: none | none | updated_by SET NULL.  error_events: none | none | none.
- country_settings: entity_known, vat_sane 0..5000, crisis_line_paired, crisis_tel_shape | none
  | updated_by, crisis_line_verified_by SET NULL.
- patient_credits: amount_positive, spend_within | none | person CASCADE, from_session SET NULL.
- session_credits: none | none | org CASCADE.
- people: phone_e164, region_known | none | claimed_by_account SET NULL.
- patient_accounts: phone_e164, phone_present, reachable | none | person RESTRICT.
- patient_auth_sessions: none | none | account CASCADE.
- patient_auth_tokens: expires, attempts 0..5, channel, purpose | none | account CASCADE.
- person_claims: none | none | person, account, patient CASCADE.
- claim_attempts: none | none | account, patient CASCADE; released_by SET NULL.
- person_invites: none | none | person CASCADE, issuer CASCADE, used_by SET NULL.
- history_grants: none | history_grants_verified_only | person, therapist CASCADE; org SET NULL.
- person_documents: none | none | person CASCADE; uploaders, org SET NULL.
- document_chunks: none | none | document, person CASCADE.
- person_diagnoses: none | none | person CASCADE, source_document CASCADE, chunk and confirmer
  SET NULL.
- content_flags: none | none | person CASCADE, raisers SET NULL.
- person_profiles / observations: none | none | person CASCADE.
- homework_items: none | none | person CASCADE; session, assigned_by, org, completed_by SET NULL.
- assistant_threads / assistant_messages: none | none | user, org CASCADE; thread, user CASCADE.
- availability_slots: whole_hour | none | therapist, org CASCADE; session, booked_by SET NULL.
- payout_methods: named, method_known | none | therapist, org CASCADE; editor SET NULL.
- payout_requests: amount_positive, status_known, entity_known, approver_not_payee,
  approver_not_editor, sent_was_approved | none | org, therapist RESTRICT; method, approver,
  sender, owner, editor SET NULL.
- payout_request_events: none | none | request CASCADE, actor SET NULL.
- support_tickets: one_handle, message_present, topic_known, status_known, entity_known,
  closed_dated, audience_known, whatsapp_summarised | none | account, user, owner, closer,
  related_session, related_payout SET NULL.
- support_ticket_events: none | none | ticket CASCADE, actor SET NULL.
- support_attachments: type_known, sized | none | ticket CASCADE, uploader SET NULL.
- phone_change_requests: status_known, reasoned, consented, e164, actually_changes,
  done_was_verified, done_was_approved | none | account CASCADE, owner SET NULL, approver
  RESTRICT (0082).
- locales: direction, code_shaped, public_implies_authoring | none | updated_by SET NULL.
- ui_strings: status, source, not_blank, machine_attributed | none | updated_by SET NULL.
- therapist_codes: shape | none | user, org CASCADE; created_by, revoked_by SET NULL.
- clinical_summaries: version_positive, body_not_blank | clinical_summaries_no_rewrite (UPDATE
  and DELETE) | person CASCADE; approver, org, session SET NULL (all blocked by the trigger).
- journals: source_known, body_not_blank, risk_known | none | person CASCADE; account_id NO FK.
- patient_invites: shape, redemption_complete | none | person CASCADE, redeemed_by SET NULL;
  account_id NO FK.
- history_asks: status_known, decline_has_reason | none | person, therapist CASCADE; account_id
  NO FK.
- cross_border_consents: regions_known, actually_crosses, wording_kept | none | person CASCADE.
- patient_clinical_facts: source_type, status, sensitivity, evidence_kind (5 values),
  quote_not_blank, value_not_blank, priority_matches_source, confidence_is_ai_only,
  verified_pair, no_self_supersede, evidence_matches_kind, facts_journal_never_concludes |
  clinical_facts_ai_unverified, clinical_facts_no_rewrite, clinical_facts_evidence_gone,
  clinical_facts_check_supersession, clinical_facts_retire | person CASCADE; org, segment,
  chunk, journal, supersedes, verified_by SET NULL; entered_by RESTRICT; assessment_id NO FK.
- session_sources: kind (7), external_is_provisioned, token_pair, token_is_hashed,
  bot_only_if_ours | session_sources_no_repoint | session CASCADE, org RESTRICT, provisioned_by
  RESTRICT.
- session_voices: role, bound_by, binding_is_whole, operator_is_named, patient_is_patient,
  ordinal_positive | session_voices_no_repoint, session_voices_unbind_clears_lines | session
  CASCADE, org RESTRICT, patient RESTRICT, bound_by_user RESTRICT.
- meeting_connections: provider, revoked_is_empty | none | user, org CASCADE.
- instruments: free_only, translation_reviewed | none | translation_reviewed_by RESTRICT.
- assessment_assignments: none | none | instrument RESTRICT, patient, org CASCADE; assigned_by,
  session SET NULL.  assessment_responses: none | none | assignment CASCADE.
- sponsors: kind, state | none | none.  sponsor_users: role | none | sponsor CASCADE.
- sponsor_auth_sessions: none | none | sponsor_user CASCADE.  sponsor_codes: none | none |
  sponsor CASCADE.
- sponsor_identifier_fields: kind, no_specimen | none | sponsor CASCADE.
- sponsor_domains: agreement_pair | none | sponsor CASCADE, agreement_approved_by SET NULL
  (contradicts the CHECK).
- enrolments: state (4), identifier_kind, removal_reason, removal_complete,
  provisional_count >= 0 | none | sponsor RESTRICT, person CASCADE.
- enrolment_verifications: attempts 0..5 | none | enrolment CASCADE.
- sponsor_pots: terms_before_money, overdraft_bounded, coverage_step, pending_coverage_pair |
  none | sponsor RESTRICT.
- patient_notifications: kind (8, 0115) | none | person CASCADE.
- clinic_managers: role | none | org CASCADE, role_id SET NULL, linked_user SET NULL.
- clinic_roles: slot_bounded, capabilities_is_array, never_delegable | none | org CASCADE,
  created_by_manager SET NULL.
- clinic_staff_assignments: none | none | org, manager, user CASCADE.
- clinic_auth_sessions: none | none | manager CASCADE.
- clinician_invitations: state, terms_before_acceptance, accepted_complete | none | org CASCADE,
  accepted_user RESTRICT (0082), invited_by_manager SET NULL.
- partners: state, approval_pair | none | approved_by_user SET NULL (contradicts the CHECK).
- partner_users: role | none | partner CASCADE.  partner_auth_sessions: none | none | user
  CASCADE.
- partner_api_keys: environment, employment_needs_sponsor, suspension_has_reason, one_owner |
  none | partner CASCADE, sponsor CASCADE.
- partner_webhooks: https, one_owner | none | partner CASCADE, sponsor CASCADE.
- partner_webhook_deliveries: event (5) | none | webhook CASCADE.
- partner_subjects: none | none | partner CASCADE, person SET NULL, revoked_by_account SET NULL.
- enrolment_attestations: answer_names_key | none | sponsor CASCADE, answered_by_key RESTRICT
  (single FK after 0079).
- partner_launch_tokens: none | none | partner, user CASCADE; key SET NULL.
- partner_consents: state, offset_sane | none | partner CASCADE.
- partner_sessions: environment, sandbox_never_billable, sandbox_no_person, stopped_not_billed,
  note_approval_whole, summary_after_approval | none | partner CASCADE, person SET NULL.
- partner_limits: bounded | none | partner CASCADE.  partner_clinicians: none | none | partner
  CASCADE.
- ehr_connections: vendor, https, revoked_holds_no_secret | none | org CASCADE.
- ehr_launches: severed_holds_no_foreign_id | none | connection, user CASCADE; patient SET NULL.
- ehr_writebacks: state, filed_names_document | none | connection, note CASCADE; approved_by
  SET NULL.
- checkins: channel | none | person CASCADE.  checkin_replies: none | none | checkin, person
  CASCADE.  checkin_mutes: via, unmute_after_mute | none | person CASCADE.
- finance_benchmarks / finance_scenarios: none | none | taken_by, created_by, benchmark SET NULL.
- manual_payments: state_valid, purpose_valid, amount_positive, payer_kind_valid (4),
  at_most_one_payer, kind_matches_id, rejection_has_reason, decision_is_dated,
  settles_positive | none | user, patient_account, sponsor, organization, decided_by SET NULL.
Triggers in the whole database: 12 (0059 one, 0060 one, 0062 five, 0064 one, 0065 three,
0083 two). No trigger enforces append-only on ledger_entries, audit_log, partner_consents,
finance_benchmarks or patient_notifications, all of which are called append-only in comments.

## Tables that store patient identity

Direct identity: `patients` (first_name, last_name, email, phone, timezone, clinical),
`people` (first_name, last_name, email, phone, avatar_url, region, preferred_country),
`patient_accounts` (email, phone, password_hash). Identity by another route:
`sessions.guest_name/guest_email`; `session_payments.payer_name/payer_email/payer_country`;
`session_feedback.patient_email`; `session_reports.patient_email`; `support_tickets.name/
email/phone`; `phone_change_requests.old_phone/new_phone`; `data_exports.delivered_to`;
`availability_slots.note` (the patient's own words) and `booked_by_account_id`;
`assistant_messages.mentions` (jsonb of patientId and name); `partner_subjects.external_ref` to
`person_id`; `partner_sessions` / `partner_consents.external_subject_ref`;
`ehr_launches.fhir_patient_id` to `patient_id`; `enrolments.identifier_hash(_global)` (work
email or student number, hashed); `enrolment_attestations.identifier_hash`;
`cross_border_consents`; `person_claims` / `claim_attempts` / `person_invites` / `patient_invites`
/ `patient_auth_tokens`; `checkins` / `checkin_replies` (person); `patient_notifications`;
`manual_payments.patient_account_id`. Linkable by id: `audit_log.patient_id`,
`ai_request_logs.patient_id`, `session_voices.patient_id`.

## Every column that could link a sponsor to a session

1. `ledger_entries` pot legs: `ref_type = 'sponsor'`, `ref_id = sponsor_id`, sharing `txn_id`
   with the `session_payment` legs of one session (lib/billing/pot.ts:618-651), and each pot
   leg's `created_at` is the session payment time. One `GROUP BY txn_id` joins a sponsor to a
   session and a therapist (`user_id` on the session legs). The schema comment at 2315-2320
   ("there is NO sponsor id here ... The pot's own ledger entries carry the sponsor") moves the
   join, it does not remove it. Any sponsor surface reading pot legs by date (the weekly spend)
   is reading per-session timestamps unless floored.
2. `session_payments.funding_source = 'pot'` + `session_id` + `sponsor_share_cents` +
   `coverage_bps`, then sessions.patient_id -> patients.person_id -> `enrolments.sponsor_id`.
   `coverage_bps` alone can name the sponsor when a sponsor's percentage is unique.
3. `enrolments (person_id, sponsor_id, created_at, provisional_sessions_used)`: the bridge from
   a sponsor to a person, with a join date and a per-person session count.
4. `sponsor_pots.published_sessions` vs the live pot session count, and `balance_cents`: the
   differencing channel 0084 exists to close.
5. `partner_webhooks.sponsor_id` with `partner_webhook_deliveries (event 'session.completed' /
   'note.approved', subject_id, created_at)` (0098).
6. `partner_api_keys.sponsor_id`, `enrolment_attestations.sponsor_id` (identity, not session).
7. `audit_log.actor_sponsor_user_id` on the same table as `patient_id`, `resource_id`.
8. `ai_request_logs.patient_id` + `session_id` + created_at (C280), via enrolments.
9. `manual_payments.sponsor_id`: pot top-ups only, no session; safe as far as the schema goes.
`patient_notifications` deliberately has no sponsor column.


## Stale

- drizzle/0012_radar_demo_ban.sql:3-6 and lib/db/schema.ts:1648-1656: `demo` "is exempt from the
  heartbeat expiry ... set by `scripts/demo.ts` and by nothing else". MAP says demo became a
  label only on 2026-09-22, and 0114:71-77 shows `scripts/seed-demo.ts` writing demo rows.
- drizzle/0040_repair.sql:45-104: "the multi-statement DO $$ blocks, repaired forward" omits
  `person_invites_issuer_fk` and `person_invites_used_by_fk` from 0034:54-55.
- drizzle/0050_country_rails.sql:31-33: argues a 10,000 bps ceiling; the CHECK is 5000.
- drizzle/0063_risk_findings.sql:10: calls `indicators` text[]; it is jsonb (0000:116).
- drizzle/0062_clinical_facts.sql:176-178: "The evidence pointer must match the kind it claims";
  the CHECK only tests the clinician branch (ELSE true).
- drizzle/0072_corporate.sql:189-196: "ONE IDENTIFIER, USED ONCE, EVER, across every sponsor";
  false since the hash is salted per sponsor (0085 admits it).
- drizzle/0079_one_fk_per_column.sql: name reads schema-wide; fixes one column.
- drizzle/0082_set_null_vs_check.sql:12-24: "an audit written for the new shape found six" and
  "a permanent check in verify:sprint52"; at least four more pairs exist (see Broken).
- drizzle/0089_renewal_obligations.sql:37: "0088's rule decides which" currency; 0088 is the
  crisis line.
- lib/db/directory.ts:23-32: "a per-request Map" cache; no cache exists in the file.
- lib/db/schema.ts:22: "22 tables"; about 100.
- lib/db/schema.ts:300: "Soft signal only, it must never gate the clinical loop" sits over
  `verification_status`, which 0060/0083 make the gate for grants and partner launch.
- lib/db/schema.ts:316-325: "We never hold their money ... paying it out by hand would make us a
  payment intermediary"; 0024 ledger, 0047 manual payouts and 0102 manual rail do exactly that.
- lib/db/schema.ts:3918-3923: patient_accounts.phone "NOT VALID until sprint 22"; validated in
  0054.
- lib/db/schema.ts:3755-3757, 4167-4169: "56 of 66 patients have no email and none has a phone"
  is a pre-purge measurement.
- lib/db/schema.ts:5138-5141: payout_requests.approved_by_user_id "restrict, 0082"; DB is SET
  NULL, 0082 changed phone_change_requests (schema.ts 5433 still says set null).
- lib/db/schema.ts:6541: verify_cycle_months default 3; DB default 6 (0073).
- lib/db/schema.ts:4164-4175: person_invites doc comment is detached above claimAttempts;
  8542: ehrWritebacks "Why it was refused" doc comment orphaned.

## Suspect

- lib/db/index.ts:63 `max: 1` per URL: a `controlDb` or outer-client query inside a
  `dbFor(r).transaction` waits on the connection the transaction holds (eg and us share a URL
  today). Answer: grep `regionOf`/`controlDb` inside `.transaction(` callbacks.
- lib/db/index.ts:165-171: any "relation does not exist" is treated as a cold database, masking
  H16 (code shipped before its migration) as a graceful fallback.
- lib/db/region.ts:137-147: pin registry fills only when pinned code runs; verify:sprint30's
  count can read low (T2). Check scripts/verify-sprint30.ts.
- Privacy P1: ledger_entries pot legs (ref_type 'sponsor') share txn_id with session payment
  legs (lib/billing/pot.ts:618-651); per-session timestamps per sponsor are one GROUP BY away.
  Answer in lib/data/sponsors.ts (weeklySpend) and anything reading sponsor_pot legs by date.
- Privacy P1: 0098 lets a sponsor own `partner_webhooks`; deliveries can carry
  'session.completed' / 'note.approved' with subject_id and created_at, and no DB rule limits a
  sponsor webhook's events. Answer in the webhook fan-out (lib/partner, lib/sponsor).
- Privacy: 0075 one partner row can hold a sponsor-scoped key and partner_subjects receiving
  session.completed. Same place.
- 0093 clinic_staff_assignments: nothing ties user_id / clinic_manager_id to organization_id;
  lib/clinic-auth must.
- 0093 clinic_managers.role_id SET NULL falls back to the built-in `role`, which may be admin.
- 0092 organizations.seats vs live clinic_seats rows: two seat counts (C3, C4). lib/billing.
- 0060 history_grants: verification checked at write only; a granted grant survives a lapsed
  verification. history_grants.status has no CHECK, no transition rule.
- 0062: facts can cite a segment/chunk/journal of a different person; 'segment'/'chunk'/
  'journal' facts can be inserted with no pointer and stay active.
- 0068/0070 facts_journal_never_concludes depends on literal domain strings 'diagnosis'/'risk'.
- 0071: nothing ties bot dispatch to sessions.recording_consent (consent). lib/meetings.
- 0095 partner_consents called append-only, no trigger. 0096 note_approved_by_ref is the
  partner server's word (P3 for partner patients).
- 0102 manual_payments.currency default 'EGP' uppercase vs lowercase everywhere else; no CHECK.
- 0107 line_items: no CHECK it sums to settles_cents; invoices named only inside line_items are
  outside the one-live-per-ref guard, so one invoice can sit in two live transfers (money
  twice). lib/billing/manual.ts confirm path.
- 0089 renewal_obligations.settled_ref not unique: one gateway ref can settle two obligations.
- 0066 session_credits: no spent <= credit / consumed <= quantity CHECK.
- 0024 / schema 2459: "legs of a txnId always sum to exactly zero" and "append-only" have no DB
  enforcement.
- schema 6972 vs 0106:3-8: sponsor_pots.balance_cents currency (entity's vs USD).
- 0085 identifier_hash_global not required on new rows.
- 0086 "exactly one actor column" on audit_log: no CHECK.
- 0032 fx_rate_micro int4 overflows for currencies above about 2147 per base unit.
- 0039 availability_slots duration unconstrained: a 120-minute slot overlaps the next hour.
- 0017/0018/0042-0046 and later: files without `--> statement-breakpoint` run as one
  multi-statement query; fine on the websocket driver, check scripts/migrate.ts.
- 0078:26-28, 0082:28-31: "no hard DELETE on these parents anywhere in the code"; the whole
  set-null-vs-check argument rests on it.

## Broken

(Latent: each fires only on a hard DELETE, which 0082 says the product never does. Grepped for
a later fix: none found in 0083-0115.)
- `patient_invites.redeemed_by_user_id` SET NULL (0060:55) vs `patient_invites_redemption_
  complete` (0060:70-74): deleting a clinician who redeemed an invite fails with a CHECK error.
- `patient_clinical_facts.verified_by` SET NULL (0062:75) vs `clinical_facts_verified_pair`
  (0062:163-167): deleting a clinician who verified a fact fails. 0082 fixed entered_by beside it.
- `sponsor_domains.agreement_approved_by` SET NULL vs `agreement_pair` (0091:41-43).
- `partners.approved_by_user_id` SET NULL vs `partners_approval_pair` (0095:244-256).
- clinical_summaries append-only trigger (0059:55-65) refuses the FK CASCADE / SET NULL writes:
  deleting a person, an approving clinician, their organization or the source session fails
  once a summary exists. A person-erasure request cannot be done by DELETE.
- Schema/DB drift that will mislead the next migration author: lib/db/schema.ts:5138-5141 vs
  0047 (payout approver), 5433 vs 0082 (phone change approver), 6541 vs 0073.

## Looks broken, is handled

- 0049 phone_change / 0070 instruments / 0074 invitations / 0075 organizations.partner_id and
  auth_sessions.partner_id set-null-vs-check pairs: fixed by 0082:61-93.
- 0075 enrolment_attestations answered_by_key SET NULL vs CHECK: 0078 added RESTRICT under the
  wrong drop name, 0079:38-63 removed the SET NULL duplicate.
- 0102 manual_payments exactly-one-payer vs SET NULL: 0103:45-83, 0104.
- Takeover claim "manual_payments_state and manual_payments_purpose have no CHECK":
  0102:68-71 has both; schema.ts:8838-8852 match value for value.
- journals.risk_level union (6 values, schema.ts:5703) wider than CHECK (3, 0059:102-105): only
  writer writes 'high' or null (lib/data/journals.ts:99-100).
- EXTERNAL_SOURCE_KINDS (schema.ts:5988) omits partner_platform while 0076 requires provisioning
  for it: the only writer inserts it directly with provisioning (lib/partner/writeback.ts:139-146).
- 0115: in-app notices refused by the old CHECK (P2 broken on production for a window); fixed.
- 0112 / 0114: radar status 'available' and lowercase 'eg' written by the raw-SQL seed; repaired
  and CHECKed.
- NOT VALID constraints: all 15 from 0042-0050 validated in 0054; every later NOT VALID is
  validated in the same file.

## Unclaimed

- (a) patient_clinical_facts evidence layer with supersession rules (0062): no promise covers it.
- (a) assessments with per-answer timing (0070); check-ins with crisis routing and mute log
  (0081); cross-border consent with frozen wording (0061); claim-by-phone challenge (0043-0045).
- (a) EHR SMART-on-FHIR connections, launches, writebacks (0080, 0099); partner platform
  intelligence (0095-0096); meeting bots (0071).
- (b) ai_request_logs.patient_id (0069): a timestamped per-person care-volume trail no promise
  covers and C280 itself calls dangerous.
- (b) ledger_entries sponsor legs keyed to sessions by txn_id (see Suspect).
- (c) partner_limits, partner_clinicians, finance_scenarios, employees/salaries,
  capital_contributions, other_costs: back-office tables with no audience promise.
- (c) history_asks (0060): a patient's ask to an old therapist; if unanswered there is no
  expiry column and no escalation, a request that can wait forever.
- (c) claim_attempts locked_at: release only by the therapist who wrote the record (schema
  4192-4196); a patient whose therapist left has no way out in the schema.

## Promise evidence

- P2: 0115 widens patient_notifications_kind for invite/start/payment; partly (was broken on
  production until 0115; delivery_attempts 0109 records attempts). Kept now at the schema level.
- P3: clinical_summaries.approved_by_name NOT NULL, credentials snapshotted (0059); kept for our
  sessions; partner notes rest on partner-sent `note_approved_by_ref` (0096): partly.
- P4: append-only summaries trigger (0059:55-65); kept (at the cost of undeletable people).
  Patient decides readers: history_grants (0035) with verified-only trigger (0060); partly (no
  status CHECK, lapsed verification keeps grant).
- P5: crisis line per country (0088), seeded empty by design; Egypt has no number until an
  operator enters one. Cannot tell the screen from here.
- T1/T2: session_notes.provenance and off_record_seconds (0067), recording_paused_at (0015);
  provenance and recording_consent have no CHECK: partly.
- T3: ledger accounts exist; no zero-sum or append-only enforcement: cannot tell from here.
- T5: grant trigger (0060), copilot_threads unique per patient (0002): partly (see P4).
- C1: therapist_radar status CHECK (0112), verification derived (0083): kept at schema level.
- C2: broken by design in the schema's own words: patients.clinic_visibility_shown_at COMMENT
  (0093:135-136, schema.ts:620-621) says clinic staff see first name, last initial and
  appointment times; 0099 comment lists "which patient reference" on the clinic records page.
- C3/C4: organizations.seats and clinic_seats both exist, unlinked: cannot tell from here.
- C5: nothing in schema.
- E1: published_balance_cents (0084) exists; per-session ledger legs keyed to sponsor remain:
  partly.
- E2: session_payments carries no sponsor id (schema 2315); sponsor webhooks may carry
  session.completed (0098); ledger join exists: partly, suspect.
- E3: coverage frozen on session_payments with shares_sum CHECK (0090): kept.
- E4: coverage 0 legal, removal separate (0090, 0072 removal_complete): kept.
- E5: overdraft_bounded (0072); nothing about the message: cannot tell.
- A1: manual_payments states CHECKed (0102); action on confirm is code: cannot tell.
- A2: one_live_per_ref (0102) covers only ref_id; line_items invoices unguarded: partly.
- A3: rejection_has_reason CHECK (0102): kept in DB; guest payer (0105) reading it: cannot tell.
- A4: nothing in schema for unmatched bank lines: cannot tell.
- A5: users.role has no CHECK (0049:4-6); audit_log gains actor columns (0086): partly.

## Coverage

| File | Lines | Read |
|---|---|---|
| drizzle.config.ts | 12 | read |
| drizzle/0000_abandoned_daredevil.sql | 285 | read |
| drizzle/0001_invoices.sql | 76 | read |
| drizzle/0002_copilot_chat.sql | 56 | read |
| drizzle/0003_connect.sql | 60 | read |
| drizzle/0004_radar.sql | 42 | read |
| drizzle/0005_rate_limits.sql | 16 | read |
| drizzle/0006_radar_reservation.sql | 7 | read |
| drizzle/0007_note_language.sql | 8 | read |
| drizzle/0008_verification.sql | 49 | read |
| drizzle/0009_data_exports.sql | 47 | read |
| drizzle/0010_taxonomy.sql | 27 | read |
| drizzle/0011_practice.sql | 23 | read |
| drizzle/0012_radar_demo_ban.sql | 15 | read |
| drizzle/0013_feedback.sql | 87 | read |
| drizzle/0014_arrival_rating.sql | 13 | read |
| drizzle/0015_recording_paused.sql | 11 | read |
| drizzle/0016_session_stars.sql | 13 | read |
| drizzle/0017_recording_consent.sql | 25 | read |
| drizzle/0018_error_events.sql | 33 | read |
| drizzle/0019_usage_microcents.sql | 44 | read |
| drizzle/0020_content_locale.sql | 23 | read |
| drizzle/0021_speaker_inferred.sql | 13 | read |
| drizzle/0022_feedback_token.sql | 25 | read |
| drizzle/0023_patient_note_approval.sql | 27 | read |
| drizzle/0024_ledger.sql | 63 | read |
| drizzle/0025_session_ladder.sql | 17 | read |
| drizzle/0026_console_keys.sql | 13 | read |
| drizzle/0027_copilot_language.sql | 12 | read |
| drizzle/0028_transcript_language.sql | 16 | read |
| drizzle/0029_platform_settings.sql | 29 | read |
| drizzle/0030_session_credits.sql | 24 | read |
| drizzle/0031_acoustic_descriptors.sql | 2 | read |
| drizzle/0032_money_model.sql | 41 | read |
| drizzle/0033_people.sql | 79 | read |
| drizzle/0034_patient_accounts.sql | 81 | read |
| drizzle/0035_consent.sql | 66 | read |
| drizzle/0036_documents.sql | 107 | read |
| drizzle/0037_memory.sql | 73 | read |
| drizzle/0038_assistant.sql | 35 | read |
| drizzle/0039_scheduling.sql | 64 | read |
| drizzle/0040_repair.sql | 104 | read |
| drizzle/0041_requeue_documents.sql | 27 | read |
| drizzle/0042_sweep.sql | 85 | read |
| drizzle/0043_claim_by_phone.sql | 96 | read |
| drizzle/0044_challenge_passed.sql | 15 | read |
| drizzle/0045_two_handles.sql | 96 | read |
| drizzle/0046_no_show.sql | 112 | read |
| drizzle/0047_two_rails.sql | 331 | read |
| drizzle/0048_support_tickets.sql | 157 | read |
| drizzle/0049_back_office.sql | 240 | read |
| drizzle/0050_country_rails.sql | 40 | read |
| drizzle/0051_strings_and_languages.sql | 116 | read |
| drizzle/0052_audit_resource_key.sql | 18 | read |
| drizzle/0053_patient_reset.sql | 46 | read |
| drizzle/0054_validate.sql | 51 | read |
| drizzle/0055_handle_verification.sql | 24 | read |
| drizzle/0056_optional_password.sql | 37 | read |
| drizzle/0057_patient_avatar.sql | 14 | read |
| drizzle/0058_therapist_codes.sql | 34 | read |
| drizzle/0059_summaries_and_journals.sql | 117 | read |
| drizzle/0060_portability.sql | 116 | read |
| drizzle/0061_region.sql | 80 | read |
| drizzle/0062_clinical_facts.sql | 340 | read |
| drizzle/0063_risk_findings.sql | 57 | read |
| drizzle/0064_session_sources.sql | 136 | read |
| drizzle/0065_session_voices.sql | 223 | read |
| drizzle/0066_split_fee.sql | 48 | read |
| drizzle/0067_note_provenance.sql | 70 | read |
| drizzle/0068_journal_inference.sql | 46 | read |
| drizzle/0069_usage_attribution.sql | 45 | read |
| drizzle/0070_assessments.sql | 165 | read |
| drizzle/0071_meeting_bots.sql | 122 | read |
| drizzle/0072_corporate.sql | 324 | read |
| drizzle/0073_pot_rails.sql | 102 | read |
| drizzle/0074_clinics.sql | 243 | read |
| drizzle/0075_partner_plane.sql | 430 | read |
| drizzle/0076_partner_sessions.sql | 49 | read |
| drizzle/0077_partner_launch.sql | 59 | read |
| drizzle/0078_attestation_key_restrict.sql | 42 | read |
| drizzle/0079_one_fk_per_column.sql | 63 | read |
| drizzle/0080_ehr.sql | 183 | read |
| drizzle/0081_checkins.sql | 106 | read |
| drizzle/0082_set_null_vs_check.sql | 93 | read |
| drizzle/0083_verification_one_truth.sql | 141 | read |
| drizzle/0084_pot_balance_floor.sql | 25 | read |
| drizzle/0085_identifier_once_ever.sql | 34 | read |
| drizzle/0086_audit_the_other_principals.sql | 48 | read |
| drizzle/0087_a_partner_link_can_be_cut.sql | 62 | read |
| drizzle/0088_a_crisis_line_per_country.sql | 63 | read |
| drizzle/0089_renewal_obligations.sql | 93 | read |
| drizzle/0090_coverage_percentage.sql | 106 | read |
| drizzle/0091_proving_a_company.sql | 90 | read |
| drizzle/0092_seats.sql | 65 | read |
| drizzle/0093_clinic_staff.sql | 136 | read |
| drizzle/0094_clinic_application.sql | 44 | read |
| drizzle/0095_partner_platform.sql | 259 | read |
| drizzle/0096_partner_content.sql | 64 | read |
| drizzle/0097_sponsor_key.sql | 72 | read |
| drizzle/0098_sponsor_webhooks.sql | 43 | read |
| drizzle/0099_clinic_records.sql | 60 | read |
| drizzle/0100_reapply_after_two_rejections.sql | 32 | read |
| drizzle/0101_financial_model.sql | 57 | read |
| drizzle/0102_manual_rail.sql | 110 | read |
| drizzle/0103_payment_survives_the_payer.sql | 86 | read |
| drizzle/0104_num_nonnulls.sql | 36 | read |
| drizzle/0105_session_is_a_payer.sql | 54 | read |
| drizzle/0106_what_it_settles.sql | 44 | read |
| drizzle/0107_what_this_transfer_is_for.sql | 44 | read |
| drizzle/0108_the_patient_stepped_away.sql | 28 | read |
| drizzle/0109_we_tried_to_tell_them.sql | 65 | read |
| drizzle/0110_what_the_people_cost.sql | 102 | read |
| drizzle/0111_the_money_in_the_bank.sql | 115 | read |
| drizzle/0112_a_status_the_product_understands.sql | 31 | read |
| drizzle/0113_a_room_that_outlives_the_appointment.sql | 29 | read |
| drizzle/0114_a_country_code_the_map_can_find.sql | 85 | read |
| drizzle/0115_the_notice_the_database_refused.sql | 42 | read |
| lib/db/directory.ts | 85 | read |
| lib/db/index.ts | 172 | read |
| lib/db/region.ts | 157 | read |
| lib/db/schema.ts | 8944 | read |
