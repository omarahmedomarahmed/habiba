/**
 * Wave 2, the company portal: every dead end gets a way forward. `takeover/FIX-PLAN.md`.
 *
 *   npm run verify:w2s
 *
 * One section per W2-S item that needs the database. Every check was written
 * first and seen to FAIL on the code it describes, then the fix made it pass.
 * Fixtures are planted and removed in a `finally` (H29), and `writesTo()`
 * refuses production by name.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { connect } from "./db";
import { setRulesForThisCheck, TWO_PEOPLE_EVERYWHERE } from "./_rules";

const { check, finish } = reporter();

const fixture = `w2s-${Date.now().toString(36)}`;

type Db = ReturnType<typeof connect>["db"];

/** Plant an active company with one admin user. Removed by `dropSponsor`. */
async function plantSponsor(db: Db, label: string): Promise<string> {
  const [sp] = (
    await db.execute(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${`W2S ${label} ${fixture}`}, 'company', 'us', 'USD', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const sponsorId = required(sp, "a sponsor").id;
  await db.execute(sql`
    INSERT INTO sponsor_users (sponsor_id, email, role)
    VALUES (${sponsorId}, ${`hr-${label}-${fixture}@example.com`}, 'admin')`);
  return sponsorId;
}

async function dropSponsor(db: Db, sponsorId: string) {
  await db.execute(sql`DELETE FROM audit_log WHERE resource_id IN
    (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsorId})`);
  await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_codes WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_users WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
  await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
  await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
  await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsorId}`);
}

const YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * A practice, a clinician, and a company with a funded pot, for the items that
 * need real sessions paid from a pot. `cast` makes one enrolled employee with
 * one pending session; `drop` removes everything, in dependency order.
 */
async function plantWorld(db: Db, label: string) {
  const tag = `${fixture}-${label}`;
  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> =>
    required((await db.execute(text)).rows[0] as T | undefined, "a planted row");

  const org = await one<{ id: string }>(sql`
    INSERT INTO organizations (name, region, slug)
    VALUES ('W2S Demo Practice', 'eg', ${tag}) RETURNING id`);
  const therapist = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
    VALUES (${org.id}, ${`hala.${tag}@example.com`}, 'Hala', 'Demo', 'therapist', 'x')
    RETURNING id`);
  const sponsorId = await plantSponsor(db, label);

  const { openPot } = await import("../lib/data/sponsor-admin");
  await openPot({
    sponsorId,
    refundPolicy: "Unused balance is refunded within 30 days of written notice.",
    expiresAt: new Date(Date.now() + YEAR),
    overdraftCents: 0,
    welcomeCreditCents: 0,
  });
  await db.execute(sql`
    UPDATE sponsor_pots SET balance_cents = 100000, coverage_bps = 6000
     WHERE sponsor_id = ${sponsorId}`);

  let n = 0;
  const cast = async (first: string, priceCents = 2000) => {
    n += 1;
    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email, region)
      VALUES (${first}, 'Demo', ${`${first.toLowerCase()}${n}.${tag}@example.com`}, 'eg') RETURNING id`);
    const patient = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, person_id, first_name, last_name, email, source)
      VALUES (${org.id}, ${person.id}, ${first}, 'Demo', ${`${first.toLowerCase()}${n}.${tag}@example.com`}, 'self')
      RETURNING id`);
    const enrolment = await one<{ id: string }>(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash,
                              identifier_kind, last_verified_at)
      VALUES (${sponsorId}, ${person.id}, 'active', true, ${`${first}${n}-${tag}`},
              'domain_email', now())
      RETURNING id`);
    const session = await book(patient.id, priceCents);
    return { personId: person.id, patientId: patient.id, enrolmentId: enrolment.id, sessionId: session };
  };

  const book = async (patientId: string, priceCents = 2000) => {
    n += 1;
    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at)
      VALUES (${org.id}, ${therapist.id}, ${patientId}, 'scheduled', 'video',
              ${`join-${n}-${tag}`}, ${`fb-${n}-${tag}`}, ${priceCents}, 'pending',
              now() + interval '2 hours')
      RETURNING id`);
    return session.id;
  };

  const drop = async () => {
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM session_payments WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM patient_notifications WHERE person_id IN
      (SELECT person_id FROM patients WHERE organization_id = ${org.id})`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM audit_log WHERE resource_id IN
      (SELECT id FROM enrolments WHERE sponsor_id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsorId}`);
    const people = (
      await db.execute(sql`SELECT person_id FROM patients WHERE organization_id = ${org.id}`)
    ).rows as { person_id: string }[];
    await db.execute(sql`DELETE FROM patients WHERE organization_id = ${org.id}`);
    for (const row of people) {
      await db.execute(sql`DELETE FROM people WHERE id = ${row.person_id}`);
    }
    await dropSponsor(db, sponsorId);
    await db.execute(sql`DELETE FROM users WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);
  };

  return { sponsorId, orgId: org.id, therapistId: therapist.id, cast, book, drop };
}

/* ================================================================== */
/*  W2-S02 · the balance is republished on every top-up                */
/* ================================================================== */

async function balanceAfterTopUp(db: Db) {
  const sponsorId = await plantSponsor(db, "topup");
  try {
    const { openPot } = await import("../lib/data/sponsor-admin");
    const { potBalance } = await import("../lib/data/sponsors");

    await openPot({
      sponsorId,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + YEAR),
      overdraftCents: 0,
      welcomeCreditCents: 10_000,
    });

    const opened = await potBalance(sponsorId);
    check(
      "W2-S02 a pot opened with a credit shows that credit, before any session",
      opened.balanceCents === 10_000,
      `published ${String(opened.balanceCents)}`,
    );

    /*
     * The differencing half: sessions have been spent since the last
     * publication (the live balance is lower than the published one), and a
     * top-up must move the published figure by the top-up alone.
     */
    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 7000, published_balance_cents = 10000
       WHERE sponsor_id = ${sponsorId}`);

    const pot = (await import("../lib/billing/pot")) as Record<string, unknown>;
    const publishTopUp = pot.publishTopUp as
      | ((sponsorId: string, creditCents: number) => Promise<void>)
      | undefined;
    if (!publishTopUp) {
      check("W2-S02 a top-up moves the published balance by the top-up and nothing else", false, "no publishTopUp");
    } else {
      await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 12000 WHERE sponsor_id = ${sponsorId}`);
      await publishTopUp(sponsorId, 5_000);
      const after = await potBalance(sponsorId);
      check(
        "W2-S02 a top-up moves the published balance by the top-up and nothing else",
        after.balanceCents === 15_000,
        `published ${String(after.balanceCents)}, live 12000: the hidden spend stays hidden`,
      );

      /*
       * 🔴 C21: a pot that has never published, with a return sent out of it,
       * then a top-up. The first figure is every credit LESS the return; a spend
       * on the pot still does not enter it (that would be the differencing leak).
       * Legs planted balanced, as `journal` would write them.
       */
      const leg = (kind: string, account: string, cents: number, txn: string) => sql`
        INSERT INTO ledger_entries (txn_id, txn_kind, account, amount_cents, ref_type, ref_id, memo, entity)
        VALUES (${txn}::uuid, ${kind}, ${account}, ${cents}, 'sponsor', ${sponsorId}, ${`C21 ${fixture}`}, 'us')`;
      const pair = async (kind: string, potCents: number) => {
        const txn = crypto.randomUUID();
        await db.execute(leg(kind, "sponsor_pot", potCents, txn));
        await db.execute(leg(kind, "cash", -potCents, txn));
      };
      await db.execute(sql`UPDATE sponsor_pots SET published_balance_cents = NULL WHERE sponsor_id = ${sponsorId}`);
      await pair("pot_return", 3_000);
      await pair("session_payment", 2_000);
      await pair("pot_topup", -5_000);
      await publishTopUp(sponsorId, 5_000);
      const first = await db.execute(sql`SELECT published_balance_cents AS p FROM sponsor_pots WHERE sponsor_id = ${sponsorId}`);
      const published = Number((first.rows[0] as { p: number | null } | undefined)?.p);
      check(
        "🔴 C21 the first published balance after a return is every credit less what was sent back",
        published === 10_000 + 5_000 - 3_000,
        `published ${published}; credits 15000, returned 3000`,
      );
      check(
        "C21 CONTROL …and a session spent from the pot is still not in it, so nothing can be differenced",
        published !== 10_000 + 5_000 - 3_000 - 2_000,
        `published ${published}`,
      );
    }

    const grants = readSource("lib/billing/manual-grants.ts");
    const card = readSource("lib/billing/pot.ts");
    check(
      "W2-S02 both top-up rails publish what they credit",
      /publishTopUp\(payment\.sponsorId, net\)/.test(grants) &&
        /publishTopUp\(input\.sponsorId, net\)/.test(card),
      "grantPotTopUp and topUpPot",
    );
  } finally {
    await dropSponsor(db, sponsorId);
  }
}

/* ================================================================== */
/*  W2-S03 · the company can make its first joining code               */
/* ================================================================== */

async function firstCode(db: Db) {
  const sponsorId = await plantSponsor(db, "code");
  try {
    const admin = (await import("../lib/data/sponsor-admin")) as Record<string, unknown>;
    const mintFirstCode = admin.mintFirstCode as
      | ((sponsorId: string) => Promise<{ code?: string; error?: string }>)
      | undefined;
    if (!mintFirstCode) {
      check("W2-S03 a company with no code can mint its first one", false, "no mintFirstCode");
      return;
    }

    const first = await mintFirstCode(sponsorId);
    const { liveCode } = await import("../lib/data/sponsors");
    check(
      "W2-S03 a company with no code can mint its first one",
      Boolean(first.code) && (await liveCode(sponsorId)) === first.code,
      first.error ?? "live",
    );

    const second = await mintFirstCode(sponsorId);
    check(
      "W2-S03 …and it cannot replace a live one, so no poster is stranded by it",
      Boolean(second.error) && (await liveCode(sponsorId)) === first.code,
      second.error ?? "it minted a second code",
    );
  } finally {
    await dropSponsor(db, sponsorId);
  }
}

/* ================================================================== */
/*  W2-S09 · an enquiry is followed through                            */
/* ================================================================== */

async function enquiry(db: Db) {
  const email = `enquiry-${fixture}@example.com`;
  const started = new Date();
  try {
    const { applyToSponsor } = await import("../lib/data/sponsor-admin");
    const apply = applyToSponsor as unknown as (input: Record<string, unknown>) => Promise<{
      ok?: true;
      error?: string;
    }>;
    const input = {
      name: `W2S Textiles ${fixture}`,
      kind: "company",
      contactName: "Salma Example",
      contactEmail: email,
      contactPhone: "+20 100 000 0000",
      contactBestTime: "mornings",
      country: "EG",
      acknowledgement: { subject: "We have your enquiry", body: "We will call Salma." },
    };

    const first = await apply(input);
    const second = await apply({ ...input, contactEmail: email.toUpperCase() });

    const rows = (
      await db.execute(sql`
        SELECT entity, currency FROM sponsors WHERE lower(contact_email) = ${email}`)
    ).rows as { entity: string; currency: string }[];

    check(
      "W2-S09 an Egyptian company's enquiry lands on the Egyptian entity",
      Boolean(first.ok) && rows[0]?.entity === "eg" && rows[0]?.currency === "egp",
      JSON.stringify(rows[0] ?? first),
    );
    check(
      "W2-S09 the same enquiry twice makes one held account, not two",
      Boolean(second.ok) && rows.length === 1,
      `${rows.length} rows`,
    );

    const told = (
      await db.execute(sql`
        SELECT kind, count(*)::int AS n FROM delivery_attempts
         WHERE kind IN ('sponsor.enquiry', 'sponsor.enquiry_received')
           AND created_at >= ${started}
         GROUP BY kind`)
    ).rows as { kind: string; n: number }[];
    const n = (kind: string) => told.find((row) => row.kind === kind)?.n ?? 0;

    check(
      "W2-S09 the applicant is told we have it, each time they ask",
      n("sponsor.enquiry_received") === 2,
      `${n("sponsor.enquiry_received")} acknowledgements`,
    );

    const staff = (
      await db.execute(sql`
        SELECT count(*)::int AS n FROM users
         WHERE role IN ('staff', 'manager', 'super_admin') AND deleted_at IS NULL`)
    ).rows as { n: number }[];
    check(
      "W2-S09 our staff are told about a new enquiry, once, not about the repeat",
      (staff[0]?.n ?? 0) === 0 ? true : n("sponsor.enquiry") === Math.min(10, staff[0]!.n),
      `${n("sponsor.enquiry")} staff alerts for ${staff[0]?.n ?? 0} back-office users`,
    );
  } finally {
    await db.execute(sql`DELETE FROM delivery_attempts
      WHERE kind IN ('sponsor.enquiry', 'sponsor.enquiry_received') AND created_at >= ${started}`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE lower(contact_email) = ${email})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE lower(contact_email) = ${email})`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE lower(contact_email) = ${email})`);
    await db.execute(sql`DELETE FROM sponsors WHERE lower(contact_email) = ${email}`);
  }
}

/* ================================================================== */
/*  W2-S08 · a pot expires on its date, and is warned before it does   */
/* ================================================================== */

async function potExpiry(db: Db) {
  const started = new Date();
  const world = await plantWorld(db, "expiry");
  try {
    const { payFromPot } = await import("../lib/billing/pot");
    const balance = async () =>
      Number(
        (
          (
            await db.execute(sql`
              SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${world.sponsorId}`)
          ).rows[0] as { balance_cents: number }
        ).balance_cents,
      );

    /* The control first: a pot inside its date pays. */
    const live = await world.cast("Nour");
    const paid = await payFromPot(live.sessionId);
    check("W2-S08 CONTROL a pot inside its date pays", paid.paid, JSON.stringify(paid));

    await db.execute(sql`
      UPDATE sponsor_pots SET expires_at = now() - interval '1 day'
       WHERE sponsor_id = ${world.sponsorId}`);
    const before = await balance();
    const late = await world.book(live.patientId);
    const refused = await payFromPot(late);
    check(
      "W2-S08 an expired pot pays for nothing, and says why",
      !refused.paid && refused.reason === ("expired" as string) && (await balance()) === before,
      JSON.stringify(refused),
    );

    /* The warning: once, before the date, however many days the job runs. */
    const alerts = (await import("../lib/billing/pot-alerts")) as {
      alertPots: () => Promise<{ alerted: number }>;
    };
    await db.execute(sql`
      UPDATE sponsor_pots SET expires_at = now() + interval '10 days'
       WHERE sponsor_id = ${world.sponsorId}`);
    await alerts.alertPots();
    await alerts.alertPots();
    const warned = Number(
      (
        (
          await db.execute(sql`
            SELECT count(*)::int AS n FROM audit_log
             WHERE action = 'sponsor.pot_alert.expiring'
               AND resource_id = (SELECT id FROM sponsor_pots WHERE sponsor_id = ${world.sponsorId})`)
        ).rows[0] as { n: number }
      ).n,
    );
    check(
      "W2-S08 a pot expiring within 30 days is warned once, before it expires",
      warned === 1,
      `${warned} warnings over two runs`,
    );
  } finally {
    await db.execute(sql`DELETE FROM delivery_attempts
      WHERE kind LIKE 'sponsor.pot_%' AND created_at >= ${started}`);
    await world.drop();
  }
}

/* ================================================================== */
/*  W2-S05 · a company runs its own logins                             */
/* ================================================================== */

async function companyLogins(db: Db) {
  const started = new Date();
  const sponsorId = await plantSponsor(db, "team");
  try {
    const mod = (await import("../lib/data/sponsor-users").catch(() => null)) as
      | typeof import("../lib/data/sponsor-users")
      | null;
    if (!mod) {
      check("W2-S05 a company can invite, reset, change and remove its own logins", false, "no lib/data/sponsor-users");
      return;
    }
    const { checkSponsorPassword } = await import("../lib/data/sponsor-admin");
    const { passwordLinkToken } = await import("../lib/sponsor/password-link");
    /* What the emailed link carries: signed over the login's hash as it stands. */
    const mint = async (sponsorUserId: string, purpose: "reset" | "invite", expiresMs?: number) => {
      const [row] = (
        await db.execute(sql`SELECT password_hash FROM sponsor_users WHERE id = ${sponsorUserId}`)
      ).rows as { password_hash: string | null }[];
      return passwordLinkToken({
        sponsorUserId,
        purpose,
        passwordHash: row?.password_hash ?? null,
        expiresMs,
      });
    };
    const [admin] = (
      await db.execute(sql`SELECT id FROM sponsor_users WHERE sponsor_id = ${sponsorId}`)
    ).rows as { id: string }[];
    const adminId = required(admin, "the planted admin").id;
    await db.execute(sql`
      UPDATE sponsor_users SET password_hash = 'x' WHERE id = ${adminId}`);

    /* Invite: a login with no password, and a link that sets one, once. */
    const email = `new-${fixture}@example.com`;
    const invited = await mod.inviteSponsorUser({
      sponsorId,
      email,
      role: "viewer",
      message: { subject: "Invited", body: "Set your password." },
    });
    const token = invited.ok ? await mint(invited.sponsorUserId!, "invite") : null;
    const set = token ? await mod.setSponsorPassword(token, "a long enough password") : { error: "no token" };
    const signedIn = await checkSponsorPassword(email, "a long enough password");
    check(
      "W2-S05 an invited person sets their own password from the link and signs in",
      Boolean(invited.ok && set.ok && signedIn.sponsorUserId),
      JSON.stringify({ invited, set, signedIn: Boolean(signedIn.sponsorUserId) }),
    );
    const reused: { error?: string } = token
      ? await mod.setSponsorPassword(token, "another long password")
      : {};
    check("W2-S05 …and the link works once", Boolean(reused.error), reused.error ?? "it worked twice");

    /* Forgot: an unknown address sends nothing and says the same thing. */
    const unknown = await mod.requestSponsorReset(`nobody-${fixture}@example.com`, {
      subject: "Reset",
      body: "Link",
    });
    const known = await mod.requestSponsorReset(email, { subject: "Reset", body: "Link" });
    const resets = Number(
      (
        (
          await db.execute(sql`
            SELECT count(*)::int AS n FROM delivery_attempts
             WHERE kind = 'sponsor.password_reset' AND created_at >= ${started}`)
        ).rows[0] as { n: number }
      ).n,
    );
    check(
      "W2-S05 forgot password emails a link to a real login only, and answers the same either way",
      Boolean(unknown.ok && known.ok) && resets === 1,
      `${resets} reset emails`,
    );
    const resetToken = await mint(invited.sponsorUserId!, "reset");
    const reset = await mod.setSponsorPassword(resetToken, "a brand new password");
    check(
      "W2-S05 the reset link sets a new password, and the old one stops working",
      Boolean(reset.ok) &&
        Boolean((await checkSponsorPassword(email, "a brand new password")).sponsorUserId) &&
        !(await checkSponsorPassword(email, "a long enough password")).sponsorUserId,
      JSON.stringify(reset),
    );
    const stale = await mint(invited.sponsorUserId!, "reset", Date.now() - 1000);
    check(
      "W2-S05 CONTROL an expired link sets nothing",
      Boolean((await mod.setSponsorPassword(stale, "yet another password")).error),
    );

    /* Change: the current password is asked for. */
    const wrong = await mod.changeSponsorPassword(invited.sponsorUserId!, "not it at all", "a fourth password here");
    const right = await mod.changeSponsorPassword(invited.sponsorUserId!, "a brand new password", "a fourth password here");
    check(
      "W2-S05 changing a password needs the current one",
      Boolean(wrong.error) && Boolean(right.ok),
      JSON.stringify({ wrong, right }),
    );

    /* Roles and removal, and the account is never left without an admin. */
    const lastAdmin = await mod.setSponsorUserRole({ sponsorId, sponsorUserId: adminId, role: "viewer" });
    const promote = await mod.setSponsorUserRole({
      sponsorId,
      sponsorUserId: invited.sponsorUserId!,
      role: "admin",
    });
    check(
      "W2-S05 roles change, but the last admin cannot be made a viewer",
      Boolean(lastAdmin.error) && Boolean(promote.ok),
      JSON.stringify({ lastAdmin, promote }),
    );

    const self = await mod.removeSponsorUser({ sponsorId, sponsorUserId: adminId, bySponsorUserId: adminId });
    const other = await mod.removeSponsorUser({
      sponsorId,
      sponsorUserId: invited.sponsorUserId!,
      bySponsorUserId: adminId,
    });
    check(
      "W2-S05 an admin removes somebody else, never themselves, and the removed login is dead",
      Boolean(self.error) &&
        Boolean(other.ok) &&
        !(await checkSponsorPassword(email, "a fourth password here")).sponsorUserId,
      JSON.stringify({ self, other }),
    );

    const elsewhere = await plantSponsor(db, "team-other");
    try {
      const borrowed = await mod.removeSponsorUser({
        sponsorId: elsewhere,
        sponsorUserId: adminId,
        bySponsorUserId: adminId,
      });
      check("W2-S05 CONTROL another company's login cannot be touched", Boolean(borrowed.error));
    } finally {
      await dropSponsor(db, elsewhere);
    }
  } finally {
    await db.execute(sql`DELETE FROM delivery_attempts
      WHERE kind IN ('sponsor.password_reset', 'sponsor.invite') AND created_at >= ${started}`);
    await db.execute(sql`DELETE FROM sponsor_auth_sessions WHERE sponsor_user_id IN
      (SELECT id FROM sponsor_users WHERE sponsor_id = ${sponsorId})`);
    await dropSponsor(db, sponsorId);
  }
}

/* ================================================================== */
/*  W2-S11 · the company pauses and resumes a benefit, and says so     */
/* ================================================================== */

async function pauseResume(db: Db) {
  const world = await plantWorld(db, "pause");
  try {
    const sponsorsModule = (await import("../lib/data/sponsors")) as Record<string, unknown>;
    type Act = (input: { sponsorId: string; enrolmentId: string }) => Promise<{ ok?: true; error?: string }>;
    const pauseBenefit = sponsorsModule.pauseBenefit as Act | undefined;
    const resumeBenefit = sponsorsModule.resumeBenefit as Act | undefined;
    if (!pauseBenefit || !resumeBenefit) {
      check("W2-S11 a company can pause and resume one person's benefit", false, "no pauseBenefit / resumeBenefit");
      return;
    }
    const { payFromPot } = await import("../lib/billing/pot");
    const { roster } = await import("../lib/data/sponsors");

    const nour = await world.cast("Nour");
    const paused = await pauseBenefit({ sponsorId: world.sponsorId, enrolmentId: nour.enrolmentId });
    const refused = await payFromPot(nour.sessionId);
    const listed = (await roster(world.sponsorId)).find((row) => row.enrolmentId === nour.enrolmentId) as
      | (Record<string, unknown> & { enrolmentId: string })
      | undefined;
    check(
      "W2-S11 a paused benefit pays for nothing, and the company sees its own pause on the list",
      Boolean(paused.ok) && !refused.paid && listed?.heldByYou === true,
      JSON.stringify({ paused, refused, held: listed?.heldByYou }),
    );

    const notices = async () =>
      (
        await db.execute(sql`
          SELECT kind, message_key FROM patient_notifications
           WHERE person_id = ${nour.personId} ORDER BY created_at`)
      ).rows as { kind: string; message_key: string }[];
    const afterPause = await notices();
    check(
      "W2-S11 the employee is told in the app, and the notice names no employer",
      afterPause.some((row) => row.kind === "benefit_paused" && row.message_key === "benefit.paused"),
      JSON.stringify(afterPause),
    );

    const resumed = await resumeBenefit({ sponsorId: world.sponsorId, enrolmentId: nour.enrolmentId });
    const later = await world.book(nour.patientId);
    const paid = await payFromPot(later);
    const afterResume = await notices();
    check(
      "W2-S11 resuming pays again, and they are told",
      Boolean(resumed.ok) &&
        paid.paid &&
        afterResume.some((row) => row.message_key === "pnotice.benefitResumed"),
      JSON.stringify({ resumed, paid: paid.paid, notices: afterResume.length }),
    );

    /*
     * A re-verification pause is not the company's to see or to lift. Planted
     * under the company's own pause: resuming lifts the company's and leaves
     * the person's, which still stops the funding.
     */
    await pauseBenefit({ sponsorId: world.sponsorId, enrolmentId: nour.enrolmentId });
    await db.execute(sql`UPDATE enrolments SET paused_at = now() WHERE id = ${nour.enrolmentId}`);
    const lifted = await resumeBenefit({ sponsorId: world.sponsorId, enrolmentId: nour.enrolmentId });
    const verifying = (await roster(world.sponsorId)).find(
      (row) => row.enrolmentId === nour.enrolmentId,
    ) as (Record<string, unknown> & { enrolmentId: string }) | undefined;
    const stillRefused = await payFromPot(await world.book(nour.patientId));
    check(
      "W2-S11 CONTROL resuming lifts only the company's pause: a re-verification pause stays, unseen",
      Boolean(lifted.ok) && verifying?.heldByYou === false && !stillRefused.paid,
      JSON.stringify({ lifted, held: verifying?.heldByYou, paid: stillRefused.paid }),
    );

    const other = await plantSponsor(db, "pause-other");
    try {
      const borrowed = await pauseBenefit({ sponsorId: other, enrolmentId: nour.enrolmentId });
      check("W2-S11 CONTROL another company cannot pause this person", Boolean(borrowed.error));
    } finally {
      await dropSponsor(db, other);
    }
  } finally {
    await world.drop();
  }
}

/* ================================================================== */
/*  W2-S10 · the company's money ledger (needs migration 0134)         */
/* ================================================================== */

async function moneyLedger(db: Db) {
  /* A FAIL, never a skip: this item is not done until 0134 is applied. */
  const table = (
    await db.execute(sql`SELECT to_regclass('sponsor_money_entries') IS NOT NULL AS present`)
  ).rows[0] as { present: boolean };
  if (!table.present) {
    check("W2-S10 the company's money ledger exists", false, "migration 0134 is not applied here");
    return;
  }

  const world = await plantWorld(db, "ledger");
  try {
    const { payFromPot } = await import("../lib/billing/pot");
    const { tellEnrolledAboutLedger } = await import("../lib/data/enrolment-verify");
    const { publishedLedger } = await import("../lib/data/sponsor-ledger");
    const entries = async () =>
      (
        await db.execute(sql`
          SELECT kind, week_start::text AS week_start, price_cents, coverage_bps,
                 covered_cents, employee_cents
            FROM sponsor_money_entries WHERE sponsor_id = ${world.sponsorId}`)
      ).rows as {
        kind: string;
        week_start: string;
        price_cents: number;
        coverage_bps: number;
        covered_cents: number;
        employee_cents: number;
      }[];

    /* Before they are told: their session is paid, and enters no ledger. */
    const nour = await world.cast("Nour", 2500);
    await payFromPot(nour.sessionId);
    check(
      "W2-S10 a session paid before the employee was told enters no ledger",
      (await entries()).length === 0,
      `${(await entries()).length} entries`,
    );

    /* Told, in the app, and only then. */
    await tellEnrolledAboutLedger();
    const notice = (
      await db.execute(sql`
        SELECT count(*)::int AS n FROM patient_notifications
         WHERE person_id = ${nour.personId} AND kind = 'benefit_terms'
           AND message_key = 'pnotice.ledgerTold'`)
    ).rows[0] as { n: number };
    const toldAt = (
      await db.execute(sql`SELECT ledger_told_at FROM enrolments WHERE id = ${nour.enrolmentId}`)
    ).rows[0] as { ledger_told_at: Date | null };
    await tellEnrolledAboutLedger();
    const again = (
      await db.execute(sql`
        SELECT count(*)::int AS n FROM patient_notifications
         WHERE person_id = ${nour.personId} AND kind = 'benefit_terms'`)
    ).rows[0] as { n: number };
    check(
      "W2-S10 each enrolled person is told in the app, once, before the ledger applies to them",
      notice.n === 1 && toldAt.ledger_told_at !== null && again.n === 1,
      JSON.stringify({ notice: notice.n, toldAt: toldAt.ledger_told_at, again: again.n }),
    );

    const later = await world.book(nour.patientId, 2500);
    await payFromPot(later);
    const [row] = await entries();
    const { weekStartOf } = await import("../lib/sponsor/ledger");
    check(
      "W2-S10 a session paid after they were told is one money entry: price, cover, both shares, the week",
      row?.kind === "session" &&
        row.price_cents === 2500 &&
        row.coverage_bps === 6000 &&
        row.covered_cents === 1500 &&
        row.employee_cents === 1000 &&
        row.week_start === weekStartOf(new Date()),
      JSON.stringify(row),
    );

    /* Published in batches: this week's entry is not out until the week ends. */
    const weekly = await publishedLedger(world.sponsorId);
    const nextWeek = await publishedLedger(world.sponsorId, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    /*
     * And never alone (a8c551ea): one entry in a week is one person at a small
     * company, so the ended week stays held until its batch clears the floor.
     * The floor's worth is planted in the same week to see it come out.
     */
    check(
      "W2-S10 by default this week's entries are published the Monday after, and a lone entry not even then",
      weekly.publishing === "weekly" && weekly.entries.length === 0 && nextWeek.entries.length === 0,
      `${weekly.entries.length} now, ${nextWeek.entries.length} after the week ends`,
    );
    const { getSettings } = await import("../lib/settings");
    const floor = (await getSettings()).sponsor.activityFloor;
    for (let i = 1; i < floor; i++) {
      await db.execute(sql`
        INSERT INTO sponsor_money_entries
          (sponsor_id, kind, week_start, price_cents, coverage_bps, covered_cents, employee_cents, shuffle)
        VALUES (${world.sponsorId}, 'session', ${row?.week_start ?? weekStartOf(new Date())}, 2500, 6000, 1500, 1000, ${i})`);
    }
    const cleared = await publishedLedger(world.sponsorId, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    check(
      "W2-S10 …and the week comes out whole once it holds the reporting floor's worth",
      cleared.entries.length === floor,
      `${cleared.entries.length} of ${floor}`,
    );
  } finally {
    await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${world.sponsorId}`).catch(
      () => undefined,
    );
    await world.drop();
  }
}

/* ================================================================== */
/*  W2-S12 · a refund of a split session returns each party its own    */
/* ================================================================== */

/*
 * A partly covered session has ONE payment row with a frozen split, and two
 * payers: the pot paid `sponsor_share_cents` at booking, the employee pays
 * `patient_share_cents` later (by card, or by transfer on the manual rail).
 * A refund must give each of them what they paid and nothing else, balance the
 * journal, and call the payment refunded only when both halves are done (W1-12).
 *
 * Three cases on one company: covered in full, covered half with the employee's
 * share unpaid, covered half with the share paid by transfer. For each, every
 * ledger account this money touched is back where it started once the refund is
 * done, and every transaction sums to zero.
 */
async function splitRefunds(db: Db) {
  const world = await plantWorld(db, "refund");
  const sessionIds: string[] = [];
  try {
    const { payFromPot } = await import("../lib/billing/pot");
    const { refundSessionPayment } = await import("../lib/billing/connect");
    const { patientOwesFor } = await import("../lib/billing/session-owed");

    const balance = async () =>
      Number(
        (
          (
            await db.execute(sql`
              SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${world.sponsorId}`)
          ).rows[0] as { balance_cents: number }
        ).balance_cents,
      );

    /* What this world's money sits at, account by account. */
    const books = async () => {
      const rows = (
        await db.execute(sql`
          SELECT account, COALESCE(SUM(amount_cents), 0)::int AS total FROM ledger_entries
           WHERE organization_id = ${world.orgId}
              OR (ref_type = 'sponsor' AND ref_id = ${world.sponsorId})
           GROUP BY account`)
      ).rows as { account: string; total: number }[];
      return Object.fromEntries(rows.map((row) => [row.account, Number(row.total)])) as Record<
        string,
        number
      >;
    };
    const moved = (before: Record<string, number>, after: Record<string, number>) =>
      Object.entries(after)
        .map(([account, total]) => [account, total - (before[account] ?? 0)] as const)
        .filter(([, delta]) => delta !== 0);
    const unbalanced = async () =>
      (
        await db.execute(sql`
          SELECT txn_id, SUM(amount_cents)::int AS delta FROM ledger_entries
           WHERE organization_id = ${world.orgId}
              OR (ref_type = 'sponsor' AND ref_id = ${world.sponsorId})
           GROUP BY txn_id HAVING SUM(amount_cents) <> 0`)
      ).rows.length;
    const payment = async (sessionId: string) =>
      (
        await db.execute(sql`
          SELECT sp.id, sp.status, sp.sponsor_share_cents, sp.patient_share_cents,
                 s.payment_status
            FROM session_payments sp JOIN sessions s ON s.id = sp.session_id
           WHERE sp.session_id = ${sessionId}`)
      ).rows[0] as {
        id: string;
        status: string;
        sponsor_share_cents: number;
        patient_share_cents: number;
        payment_status: string;
      };
    const cover = (bps: number) =>
      db.execute(sql`UPDATE sponsor_pots SET coverage_bps = ${bps} WHERE sponsor_id = ${world.sponsorId}`);
    /*
     * An employee who has been told about the company's ledger (W2-S10), so
     * their sessions and refunds enter it where 0134 is applied. Without the
     * column it is nothing, and the money checks above do not need it.
     */
    const cast = async (first: string) => {
      const person = await world.cast(first, 10_000);
      await db
        .execute(sql`UPDATE enrolments SET ledger_told_at = now() - interval '1 minute'
                      WHERE id = ${person.enrolmentId}`)
        .catch(() => undefined);
      return person;
    };

    /* 1. Covered in full: the pot gets the whole price back, and only that. */
    await cover(10_000);
    const nour = await cast("Nour");
    sessionIds.push(nour.sessionId);
    const start1 = await balance();
    const books1 = await books();
    await payFromPot(nour.sessionId);
    const full = await payment(nour.sessionId);
    const r1 = await refundSessionPayment({ paymentId: full.id, reason: "W2-S12 full", adminUserId: null });
    const after1 = await payment(nour.sessionId);
    check(
      "W2-S12 a session the company covered in full, refunded: the pot has its whole price back, the payment is refunded",
      Boolean(r1.ok) && (await balance()) === start1 && after1.status === "refunded",
      JSON.stringify({ r1, balance: (await balance()) - start1, status: after1.status }),
    );
    const delta1 = moved(books1, await books());
    check(
      "W2-S12 …and every account it touched is back where it was, the clinician's held share included",
      delta1.length === 0 && (await unbalanced()) === 0,
      JSON.stringify(delta1),
    );

    /* 2. Covered half, the employee's share never paid: the pot gets ITS half. */
    await cover(5_000);
    const hana = await cast("Hana");
    sessionIds.push(hana.sessionId);
    const start2 = await balance();
    const books2 = await books();
    await payFromPot(hana.sessionId);
    const half = await payment(hana.sessionId);
    const r2 = await refundSessionPayment({ paymentId: half.id, reason: "W2-S12 unpaid", adminUserId: null });
    const after2 = await payment(hana.sessionId);
    check(
      "W2-S12 half covered, share unpaid: the pot gets back the 50 it paid, not the 100 the session cost",
      half.sponsor_share_cents === 5_000 && Boolean(r2.ok) && (await balance()) === start2,
      JSON.stringify({ r2, share: half.sponsor_share_cents, balance: (await balance()) - start2 }),
    );
    const owed = await patientOwesFor(hana.sessionId);
    const delta2 = moved(books2, await books());
    check(
      "W2-S12 …the employee's unpaid share is no longer owed, the payment is refunded, and the books are back",
      after2.status === "refunded" && owed.grossCents === 0 && delta2.length === 0 && (await unbalanced()) === 0,
      JSON.stringify({ status: after2.status, owed, moved: delta2 }),
    );

    /* 3. Covered half, the share paid by bank transfer (the manual rail). */
    const omar = await cast("Omar");
    sessionIds.push(omar.sessionId);
    const start3 = await balance();
    const books3 = await books();
    await payFromPot(omar.sessionId);
    const [transfer] = (
      await db.execute(sql`
        INSERT INTO manual_payments (purpose, ref_id, amount_cents, currency, settles_cents,
                                     payer_kind, organization_id, state, decided_at)
        VALUES ('session', ${omar.sessionId}, 5000, 'USD', 5000, 'session', ${world.orgId},
                'confirmed', now())
        RETURNING *`)
    ).rows as Record<string, unknown>[];
    const { grantFor } = await import("../lib/billing/manual-grants");
    await grantFor({
      ...(transfer as object),
      refId: omar.sessionId,
      purpose: "session",
      settlesCents: 5000,
      decidedAt: new Date(),
      id: String(transfer!.id),
    } as Parameters<typeof grantFor>[0]);
    const paid3 = await payment(omar.sessionId);
    const r3 = await refundSessionPayment({ paymentId: paid3.id, reason: "W2-S12 transfer", adminUserId: null });
    const again3 = await refundSessionPayment({ paymentId: paid3.id, reason: "W2-S12 again", adminUserId: null });
    const queued = (
      await db.execute(sql`
        SELECT id, amount_cents, status FROM refund_requests WHERE session_payment_id = ${paid3.id}`)
    ).rows as { id: string; amount_cents: number; status: string }[];
    const held3 = await payment(omar.sessionId);
    check(
      "CONTROL W2-S12 the employee's share was paid by transfer before the refund",
      paid3.payment_status === "paid" && paid3.status === "paid",
      JSON.stringify(paid3),
    );
    check(
      "W2-S12 half covered, share paid by transfer: the pot has its 50 back at once, once, however often it is asked",
      (await balance()) === start3,
      `${(await balance()) - start3} against the start`,
    );
    check(
      "W2-S12 …the employee's 50 is on the refund queue, and the payment is NOT called refunded while we hold it",
      // W2-M04: queuing their share is the refund's success for now, not an error.
      Boolean(r3.ok) &&
        r3.queuedCents === 5_000 &&
        Boolean(again3.ok) &&
        queued.length === 1 &&
        Number(queued[0]!.amount_cents) === 5_000 &&
        queued[0]!.status === "owed" &&
        held3.status === "paid",
      JSON.stringify({ r3, again3, queued, status: held3.status }),
    );

    const { markRefundSent } = await import("../lib/billing/refunds");
    /* 0152: somebody other than the sender recorded where it goes. */
    await db.execute(sql`
      UPDATE refund_requests
         SET payee_method = 'bank', payee_identifier = 'EG00 0000', payee_account_name = 'Omar Demo',
             payee_set_by_user_id = (SELECT id FROM users WHERE id <> ${world.therapistId} ORDER BY created_at LIMIT 1)
       WHERE id = ${queued[0]?.id ?? "00000000-0000-0000-0000-000000000000"}`);
    const sent = await markRefundSent({
      requestId: queued[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      senderUserId: world.therapistId,
      proofUrl: "https://example.com/proof/w2s12",
      method: "bank",
      identifier: "EG00 0000",
      accountName: "Omar Demo",
    });
    const after3 = await payment(omar.sessionId);
    const delta3 = moved(books3, await books());
    check(
      "W2-S12 …and when an operator sends it, the payment is refunded and every account is back where it was",
      Boolean(sent.ok) &&
        after3.status === "refunded" &&
        (await balance()) === start3 &&
        delta3.length === 0 &&
        (await unbalanced()) === 0,
      JSON.stringify({ sent, status: after3.status, moved: delta3 }),
    );

    /*
     * 4. A session paid before this fix: its pot leg sits in a transaction of
     * its own, which is why every pot refund used to stop at "No pot spend is on
     * the books". Planted by moving the pot leg out of the payment's txn.
     */
    await cover(6_000);
    const lina = await cast("Lina");
    sessionIds.push(lina.sessionId);
    const start4 = await balance();
    await payFromPot(lina.sessionId);
    await db.execute(sql`
      UPDATE ledger_entries SET txn_id = ${crypto.randomUUID()}
       WHERE ref_type = 'sponsor' AND ref_id = ${world.sponsorId}
         AND txn_id IN (SELECT txn_id FROM ledger_entries
                         WHERE ref_type = 'session_payment'
                           AND ref_id = (SELECT id FROM session_payments WHERE session_id = ${lina.sessionId}))`);
    const legacy = await payment(lina.sessionId);
    const r4 = await refundSessionPayment({ paymentId: legacy.id, reason: "W2-S12 legacy", adminUserId: null });
    check(
      "W2-S12 a pot session paid before the fix is refunded too: the pot gets its 60 back",
      Boolean(r4.ok) && (await balance()) === start4 && (await unbalanced()) === 0,
      JSON.stringify({ r4, balance: (await balance()) - start4 }),
    );

    /* The company's own ledger, where 0134 exists (it is not applied in dev). */
    const table = (
      await db.execute(sql`SELECT to_regclass('sponsor_money_entries') IS NOT NULL AS present`)
    ).rows[0] as { present: boolean };
    if (table.present) {
      const figures = async (kind: string) =>
        (
          (
            await db.execute(sql`
              SELECT price_cents, coverage_bps, covered_cents, employee_cents
                FROM sponsor_money_entries
               WHERE sponsor_id = ${world.sponsorId} AND kind = ${kind}`)
          ).rows as Record<string, number>[]
        )
          .map((row) =>
            [row.price_cents, row.coverage_bps, row.covered_cents, row.employee_cents].map(Number).join("/"),
          )
          .sort();
      const sessionsIn = await figures("session");
      const refundsIn = await figures("refund");
      check(
        "W2-S12 each refund entry in the company's ledger is its session's entry: its share back, the employee's share as frozen",
        sessionsIn.length === 4 && JSON.stringify(refundsIn) === JSON.stringify(sessionsIn),
        JSON.stringify({ sessionsIn, refundsIn }),
      );
    }
  } finally {
    for (const id of sessionIds) {
      await db.execute(sql`DELETE FROM refund_requests WHERE session_payment_id IN
        (SELECT id FROM session_payments WHERE session_id = ${id})`);
      await db.execute(sql`DELETE FROM manual_payments WHERE ref_id = ${id}`);
    }
    await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${world.sponsorId}`).catch(
      () => undefined,
    );
    await world.drop();
  }
}

/* ================================================================== */
/*  W2-M · the employee's share, booked when it arrives, and the gaps  */
/* ================================================================== */

/*
 * The pot books its own leg at booking and the employee's leg is booked when
 * their money arrives (W2-M01). Card is settled here without Stripe: the
 * checkout is written onto the pot row and settled by id, which is exactly
 * what the webhook and the redirect do. Each case checks the books move by the
 * leg and nothing else, and that a reversal puts every account back.
 */
async function moneyGaps(db: Db) {
  const world = await plantWorld(db, "gaps");
  const sessionIds: string[] = [];
  try {
    const { payFromPot } = await import("../lib/billing/pot");
    const { recordCoveredCheckout, settleSessionPayment, refundSessionPayment } = await import(
      "../lib/billing/connect"
    );
    const { patientOwesFor } = await import("../lib/billing/session-owed");
    const { fundingLegs } = await import("../lib/billing/split-refund");
    const { postReversalOf } = await import("../lib/billing/ledger");

    const balance = async () =>
      Number(
        (
          (await db.execute(sql`SELECT balance_cents FROM sponsor_pots WHERE sponsor_id = ${world.sponsorId}`))
            .rows[0] as { balance_cents: number }
        ).balance_cents,
      );
    const books = async () => {
      const rows = (
        await db.execute(sql`
          SELECT account, COALESCE(SUM(amount_cents), 0)::int AS total FROM ledger_entries
           WHERE organization_id = ${world.orgId}
              OR (ref_type = 'sponsor' AND ref_id = ${world.sponsorId})
           GROUP BY account`)
      ).rows as { account: string; total: number }[];
      return Object.fromEntries(rows.map((row) => [row.account, Number(row.total)])) as Record<string, number>;
    };
    const moved = (before: Record<string, number>, after: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(after)
          .map(([account, total]) => [account, total - (before[account] ?? 0)] as const)
          .filter(([, delta]) => delta !== 0),
      );
    const unbalanced = async () =>
      (
        await db.execute(sql`
          SELECT txn_id FROM ledger_entries
           WHERE organization_id = ${world.orgId} OR (ref_type = 'sponsor' AND ref_id = ${world.sponsorId})
           GROUP BY txn_id HAVING SUM(amount_cents) <> 0`)
      ).rows.length;
    const payment = async (sessionId: string) =>
      (
        await db.execute(sql`
          SELECT sp.*, s.payment_status AS session_status FROM session_payments sp
            JOIN sessions s ON s.id = sp.session_id WHERE sp.session_id = ${sessionId}`)
      ).rows[0] as Record<string, unknown>;
    const cover = (bps: number) =>
      db.execute(sql`UPDATE sponsor_pots SET coverage_bps = ${bps} WHERE sponsor_id = ${world.sponsorId}`);

    /* M01. Half covered: the pot's leg alone is booked at booking. */
    await cover(5_000);
    const nadia = await world.cast("Nadia", 10_000);
    sessionIds.push(nadia.sessionId);
    const before = await books();
    await payFromPot(nadia.sessionId);
    const row = await payment(nadia.sessionId);
    const legs = fundingLegs({
      grossCents: 10_000,
      coverageBps: 5_000,
      sponsorShareCents: Number(row.sponsor_share_cents),
      patientShareCents: Number(row.patient_share_cents),
      platformFeeCents: Number(row.platform_fee_cents),
    });
    const atBooking = moved(before, await books());
    check(
      "🔴 W2-M01 a half covered session books the pot's leg at booking, not the employee's unpaid half",
      (atBooking.therapist_payable ?? 0) === -legs.pot.netCents &&
        (atBooking.platform_revenue ?? 0) === -legs.pot.feeCents &&
        legs.pot.feeCents + legs.employee.feeCents === Number(row.platform_fee_cents),
      JSON.stringify({ atBooking, legs }),
    );

    /* M01. Their share by card: the checkout is recorded on the pot row and settles once. */
    const checkoutId = `cs_test_${fixture}_nadia`;
    const recorded = await recordCoveredCheckout({
      sessionId: nadia.sessionId,
      checkoutId,
      payerName: "Nadia Example",
      payerEmail: "nadia@example.com",
      vatCents: 0,
      vatBps: 0,
      payerCountry: "US",
      presentedCents: 5_000,
      presentedCurrency: "usd",
      fxRateMicro: 1_000_000,
      fxQuotedAt: new Date(),
    });
    const beforeCard = await books();
    await settleSessionPayment({ id: checkoutId, paymentIntentId: `pi_test_${fixture}_nadia`, capture: "destination" });
    await settleSessionPayment({ id: checkoutId, paymentIntentId: `pi_test_${fixture}_nadia`, capture: "destination" });
    const card = moved(beforeCard, await books());
    const paidRow = await payment(nadia.sessionId);
    check(
      "🔴 W2-M01 the employee's card share is recorded on the pot row, and the session is paid",
      recorded && paidRow.session_status === "paid" && paidRow.stripe_payment_intent_id === `pi_test_${fixture}_nadia`,
      JSON.stringify({ recorded, session: paidRow.session_status }),
    );
    check(
      "🔴 W2-M01 …it books our fee on THEIR share alone, once, and nothing held for the clinician (Stripe paid them)",
      (card.platform_revenue ?? 0) === -legs.employee.feeCents &&
        (card.cash ?? 0) === legs.employee.feeCents &&
        (card.therapist_payable ?? 0) === 0 &&
        (await unbalanced()) === 0,
      JSON.stringify({ card, employeeFee: legs.employee.feeCents }),
    );
    const again = await recordCoveredCheckout({
      sessionId: nadia.sessionId,
      checkoutId: `${checkoutId}_2`,
      payerName: "Nadia Example",
      payerEmail: null,
      vatCents: 0,
      vatBps: 0,
      payerCountry: "US",
      presentedCents: 5_000,
      presentedCurrency: "usd",
      fxRateMicro: 1_000_000,
      fxQuotedAt: new Date(),
    });
    check("W2-M01 …and a paid share cannot be checked out again", again === false, String(again));
    await postReversalOf({ paymentId: String(paidRow.id) });
    await db.execute(sql`UPDATE session_payments SET status = 'refunded' WHERE id = ${String(paidRow.id)}`);
    check(
      "W2-M01 a reversal of everything booked for the payment puts every account back",
      Object.keys(moved(before, await books())).filter((a) => a !== "sponsor_pot" && a !== "cash").length === 0 &&
        (await unbalanced()) === 0,
      JSON.stringify(moved(before, await books())),
    );

    /* M02. An abandoned card checkout on an uncovered session still owes the price. */
    await cover(0);
    const tarek = await world.book((await world.cast("Tarek", 10_000)).patientId, 3_000);
    sessionIds.push(tarek);
    await db.execute(sql`
      INSERT INTO session_payments (organization_id, therapist_id, session_id, gross_cents, currency,
                                    platform_fee_cents, therapist_net_cents, capture, status,
                                    stripe_checkout_session_id)
      VALUES (${world.orgId}, ${world.therapistId}, ${tarek}, 3000, 'usd', 450, 2550, 'destination',
              'pending', ${`cs_test_${fixture}_tarek`})`);
    const owes = await patientOwesFor(tarek);
    check(
      "W2-M02 a patient who closed the card page still owes the price, not zero",
      owes.grossCents === 3_000,
      JSON.stringify(owes),
    );

    /* M03. A transfer confirmed after the session was refunded buys nothing. */
    await cover(5_000);
    const sara = await world.cast("Sara", 10_000);
    sessionIds.push(sara.sessionId);
    await payFromPot(sara.sessionId);
    const saraRow = await payment(sara.sessionId);
    await refundSessionPayment({ paymentId: String(saraRow.id), reason: "W2-M03 first", adminUserId: null });
    const beforeLate = await books();
    const [late] = (
      await db.execute(sql`
        INSERT INTO manual_payments (purpose, ref_id, amount_cents, currency, settles_cents,
                                     payer_kind, organization_id, state, decided_at)
        VALUES ('session', ${sara.sessionId}, 5000, 'USD', 5000, 'session', ${world.orgId}, 'confirmed', now())
        RETURNING *`)
    ).rows as Record<string, unknown>[];
    const { grantFor } = await import("../lib/billing/manual-grants");
    await grantFor({
      ...(late as object),
      refId: sara.sessionId,
      purpose: "session",
      settlesCents: 5000,
      decidedAt: new Date(),
      id: String(late!.id),
    } as Parameters<typeof grantFor>[0]);
    const lateRow = await payment(sara.sessionId);
    const flagged = (
      await db.execute(sql`SELECT exception FROM manual_payments WHERE id = ${String(late!.id)}`)
    ).rows[0] as { exception: string | null };
    check(
      "🔴 W2-M03 a transfer confirmed after the refund leaves the session unpaid, posts nothing, and asks a person",
      lateRow.session_status !== "paid" &&
        Object.keys(moved(beforeLate, await books())).length === 0 &&
        flagged.exception === "not_payable",
      JSON.stringify({ session: lateRow.session_status, flagged, moved: moved(beforeLate, await books()) }),
    );

    /* M05. The company's share on the queue, returned by a person, finishes the refund. */
    const karim = await world.cast("Karim", 10_000);
    sessionIds.push(karim.sessionId);
    const start = await balance();
    const beforeKarim = await books();
    await payFromPot(karim.sessionId);
    const karimRow = await payment(karim.sessionId);
    const { openRefundRequest, returnPotShare, markRefundSent } = await import("../lib/billing/refunds");
    const opened = await openRefundRequest({
      sessionPaymentId: String(karimRow.id),
      requestedByUserId: null,
      reason: "pot_share",
    });
    const viaBank = await markRefundSent({
      requestId: opened.id ?? "",
      senderUserId: world.therapistId,
      proofUrl: "https://example.com/proof",
      method: "bank",
      identifier: "EG00 0000",
      accountName: "Nobody Example",
    });
    const returned = await returnPotShare({ requestId: opened.id ?? "", actorUserId: world.therapistId });
    const karimAfter = await payment(karim.sessionId);
    check(
      "🔴 W2-M05 the company's share is a queue row a person returns to the pot, never a bank transfer, and the refund finishes",
      Boolean(opened.ok) &&
        viaBank.error === "arefund.errMoved" &&
        Boolean(returned.ok) &&
        (await balance()) === start &&
        karimAfter.status === "refunded" &&
        Object.keys(moved(beforeKarim, await books())).length === 0 &&
        (await unbalanced()) === 0,
      JSON.stringify({ opened, viaBank, returned, status: karimAfter.status, moved: moved(beforeKarim, await books()) }),
    );

    /* M06. A queue row from before W2-S12, for the whole price, cannot overpay. */
    const layla = await world.cast("Layla", 10_000);
    sessionIds.push(layla.sessionId);
    await payFromPot(layla.sessionId);
    const laylaRow = await payment(layla.sessionId);
    const [stale] = (
      await db.execute(sql`
        INSERT INTO refund_requests (session_payment_id, organization_id, amount_cents, currency, reason)
        VALUES (${String(laylaRow.id)}, ${world.orgId}, 10000, 'usd', 'no_show') RETURNING id`)
    ).rows as { id: string }[];
    const over = await markRefundSent({
      requestId: stale!.id,
      senderUserId: world.therapistId,
      proofUrl: "https://example.com/proof",
      method: "bank",
      identifier: "EG00 0000",
      accountName: "Layla Example",
    });
    const laylaAfter = await payment(layla.sessionId);
    check(
      "🔴 W2-M06 a stale queue row asking for the whole price is refused before any money leaves",
      over.error === "arefund.errOverpaid" && laylaAfter.status === "paid",
      JSON.stringify({ over, status: laylaAfter.status }),
    );
  } finally {
    for (const id of sessionIds) {
      await db.execute(sql`DELETE FROM refund_requests WHERE session_payment_id IN
        (SELECT id FROM session_payments WHERE session_id = ${id})`);
      await db.execute(sql`DELETE FROM manual_payments WHERE ref_id = ${id}`);
    }
    await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${world.sponsorId}`).catch(
      () => undefined,
    );
    await world.drop();
  }
}

/* ================================================================== */
/*  C18 · the domain proof: an admin mailbox the company picks, again  */
/*  C19 · the portal's own loading and error screens                   */
/*  C20 · a viewer's badge says Viewer                                 */
/* ================================================================== */

async function domainProofAndChrome(db: Db) {
  const sponsorId = await plantSponsor(db, "domain");
  const otherId = await plantSponsor(db, "domain-other");
  const domain = `${fixture}.example.com`;
  const { env } = await import("../lib/env");
  const { subjectKey } = await import("../lib/rate-limit");
  const heldKey = env.resendApiKey;
  const realFetch = globalThis.fetch;
  const mail: string[] = [];
  let domainId = "";
  try {
    const [row] = (
      await db.execute(sql`
        INSERT INTO sponsor_domains (sponsor_id, domain, dns_token)
        VALUES (${sponsorId}, ${domain}, ${`24t-verify=${fixture}`}) RETURNING id`)
    ).rows as { id: string }[];
    domainId = required(row, "a domain").id;

    /* The mail provider, caught here: a key so the product sends, nothing leaves. */
    Object.assign(env, { resendApiKey: "re_verify_w2s" });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith("https://api.resend.com")) return realFetch(input, init);
      const sent = JSON.parse(String(init?.body ?? "{}")) as { to?: string | string[] };
      mail.push([sent.to].flat().join(","));
      return Response.json({ id: "caught" });
    }) as typeof fetch;

    const { sendDomainProof } = await import("../lib/data/sponsor-domains");
    const picked = await sendDomainProof({ sponsorId, domainId, mailbox: "webmaster" });
    const typed = await sendDomainProof({ sponsorId, domainId, mailbox: "ceo" as "admin" });
    const borrowed = await sendDomainProof({ sponsorId: otherId, domainId, mailbox: "admin" });
    const second = await sendDomainProof({ sponsorId, domainId, mailbox: "hostmaster" });
    const third = await sendDomainProof({ sponsorId, domainId, mailbox: "admin" });
    const fourth = await sendDomainProof({ sponsorId, domainId, mailbox: "postmaster" });
    check(
      "🔴 C18 the proof goes to the admin mailbox the company picks, and can be sent again",
      "sent" in picked && picked.sent === `webmaster@${domain}` && mail.includes(`webmaster@${domain}`) &&
        "sent" in second && "sent" in third,
      JSON.stringify({ picked, second, third, mail }),
    );
    check(
      "🔴 C18 …never to an address outside the admin names or for another company's domain, and three times a domain an hour",
      "error" in typed && typed.error === "missing" && "error" in borrowed && borrowed.error === "missing" &&
        "error" in fourth && fourth.error === "wait" && mail.length === 3 &&
        !mail.some((to) => to.startsWith("ceo@")),
      JSON.stringify({ typed, borrowed, fourth, mail }),
    );
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(env, { resendApiKey: heldKey });
    if (domainId) {
      await db.execute(sql`DELETE FROM rate_limits WHERE key = ${subjectKey("sponsor-domain-proof", domainId)}`);
    }
    await db.execute(sql`DELETE FROM sponsor_domains WHERE sponsor_id = ${sponsorId}`);
    await dropSponsor(db, sponsorId);
    await dropSponsor(db, otherId);
  }

  const chrome = readSource("components/sponsor/chrome.tsx");
  check(
    "🔴 C20 a viewer's badge says Viewer, the role, not the Overview tab's label",
    /badge=\{role === "viewer" \? t\("sponsor\.roleViewer"\)/.test(chrome) && !/badge=[^\n]*nav\.overview/.test(chrome),
    "the badge beside the company's name",
  );
  check(
    "C20 CONTROL …and the Overview tab keeps its own label",
    /href: "\/sponsor", key: "sponsor\.nav\.overview"/.test(chrome),
    "the tab list",
  );

  const { en, ar } = await import("../lib/i18n/messages");
  const boundaries = ["app/(sponsor)/error.tsx", "app/(partner)/error.tsx"].map((file) => readSource(file));
  const loaders = ["app/(sponsor)/loading.tsx", "app/(partner)/loading.tsx"].map((file) => readSource(file));
  check(
    "🔴 C19 both desk portals have their own error screen: a client boundary with a retry, in the reader's language",
    boundaries.every((src) => /^"use client"/.test(src.trim()) && /onClick=\{reset\}/.test(src) && /t\("(sponsor|dev)\.retry"\)/.test(src)) &&
      Boolean(en["sponsor.retry"] && ar["sponsor.retry"] && en["dev.retry"] && ar["dev.retry"]),
    "app/(sponsor)/error.tsx, app/(partner)/error.tsx",
  );
  check(
    "C19 CONTROL …and a loading screen each, so a click on the rail answers at once",
    loaders.every((src) => /DeskLoading/.test(src)),
    "app/(sponsor)/loading.tsx, app/(partner)/loading.tsx",
  );
}

async function main() {
  writesTo();

  const { pool, db } = connect();
  try {
    await domainProofAndChrome(db);
    await balanceAfterTopUp(db);
    await firstCode(db);
    await enquiry(db);
    await potExpiry(db);
    await companyLogins(db);
    await pauseResume(db);
    await moneyLedger(db);
    await splitRefunds(db);
    await moneyGaps(db);
  } finally {
    await pool.end();
  }

  finish("wave 2 company");
}

/* 🔴 0161: these checks were written for two people on every queue, so they say so. */
setRulesForThisCheck(TWO_PEOPLE_EVERYWHERE);

void main();
