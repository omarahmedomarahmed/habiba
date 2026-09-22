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

