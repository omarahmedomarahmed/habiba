/**
 * Demonstration clinicians — seed and purge.
 *
 *   npm run demo:seed    create them, print the logins
 *   npm run demo:purge   delete them and everything they touched
 *
 * These are real accounts. They can be signed into, they appear on the public
 * radar, and a stranger can book one. That is the point — a radar with nobody
 * on it demonstrates nothing — but it means the purge has to be as real as the
 * seed, so it deletes the whole tenant rather than hiding it.
 *
 * They carry `therapist_radar.demo = true`, which exempts them from the
 * heartbeat expiry (nobody is holding a browser open for a fixture) and makes
 * them countable separately in admin. Nothing else in the product sets that
 * column.
 */

import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

// The real hasher, not a copy of it. A second implementation here would drift
// from the one that verifies at login, and the failure mode is a fixture
// account nobody can sign into.
import { hashPassword } from "../lib/auth/password";
import { connect, schema } from "./db";

/** One shared password. They are fixtures on a demo tenant, not secrets. */
const PASSWORD = process.env.DEMO_PASSWORD ?? "Radar-Demo-2026!";
const DOMAIN = "demo.24therapy.app";

type Fixture = {
  first: string;
  last: string;
  country: string;
  region: string;
  city: string;
  lat?: string;
  lon?: string;
  practice?: string;
  walkIns?: boolean;
  languages: string[];
  specialties: string[];
  credentials: string;
  headline: string;
  rate: number;
  status: "online" | "in_session" | "offline";
};

/**
 * Chosen to make the globe tell a story at a glance: three in the UAE and two
 * in Egypt so the region the pitch is about is visibly busy, then enough of the
 * rest of the world that spinning it is worth doing.
 */
const FIXTURES: Fixture[] = [
  {
    first: "Layla", last: "Mansour", country: "AE", region: "Dubai", city: "Dubai",
    lat: "25.1972", lon: "55.2744", practice: "Jumeirah Psychology Clinic", walkIns: true,
    languages: ["Arabic", "English"], specialties: ["Anxiety", "Work stress & burnout", "Relationships"],
    credentials: "PsyD, CDA-licensed", headline: "Bilingual CBT. I keep a half hour free most evenings.",
    rate: 6500, status: "online",
  },
  {
    first: "Rashid", last: "Al Habtoor", country: "AE", region: "Abu Dhabi", city: "Abu Dhabi",
    lat: "24.4539", lon: "54.3773", practice: "Corniche Counselling", walkIns: true,
    languages: ["Arabic", "English", "Urdu"], specialties: ["Trauma & PTSD", "Grief & loss"],
    credentials: "MSc, DoH Abu Dhabi", headline: "Trauma-focused work. Arabic, English or Urdu.",
    rate: 7000, status: "online",
  },
  {
    first: "Priya", last: "Nair", country: "AE", region: "Sharjah", city: "Sharjah",
    languages: ["English", "Hindi"], specialties: ["Depression", "Panic attacks"],
    credentials: "MA Clinical Psychology", headline: "Evenings and weekends, no waiting list.",
    rate: 5000, status: "in_session",
  },
  {
    first: "Habiba", last: "Farouk", country: "EG", region: "Cairo Governorate", city: "Cairo",
    lat: "30.0629", lon: "31.2196", practice: "Nile Psychology Centre", walkIns: true,
    languages: ["Arabic", "English", "French"], specialties: ["Anxiety", "Trauma & PTSD", "Postnatal"],
    credentials: "PhD, Egyptian Psychologists Syndicate",
    headline: "Fifteen years in Cairo. I answer within a minute when I am on.",
    rate: 3000, status: "online",
  },
  {
    first: "Omar", last: "Shafik", country: "EG", region: "Giza Governorate", city: "Giza",
    languages: ["Arabic"], specialties: ["Addiction", "Family conflict"],
    credentials: "MSc Clinical Psychology", headline: "Addiction and family work, in Arabic.",
    rate: 2500, status: "online",
  },
  {
    first: "Sarah", last: "Whitfield", country: "GB", region: "England", city: "London",
    lat: "51.5155", lon: "-0.1418", practice: "Marylebone Therapy Rooms", walkIns: false,
    languages: ["English"], specialties: ["OCD", "Anxiety", "Sleep"],
    credentials: "DClinPsy, HCPC registered", headline: "OCD specialist. Between-appointment slots.",
    rate: 8000, status: "online",
  },
  {
    first: "Marc", last: "Lefevre", country: "FR", region: "Île-de-France", city: "Paris",
    languages: ["French", "English"], specialties: ["Relationships", "Grief & loss"],
    credentials: "Psychologue clinicien", headline: "Couples and bereavement work.",
    rate: 6000, status: "online",
  },
  {
    first: "Ana", last: "Ribeiro", country: "BR", region: "São Paulo", city: "São Paulo",
    languages: ["Portuguese", "Spanish"], specialties: ["Panic attacks", "Depression"],
    credentials: "CRP registered", headline: "Panic and mood work, Portuguese or Spanish.",
    rate: 2000, status: "online",
  },
  {
    first: "Tom", last: "Alvarez", country: "US", region: "California", city: "Los Angeles",
    languages: ["English", "Spanish"], specialties: ["Addiction", "Identity & LGBTQ+"],
    credentials: "LMFT #12849", headline: "Late nights Pacific time.",
    rate: 9000, status: "online",
  },
  {
    first: "Ayesha", last: "Khan", country: "PK", region: "Sindh", city: "Karachi",
    languages: ["Urdu", "English"], specialties: ["Anxiety", "Family conflict"],
    credentials: "MS Clinical Psychology", headline: "Urdu and English, most afternoons.",
    rate: 1500, status: "online",
  },
  {
    first: "Kenji", last: "Sato", country: "JP", region: "Tokyo", city: "Tokyo",
    languages: ["Japanese", "English"], specialties: ["Work stress & burnout", "Sleep"],
    credentials: "Certified Public Psychologist", headline: "Burnout and sleep, Tokyo hours.",
    rate: 7500, status: "offline",
  },
  {
    first: "Amara", last: "Okafor", country: "NG", region: "Lagos", city: "Lagos",
    languages: ["English"], specialties: ["Trauma & PTSD", "Grief & loss"],
    credentials: "MSc, NAP registered", headline: "Trauma work, West Africa time.",
    rate: 1200, status: "online",
  },
];

async function seed() {
  const { pool, db } = connect();
  const passwordHash = await hashPassword(PASSWORD);
  const created: { email: string; name: string; country: string; status: string }[] = [];

  try {
    for (const fixture of FIXTURES) {
      const email = `${fixture.first.toLowerCase()}.${fixture.last
        .toLowerCase()
        .replace(/[^a-z]/g, "")}@${DOMAIN}`;

      const [org] = await db
        .insert(schema.organizations)
        .values({
          name: `${fixture.first} ${fixture.last}`,
          slug: `demo-${fixture.first}-${fixture.last}`.toLowerCase().replace(/[^a-z-]/g, ""),
          settings: { demo: true },
        })
        .onConflictDoNothing()
        .returning({ id: schema.organizations.id });

      // Re-running the seed must not create a second copy of everyone.
      if (!org) {
        console.log(`· ${email} already seeded`);
        continue;
      }

      const [user] = await db
        .insert(schema.users)
        .values({
          organizationId: org.id,
          email,
          passwordHash,
          firstName: fixture.first,
          lastName: fixture.last,
          role: "therapist",
          verificationStatus: "verified",
          sessionRateCents: fixture.rate,
          // Charges stay off: these accounts have no Stripe account behind
          // them, so the radar shows them as free rather than quoting a price
          // nobody can pay. `rate` is still set so the admin view has numbers.
          chargesEnabled: false,
          profile: { credentials: fixture.credentials, alertOnView: true, alertOnBooking: true },
        })
        .returning({ id: schema.users.id });

      await db
        .insert(schema.subscriptions)
        .values({ organizationId: org.id, plan: "payg", status: "active" });

      await db.insert(schema.therapistVerifications).values({
        userId: user!.id,
        organizationId: org.id,
        state: "approved",
        country: fixture.country,
        licenseNumber: "DEMO-" + randomBytes(3).toString("hex").toUpperCase(),
        specialties: fixture.specialties,
        languages: fixture.languages,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      });

      await db.insert(schema.therapistRadar).values({
        userId: user!.id,
        organizationId: org.id,
        status: fixture.status,
        demo: true,
        headline: fixture.headline,
        languages: fixture.languages,
        specialties: fixture.specialties,
        country: fixture.country,
        region: fixture.region,
        city: fixture.city,
        practiceName: fixture.practice ?? null,
        practiceAddress: fixture.practice
          ? `${fixture.practice}, ${fixture.city}, ${fixture.region}`
          : null,
        practiceLat: fixture.lat ?? null,
        practiceLon: fixture.lon ?? null,
        practiceConfirmedAt: fixture.practice ? new Date() : null,
        acceptsWalkIns: Boolean(fixture.walkIns),
        lastSeenAt: new Date(),
      });

      created.push({
        email,
        name: `${fixture.first} ${fixture.last}`,
        country: fixture.country,
        status: fixture.status,
      });
    }
  } finally {
    await pool.end();
  }

  console.log(`\nSeeded ${created.length} demonstration clinicians.\n`);
  console.log("email".padEnd(42), "name".padEnd(20), "country", " status");
  console.log("-".repeat(88));
  for (const row of created) {
    console.log(row.email.padEnd(42), row.name.padEnd(20), row.country.padEnd(7), row.status);
  }
  console.log(`\npassword for all of them: ${PASSWORD}`);
  console.log("purge with: npm run demo:purge\n");
}

/**
 * Delete the demonstration tenants outright.
 *
 * Ordered by foreign key, not by cascade, because most of the clinical tables
 * are `ON DELETE restrict` on purpose — a therapy record should not vanish
 * because someone removed a user. That protection is right, and it means the
 * purge has to be explicit about what it is destroying.
 *
 * Also sweeps up accounts the browser tests leave behind, which is where the
 * pile of identical `e2e-…@example.com` clinicians in the admin list came from.
 */
async function purge() {
  const { pool, db } = connect();

  try {
    const orgs = await db.execute(sql`
      SELECT DISTINCT u.organization_id AS id
      FROM users u
      LEFT JOIN therapist_radar r ON r.user_id = u.id
      WHERE r.demo = true
         OR u.email LIKE '%@${sql.raw(DOMAIN)}'
         OR u.email LIKE 'e2e-%@example.com'
         OR u.email LIKE 'repro-%@example.com'
    `);

    const ids = (orgs.rows as { id: string }[]).map((row) => row.id);
    if (ids.length === 0) {
      console.log("Nothing to purge.");
      return;
    }

    const list = sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    // Deepest first. Each of these is a real foreign key that would otherwise
    // refuse the delete, which is the behaviour we want everywhere except here.
    for (const statement of [
      sql`DELETE FROM session_payments WHERE session_id IN (SELECT id FROM sessions WHERE organization_id IN (${list}))`,
      sql`DELETE FROM transcript_segments WHERE organization_id IN (${list})`,
      sql`DELETE FROM session_notes WHERE organization_id IN (${list})`,
      sql`DELETE FROM risk_assessments WHERE organization_id IN (${list})`,
      sql`DELETE FROM copilot_messages WHERE thread_id IN (SELECT id FROM copilot_threads WHERE organization_id IN (${list}))`,
      sql`DELETE FROM copilot_threads WHERE organization_id IN (${list})`,
      sql`DELETE FROM data_exports WHERE organization_id IN (${list})`,
      sql`DELETE FROM sessions WHERE organization_id IN (${list})`,
      sql`DELETE FROM patients WHERE organization_id IN (${list})`,
      sql`DELETE FROM therapist_radar WHERE organization_id IN (${list})`,
      sql`DELETE FROM therapist_verifications WHERE organization_id IN (${list})`,
      sql`DELETE FROM invoices WHERE organization_id IN (${list})`,
      sql`DELETE FROM subscriptions WHERE organization_id IN (${list})`,
      sql`DELETE FROM ai_request_logs WHERE organization_id IN (${list})`,
      sql`DELETE FROM audit_log WHERE organization_id IN (${list})`,
      sql`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id IN (${list}))`,
      sql`DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id IN (${list}))`,
      sql`DELETE FROM auth_tokens WHERE user_id IN (SELECT id FROM users WHERE organization_id IN (${list}))`,
      sql`DELETE FROM users WHERE organization_id IN (${list})`,
      sql`DELETE FROM organizations WHERE id IN (${list})`,
    ]) {
      await db.execute(statement);
    }

    console.log(`Purged ${ids.length} demonstration and test tenants.`);
  } finally {
    await pool.end();
  }
}

const command = process.argv[2];
const run =
  command === "purge" ? purge : command === "seed" ? seed : null;

if (!run) {
  console.error("usage: tsx scripts/demo.ts <seed|purge>");
  process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
