/**
 * 🔴 THE EVENT POSITION: THE FOUNDERS' DEMO VIDEO, AS A PRODUCT STRANGERS CAN SIGN INTO.
 *
 *     npm run seed:demo -- --scenario=event
 *
 * Called by `seed-demo.ts` after its wipe, with the platform organisation, the
 * founder's console login and the support login already written (both on the
 * private password, exactly as in every other position). Everything else here is
 * the event cast from `_event-cast.ts`, speaking the words in `_event-story.ts`.
 *
 * ## The rules this keeps from `seed-demo.ts`
 *
 *   - Every cent goes through the product's own functions: `openPot`,
 *     `openCart`, `submitProof`, `confirmPayment`, `payFromPot`,
 *     `chargeForSession`. People, sessions, notes and transcripts are inserted;
 *     money is posted.
 *   - `verification_status` is never written: the approved verification row is
 *     the switch and the trigger derives the rest.
 *   - `demo = true` on every radar row, because these clinicians are invented.
 *
 * ## 🔴 AND ONE IT ADDS: HISTORY IS DATED, AFTER THE MONEY IS POSTED
 *
 * The product posts money at `now()`, because that is when money moves. A seed
 * that posts a month of sessions in one minute would put every ledger leg, and so
 * every week of the company's spend chart, in the current week. So each session's
 * money is posted through the product first and then its rows are moved to the
 * day the session happened: the ledger legs of the transactions that name that
 * session (found by reference, never by time alone, so nothing else on the
 * database can be swept up), its payment rows and its invoice. Amounts are never
 * touched, so every balance still reconciles to its ledger, and
 * `verify:event-demo` checks that it does.
 *
 * ## 🔴 NO MESSAGE LEAVES THIS PROCESS
 *
 * Confirming a transfer tells the payer, by email and WhatsApp. Every address is
 * at `example.com`, which the notifier already keeps rather than sends, but the
 * phone numbers are Egyptian-shaped and could belong to a stranger. So this
 * process runs with `SIMULATION_RUNNING=1`, which is the product's own switch for
 * "keep WhatsApp in `sim_outbox`, do not send it". It is set on this process only
 * and never on the deployed site.
 */
import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { EVENT, EVENT_LOGINS, EVENT_PASSWORD, SITE } from "./_event-cast";
import {
  MARIAM_COPILOT,
  MARIAM_JOURNAL,
  MARIAM_NEXT_HOUR_UTC,
  MARIAM_OBSERVATIONS,
  MARIAM_PROFILE,
  MARIAM_VISITS,
  PAIRS,
  type Brief,
  type Line,
  type Soap,
} from "./_event-story";
import type { connect } from "./db";

type Db = ReturnType<typeof connect>["db"];
type Row = Record<string, unknown>;

/* ======================================================================== */
/*  who                                                                      */
/* ======================================================================== */

type Clinician = {
  key: string;
  first: string;
  last: string;
  email: string;
  /** Which practice: their own, or the clinic. */
  org: "karim" | "amira" | "hesham" | "clinic";
  licence: string;
  /** Pounds per session. */
  egp: number;
  city: string;
  governorate: string;
  languages: string[];
  specialties: string[];
  headline: string;
  credentials: string;
  bio: string;
  /** Open hours, in UTC. Cairo is three hours ahead. */
  hours: [number, number];
  practice: { name: string; address: string };
};

const CLINICIANS: Clinician[] = [
  {
    key: "karim",
    first: "Karim",
    last: "Nabil",
    email: EVENT.karim,
    org: "karim",
    licence: EVENT.karimLicence,
    egp: 1_200,
    city: "Cairo",
    governorate: "Cairo Governorate",
    languages: ["Arabic", "English"],
    specialties: ["Anxiety", "Work stress & burnout", "Sleep"],
    headline: "Anxiety, burnout and sleep, in Arabic and English",
    credentials: "Clinical psychologist",
    bio: "I work with people whose jobs have started keeping them up at night: anxiety, burnout and the sleep that goes with them. Short, practical work, in Arabic or English.",
    hours: [11, 17],
    practice: { name: "Karim Nabil Psychology", address: "14 Hassan Sabry Street, Zamalek, Cairo" },
  },
  {
    key: "salma",
    first: "Salma",
    last: "Fouad",
    email: "salma.fouad@example.com",
    org: "clinic",
    licence: "EG-PSY-31188",
    egp: 1_000,
    city: "Cairo",
    governorate: "Cairo Governorate",
    languages: ["Arabic", "English"],
    specialties: ["Depression", "Grief & loss", "Relationships"],
    headline: "Grief, low mood and relationships",
    credentials: "Counselling psychologist",
    bio: "Grief and low mood, and the relationships that carry us through them. I see people online and at Nile Practice in Heliopolis.",
    hours: [7, 13],
    practice: { name: "Nile Practice", address: "22 El Merghany Street, Heliopolis, Cairo" },
  },
  {
    key: "youssef",
    first: "Youssef",
    last: "Adel",
    email: "youssef.adel@example.com",
    org: "clinic",
    licence: "EG-PSY-27754",
    egp: 1_400,
    city: "Giza",
    governorate: "Giza Governorate",
    languages: ["Arabic", "English"],
    specialties: ["Trauma & PTSD", "Panic attacks", "Anxiety"],
    headline: "Trauma and panic, step by step",
    credentials: "Clinical psychologist",
    bio: "Trauma-focused therapy and panic treatment, with graded, practical steps. Online, or in person in Dokki.",
    hours: [9, 15],
    practice: { name: "Nile Practice, Dokki", address: "5 Mossadak Street, Dokki, Giza" },
  },
  {
    key: "nour",
    first: "Nour",
    last: "El-Sayed",
    email: "nour.elsayed@example.com",
    org: "clinic",
    licence: "EG-PSY-40921",
    egp: 1_100,
    city: "Cairo",
    governorate: "Cairo Governorate",
    languages: ["Arabic", "English", "French"],
    specialties: ["Family conflict", "Relationships", "Postnatal"],
    headline: "Families, couples and new parents",
    credentials: "Family therapist",
    bio: "Family and couples work, and the year after a baby arrives. Arabic, English or French.",
    hours: [12, 18],
    practice: { name: "Nile Practice, Maadi", address: "9 Road 233, Degla, Maadi, Cairo" },
  },
  {
    key: "amira",
    first: "Amira",
    last: "Mansour",
    email: "amira.mansour@example.com",
    org: "amira",
    licence: "EG-PSY-18830",
    egp: 900,
    city: "Alexandria",
    governorate: "Alexandria Governorate",
    languages: ["Arabic", "French", "English"],
    specialties: ["OCD", "Anxiety", "Eating disorders"],
    headline: "OCD, anxiety and eating, in Alexandria and online",
    credentials: "Clinical psychologist",
    bio: "Exposure-based work for OCD and anxiety, and support around eating. Francophone patients welcome.",
    hours: [8, 14],
    practice: { name: "Amira Mansour Therapy", address: "31 Fouad Street, Alexandria" },
  },
  {
    key: "hesham",
    first: "Hesham",
    last: "Ragab",
    email: "hesham.ragab@example.com",
    org: "hesham",
    licence: "EG-PSY-22506",
    egp: 700,
    city: "Mansoura",
    governorate: "Dakahlia Governorate",
    languages: ["Arabic"],
    specialties: ["Addiction", "Depression", "Work stress & burnout"],
    headline: "Drinking, low mood and work stress, in Arabic",
    credentials: "Psychotherapist",
    bio: "Practical help with drinking, low mood and stress at work, in Arabic. Online across Egypt, in person in Mansoura.",
    hours: [14, 20],
    practice: { name: "Hesham Ragab Counselling", address: "40 El Gomhoreya Street, Mansoura" },
  },
];

type Person = {
  key: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  /** `event`: the shared password. `hidden`: an account nobody is told the password of. `none`: no account. */
  login: "event" | "hidden" | "none";
  employer?: "foundry" | "pharma";
};

const PEOPLE: Person[] = [
  { key: "mariam", first: "Mariam", last: "Hassan", email: EVENT.mariam, phone: EVENT.mariamPhone, login: "event", employer: "foundry" },
  { key: "omar", first: "Omar", last: "Khaled", email: "omar.khaled@example.com", phone: "+201009000062", login: "event", employer: "foundry" },
  { key: "yara", first: "Yara", last: "Mostafa", email: "yara.mostafa@example.com", phone: "+201009000063", login: "event", employer: "pharma" },
  { key: "ahmed", first: "Ahmed", last: "Samir", email: "ahmed.samir@example.com", phone: "+201009000064", login: "event" },
  { key: "nadine", first: "Nadine", last: "Farouk", email: "nadine.farouk@example.com", phone: "+201009000065", login: "event" },
  { key: "sherif", first: "Sherif", last: "Wahba", email: EVENT.moved, phone: "+201009000066", login: "event" },
  { key: "hazem", first: "Hazem", last: "Tawfik", email: "hazem.tawfik@example.com", phone: "+201009000067", login: "event", employer: "pharma" },
  { key: "hoda", first: "Hoda", last: "Ibrahim", email: EVENT.unclaimed, phone: "+201009000068", login: "none" },
  /* The rest of the two rosters. On the lists, enrolled, and nobody's login. */
  { key: "mohamed", first: "Mohamed", last: "Gaber", email: "mohamed.gaber@example.com", phone: "+201009000071", login: "hidden", employer: "foundry" },
  { key: "tamer", first: "Tamer", last: "Adly", email: "tamer.adly@example.com", phone: "+201009000072", login: "hidden", employer: "foundry" },
  { key: "rana", first: "Rana", last: "Shawky", email: "rana.shawky@example.com", phone: "+201009000073", login: "hidden", employer: "foundry" },
  { key: "dina", first: "Dina", last: "Lotfy", email: "dina.lotfy@example.com", phone: "+201009000074", login: "hidden", employer: "foundry" },
  { key: "hany", first: "Hany", last: "Zaki", email: "hany.zaki@example.com", phone: "+201009000075", login: "hidden", employer: "foundry" },
  { key: "mai", first: "Mai", last: "Soliman", email: "mai.soliman@example.com", phone: "+201009000076", login: "hidden", employer: "foundry" },
  { key: "aya", first: "Aya", last: "Hamdy", email: "aya.hamdy@example.com", phone: "+201009000081", login: "hidden", employer: "pharma" },
  { key: "mostafa", first: "Mostafa", last: "Reda", email: "mostafa.reda@example.com", phone: "+201009000082", login: "hidden", employer: "pharma" },
  { key: "ingy", first: "Ingy", last: "Sabry", email: "ingy.sabry@example.com", phone: "+201009000083", login: "hidden", employer: "pharma" },
];

/** The same shape `seed-demo.ts` writes, so every screen that reads a note reads this one. */
function noteContent(opts: {
  soap: Soap;
  summary: string;
  brief: Brief;
  talkingPoints?: string[];
  impressions?: string;
  recommendations?: string[];
  followUp?: string;
}) {
  return {
    soap: opts.soap,
    summary: opts.summary,
    patientBrief: opts.brief.brief,
    patientSteps: opts.brief.steps,
    patientNext: opts.brief.next,
    talkingPoints: opts.talkingPoints ?? [],
    observations: opts.soap.objective,
    impressions: opts.impressions ?? opts.soap.assessment,
    recommendations: opts.recommendations ?? [opts.soap.plan],
    followUp: opts.followUp ?? opts.brief.next,
  };
}

/* ======================================================================== */
/*  the seed                                                                 */
/* ======================================================================== */

export async function seedEvent(ctx: { db: Db; adminId: string }): Promise<void> {
  process.env.SIMULATION_RUNNING = "1";

  const { db, adminId } = ctx;
  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };
  const rows = async (text: ReturnType<typeof sql>): Promise<Row[]> =>
    (await db.execute(text)).rows as Row[];

  const hash = await hashPassword(EVENT_PASSWORD);
  /* An account that exists for the roster and opens for nobody. */
  const nobody = await hashPassword(randomBytes(24).toString("base64url"));
  const token = () => randomBytes(18).toString("base64url");

  const DAY = 86_400_000;
  const nowDb = async () => new Date(String((await one<{ t: string }>(sql`SELECT clock_timestamp() AS t`)).t));
  const seedStart = await nowDb();
  const today = Date.UTC(seedStart.getUTCFullYear(), seedStart.getUTCMonth(), seedStart.getUTCDate());
  const at = (days: number, hourUtc: number) => new Date(today + days * DAY + hourUtc * 3_600_000);
  const daysAgo = (n: number) => new Date(seedStart.getTime() - n * DAY);
  /*
   * The earlier of the two clocks, less a margin. Rows written by the product carry
   * one or the other, and a leg stamped by a clock slightly behind must still count
   * as "written just now" when it is moved to its day.
   */
  const since = async () => {
    const database = await nowDb();
    return new Date(Math.min(database.getTime(), Date.now()) - 5_000);
  };

  const { egpRateMicro, egpMinorFor, submitProof, confirmPayment } = await import("../lib/billing/manual");
  const { openCart } = await import("../lib/billing/cart");
  const { grantFor } = await import("../lib/billing/manual-grants");
  const { payFromPot, potTopUpMoney, entityVatBps } = await import("../lib/billing/pot");
  const { chargeForSession } = await import("../lib/billing/service");
  const { sessionTransferMoney } = await import("../lib/billing/manual-entry");
  const { patientOwesFor } = await import("../lib/billing/session-owed");
  const { rederiveEgpRates } = await import("../lib/billing/egp-rates");
  const { weekStartOf } = await import("../lib/sponsor/ledger");

  const rate = await egpRateMicro();

  /* ------------------------------------------------------ practices -- */

  const orgs: Record<Clinician["org"], string> = { karim: "", amira: "", hesham: "", clinic: "" };
  for (const [key, name, slug, contact, email] of [
    ["karim", "Karim Nabil Psychology", "karim-nabil-psychology", "Karim Nabil", EVENT.karim],
    ["amira", "Amira Mansour Therapy", "amira-mansour-therapy", "Amira Mansour", "amira.mansour@example.com"],
    ["hesham", "Hesham Ragab Counselling", "hesham-ragab-counselling", "Hesham Ragab", "hesham.ragab@example.com"],
  ] as const) {
    const row = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind, contact_name, contact_email, created_at)
      VALUES (${name}, 'eg', ${slug}, 'solo', ${contact}, ${email}, ${daysAgo(120).toISOString()})
      RETURNING id`);
    orgs[key] = row.id;
    await db.execute(sql`
      INSERT INTO subscriptions (organization_id, plan, status) VALUES (${row.id}, 'payg', 'active')
      ON CONFLICT (organization_id) DO NOTHING`);
  }

  const clinic = await one<{ id: string }>(sql`
    INSERT INTO organizations (name, region, slug, kind, clinic_state, seats, billing_mode,
                               contact_name, contact_email, created_at)
    VALUES ('Nile Practice', 'eg', ${EVENT.clinicSlug}, 'clinic', 'active', 3, 'self',
            'Hana Mahmoud', ${EVENT.hana}, ${daysAgo(150).toISOString()})
    RETURNING id`);
  orgs.clinic = clinic.id;
  await db.execute(sql`
    INSERT INTO subscriptions (organization_id, plan, status) VALUES (${clinic.id}, 'clinic', 'active')
    ON CONFLICT (organization_id) DO NOTHING`);

  /* ------------------------------------------------------ clinicians -- */

  const clinician: Record<string, { id: string; orgId: string; c: Clinician; rateCents: number }> = {};
  for (const c of CLINICIANS) {
    const orgId = orgs[c.org];
    const user = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, status,
                         profile, rate_egp_minor, rate_currency, timezone, created_at)
      VALUES (${orgId}, ${c.email}, ${c.first}, ${c.last}, 'therapist', ${hash}, 'active',
              ${JSON.stringify({ credentials: c.credentials, bio: c.bio, licenseNumber: c.licence })}::jsonb,
              ${c.egp * 100}, 'egp', 'Africa/Cairo', ${daysAgo(100).toISOString()})
      RETURNING id`);

    /* The switch: an approved verification, and the trigger derives the user's status. */
    await db.execute(sql`
      INSERT INTO therapist_verifications
        (user_id, organization_id, state, country, license_body, license_number, license_expiry,
         specialties, languages, submitted_at, reviewed_at, reviewed_by)
      VALUES (${user.id}, ${orgId}, 'approved', 'EG', 'Egyptian Psychological Association', ${c.licence},
              '2029-06-30', ${JSON.stringify(c.specialties)}::jsonb, ${JSON.stringify(c.languages)}::jsonb,
              ${daysAgo(95).toISOString()}, ${daysAgo(93).toISOString()}, ${adminId})`);

    /*
     * 🔴 THE RADAR ROW IS WHAT MAKES A CLINICIAN VISIBLE ANYWHERE.
     *
     * `listable()` in `lib/data/discover.ts` reads `therapist_radar` joined to an
     * approved verification: the home rail, the categories, search and the
     * profile all go through it. A clinician without this row is invisible to
     * every patient until they open the crisis radar themselves, which no
     * invented clinician ever will. `online` with a fresh heartbeat reads as
     * online for ninety seconds and offline after, and stays listed either way.
     */
    await db.execute(sql`
      INSERT INTO therapist_radar
        (user_id, organization_id, status, demo, headline, languages, specialties, country, region, city,
         last_seen_at, accepts_walk_ins, practice_name, practice_address, practice_confirmed_at)
      VALUES (${user.id}, ${orgId}, 'online', true, ${c.headline}, ${JSON.stringify(c.languages)}::jsonb,
              ${JSON.stringify(c.specialties)}::jsonb, 'EG', ${c.governorate}, ${c.city}, now(), false,
              ${c.practice.name}, ${c.practice.address}, now())`);

    /* Fourteen days of opening hours, on the hour, skipping the Egyptian weekend. */
    await db.execute(sql`
      INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, duration_minutes, status, place)
      SELECT ${user.id}, ${orgId}, slot, 60, 'open',
             CASE WHEN hour < ${c.hours[0] + 2} THEN 'either' ELSE 'online' END
        FROM generate_series(date_trunc('day', now() + interval '1 day'),
                             date_trunc('day', now() + interval '14 days'),
                             interval '1 day') AS day,
             generate_series(${c.hours[0]}::int, ${c.hours[1] - 1}::int) AS hour,
             LATERAL (SELECT day + make_interval(hours => hour)) AS s(slot)
       WHERE extract(dow from day) NOT IN (5, 6)`);

    clinician[c.key] = { id: user.id, orgId, c, rateCents: 0 };
  }

  /* Their dollar prices follow this database's rate, as the product derives them. */
  await rederiveEgpRates(rate);
  for (const row of await rows(sql`SELECT id, session_rate_cents AS cents FROM users WHERE role = 'therapist'`)) {
    const found = Object.values(clinician).find((x) => x.id === String(row.id));
    if (found) found.rateCents = Number(row.cents);
  }

  await db.execute(sql`
    INSERT INTO payout_methods (therapist_id, organization_id, method, identifier, account_name, currency, is_default)
    VALUES (${clinician.karim!.id}, ${orgs.karim}, 'instapay', 'karim.nabil@instapay', 'Karim Nabil', 'EGP', true)`);

  /* ---------------------------------------------------------- clinic -- */

  await db.execute(sql`
    INSERT INTO clinic_managers (organization_id, email, name, password_hash, role)
    VALUES (${clinic.id}, ${EVENT.hana}, 'Hana Mahmoud', ${hash}, 'admin')`);
  for (const key of ["salma", "youssef", "nour"]) {
    await db.execute(sql`
      INSERT INTO clinic_seats (organization_id, user_id, billable_from)
      VALUES (${clinic.id}, ${clinician[key]!.id}, ${daysAgo(90).toISOString()})`);
  }

  /* ------------------------------------------------------- companies -- */

  const { openPot, rotateCode, setIdentifierField } = await import("../lib/data/sponsor-admin");
  const { replaceEmailList } = await import("../lib/data/sponsor-email-list");
  const { hashIdentifier, hashIdentifierGlobal } = await import("../lib/data/enrolment");

  /** A company, its pot funded through the transfer rail, its code and its staff list. */
  const company = async (opts: {
    name: string;
    legal: string;
    admin: { email: string; name: string };
    coverageBps: number;
    welcomeCents: number;
    topUpCents: number;
    openedDaysAgo: number;
    reference: string;
    employer: "foundry" | "pharma";
  }) => {
    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state, contact_name, contact_email, legal_name, created_at)
      VALUES (${opts.name}, 'company', 'eg', 'EGP', 'active', ${opts.admin.name}, ${opts.admin.email},
              ${opts.legal}, ${daysAgo(opts.openedDaysAgo + 5).toISOString()})
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO sponsor_users (sponsor_id, email, name, role, password_hash)
      VALUES (${sponsor.id}, ${opts.admin.email}, ${opts.admin.name}, 'admin', ${hash})`);

    const t0 = await since();
    const opened = await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(seedStart.getTime() + 330 * DAY),
      overdraftCents: 1_000,
      welcomeCreditCents: opts.welcomeCents,
    });
    if (opened.error) throw new Error(`openPot ${opts.name}: ${opened.error}`);

    const money = potTopUpMoney({ creditCents: opts.topUpCents, vatBps: await entityVatBps("eg") });
    const topUp = await openCart({
      purpose: "pot_topup",
      refId: sponsor.id,
      amountCents: egpMinorFor(money.settlesCents, rate),
      settlesCents: money.settlesCents,
      lineItems: [
        { label: "Pot credit", cents: money.creditCents },
        { label: "VAT", cents: money.vatCents },
      ],
      payer: { kind: "sponsor", sponsorId: sponsor.id },
    });
    if (!topUp.id) throw new Error(`openCart ${opts.name}: ${topUp.error ?? "no payment id"}`);
    await submitProof({ paymentId: topUp.id, reference: opts.reference, proofUrl: null });
    await confirmPayment({ paymentId: topUp.id, byUserId: adminId, onConfirmed: grantFor });

    /* Before the first session, because that is when each split is frozen. */
    await db.execute(sql`
      UPDATE sponsor_pots SET coverage_bps = ${opts.coverageBps} WHERE sponsor_id = ${sponsor.id}`);

    const funded = await one<{ balance: number }>(sql`
      SELECT balance_cents AS balance FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`);
    const wanted = opts.welcomeCents + money.creditCents;
    if (Number(funded.balance) !== wanted) {
      throw new Error(`${opts.name}'s pot holds ${String(funded.balance)} cents, wanted ${String(wanted)}`);
    }

    /* The pot opened, and was topped up, on the day it did: moved there, amounts untouched. */
    const opening = daysAgo(opts.openedDaysAgo);
    await db.execute(sql`
      UPDATE ledger_entries SET created_at = ${opening.toISOString()}
       WHERE created_at >= ${t0.toISOString()}
         AND txn_id IN (SELECT txn_id FROM ledger_entries
                         WHERE created_at >= ${t0.toISOString()}
                           AND ref_id IN (${sponsor.id}::uuid, ${topUp.id}::uuid))`);
    await db.execute(sql`
      UPDATE manual_payments
         SET created_at = ${new Date(opening.getTime() - 2 * 3_600_000).toISOString()},
             submitted_at = ${new Date(opening.getTime() - 3_600_000).toISOString()},
             decided_at = ${opening.toISOString()}
       WHERE id = ${topUp.id}`);
    await db.execute(sql`
      UPDATE sponsor_pots SET created_at = ${opening.toISOString()} WHERE sponsor_id = ${sponsor.id}`);

    const { code } = await rotateCode(sponsor.id);
    const listed = await setIdentifierField({
      sponsorId: sponsor.id,
      kind: "listed_email",
      domain: null,
      pattern: null,
      shapeHint: null,
    });
    if (listed.error) throw new Error(`staff list field ${opts.name}: ${listed.error}`);
    const staff = PEOPLE.filter((x) => x.employer === opts.employer).map((x) => x.email);
    await replaceEmailList(sponsor.id, staff, daysAgo(opts.openedDaysAgo - 1));

    return { id: sponsor.id, code, fundedCents: Number(funded.balance) };
  };

  /*
   * Cairo Foundry covers everything, so it needs the bigger pot: EGP 50,000 of
   * credit against about eighteen sessions at EGP 700 to 1,400 each.
   */
  const foundry = await company({
    name: EVENT.cairoFoundry,
    legal: "Cairo Foundry Ventures S.A.E.",
    admin: { email: EVENT.dalia, name: "Dalia Samir" },
    coverageBps: 10_000,
    welcomeCents: 10_000,
    topUpCents: 100_000,
    openedDaysAgo: 60,
    reference: "CIB-TRF-2026-08-731",
    employer: "foundry",
  });
  const pharma = await company({
    name: EVENT.nilePharma,
    legal: "Nile Pharma Industries S.A.E.",
    admin: { email: EVENT.nilePharmaHr, name: "Nile Pharma HR" },
    coverageBps: 5_000,
    welcomeCents: 10_000,
    topUpCents: 20_000,
    openedDaysAgo: 45,
    reference: "NBE-TRF-2026-08-214",
    employer: "pharma",
  });
  const sponsorOf = { foundry, pharma } as const;
  console.log(
    `  companies funded: Cairo Foundry ${String(foundry.fundedCents)} cents at 100%, ` +
      `Nile Pharma ${String(pharma.fundedCents)} cents at 50%`,
  );

  /* ---------------------------------------------------------- people -- */

  const person: Record<string, { id: string; accountId: string | null; p: Person }> = {};
  for (const x of PEOPLE) {
    const row = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email, phone, region, created_at)
      VALUES (${x.first}, ${x.last}, ${x.email}, ${x.phone}, 'eg', ${daysAgo(70).toISOString()})
      RETURNING id`);
    let accountId: string | null = null;
    if (x.login !== "none") {
      const account = await one<{ id: string }>(sql`
        INSERT INTO patient_accounts (person_id, email, password_hash, email_verified_at, phone,
                                      phone_verified_at, timezone, created_at)
        VALUES (${row.id}, ${x.email}, ${x.login === "event" ? hash : nobody}, now(), ${x.phone}, now(),
                'Africa/Cairo', ${daysAgo(70).toISOString()})
        RETURNING id`);
      accountId = account.id;
      /* Claimed, or every screen that asks `assertClaimed` refuses them. */
      await db.execute(sql`
        UPDATE people SET claimed_at = ${daysAgo(70).toISOString()}, claimed_by_account_id = ${accountId}
         WHERE id = ${row.id}`);
    }
    person[x.key] = { id: row.id, accountId, p: x };

    if (x.employer) {
      const sponsor = sponsorOf[x.employer];
      const joined = daysAgo(x.employer === "foundry" ? 58 : 43);
      /*
       * Enrolled by the staff list, confirmed, and told about the company's money
       * view before any session was paid, which is what lets `payFromPot` write the
       * company's money entry for each one.
       */
      await db.execute(sql`
        INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash, identifier_hash_global,
                                identifier_kind, last_verified_at, ledger_told_at, created_at)
        VALUES (${sponsor.id}, ${row.id}, 'active', true, ${hashIdentifier(sponsor.id, x.email)},
                ${hashIdentifierGlobal(x.email)}, 'listed_email', ${joined.toISOString()},
                ${new Date(joined.getTime() + 3_600_000).toISOString()}, ${joined.toISOString()})`);
    }
  }

  /* One chart per clinician a person has seen. */
  const chartOf = new Map<string, string>();
  const chart = async (therapistKey: string, personKey: string) => {
    const key = `${therapistKey}:${personKey}`;
    const existing = chartOf.get(key);
    if (existing) return existing;
    const c = clinician[therapistKey]!;
    const x = person[personKey]!;
    const row = await one<{ id: string }>(sql`
      INSERT INTO patients (organization_id, therapist_id, person_id, first_name, last_name, email, phone,
                            source, timezone, created_at)
      VALUES (${c.orgId}, ${c.id}, ${x.id}, ${x.p.first}, ${x.p.last}, ${x.p.email}, ${x.p.phone},
              ${x.p.login === "none" ? "therapist" : "self"}, 'Africa/Cairo', ${daysAgo(65).toISOString()})
      RETURNING id`);
    chartOf.set(key, row.id);
    return row.id;
  };

  /* ======================================================================== */
  /*  sessions, oldest first, each with its money posted and then dated        */
  /* ======================================================================== */

  type Held = {
    therapist: string;
    patient: string;
    when: Date;
    lines: Line[];
    content: ReturnType<typeof noteContent>;
    modality: "video" | "in_person";
    language: "en" | "ar";
    /** Filled when written. */
    id?: string;
  };

  const held: Held[] = [];
  for (const v of MARIAM_VISITS) {
    held.push({
      therapist: "karim",
      patient: "mariam",
      when: at(-v.daysAgo, MARIAM_NEXT_HOUR_UTC),
      lines: v.lines,
      content: noteContent(v),
      modality: "video",
      language: "en",
    });
  }
  for (const pair of PAIRS) {
    const c = CLINICIANS.find((x) => x.key === pair.therapist)!;
    pair.held.forEach((d, i) => {
      held.push({
        therapist: pair.therapist,
        patient: pair.patient,
        when: at(-d, c.hours[0] + 1 + (i % 3)),
        lines: pair.lines,
        content: noteContent({ soap: pair.soap, summary: pair.summary, brief: pair.briefs[i % pair.briefs.length]! }),
        modality: pair.modality ?? "video",
        language: pair.language ?? "en",
      });
    });
  }
  held.sort((a, b) => a.when.getTime() - b.when.getTime());

  /** Move everything the product just wrote about one session to the day it happened. */
  const dateSession = async (sessionId: string, t0: Date, when: Date, paidAt: Date) => {
    await db.execute(sql`
      UPDATE ledger_entries SET created_at = ${when.toISOString()}
       WHERE created_at >= ${t0.toISOString()}
         AND txn_id IN (
           SELECT txn_id FROM ledger_entries
            WHERE created_at >= ${t0.toISOString()}
              AND ref_id IN (SELECT ${sessionId}::uuid
                             UNION SELECT id FROM session_payments WHERE session_id = ${sessionId}
                             UNION SELECT id FROM manual_payments WHERE ref_id = ${sessionId}
                             UNION SELECT id FROM invoices WHERE session_id = ${sessionId}))`);
    await db.execute(sql`
      UPDATE session_payments SET created_at = ${paidAt.toISOString()},
             paid_at = CASE WHEN paid_at IS NULL THEN NULL ELSE ${paidAt.toISOString()}::timestamptz END
       WHERE session_id = ${sessionId}`);
    await db.execute(sql`
      UPDATE manual_payments
         SET created_at = ${new Date(paidAt.getTime() - 2 * 3_600_000).toISOString()},
             submitted_at = ${new Date(paidAt.getTime() - 3_600_000).toISOString()},
             decided_at = ${paidAt.toISOString()}
       WHERE ref_id = ${sessionId}`);
    await db.execute(sql`
      UPDATE invoices SET issued_at = ${when.toISOString()},
             paid_at = CASE WHEN paid_at IS NULL THEN NULL ELSE ${when.toISOString()}::timestamptz END
       WHERE session_id = ${sessionId}`);
  };

  /** The patient's transfer, by InstaPay, claimed and confirmed on the operator's rail. */
  let instapay = 40_210;
  const payByTransfer = async (sessionId: string, orgId: string, label: string) => {
    const owed = await patientOwesFor(sessionId);
    const money = await sessionTransferMoney({ organizationId: orgId, priceCents: owed.grossCents });
    const cart = await openCart({
      purpose: "session",
      refId: sessionId,
      amountCents: egpMinorFor(money.settlesCents, rate),
      settlesCents: money.settlesCents,
      lineItems: [{ label, cents: money.grossCents }],
      payer: { kind: "session", organizationId: orgId },
    });
    if (!cart.id) throw new Error(`session transfer did not open: ${cart.error ?? "?"}`);
    instapay += 137;
    await submitProof({ paymentId: cart.id, reference: `INSTAPAY-${String(instapay)}`, proofUrl: null });
    await confirmPayment({ paymentId: cart.id, byUserId: adminId, onConfirmed: grantFor });
  };

  /**
   * The company's money entry is written in the current week, because that is when
   * the product posts it. Sessions are processed oldest first, so the only entry
   * still sitting in this week is the one just written, and it is moved to its own.
   */
  const thisWeek = weekStartOf(new Date());
  const dateMoneyEntry = async (sponsorId: string, when: Date) => {
    await db.execute(sql`
      UPDATE sponsor_money_entries SET week_start = ${weekStartOf(when)}::date
       WHERE sponsor_id = ${sponsorId} AND week_start = ${thisWeek}::date`);
  };

  let feedbackStars = 0;
  for (const h of held) {
    const c = clinician[h.therapist]!;
    const x = person[h.patient]!;
    const chartId = await chart(h.therapist, h.patient);
    const ended = new Date(h.when.getTime() + 50 * 60_000);

    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality, session_type,
                            join_token, feedback_token, price_cents, price_currency, payment_status,
                            scheduled_at, started_at, ended_at, duration_minutes, note_status,
                            recording_consent, recording_consent_at, transcript_language, created_at, updated_at)
      VALUES (${c.orgId}, ${c.id}, ${chartId}, 'completed', ${h.modality}, 'paid_link', ${token()}, ${token()},
              ${c.rateCents}, 'usd', 'pending', ${h.when.toISOString()}, ${h.when.toISOString()},
              ${ended.toISOString()}, 50, 'ready', 'granted', ${h.when.toISOString()}, ${h.language},
              ${new Date(h.when.getTime() - 3 * DAY).toISOString()}, ${ended.toISOString()})
      RETURNING id`);
    h.id = session.id;

    let ms = 0;
    for (const [i, line] of h.lines.entries()) {
      const length = Math.max(4_000, line.text.length * 70);
      await db.execute(sql`
        INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
        VALUES (${session.id}, ${c.orgId}, ${i + 1}, ${line.speaker}, ${line.text}, ${ms}, ${ms + length})`);
      ms += length + 1_500;
    }

    /* Signed for the chart and released to the patient: two decisions, both made. */
    await db.execute(sql`
      INSERT INTO session_notes (session_id, organization_id, therapist_id, patient_id, content, status,
                                 approved_at, approved_by, patient_status, patient_approved_at,
                                 patient_approved_by, provenance, language, model, created_at)
      VALUES (${session.id}, ${c.orgId}, ${c.id}, ${chartId}, ${JSON.stringify(h.content)}::jsonb, 'approved',
              ${ended.toISOString()}, ${c.id}, 'approved', ${ended.toISOString()}, ${c.id}, 'transcript',
              'en', 'seed', ${ended.toISOString()})`);

    /* The money, through the product, then dated. */
    const t0 = await since();
    const employer = x.p.employer;
    if (employer) {
      const spend = await payFromPot(session.id);
      if (!spend.paid) throw new Error(`the pot declined a session: ${spend.reason}`);
      await dateMoneyEntry(sponsorOf[employer].id, h.when);
    }
    const after = await one<{ status: string }>(sql`SELECT payment_status AS status FROM sessions WHERE id = ${session.id}`);
    if (after.status !== "paid") {
      await payByTransfer(session.id, c.orgId, `Session with Dr ${c.c.first} ${c.c.last}`);
    }
    const settled = await one<{ status: string }>(sql`SELECT payment_status AS status FROM sessions WHERE id = ${session.id}`);
    if (settled.status !== "paid") throw new Error(`a held session is still ${settled.status}`);

    await chargeForSession({ organizationId: c.orgId, sessionId: session.id });
    await dateSession(session.id, t0, ended, new Date(h.when.getTime() - DAY));

    await db.execute(sql`
      UPDATE patients SET last_session_at = ${ended.toISOString()} WHERE id = ${chartId}`);

    /* Rated by the patient afterwards: enough per clinician for the score to show. */
    feedbackStars += 1;
    await db.execute(sql`
      INSERT INTO session_feedback (session_id, organization_id, therapist_id, therapist_stars, service_stars,
                                    session_stars, arrived_at, created_at)
      VALUES (${session.id}, ${c.orgId}, ${c.id}, ${feedbackStars % 4 === 0 ? 4 : 5}, 5, 5,
              ${ended.toISOString()}, ${new Date(ended.getTime() + 3_600_000).toISOString()})`);
  }
  console.log(`  ${String(held.length)} sessions held, noted, signed, paid and billed`);

  /* ------------------------------------------------ what is booked next -- */

  const booked: { therapist: string; patient: string; when: Date }[] = [
    { therapist: "karim", patient: "mariam", when: at(1, MARIAM_NEXT_HOUR_UTC) },
    ...PAIRS.filter((pair) => pair.booked !== undefined).map((pair) => ({
      therapist: pair.therapist,
      patient: pair.patient,
      when: at(pair.booked!, CLINICIANS.find((c) => c.key === pair.therapist)!.hours[0] + 2),
    })),
  ];
  for (const b of booked) {
    const c = clinician[b.therapist]!;
    const x = person[b.patient]!;
    const chartId = await chart(b.therapist, b.patient);
    const session = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality, session_type,
                            join_token, feedback_token, price_cents, price_currency, payment_status, scheduled_at)
      VALUES (${c.orgId}, ${c.id}, ${chartId}, 'scheduled', 'video', 'paid_link', ${token()}, ${token()},
              ${c.rateCents}, 'usd', 'pending', ${b.when.toISOString()})
      RETURNING id`);

    /* The hour they booked, taken off the open list. */
    const taken = await rows(sql`
      UPDATE availability_slots SET status = 'booked', session_id = ${session.id},
             booked_by_account_id = ${x.accountId}
       WHERE therapist_user_id = ${c.id} AND starts_at = ${b.when.toISOString()} AND status = 'open'
      RETURNING id`);
    if (taken.length === 0) {
      await db.execute(sql`
        INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, duration_minutes, status,
                                        place, session_id, booked_by_account_id)
        VALUES (${c.id}, ${c.orgId}, ${b.when.toISOString()}, 60, 'booked', 'online', ${session.id},
                ${x.accountId})`);
    }

    /* A covered employee's company pays at booking, as the product does. Today, so not dated. */
    if (x.p.employer) {
      const spend = await payFromPot(session.id);
      if (!spend.paid) throw new Error(`the pot declined a booking: ${spend.reason}`);
    }
  }
  console.log(`  ${String(booked.length)} sessions booked ahead, the first of them tomorrow`);

  /* ======================================================================== */
  /*  the record: summaries, grants, homework, journals, measures, profile     */
  /* ======================================================================== */

  const mariam = person.mariam!;
  const karim = clinician.karim!;
  const mariamSessions = held.filter((h) => h.patient === "mariam");

  /** `S2:4` for the line in Mariam's session two containing this quote. */
  const refTo = (session: number, quote: string) => {
    const lines = mariamSessions[session - 1]!.lines;
    const index = lines.findIndex((l) => l.text.includes(quote));
    if (index < 0) throw new Error(`no line in session ${String(session)} contains "${quote}"`);
    return { ref: `S${String(session)}:${String(index + 1)}`, index };
  };

  /* Her record goes to Karim "until I change my mind": open, no expiry. */
  await db.execute(sql`
    INSERT INTO history_grants (person_id, therapist_user_id, organization_id, status, shape, request_note,
                                requested_at, decided_at)
    VALUES (${mariam.id}, ${karim.id}, ${karim.orgId}, 'granted', 'open',
            'So I can read your earlier notes before each session.',
            ${mariamSessions[0]!.when.toISOString()},
            ${new Date(mariamSessions[0]!.when.getTime() + 2 * 3_600_000).toISOString()})`);

  /* Sherif moved practice and brought his record: a grant to Dr Nour, both summaries kept. */
  const sherif = person.sherif!;
  const nour = clinician.nour!;
  const amira = clinician.amira!;
  await db.execute(sql`
    INSERT INTO history_grants (person_id, therapist_user_id, organization_id, status, shape, request_note,
                                requested_at, decided_at)
    VALUES (${sherif.id}, ${nour.id}, ${nour.orgId}, 'granted', 'open',
            'Dr Amira referred you to me. May I read her summary so you do not have to start again?',
            ${daysAgo(23).toISOString()}, ${daysAgo(22).toISOString()})`);

  /* One summary per clinician a person saw, in the order they saw them. */
  const lastWith = (therapist: string, patient: string) =>
    [...held].reverse().find((h) => h.therapist === therapist && h.patient === patient)!;
  const records: { patient: string; therapist: string; body: string }[] = [
    {
      patient: "mariam",
      therapist: "karim",
      body: "Work-related anxiety with middle insomnia, maintained by answering her manager's messages late at night. After agreeing response times at work she sleeps through five nights of seven; PHQ-9 12 to 7, GAD-7 13 to 8. Relapse plan in place for quarter close.",
    },
    ...PAIRS.map((pair) => ({ patient: pair.patient, therapist: pair.therapist, body: pair.record })),
  ];
  const version = new Map<string, number>();
  const written = records
    .map((r) => ({ ...r, last: lastWith(r.therapist, r.patient) }))
    .sort((a, b) => a.last.when.getTime() - b.last.when.getTime());
  for (const r of written) {
    const x = person[r.patient]!;
    if (x.p.login === "none") continue;
    const c = clinician[r.therapist]!;
    const v = (version.get(r.patient) ?? 0) + 1;
    version.set(r.patient, v);
    await db.execute(sql`
      INSERT INTO clinical_summaries (person_id, version, body, approved_by_user_id, approved_by_name,
                                      approved_by_credentials, approved_by_license_body, approved_by_license_number,
                                      organization_id, session_id, approved_at)
      VALUES (${x.id}, ${v}, ${r.body}, ${c.id}, ${`Dr ${c.c.first} ${c.c.last}`}, ${c.c.credentials},
              'Egyptian Psychological Association', ${c.c.licence}, ${c.orgId}, ${r.last.id!},
              ${new Date(r.last.when.getTime() + DAY).toISOString()})`);
  }

  /* Homework: each of Mariam's sessions set steps; the older ones are done. */
  for (const [i, h] of mariamSessions.entries()) {
    const done = i < mariamSessions.length - 1;
    for (const step of h.content.patientSteps) {
      await db.execute(sql`
        INSERT INTO homework_items (person_id, session_id, assigned_by_user_id, organization_id, title, source,
                                    status, due_at, completed_at, completed_by_account_id, created_at)
        VALUES (${mariam.id}, ${h.id!}, ${karim.id}, ${karim.orgId}, ${step}, 'therapist',
                ${done ? "done" : "open"}, ${new Date(h.when.getTime() + 7 * DAY).toISOString()},
                ${done ? new Date(h.when.getTime() + 5 * DAY).toISOString() : null},
                ${done ? mariam.accountId : null}, ${new Date(h.when.getTime() + DAY).toISOString()})`);
    }
  }
  /* Everybody else with a login: this week's steps from their latest session. */
  for (const x of Object.values(person)) {
    if (x.p.key === "mariam" || x.p.login !== "event") continue;
    const last = [...held].reverse().find((h) => h.patient === x.p.key);
    if (!last) continue;
    const c = clinician[last.therapist]!;
    for (const step of last.content.patientSteps) {
      await db.execute(sql`
        INSERT INTO homework_items (person_id, session_id, assigned_by_user_id, organization_id, title, source,
                                    status, due_at, created_at)
        VALUES (${x.id}, ${last.id!}, ${c.id}, ${c.orgId}, ${step}, 'therapist', 'open',
                ${new Date(last.when.getTime() + 7 * DAY).toISOString()},
                ${new Date(last.when.getTime() + DAY).toISOString()})`);
    }
  }

  /* Journals, dated between sessions, in their own words. */
  for (const entry of MARIAM_JOURNAL) {
    await db.execute(sql`
      INSERT INTO journals (person_id, account_id, source, body, created_at)
      VALUES (${mariam.id}, ${mariam.accountId}, 'typed', ${entry.body}, ${daysAgo(entry.daysAgo).toISOString()})`);
  }
  for (const [key, days, body] of [
    ["omar", 3, "Went to the grave with my brother. We talked about Dad the whole drive back. First time."],
    ["yara", 6, "Drove to the supermarket and back. Hands shook at the start and then stopped. I did it."],
    ["hazem", 5, "Home for bath time four nights. My mother said the baby sleeps better when I do it."],
    ["ahmed", 8, "Three nights, no beer. The client call on Tuesday was bad and I went to the gym anyway."],
    ["nadine", 2, "Samedi difficile. Ate lunch anyway. Writing it down like Dr Amira asked."],
    ["sherif", 4, "Did not check after lunch today. Or yesterday. Counting the others: nine."],
  ] as const) {
    const x = person[key]!;
    await db.execute(sql`
      INSERT INTO journals (person_id, account_id, source, body, created_at)
      VALUES (${x.id}, ${x.accountId}, 'typed', ${body}, ${daysAgo(days).toISOString()})`);
  }

  /* ------------------------------------------------ PHQ-9 and GAD-7 -- */

  const instruments = await rows(sql`
    SELECT id, key, version, questions FROM instruments
     WHERE key IN ('phq9', 'gad7') AND published_at IS NOT NULL`);
  const mariamChart = chartOf.get("karim:mariam")!;
  /* Item by item, and the last PHQ-9 item, the one about self-harm, is zero both times. */
  const answers: Record<string, number[][]> = {
    phq9: [
      [2, 1, 2, 2, 1, 1, 2, 1, 0],
      [1, 1, 1, 1, 1, 0, 1, 1, 0],
    ],
    gad7: [
      [2, 2, 2, 2, 1, 2, 2],
      [1, 1, 1, 2, 1, 1, 1],
    ],
  };
  let measured = 0;
  for (const instrument of instruments) {
    const key = String(instrument.key);
    const questions = instrument.questions as { key: string }[];
    for (const [round, session] of [
      [0, mariamSessions[0]!],
      [1, mariamSessions[3]!],
    ] as const) {
      const values = answers[key]![round]!;
      if (values.length !== questions.length) {
        throw new Error(`${key} has ${String(questions.length)} questions and the seed has ${String(values.length)} answers`);
      }
      const answeredAt = new Date(session.when.getTime() - 20 * 3_600_000);
      const score = values.reduce((sum, value) => sum + value, 0);
      const assignment = await one<{ id: string }>(sql`
        INSERT INTO assessment_assignments (instrument_id, patient_id, organization_id, assigned_by_user_id,
                                            mode, status, score, instrument_version, started_at, completed_at,
                                            created_at)
        VALUES (${String(instrument.id)}, ${mariamChart}, ${karim.orgId}, ${karim.id}, 'homework', 'completed',
                ${score}, ${Number(instrument.version)}, ${answeredAt.toISOString()},
                ${new Date(answeredAt.getTime() + 4 * 60_000).toISOString()},
                ${new Date(answeredAt.getTime() - 3 * 3_600_000).toISOString()})
        RETURNING id`);
      for (const [i, question] of questions.entries()) {
        await db.execute(sql`
          INSERT INTO assessment_responses (assignment_id, question_key, value, answer_ms, answered_at)
          VALUES (${assignment.id}, ${question.key}, ${values[i]!}, ${4_000 + i * 900},
                  ${new Date(answeredAt.getTime() + i * 20_000).toISOString()})`);
      }
      measured += 1;
    }
  }
  console.log(
    measured > 0
      ? `  Mariam's PHQ-9 and GAD-7: ${String(measured)} answered, 12 to 7 and 13 to 8`
      : "  note: no published PHQ-9 or GAD-7 on this database, so none were answered",
  );

  /* ---------------------------------------------- her standing profile -- */

  /*
   * 🔴 WRITTEN, NOT GENERATED, AND EVERY REFERENCE RESOLVES.
   *
   * `regenerateProfile` calls a model, which a seed must not spend money on. So the
   * profile is written the way that function stores one: sections whose body
   * carries the markers, and `refs` naming real lines. `S<n>` numbers her sessions
   * oldest first by `created_at`, exactly as `gather()` does, and `refTo` finds each
   * line by its words rather than trusting a typed number.
   */
  const sections = MARIAM_PROFILE.map((section) => {
    const parts = section.parts.map((part) => ({ ...part, ...refTo(part.session, part.quote) }));
    return {
      heading: section.heading,
      body: parts.map((part) => `${part.text} [${part.ref}]`).join(" "),
      refs: parts.map((part) => part.ref),
    };
  });
  const mariamSessionCount = await one<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM sessions s JOIN patients p ON p.id = s.patient_id WHERE p.person_id = ${mariam.id}`);
  await db.execute(sql`
    INSERT INTO person_profiles (person_id, sections, session_count, document_count, conflicts, model, generated_at)
    VALUES (${mariam.id}, ${JSON.stringify(sections)}::jsonb, ${Number(mariamSessionCount.n)}, 0, '[]'::jsonb, 'seed',
            ${new Date(mariamSessions[3]!.when.getTime() + 2 * 3_600_000).toISOString()})`);
  for (const o of MARIAM_OBSERVATIONS) {
    const { ref } = refTo(o.session, o.quote);
    const h = mariamSessions[o.session - 1]!;
    await db.execute(sql`
      INSERT INTO observations (person_id, observed_at, text, source, source_id, ref)
      VALUES (${mariam.id}, ${h.when.toISOString()}, ${o.text}, 'session', ${h.id!}, ${ref})`);
  }

  /* --------------------------------------------------- the copilot -- */

  {
    const h = mariamSessions[MARIAM_COPILOT.session - 1]!;
    const { index } = refTo(MARIAM_COPILOT.session, MARIAM_COPILOT.quote);
    const segment = await one<{ start: number }>(sql`
      SELECT start_ms AS start FROM transcript_segments WHERE session_id = ${h.id!} AND sequence = ${index + 1}`);
    const asked = daysAgo(2);
    const thread = await one<{ id: string }>(sql`
      INSERT INTO copilot_threads (patient_id, organization_id, therapist_id, reply_language, last_message_at, created_at)
      VALUES (${mariamChart}, ${karim.orgId}, ${karim.id}, 'en', ${asked.toISOString()}, ${asked.toISOString()})
      RETURNING id`);
    await db.execute(sql`
      INSERT INTO copilot_messages (thread_id, role, content, session_id, created_at)
      VALUES (${thread.id}, 'therapist', ${MARIAM_COPILOT.question}, ${h.id!}, ${asked.toISOString()})`);
    await db.execute(sql`
      INSERT INTO copilot_messages (thread_id, role, content, citations, session_id, created_at)
      VALUES (${thread.id}, 'assistant', ${MARIAM_COPILOT.answer},
              ${JSON.stringify([
                {
                  sessionId: h.id!,
                  sessionDate: h.when.toISOString(),
                  sequence: index + 1,
                  speaker: h.lines[index]!.speaker,
                  quote: h.lines[index]!.text,
                  atSeconds: Math.floor(Number(segment.start) / 1000),
                },
              ])}::jsonb,
              ${h.id!}, ${new Date(asked.getTime() + 8_000).toISOString()})`);
  }

  /* -------------------------------------------------------- partner -- */

  const partner = await one<{ id: string }>(sql`
    INSERT INTO partners (name, slug, state, contact_name, contact_email, intent, created_at)
    VALUES ('Helio Health', ${EVENT.partnerSlug}, 'active', 'Rami Helmy', ${EVENT.helio},
            'Bring therapy records into our employee wellbeing app, with the patient''s consent.',
            ${daysAgo(30).toISOString()})
    RETURNING id`);
  const partnerUser = await one<{ id: string }>(sql`
    INSERT INTO partner_users (partner_id, email, name, role, password_hash)
    VALUES (${partner.id}, ${EVENT.helio}, 'Rami Helmy', 'developer', ${hash})
    RETURNING id`);
  const { mintKey } = await import("../lib/partner/keys");
  const minted = await mintKey({
    partnerId: partner.id,
    label: "Sandbox",
    scopes: ["record:read", "session:write"],
    environment: "sandbox",
    sponsorId: null,
    byPartnerUserId: partnerUser.id,
  });
  if (!minted.key) throw new Error(`the sandbox key was not minted: ${minted.error ?? "?"}`);

  /* ---------------------------------------------- what HR sees first -- */

  /*
   * HR opening the portal is what publishes a balance: `potBalance` republishes
   * once enough sessions have passed since the last figure. Called once here, as
   * the portal would, so the first screen Dalia sees is a figure and not
   * "not enough activity yet".
   */
  const { potBalance } = await import("../lib/data/sponsors");
  for (const sponsor of [foundry, pharma]) await potBalance(sponsor.id);

  /*
   * 🔴 AND NOTHING WAS LEFT IN TODAY BY ACCIDENT. The only money written today
   * should be the bookings ahead; anything else is a leg the dating missed, and
   * a company's chart would show a month of spend in this week.
   */
  const stray = await one<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM ledger_entries l
     WHERE l.created_at >= ${seedStart.toISOString()}
       AND NOT EXISTS (
         SELECT 1 FROM ledger_entries m
          WHERE m.txn_id = l.txn_id
            AND m.ref_id IN (SELECT id FROM session_payments
                              WHERE session_id IN (SELECT id FROM sessions WHERE status = 'scheduled')
                             UNION SELECT id FROM sessions WHERE status = 'scheduled'))`);
  console.log(`  ledger legs left in today that are not a booking: ${String(stray.n)}`);

  /*
   * 🔴 THE MESSAGES THE HISTORY WOULD HAVE SENT, KEPT AND THEN DROPPED.
   *
   * Each confirmed transfer above told its payer, and `SIMULATION_RUNNING` kept
   * every one in `sim_outbox` rather than sending it. They describe payments dated
   * weeks ago as if they happened this minute, so they are removed: only rows
   * written since this seed began, and only to this cast's own addresses and
   * numbers, so nothing anybody else was sent is touched.
   */
  const ours = [
    ...PEOPLE.flatMap((x) => [x.email, x.phone]),
    ...CLINICIANS.map((c) => c.email),
    EVENT.dalia,
    EVENT.nilePharmaHr,
    EVENT.hana,
    EVENT.helio,
  ].map((address) => address.toLowerCase());
  const dropped = await rows(sql`
    DELETE FROM sim_outbox
     WHERE created_at >= ${seedStart.toISOString()}
       AND to_address = ANY(${sql.raw(`ARRAY[${ours.map((a) => `'${a.replace(/'/g, "''")}'`).join(",")}]::text[]`)})
    RETURNING id`);
  console.log(`  ${String(dropped.length)} kept messages from the seeded history removed from the outbox`);

  /* ======================================================================== */
  /*  what to hand out                                                         */
  /* ======================================================================== */

  console.log(`\n🔴 Seeded: event. One password for every event login: ${EVENT_PASSWORD}`);
  console.log("   The console and the support account keep DEMO_PRIVATE_PASSWORD and are not in this list.\n");
  for (const login of EVENT_LOGINS) {
    console.log(`  ${login.who.padEnd(28)} ${`${SITE}${login.where}`.padEnd(40)} ${login.email}`);
  }
  console.log(`\n  Cairo Foundry joining code: ${foundry.code}`);
  console.log(`  Nile Pharma joining code:   ${pharma.code}`);
  console.log(`  Hoda Ibrahim (${EVENT.unclaimed}) has a record on Dr Salma's list and no account.`);
  console.log("\n  🔴 Helio Health's sandbox key, shown once and stored only as a hash. Hand it over, never commit it:");
  console.log(`     ${minted.key.raw}`);
  console.log("\n  then: npm run on:production -- verify:event-demo\n");
}
