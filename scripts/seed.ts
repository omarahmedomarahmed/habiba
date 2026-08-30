/**
 * Seed script. Idempotent — safe to re-run on every deploy.
 *
 *   npm run db:seed            org + super admin + published public pages
 *   npm run db:seed -- --demo  …plus a test therapist, test patient and one
 *                              completed demo session with an approved note
 *
 * The demo data is behind a flag on purpose so that a production deploy can run
 * the seed without quietly creating a login with a documented password.
 */
import { eq, sql } from "drizzle-orm";

import { hashPassword, validatePassword } from "../lib/auth/password";
import { DEFAULT_PAGES } from "../lib/content/defaults";
import { connect, schema } from "./db";

const {
  organizations,
  users,
  patients,
  sessions,
  transcriptSegments,
  sessionNotes,
  subscriptions,
  contentPages,
} = schema;

const DEMO = process.argv.includes("--demo");
/**
 * Overwrite CMS pages with the built-in definitions.
 *
 * Off by default because a re-run must never silently revert an admin's edits.
 * Pass it when the shipped content itself has changed and you want it live.
 */
const REFRESH_CONTENT = process.argv.includes("--refresh-content");

const ORG_NAME = process.env.SEED_ORG_NAME || "24Therapy";
const ORG_SLUG = process.env.SEED_ORG_SLUG || "24therapy";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const TEST_EMAIL = process.env.SEED_TEST_EMAIL || "test@24therapy.ai";
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "TestTherapist2026!";

const DEMO_TRANSCRIPT: { speaker: "therapist" | "patient"; text: string }[] = [
  { speaker: "therapist", text: "Good to see you. How has the week been since we last spoke?" },
  { speaker: "patient", text: "Honestly, harder than I expected. The sleep thing came back." },
  { speaker: "therapist", text: "Tell me about the sleep. Is it falling asleep, or staying asleep?" },
  { speaker: "patient", text: "Staying asleep. I wake around three and then my head just starts going." },
  { speaker: "patient", text: "It is mostly work. There is a review coming up and I keep rehearsing it." },
  { speaker: "therapist", text: "So the rehearsing starts once you are already awake, rather than keeping you up at the start." },
  { speaker: "patient", text: "Right. And then I am exhausted all day, which makes the worrying worse." },
  { speaker: "therapist", text: "That loop makes sense. Did you get a chance to try the wind-down routine we talked about?" },
  { speaker: "patient", text: "Twice. The nights I did it I got back to sleep faster, actually." },
  { speaker: "therapist", text: "That is worth noticing. Two out of seven, and both were better." },
  { speaker: "patient", text: "I did not really connect those. I think I assumed nothing was working." },
  { speaker: "therapist", text: "Let us build on that. Before next week, can we aim for four nights?" },
];

const DEMO_NOTE = {
  soap: {
    subjective:
      "Patient reports a return of middle-insomnia over the past week, waking around 03:00 with ruminative thinking focused on an upcoming performance review. Describes a self-reinforcing loop between daytime fatigue and anticipatory worry. Reports partial adherence to the agreed wind-down routine (2 of 7 nights) with subjectively faster return to sleep on both occasions.",
    objective:
      "Alert, oriented and engaged throughout. Affect mildly constricted, congruent with reported mood. Speech normal in rate and volume. No psychomotor agitation observed. Insight intact; patient was able to revise an initial global appraisal ('nothing is working') when presented with their own data.",
    assessment:
      "Recurrence of anxiety-driven sleep disruption in the context of an identifiable, time-limited work stressor. Presentation is consistent with the previously established formulation rather than a new or escalating process. Adherence, not strategy, appears to be the limiting factor. No indicators of risk elicited or observed.",
    plan: "Increase wind-down routine target to four nights before next session and record which nights were completed. Continue cognitive work on catastrophic appraisal of the review. Review sleep pattern at next session and reassess if middle-insomnia persists beyond the review date.",
  },
  summary:
    "Follow-up session addressing a one-week recurrence of middle-insomnia linked to anticipatory work anxiety. Partial adherence to the sleep intervention produced a measurable improvement the patient had not registered; session focused on making that evidence visible and raising the adherence target.",
  talkingPoints: [
    "Middle-insomnia recurrence, waking ~03:00 with rumination",
    "Upcoming performance review as the identifiable stressor",
    "Fatigue and worry operating as a reinforcing loop",
    "Wind-down routine used 2 of 7 nights, both with better outcomes",
    "Patient revised a global negative appraisal when shown their own data",
  ],
  observations:
    "Engaged and collaborative. Responded well to being shown the discrepancy between reported outcome and actual data. Mild fatigue evident but did not impair participation.",
  impressions:
    "Consistent with the existing formulation of anxiety-maintained sleep disruption. No evidence of a new process. Impressions only — for clinician review, not a diagnosis.",
  recommendations: [
    "Raise wind-down routine target to four nights per week with a simple written record",
    "Continue cognitive restructuring around performance-review catastrophising",
    "Reassess sleep pattern after the review date before considering any change in approach",
  ],
  followUp: "One week",
  patientBrief:
    "We spent most of today on the nights you have been having, and on how much of the day gets spent bracing for the next bad one. You put it into words really clearly.\n\nThe part worth holding on to: on the two nights you did the wind-down, you slept better. You had written both of those off as flukes until we lined them up.",
  patientSteps: [
    "Screens down an hour before bed, four nights this week — pick the nights now rather than deciding each evening.",
    "Get up at the same time even after a bad night. This is the one that does the most work and feels the most pointless.",
    "Jot down roughly when you fell asleep and when you woke. Not a diary, just two times.",
  ],
  patientNext:
    "Same time next week, and bring the times you wrote down. If the review lands earlier than expected and the nights get heavier, message to move it sooner.",
};

async function main() {
  const { pool, db } = connect();

  try {
    // ---------------------------------------------------------- organisation
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, ORG_SLUG))
      .limit(1);

    const org =
      existingOrg[0] ??
      (
        await db
          .insert(organizations)
          .values({ name: ORG_NAME, slug: ORG_SLUG })
          .returning()
      )[0]!;

    console.log(`org: ${org.name} (${org.slug})`);

    await db
      .insert(subscriptions)
      .values({ organizationId: org.id, plan: "unlimited", status: "active" })
      .onConflictDoNothing({ target: subscriptions.organizationId });

    // ----------------------------------------------------------- super admin
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const problem = validatePassword(ADMIN_PASSWORD);
      if (problem) {
        console.error(`SEED_ADMIN_PASSWORD rejected: ${problem}`);
        process.exit(1);
      }
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await db
        .insert(users)
        .values({
          organizationId: org.id,
          email: ADMIN_EMAIL.toLowerCase(),
          passwordHash,
          firstName: process.env.SEED_ADMIN_FIRST || "Super",
          lastName: process.env.SEED_ADMIN_LAST || "Admin",
          role: "super_admin",
          verificationStatus: "verified",
        })
        .onConflictDoUpdate({
          target: [users.organizationId, users.email],
          targetWhere: sql`deleted_at IS NULL`,
          set: { passwordHash, role: "super_admin", status: "active" },
        });
      console.log(`super admin: ${ADMIN_EMAIL}`);
    } else {
      console.log(
        "super admin: skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)",
      );
    }

    // ------------------------------------------------------------- CMS pages
    for (const page of DEFAULT_PAGES) {
      await db
        .insert(contentPages)
        .values({
          slug: page.slug,
          title: page.title,
          description: page.description,
          layout: page.layout,
          navLabel: page.navLabel,
          navOrder: page.navOrder,
          blocks: page.blocks,
          status: "published",
          publishedAt: new Date(),
        })
        // Re-running the seed must not silently revert an admin's edits.
        .onConflictDoUpdate({
          target: contentPages.slug,
          set: REFRESH_CONTENT
            ? {
                title: page.title,
                description: page.description,
                layout: page.layout,
                navLabel: page.navLabel,
                navOrder: page.navOrder,
                blocks: page.blocks,
                status: "published",
                publishedAt: new Date(),
                updatedAt: new Date(),
              }
            : // No-op update: leaves an admin's edits exactly as they are.
              { slug: page.slug },
        });
    }
    console.log(
      `content pages: ${DEFAULT_PAGES.length} ${REFRESH_CONTENT ? "refreshed from defaults" : "ensured (existing edits preserved)"}`,
    );

    if (!DEMO) {
      console.log("\nDone. Re-run with --demo to add a test therapist and patient.");
      return;
    }

    // ---------------------------------------------------------- demo account
    const problem = validatePassword(TEST_PASSWORD);
    if (problem) {
      console.error(`SEED_TEST_PASSWORD rejected: ${problem}`);
      process.exit(1);
    }
    const testHash = await hashPassword(TEST_PASSWORD);
    await db
      .insert(users)
      .values({
        organizationId: org.id,
        email: TEST_EMAIL.toLowerCase(),
        passwordHash: testHash,
        firstName: "Test",
        lastName: "Therapist",
        role: "therapist",
        verificationStatus: "verified",
        profile: { credentials: "LCSW", licenseState: "NY", timezone: "America/New_York" },
      })
      .onConflictDoUpdate({
        target: [users.organizationId, users.email],
        targetWhere: sql`deleted_at IS NULL`,
        set: { passwordHash: testHash, role: "therapist", status: "active" },
      });

    const therapist = (
      await db
        .select()
        .from(users)
        .where(eq(users.email, TEST_EMAIL.toLowerCase()))
        .limit(1)
    )[0]!;
    console.log(`test therapist: ${TEST_EMAIL}`);

    const existingPatient = await db
      .select()
      .from(patients)
      .where(eq(patients.email, "patient@test.24therapy.ai"))
      .limit(1);

    const patient =
      existingPatient[0] ??
      (
        await db
          .insert(patients)
          .values({
            organizationId: org.id,
            therapistId: therapist.id,
            firstName: "Test",
            lastName: "Patient",
            email: "patient@test.24therapy.ai",
            source: "therapist",
            clinical: {
              diagnoses: ["Generalised anxiety disorder"],
              goals: ["Improve sleep continuity", "Reduce anticipatory worry"],
            },
          })
          .returning()
      )[0]!;
    console.log(`test patient: ${patient.firstName} ${patient.lastName}`);

    // -------------------------------------------------- one completed session
    const already = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.patientId, patient.id))
      .limit(1);

    if (already.length > 0) {
      console.log("demo session: already present, skipping");
    } else {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - 50 * 60 * 1000);

      const session = (
        await db
          .insert(sessions)
          .values({
            organizationId: org.id,
            therapistId: therapist.id,
            patientId: patient.id,
            modality: "in_person",
            status: "completed",
            startedAt,
            endedAt,
            durationMinutes: 50,
            noteStatus: "ready",
          })
          .returning()
      )[0]!;

      await db.insert(transcriptSegments).values(
        DEMO_TRANSCRIPT.map((seg, i) => ({
          sessionId: session.id,
          organizationId: org.id,
          sequence: i + 1,
          speaker: seg.speaker,
          text: seg.text,
          startMs: i * 8000,
          endMs: (i + 1) * 8000,
        })),
      );

      await db.insert(sessionNotes).values({
        sessionId: session.id,
        organizationId: org.id,
        therapistId: therapist.id,
        patientId: patient.id,
        content: DEMO_NOTE,
        status: "approved",
        approvedAt: endedAt,
        approvedBy: therapist.id,
        model: "seed",
      });

      await db
        .update(patients)
        .set({ lastSessionAt: endedAt })
        .where(eq(patients.id, patient.id));

      console.log("demo session: 1 completed session with transcript and approved note");
    }

    console.log("\nDemo credentials");
    console.log(`  therapist  ${TEST_EMAIL} / ${TEST_PASSWORD}`);
    if (ADMIN_EMAIL) console.log(`  admin      ${ADMIN_EMAIL} / (SEED_ADMIN_PASSWORD)`);
  } catch (error) {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
