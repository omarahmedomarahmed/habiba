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

