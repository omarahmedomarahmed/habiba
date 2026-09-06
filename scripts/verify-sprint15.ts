/**
 * Sprint 15 acceptance — the patient app. PLAN.md 15.1–15.8, C16.
 *
 *   npm run verify:sprint15
 *
 * 15.8 is the ticket that matters: **a patient never sees a transcript or a
 * clinical note, enforced server-side.** A screen that "just doesn't render"
 * one is a prop away from rendering it, so the enforcement is the select list
 * of one query — and this asserts on the *shape of what comes back*, because a
 * component can only leak what it was handed.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  patients,
  people,
  sessionNotes,
  sessions,
  transcriptSegments,
  users,
} from "../lib/db/schema";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const SECRET = "THE-PATIENT-MUST-NEVER-SEE-THIS";

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  try {
    const [therapist] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .limit(1);
    if (!therapist) {
      check("15 a clinician exists", false);
      return;
    }

    const [person] = await db
      .insert(people)
      .values({ firstName: "verify15", phone: "+201500000001" })
      .returning({ id: people.id });

    const [patient] = await db
      .insert(patients)
      .values({
        organizationId: therapist.organizationId,
        therapistId: therapist.id,
        firstName: "verify15",
        personId: person!.id,
        phone: "+201500000001",
        source: "therapist",
      })
      .returning({ id: patients.id });

    const [session] = await db
      .insert(sessions)
      .values({
        organizationId: therapist.organizationId,
        therapistId: therapist.id,
        patientId: patient!.id,
        status: "completed",
        modality: "video",
        guestName: "verify15",
        feedbackToken: "verify15-token",
        scheduledAt: new Date(Date.now() - 48 * 3_600_000),
        endedAt: new Date(Date.now() - 47 * 3_600_000),
      })
      .returning({ id: sessions.id });

    /*
     * A note whose EVERY clinical field carries a sentinel, plus a transcript
     * line carrying the same. If any of it reaches the patient's query, the
     * string appears in the JSON and the check below fails.
     */
    await db.insert(sessionNotes).values({
      sessionId: session!.id,
      organizationId: therapist.organizationId,
      patientId: patient!.id,
      therapistId: therapist.id,
      status: "approved",
      patientStatus: "approved",
      content: {
        soap: {
          subjective: SECRET,
          objective: SECRET,
          assessment: SECRET,
          plan: SECRET,
        },
        summary: SECRET,
        talkingPoints: [SECRET],
        observations: SECRET,
        impressions: SECRET,
        recommendations: [SECRET],
        followUp: SECRET,
        patientBrief: "You said you would try going to bed earlier.",
        patientSteps: [],
        patientNext: "",
      },
    });

    await db.insert(transcriptSegments).values({
      sessionId: session!.id,
      organizationId: therapist.organizationId,
      speaker: "patient",
      sequence: 1,
      text: SECRET,
      startMs: 0,
      endMs: 1000,
    });

    /* -------------------------------------------------------------- 15.8 */

    const { sessionsForPatient, groupOf } = await import("../lib/data/patient-view");
    const rows = await sessionsForPatient(person!.id);

    check("15.3 the patient's own session comes back", rows.length === 1, `${rows.length} rows`);

    /*
     * 🔴 The whole of 15.8, in one assertion: serialise everything the data
     * layer hands the screen and look for the sentinel. A component cannot
     * render what it was never given.
     */
    const payload = JSON.stringify(rows);
    check(
      "🔴 15.8 NOTHING clinical reaches the patient's query — not the SOAP, the summary, the impressions, or a transcript line",
      !payload.includes(SECRET),
      payload.includes(SECRET) ? "THE SENTINEL LEAKED" : "sentinel absent from every field",
    );

    /*
     * 🔴 The control. C84's lesson: a check that has never failed has not been
     * shown to work. Here is a query of the shape somebody WILL write next —
     * the same join, one column wider — run through the identical assertion.
     * If the sentinel does not surface here, the check above is a false green
     * and proves nothing about the query it guards.
     */
    const widened = await db
      .select({ id: sessions.id, content: sessionNotes.content })
      .from(sessions)
      .innerJoin(patients, eq(patients.id, sessions.patientId))
      .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
      .where(eq(patients.personId, person!.id));
    check(
      "🔴 15.8 CONTROL — the same assertion CATCHES a query one column wider",
      JSON.stringify(widened).includes(SECRET),
      JSON.stringify(widened).includes(SECRET)
        ? "the sentinel surfaces, so the check above has teeth"
        : "THE CHECK IS A FALSE GREEN — it cannot see a leak",
    );

    check(
      "15.4 …but the brief written TO them, signed by their clinician, does",
      rows[0]?.brief?.includes("bed earlier") === true,
      String(rows[0]?.brief),
    );

    /*
     * And the shape itself, so a future widening fails here rather than
     * shipping. Same technique as 10.2's roster key set.
     */
    const keys = rows[0] ? Object.keys(rows[0]).sort().join(",") : "";
    check(
      "🔴 15.8 the row has no field that COULD hold a clinical sentence",
      keys ===
        "at,brief,briefPending,group,id,modality,paymentStatus,priceCents,therapistName",
      keys,
    );

    /* ------------------------------------------- 15.4 the unsigned draft */

    await db
      .update(sessionNotes)
      .set({ patientStatus: "draft" })
      .where(eq(sessionNotes.sessionId, session!.id));

    const unsigned = await sessionsForPatient(person!.id);
    check(
      "🔴 15.4 an UNSIGNED brief is withheld — a draft is a machine's first attempt",
      unsigned[0]?.brief === null && unsigned[0]?.briefPending === true,
      `brief=${unsigned[0]?.brief === null ? "null" : "present"}`,
    );

    /* --------------------------------------------------- 15.3 the groups */

    const now = Date.now();
    check(
      "15.3 a booked session an hour away is today's, not upcoming",
      groupOf({ at: new Date(now + 3_600_000), now, scheduled: true, fromRadar: false }) ===
        "today",
    );
    check(
      "15.3 a booked session next week is upcoming",
      groupOf({ at: new Date(now + 7 * 86_400_000), now, scheduled: true, fromRadar: false }) ===
        "upcoming",
    );
    check(
      "15.3 a past booked session and a past radar session are DIFFERENT lists",
      groupOf({ at: new Date(now - 86_400_000), now, scheduled: true, fromRadar: false }) ===
        "past_scheduled" &&
        groupOf({ at: new Date(now - 86_400_000), now, scheduled: false, fromRadar: true }) ===
          "past_instant",
    );

    /* ---------------------------------------------------------- C16 */

    const { readdirSync } = await import("node:fs");
    const patientPages = readdirSync("app/(patient)/patient", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    check(
      "C16 the patient app has its own routes and shares no admin page",
      patientPages.includes("billing") &&
        patientPages.includes("account") &&
        patientPages.includes("consent"),
      patientPages.join(", "),
    );

    /*
     * 🔴 C16's real teeth. The patient app may reuse the design system and the
     * formatters; it may NOT reuse a clinician's data layer. A patient screen
     * that imports the notes tables is one line from selecting `content`, and
     * the sentinel check above only covers the query it knows about.
     */
    const { readFileSync } = await import("node:fs");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? walk(`${dir}/${e.name}`)
          : e.name.endsWith(".tsx") || e.name.endsWith(".ts")
            ? [`${dir}/${e.name}`]
            : [],
      );

    const BANNED = ["sessionNotes", "transcriptSegments", "sessionInsights"];
    const offenders = walk("app/(patient)")
      .concat(walk("components/patient"))
      .filter((file) => {
        const src = readFileSync(file, "utf8");
        return BANNED.some((table) => new RegExp(`\\b${table}\\b`).test(src));
      });
    check(
      "🔴 C16 no patient screen touches a clinical table — the reuse boundary, not a convention",
      offenders.length === 0,
      offenders.length === 0 ? `${BANNED.join(", ")} absent` : offenders.join(", "),
    );

    // …and the ban is a real ban: it must fire on a file that does touch one.
    const control = walk("app").filter((f) => f.includes("(app)")).find((file) =>
      BANNED.some((t) => new RegExp(`\\b${t}\\b`).test(readFileSync(file, "utf8"))),
    );
    check(
      "🔴 C16 CONTROL — the same scan FINDS a clinician screen that does",
      control !== undefined,
      control ?? "NOTHING MATCHED — the scan proves nothing",
    );
  } finally {
    await db.delete(transcriptSegments).where(
      sql`${transcriptSegments.sessionId} IN (SELECT id FROM sessions WHERE guest_name = 'verify15')`,
    );
    await db.delete(sessionNotes).where(
      sql`${sessionNotes.sessionId} IN (SELECT id FROM sessions WHERE guest_name = 'verify15')`,
    );
    await db.delete(sessions).where(like(sessions.guestName, "verify15%"));
    await db.delete(patients).where(like(patients.firstName, "verify15%"));
    await db.delete(people).where(like(people.firstName, "verify15%"));
  }

  console.log(
    `\n${failures === 0 ? "sprint 15: PASS" : `sprint 15: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
