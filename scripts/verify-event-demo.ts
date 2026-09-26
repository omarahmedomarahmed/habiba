/**
 * 🔴 THE EVENT CAST: EVERY LOGIN OPENS, AND WHAT IT OPENS ONTO IS TRUE.
 *
 *     npm run verify:event-demo
 *     npm run on:production -- verify:event-demo
 *     npm run verify:demo -- --scenario=event          # the same thing, by the other door
 *
 * The half of `seed:demo -- --scenario=event` that reads. Every statement is a
 * SELECT or a password hash compared in memory, which is why it may be pointed at
 * production.
 *
 * What it holds, and why each one:
 *
 *   - Every login in `EVENT_LOGINS`, which is the table in `docs/DEMO-LOGINS.md`,
 *     exists, is at `example.com`, and opens with `EVENT_PASSWORD`. A table handed
 *     to strangers with one dead row in it is a stranger stuck at a sign-in page.
 *   - Neither published password opens the console or the support account.
 *   - Cairo Foundry's pot is the ledger's, and enough people are enrolled that
 *     its spend is published: the product hides it below the floor, and a
 *     company screen reading "not enough activity" is the empty screen this
 *     cast exists to avoid.
 *   - Mariam has four completed sessions with Dr Karim, each with a two-sided
 *     transcript and a signed, released note, a live grant to him, one booked
 *     tomorrow, and a standing profile whose every reference names a real line.
 *   - Every clinician is visible to patients by the same rule the directory
 *     uses, without anybody opening the crisis radar first.
 */
import { sql } from "drizzle-orm";

import { DEMO_PASSWORD, PRIVATE_LOGINS } from "./_demo-cast";
import { EVENT, EVENT_LOGINS, EVENT_PASSWORD } from "./_event-cast";
import { hostOf, reporter } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

type Row = Record<string, unknown>;

async function main() {
  const { db, pool } = connect();
  console.log(`\nreading ${hostOf()}`);
  console.log("scenario: event. The founders' demo video, as logins to hand out.\n");

  try {
    const { verifyPassword } = await import("../lib/auth/password");
    const rows = async (text: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(text)).rows as Row[];
    const num = async (text: ReturnType<typeof sql>): Promise<number> =>
      Number(((await rows(text))[0] ?? {}).n ?? 0);

    /* ------------------------------------------------ can they sign in -- */

    for (const login of EVENT_LOGINS) {
      check(`${login.who}: the address is at example.com`, login.email.endsWith("@example.com"), login.email);
      const [row] = await rows(
        sql.raw(
          `SELECT password_hash AS h FROM ${login.table}
            WHERE lower(email) = lower('${login.email.replace(/'/g, "''")}') AND deleted_at IS NULL`,
        ),
      );
      const stored = row?.h ? String(row.h) : null;
      check(
        `${login.who} (${login.role}) signs in at ${login.where}`,
        stored !== null && (await verifyPassword(EVENT_PASSWORD, stored)),
        stored ? login.email : `no ${login.table} row for ${login.email}`,
      );
    }

    /* And the doors behind those passwords are open, not merely the passwords right. */
    const shut = await num(sql`
      SELECT count(*)::int AS n FROM (
        SELECT 1 FROM sponsors WHERE name IN (${EVENT.cairoFoundry}, ${EVENT.nilePharma}) AND state <> 'active'
        UNION ALL SELECT 1 FROM organizations WHERE slug = ${EVENT.clinicSlug} AND clinic_state <> 'active'
        UNION ALL SELECT 1 FROM partners WHERE slug = ${EVENT.partnerSlug} AND state <> 'active'
        UNION ALL SELECT 1 FROM people p JOIN patient_accounts a ON a.person_id = p.id
                   WHERE a.email LIKE '%@example.com' AND p.claimed_at IS NULL
      ) x`);
    check("every company, the clinic, the partner and every patient account is open for use", shut === 0, `${String(shut)} shut`);

    for (const email of PRIVATE_LOGINS) {
      const [row] = await rows(sql`
        SELECT password_hash AS h FROM users WHERE email = ${email}
        UNION ALL SELECT password_hash FROM sponsor_users WHERE email = ${email}`);
      if (!row?.h) {
        console.log(`  --    ${email}: not in this cast`);
        continue;
      }
      const stored = String(row.h);
      check(
        `${email}: neither published password opens it`,
        !(await verifyPassword(EVENT_PASSWORD, stored)) && !(await verifyPassword(DEMO_PASSWORD, stored)),
      );
    }

    /* ------------------------------------------------------ the companies -- */

    const { ledgerPotBalance, potTotals } = await import("../lib/billing/pot");
    const { getSettings } = await import("../lib/settings");
    const floor = (await getSettings()).sponsor.activityFloor;

    for (const [name, coverage, enrolledAtLeast] of [
      [EVENT.cairoFoundry, 10_000, 8],
      [EVENT.nilePharma, 5_000, 5],
    ] as const) {
      const [pot] = await rows(sql`
        SELECT s.id, p.balance_cents AS balance, p.coverage_bps AS coverage, p.overdraft_cents AS overdraft,
               p.published_balance_cents AS published
          FROM sponsors s JOIN sponsor_pots p ON p.sponsor_id = s.id WHERE s.name = ${name}`);
      if (!pot) {
        check(`${name} has a pot`, false, "no sponsor or no pot");
        continue;
      }
      const sponsorId = String(pot.id);
      const balance = Number(pot.balance);
      const fromLedger = await ledgerPotBalance(sponsorId);
      check(`${name}: the pot balance is the ledger's`, fromLedger === balance, `ledger ${String(fromLedger)}, pot ${String(balance)}`);
      check(`${name}: the pot holds money`, balance > 0, `${String(balance)} cents`);
      check(`${name}: covers ${String(coverage / 100)}%`, Number(pot.coverage) === coverage, `${String(pot.coverage)} bps`);

      const enrolled = await num(sql`
        SELECT count(*)::int AS n FROM enrolments
         WHERE sponsor_id = ${sponsorId} AND removed_at IS NULL AND state = 'active' AND last_verified_at IS NOT NULL`);
      check(
        `${name}: ${String(enrolledAtLeast)}+ enrolled, and at least the privacy floor of ${String(floor)}`,
        enrolled >= enrolledAtLeast && enrolled >= floor,
        `${String(enrolled)} enrolled`,
      );

      const totals = await potTotals(sponsorId);
      check(
        `${name}: sessions it paid towards clear the floor, so a balance is published`,
        totals.sessions >= floor && pot.published !== null,
        `${String(totals.sessions)} sessions, published ${pot.published === null ? "nothing" : String(pot.published)}`,
      );

      /* The weekly chart, by the rule the portal applies, read rather than called: this file writes nothing. */
      const { applyActivityFloor } = await import("../lib/data/sponsors");
      const weeks = (
        await rows(sql`
          SELECT date_trunc('week', created_at) AS w, SUM(amount_cents)::int AS spend, COUNT(*)::int AS n
            FROM ledger_entries
           WHERE account = 'sponsor_pot' AND amount_cents > 0 AND txn_kind <> 'pot_return'
             AND ref_type = 'sponsor' AND ref_id = ${sponsorId}
           GROUP BY 1 ORDER BY 1`)
      ).map((r) => ({ weekStart: new Date(String(r.w)), spendCents: Number(r.spend), sessions: Number(r.n) }));
      const shown = applyActivityFloor(weeks, floor).filter((w) => w.spendCents !== null);
      check(
        `${name}: spend is spread over weeks and some weeks publish a figure`,
        weeks.length >= 4 && shown.length >= 1,
        `${String(weeks.length)} weeks of spend, ${String(shown.length)} published`,
      );

      const code = await num(sql`
        SELECT count(*)::int AS n FROM sponsor_codes WHERE sponsor_id = ${sponsorId} AND revoked_at IS NULL`);
      const list = await num(sql`
        SELECT count(*)::int AS n FROM sponsor_email_list WHERE sponsor_id = ${sponsorId} AND removed_at IS NULL`);
      check(`${name}: a joining code and a staff email list`, code === 1 && list >= enrolledAtLeast, `${String(code)} code, ${String(list)} on the list`);
    }

    const split = await num(sql`
      SELECT count(*)::int AS n FROM session_payments sp JOIN sessions s ON s.id = sp.session_id
       WHERE sp.coverage_bps = 5000 AND sp.sponsor_share_cents > 0 AND sp.patient_share_cents > 0
         AND s.status = 'completed' AND s.payment_status = 'paid'`);
    check("Nile Pharma: sessions part-paid by the company, the rest paid by the employee", split >= 5, `${String(split)}`);

    /* ------------------------------------------------------------- Mariam -- */

    const karimId = sql`(SELECT id FROM users WHERE email = ${EVENT.karim})`;
    const mariamPerson = sql`(SELECT id FROM people WHERE email = ${EVENT.mariam})`;

    const [mariam] = await rows(sql`
      SELECT p.phone, e.state, s.name AS sponsor FROM people p
        JOIN enrolments e ON e.person_id = p.id AND e.removed_at IS NULL
        JOIN sponsors s ON s.id = e.sponsor_id
       WHERE p.email = ${EVENT.mariam}`);
    check(
      "Mariam is enrolled with Cairo Foundry, with her phone on file",
      mariam?.sponsor === EVENT.cairoFoundry && mariam?.state === "active" && mariam?.phone === EVENT.mariamPhone,
      `${String(mariam?.sponsor ?? "no enrolment")}, ${String(mariam?.phone ?? "no phone")}`,
    );

    const completed = await rows(sql`
      SELECT s.id,
             (SELECT count(DISTINCT speaker)::int FROM transcript_segments t WHERE t.session_id = s.id) AS speakers,
             (SELECT count(*)::int FROM transcript_segments t WHERE t.session_id = s.id) AS lines,
             (SELECT count(*)::int FROM session_notes n WHERE n.session_id = s.id
                 AND n.status = 'approved' AND n.patient_status = 'approved') AS signed
        FROM sessions s JOIN patients c ON c.id = s.patient_id
       WHERE c.person_id = ${mariamPerson} AND s.therapist_id = ${karimId} AND s.status = 'completed'`);
    check("Mariam has 4 completed sessions with Dr Karim", completed.length === 4, `${String(completed.length)}`);
    check(
      "each with a two-sided transcript",
      completed.every((s) => Number(s.speakers) === 2 && Number(s.lines) >= 10),
      completed.map((s) => `${String(s.lines)} lines`).join(", "),
    );
    check(
      "each with a note signed for the chart and released to her",
      completed.every((s) => Number(s.signed) === 1),
      `${String(completed.filter((s) => Number(s.signed) === 1).length)} of ${String(completed.length)}`,
    );

    const arabic = await num(sql`
      SELECT count(*)::int AS n FROM transcript_segments t JOIN sessions s ON s.id = t.session_id
        JOIN patients c ON c.id = s.patient_id
       WHERE c.person_id = ${mariamPerson} AND t.text ~ '[؀-ۿ]'`);
    check("her sessions are in English with some Arabic", arabic >= 3, `${String(arabic)} lines with Arabic`);

    const grant = await num(sql`
      SELECT count(*)::int AS n FROM history_grants
       WHERE person_id = ${mariamPerson} AND therapist_user_id = ${karimId} AND status = 'granted'
         AND revoked_at IS NULL AND expires_at IS NULL`);
    check("a live grant to Dr Karim, until she changes her mind", grant === 1, `${String(grant)}`);

    const tomorrow = await num(sql`
      SELECT count(*)::int AS n FROM sessions s JOIN patients c ON c.id = s.patient_id
       WHERE c.person_id = ${mariamPerson} AND s.therapist_id = ${karimId} AND s.status = 'scheduled'
         AND s.scheduled_at > now() AND s.scheduled_at < now() + interval '2 days'
         AND EXISTS (SELECT 1 FROM availability_slots a WHERE a.session_id = s.id AND a.status = 'booked')`);
    check("and one booked with him in the next day or so, from his open hours", tomorrow === 1, `${String(tomorrow)}`);

    const measures = await num(sql`
      SELECT count(*)::int AS n FROM assessment_assignments a JOIN patients c ON c.id = a.patient_id
       WHERE c.person_id = ${mariamPerson} AND a.status = 'completed' AND a.score IS NOT NULL`);
    const published = await num(sql`
      SELECT count(*)::int AS n FROM instruments WHERE key IN ('phq9','gad7') AND published_at IS NOT NULL`);
    check("her PHQ-9 and GAD-7, answered twice each", measures === published * 2, `${String(measures)} of ${String(published * 2)}`);

    for (const [label, text, atLeast] of [
      ["homework from her sessions", sql`SELECT count(*)::int AS n FROM homework_items WHERE person_id = ${mariamPerson}`, 6],
      ["her journal", sql`SELECT count(*)::int AS n FROM journals WHERE person_id = ${mariamPerson}`, 3],
      ["a clinical summary on her record", sql`SELECT count(*)::int AS n FROM clinical_summaries WHERE person_id = ${mariamPerson}`, 1],
      ["a copilot thread on Dr Karim's side", sql`SELECT count(*)::int AS n FROM copilot_threads t JOIN patients c ON c.id = t.patient_id WHERE c.person_id = ${mariamPerson}`, 1],
    ] as const) {
      const got = await num(text);
      check(`Mariam: ${label}`, got >= atLeast, `${String(got)}`);
    }

    /*
     * 🔴 THE PROFILE'S REFERENCES, RESOLVED THE WAY `lib/ai/profile.ts` BUILDS THEM:
     * `S<n>` is her n-th session by `created_at`, `:<m>` its segment sequence.
     */
    const [profile] = await rows(sql`SELECT sections FROM person_profiles WHERE person_id = ${mariamPerson}`);
    const sections = (profile?.sections ?? []) as { heading: string; body: string; refs: string[] }[];
    const ordered = await rows(sql`
      SELECT s.id FROM sessions s JOIN patients c ON c.id = s.patient_id
       WHERE c.person_id = ${mariamPerson} ORDER BY s.created_at ASC`);
    let resolved = 0;
    let refs = 0;
    for (const section of sections) {
      for (const ref of section.refs) {
        refs += 1;
        const m = /^S(\d+):(\d+)$/.exec(ref);
        const session = m ? ordered[Number(m[1]) - 1] : undefined;
        if (!m || !session) continue;
        const found = await num(sql`
          SELECT count(*)::int AS n FROM transcript_segments
           WHERE session_id = ${String(session.id)} AND sequence = ${Number(m[2])}`);
        if (found === 1 && section.body.includes(`[${ref}]`)) resolved += 1;
      }
    }
    check(
      "her standing profile exists and every reference names a real transcript line",
      sections.length >= 3 && refs >= 5 && resolved === refs,
      `${String(sections.length)} sections, ${String(resolved)} of ${String(refs)} references resolve`,
    );

    /* ------------------------------------------------ Dr Karim, and every clinician -- */

    const [karim] = await rows(sql`
      SELECT u.verification_status AS status, v.license_number AS licence, v.country, r.languages, r.specialties
        FROM users u JOIN therapist_verifications v ON v.user_id = u.id
        JOIN therapist_radar r ON r.user_id = u.id
       WHERE u.email = ${EVENT.karim}`);
    const languages = (karim?.languages ?? []) as string[];
    const specialties = (karim?.specialties ?? []) as string[];
    check(
      `Dr Karim: verified, Egypt, licence ${EVENT.karimLicence}, Arabic and English, anxiety, burnout and sleep`,
      karim?.status === "verified" &&
        karim?.licence === EVENT.karimLicence &&
        karim?.country === "EG" &&
        languages.includes("Arabic") &&
        languages.includes("English") &&
        ["Anxiety", "Work stress & burnout", "Sleep"].every((s) => specialties.includes(s)),
      `${String(karim?.status)}, ${String(karim?.licence)}`,
    );

    const earned = await num(sql`
      SELECT count(*)::int AS n FROM ledger_entries WHERE user_id = ${karimId} AND created_at < now() - interval '1 day'`);
    check("Dr Karim: an earnings history from the sessions above, dated when they happened", earned >= 4, `${String(earned)} ledger legs`);

    const clinicians = EVENT_LOGINS.filter((l) => l.table === "users").map((l) => l.email);
    /*
     * 🔴 THE DIRECTORY'S OWN RULE, `listable()` in `lib/data/discover.ts`: a radar
     * row, an approved verification, an active therapist, not suspended. The home
     * rail, search, categories and the profile page all read through it.
     */
    for (const email of clinicians) {
      const [row] = await rows(sql`
        SELECT count(*)::int AS listed,
               (SELECT count(*)::int FROM availability_slots a
                 WHERE a.therapist_user_id = u.id AND a.status = 'open' AND a.starts_at > now()) AS open,
               (SELECT count(*)::int FROM sessions s WHERE s.therapist_id = u.id AND s.status = 'completed') AS held,
               (SELECT count(*)::int FROM session_feedback f WHERE f.therapist_id = u.id AND f.therapist_stars IS NOT NULL) AS rated
          FROM therapist_radar r
          JOIN users u ON u.id = r.user_id
          JOIN therapist_verifications v ON v.user_id = u.id
         WHERE u.email = ${email} AND u.deleted_at IS NULL AND u.status = 'active' AND u.role = 'therapist'
           AND v.state = 'approved' AND (r.suspended_until IS NULL OR r.suspended_until < now())
         GROUP BY u.id`);
      check(
        `${email}: visible to patients, with open hours ahead and past sessions`,
        Number(row?.listed ?? 0) === 1 && Number(row?.open ?? 0) >= 20 && Number(row?.held ?? 0) >= 2,
        row ? `${String(row.open)} open hours, ${String(row.held)} sessions, ${String(row.rated)} ratings` : "not listable",
      );
    }
    const hidden = await num(sql`
      SELECT count(*)::int AS n FROM users u
       WHERE u.role = 'therapist' AND u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM therapist_radar r WHERE r.user_id = u.id)`);
    check("no clinician on this database is missing from the directory", hidden === 0, `${String(hidden)} without a radar row`);

    const cities = await num(sql`
      SELECT count(DISTINCT city)::int AS n FROM therapist_radar WHERE city IN ('Cairo','Alexandria','Giza','Mansoura')`);
    check("clinicians in Cairo, Alexandria, Giza and Mansoura", cities === 4, `${String(cities)} cities`);

    /* ---------------------------------------- the other stories in the cast -- */

    const selfPaid = await num(sql`
      SELECT count(*)::int AS n FROM manual_payments
       WHERE purpose = 'session' AND state = 'confirmed' AND reference LIKE 'INSTAPAY-%'`);
    check("sessions paid by InstaPay transfer and confirmed by the operator", selfPaid >= 5, `${String(selfPaid)}`);

    const [moved] = await rows(sql`
      SELECT count(*)::int AS n, count(DISTINCT approved_by_user_id)::int AS clinicians,
             count(DISTINCT organization_id)::int AS orgs,
             (SELECT count(*)::int FROM history_grants g
               WHERE g.person_id = p.id AND g.status = 'granted' AND g.revoked_at IS NULL) AS grants
        FROM people p JOIN clinical_summaries c ON c.person_id = p.id
       WHERE p.email = ${EVENT.moved} GROUP BY p.id`);
    check(
      "Sherif's record moved: two summaries, two clinicians, two practices, and a grant to the new one",
      Number(moved?.n) === 2 && Number(moved?.clinicians) === 2 && Number(moved?.orgs) === 2 && Number(moved?.grants) === 1,
      moved ? `${String(moved.n)} summaries, ${String(moved.grants)} grant` : "no record",
    );

    const [unclaimed] = await rows(sql`
      SELECT p.claimed_at, (SELECT count(*)::int FROM patient_accounts a WHERE a.person_id = p.id) AS accounts,
             (SELECT count(*)::int FROM patients c WHERE c.person_id = p.id AND c.source = 'therapist'
                 AND c.therapist_id IS NOT NULL) AS charts
        FROM people p WHERE p.email = ${EVENT.unclaimed}`);
    check(
      "Hoda's record was written by a clinician and nobody has claimed it",
      !!unclaimed && unclaimed.claimed_at === null && Number(unclaimed.accounts) === 0 && Number(unclaimed.charts) === 1,
    );

    const [clinic] = await rows(sql`
      SELECT (SELECT count(*)::int FROM clinic_seats s WHERE s.organization_id = o.id AND s.released_at IS NULL) AS seats,
             (SELECT count(*)::int FROM sessions s WHERE s.organization_id = o.id AND s.status = 'scheduled'
                 AND s.scheduled_at BETWEEN now() AND now() + interval '7 days') AS week,
             (SELECT count(*)::int FROM invoices i WHERE i.organization_id = o.id) AS bills
        FROM organizations o WHERE o.slug = ${EVENT.clinicSlug}`);
    check(
      "Nile Practice: three clinicians on seats, bookings this week, and bills",
      Number(clinic?.seats) === 3 && Number(clinic?.week) >= 3 && Number(clinic?.bills) >= 1,
      clinic ? `${String(clinic.seats)} seats, ${String(clinic.week)} this week, ${String(clinic.bills)} bills` : "no clinic",
    );

    const keys = await num(sql`
      SELECT count(*)::int AS n FROM partner_api_keys k JOIN partners p ON p.id = k.partner_id
       WHERE p.slug = ${EVENT.partnerSlug} AND k.environment = 'sandbox' AND k.revoked_at IS NULL`);
    check("Helio Health has a sandbox key", keys >= 1, `${String(keys)}`);

    /* ------------------------------------------------------ what must hold -- */

    const stray = await num(sql`
      SELECT count(*)::int AS n FROM (
        SELECT email FROM users WHERE email NOT IN ('omarabdelgawad001@gmail.com')
        UNION ALL SELECT email FROM patient_accounts
        UNION ALL SELECT email FROM sponsor_users
        UNION ALL SELECT email FROM clinic_managers
        UNION ALL SELECT email FROM partner_users
        UNION ALL SELECT email FROM people
      ) a WHERE a.email IS NOT NULL AND a.email NOT LIKE '%@example.com'`);
    check("every invented address is at example.com; only the founder's console login is not", stray === 0, `${String(stray)} elsewhere`);

    const enabled = await num(sql`
      SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'clinical_summaries_no_rewrite' AND tgenabled <> 'D'`);
    check("the append-only rule on clinical summaries is enabled", enabled === 1);

    for (const table of ["content_pages", "platform_settings", "country_settings"]) {
      const got = await num(sql.raw(`SELECT count(*)::int AS n FROM ${table}`));
      check(`kept: ${table}`, got >= 1, `${String(got)} rows`);
    }

    finish("verify:event-demo");
  } finally {
    await pool.end();
  }
}

void main();
