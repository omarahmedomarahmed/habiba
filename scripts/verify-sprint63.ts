/**
 * Sprint 63 acceptance: clinic staff, the seventh principal.
 *
 *   npm run verify:sprint63
 *
 * ## 🔴 The four sentences this sprint is subordinate to
 *
 * > **Clinic staff must not be a `users` row.** (C324)
 * >
 * > **A navigation filter is not a permission. Permissions are a capability set
 * > checked in the data layer, on the RESOURCE.** (C325)
 * >
 * > **A custom role must never be grantable a capability its creator lacks.** (C326)
 * >
 * > **Never one session carrying both capability sets.** (C352)
 *
 * ## 🔴 AND THE ACCEPTANCE TEST IS RUN, NOT DESCRIBED
 *
 * *A clinic admin manages calendars, bills and reports for four clinicians and cannot
 * reach one clinical byte by any route; a custom role cannot be created with a
 * capability its creator lacks.*
 *
 * The second half of that is checked below by CALLING the wall as every role against
 * a real database, with real rows, and asserting the refusal. A source scan asserting
 * that `refuseWithout` appears in a file would pass against a `refuseWithout` that
 * returns true.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `verify63-${Date.now().toString(36)}`;

async function main() {
  await stubModules();
  writesTo();

  const {
    ADMIN_CAPABILITIES,
    CLINIC_CAPABILITIES,
    DELEGABLE,
    NEVER_DELEGABLE,
    THERAPIST_SCOPED,
    can,
    parseCapabilities,
    roleProblem,
  } = await import("../lib/clinic-auth/capabilities");

  /* ================================================================== */
  /*  63.5 · C353 · the vocabulary is a CLOSED LIST IN CODE              */
  /* ================================================================== */

  check(
    "🔴 63.5 / C353 an unknown capability is DROPPED, never passed through",
    parseCapabilities(["schedule.read", "everything", "notes.read", "*"]).join(",") ===
      "schedule.read",
    "a capability set stored as editable JSON is an escalation vector when the check trusts it",
  );

  check(
    "🔴 63.5 CONTROL …and a real one survives, so the filter is a filter and not a wall",
    parseCapabilities([...CLINIC_CAPABILITIES]).length === CLINIC_CAPABILITIES.length,
    "an absence assertion over a parser that returns nothing passes for free",
  );

  check(
    "🔴 63.5 asking about a capability that is not in the vocabulary is FALSE",
    !can(parseCapabilities(["schedule.read"]), "notes.read" as never) &&
      can(parseCapabilities(["schedule.read"]), "schedule.read"),
    "a lookup that matched an unknown string would grant whatever somebody typed",
  );

  /*
   * 🔴 63.11 — THERE IS NO NAME FOR A CLINICAL THING IN THE VOCABULARY.
   *
   * *Clinic staff never reach a record, a note, a transcript, a copilot or a risk
   * alert.* The way to keep a rule like that is to have no name for the thing: a
   * capability called `notes.read` would be one settings screen away from a grant.
   */
  const CLINICAL_NAMES = /note|transcript|record|risk|copilot|journal|diagnos|session\.|memory/i;
  const clinicalCapability = CLINIC_CAPABILITIES.filter((capability) =>
    CLINICAL_NAMES.test(capability),
  );

  check(
    "🔴 63.11 no capability in the vocabulary names a clinical thing",
    clinicalCapability.length === 0,
    clinicalCapability.join(", ") || `${CLINIC_CAPABILITIES.length} capabilities scanned`,
  );

  check(
    "🔴 63.11 CONTROL the same scan CATCHES the capability somebody would add",
    ["notes.read", "transcript.read", "risk.read", "copilot.ask"].every((name) =>
      CLINICAL_NAMES.test(name),
    ),
    "notes.read · transcript.read · risk.read · copilot.ask",
  );

  /* ================================================================== */
  /*  63.6 / 63.7 · C326 · a role is a SUBSET, and two are never given   */
  /* ================================================================== */

  check(
    "🔴 63.7 money and membership are not in the delegable set at all",
    NEVER_DELEGABLE.includes("seats.manage") &&
      NEVER_DELEGABLE.includes("clinicians.manage") &&
      !DELEGABLE.includes("seats.manage") &&
      !DELEGABLE.includes("clinicians.manage"),
    "a practice manager who can add seats adds one every month and nobody reads the invoice",
  );

  check(
    "🔴 63.6 / C326 a role asking for something its creator lacks is REFUSED",
    roleProblem({
      name: "Receptionist",
      capabilities: ["schedule.read", "bills.read"],
      creatorHolds: ["schedule.read"],
    }) !== null,
    "otherwise 'create a custom role' is 'create yourself an admin'",
  );

  check(
    "🔴 63.7 …and one asking for seats is refused even from the ADMIN, who holds it",
    roleProblem({
      name: "Office manager",
      capabilities: ["schedule.read", "seats.manage"],
      creatorHolds: ADMIN_CAPABILITIES,
    }) !== null,
    "the subset rule alone would permit this, which is why NEVER_DELEGABLE exists",
  );

  check(
    "🔴 63.5 …and one asking for a capability nobody can spell is refused, not trimmed",
    roleProblem({
      name: "Everything",
      capabilities: ["schedule.read", "notes.read"],
      creatorHolds: ADMIN_CAPABILITIES,
    }) !== null,
    "saving a role that silently does less than the request is how somebody believes a permission is in place",
  );

  check(
    "🔴 CONTROL a legitimate role is ACCEPTED, so the rule is a rule and not a refusal",
    roleProblem({
      name: "Receptionist",
      capabilities: ["schedule.read", "bills.read"],
      creatorHolds: ADMIN_CAPABILITIES,
    }) === null,
    "an absence assertion over a function that refuses everybody passes",
  );

  /* ================================================================== */
  /*  63.4 · C325 · the refusal is in the DATA LAYER, on the resource     */
  /* ================================================================== */

  const { pool, db } = connect();

  try {
    const [org] = (
      await db.execute(sql`
        INSERT INTO organizations (name, slug, kind, clinic_state)
        VALUES (${`Clinic ${fixture}`}, ${fixture}, 'clinic', 'active') RETURNING id`)
    ).rows as { id: string }[];
    const clinic = required(org, "a clinic organisation");

    const [a] = (
      await db.execute(sql`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role,
                           verification_status)
        VALUES (${clinic.id}, ${`a-${fixture}@example.test`}, 'x', 'Ay', 'One', 'therapist', 'verified')
        RETURNING id`)
    ).rows as { id: string }[];
    const [b] = (
      await db.execute(sql`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role,
                           verification_status)
        VALUES (${clinic.id}, ${`b-${fixture}@example.test`}, 'x', 'Bee', 'Two', 'therapist', 'verified')
        RETURNING id`)
    ).rows as { id: string }[];
    const therapistA = required(a, "therapist A");
    const therapistB = required(b, "therapist B");

    const [mgr] = (
      await db.execute(sql`
        INSERT INTO clinic_managers (organization_id, email, password_hash, role)
        VALUES (${clinic.id}, ${`admin-${fixture}@example.test`}, 'x', 'admin') RETURNING id`)
    ).rows as { id: string }[];
    const [asst] = (
      await db.execute(sql`
        INSERT INTO clinic_managers (organization_id, email, password_hash, role)
        VALUES (${clinic.id}, ${`asst-${fixture}@example.test`}, 'x', 'viewer') RETURNING id`)
    ).rows as { id: string }[];
    const admin = required(mgr, "a clinic admin");
    const assistant = required(asst, "a clinic assistant");

    /* Assistant 1 is assigned to therapist A and to nobody else. */
    await db.execute(sql`
      INSERT INTO clinic_staff_assignments (organization_id, clinic_manager_id, user_id)
      VALUES (${clinic.id}, ${assistant.id}, ${therapistA.id})`);

    /*
     * A real patient row, because 63.12 is about a PATIENT's name and a session with
     * no patient on it renders an empty cell that every assertion about shortening
     * would pass against.
     */
    const [pat] = (
      await db.execute(sql`
        INSERT INTO patients (organization_id, therapist_id, first_name, last_name, phone)
        VALUES (${clinic.id}, ${therapistA.id}, 'Sarah', 'Mahmoud', ${`+2010${Date.now() % 100000000}`})
        RETURNING id`)
    ).rows as { id: string }[];
    const patient = required(pat, "a patient");

    /* One session each, in the same week, so the calendar has both on it. */
    const made: string[] = [];
    for (const [i, therapist] of [therapistA, therapistB].entries()) {
      const [row] = (
        await db.execute(sql`
          INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                                scheduled_at, feedback_token, price_cents)
          VALUES (${clinic.id}, ${therapist.id}, ${patient.id}, 'scheduled', 'video', now(),
                  ${`${fixture}-${i}`}, 5000)
          RETURNING id`)
      ).rows as { id: string }[];
      made.push(required(row, "a session").id);
    }

    const { clinicClinicians, clinicSchedule, shortenForClinic } = await import(
      "../lib/data/clinic"
    );

    const adminPrincipal = {
      clinicManagerId: admin.id,
      clinicOrganizationId: clinic.id,
      role: "admin" as const,
      capabilities: ADMIN_CAPABILITIES,
      therapistIds: null,
    };

    const assistantPrincipal = {
      clinicManagerId: assistant.id,
      clinicOrganizationId: clinic.id,
      role: "viewer" as const,
      capabilities: ["schedule.read"] as const,
      therapistIds: [therapistA.id],
    };

    const window = {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const adminRows = await clinicSchedule({ actor: adminPrincipal, ...window });

    check(
      "🔴 63.12 / C327 the schedule hands the practice a shortened name, from the query",
      adminRows.every((row) => row.patientName === "Sarah M"),
      adminRows.map((row) => row.patientName).join(", ") || "no rows",
    );

    check(
      "🔴 CONTROL the admin sees BOTH clinicians' appointments, so the fixture is real",
      made.every((id) => adminRows.some((row) => row.sessionId === id)),
      `${adminRows.length} row(s) for the admin`,
    );

    /*
     * 🔴 THE ACCEPTANCE TEST, ON THE SAME ROUTE, AGAINST A REAL DATABASE.
     *
     * *Assistant 1 assigned to therapist A is refused therapist B's calendar on the
     * same route.* Not a different page, not a hidden nav item: the same function,
     * with a different principal, returning fewer rows.
     */
    const assistantRows = await clinicSchedule({ actor: assistantPrincipal, ...window });

    check(
      "🔴 63.4 / C325 an assistant assigned to A is REFUSED B's calendar on the same route",
      assistantRows.some((row) => row.sessionId === made[0]) &&
        !assistantRows.some((row) => row.sessionId === made[1]),
      `${assistantRows.length} row(s): ${assistantRows.map((row) => row.therapistName).join(", ")}`,
    );

    /*
     * 🔴 AN EMPTY ASSIGNMENT LIST MEANS NOBODY, WHICH IS THE HOLE IF IT IS BACKWARDS.
     *
     * `inArray(column, [])` matches nothing and treating `[]` as "no filter" would
     * show an unassigned assistant the entire practice. This is the check that tells
     * the two readings apart.
     */
    const unassignedRows = await clinicSchedule({
      actor: { ...assistantPrincipal, therapistIds: [] },
      ...window,
    });

    check(
      "🔴 63.4 …and an assistant assigned to NOBODY sees nothing, not everything",
      unassignedRows.length === 0,
      `${unassignedRows.length} row(s), and "no assignments" must never read as "no filter"`,
    );

    /* 🔴 And a capability they do not hold is refused, on the resource. */
    let refused = false;
    try {
      await clinicClinicians(assistantPrincipal);
    } catch {
      refused = true;
    }

    check(
      "🔴 63.4 / C325 a capability the principal lacks is REFUSED in the data layer",
      refused,
      "a route guard that let somebody through to a function that trusted them is the classic hole",
    );

    check(
      "🔴 CONTROL …while the admin, who holds it, is not refused",
      (await clinicClinicians(adminPrincipal)).length === 2,
      "an assertion that everything throws is satisfied by a function that always throws",
    );

    /* ================================================================ */
    /*  63.12 · C327 · first name plus last initial, and it is audited   */
    /* ================================================================ */

    check(
      "🔴 63.12 / C327 a patient's name reaches the practice as first name plus last initial",
      shortenForClinic("Sarah", "Mahmoud") === "Sarah M" &&
        shortenForClinic("Sarah", "van der Berg") === "Sarah v",
      "'Sarah Mahmoud, Tuesdays 3pm, six months' identifies a person and says they are in therapy",
    );

    check(
      "🔴 63.12 …and an Arabic surname has an initial too, rather than falling back to the whole name",
      shortenForClinic("سارة", "محمود") === "سارة م",
      "a regular expression over Latin letters returns the given name alone for a whole alphabet",
    );

    check(
      "🔴 63.12 …and a name we cannot shorten is never printed in full",
      shortenForClinic("Sarah", null) === "Sarah" && shortenForClinic(null, null) === "",
      "giving up and printing the whole thing leaks exactly the names that are most identifying",
    );

    const audited = await db.execute(sql`
      SELECT action, category FROM audit_log
       WHERE actor_clinic_manager_id = ${admin.id}
         AND action = 'clinic.schedule.read'
       LIMIT 1`);

    check(
      "🔴 63.12 / C327 every clinic-staff read of a calendar is AUDITED",
      audited.rows.length === 1 &&
        (audited.rows[0] as { category: string }).category === "phi_access",
      JSON.stringify(audited.rows),
    );

    /* ================================================================ */
    /*  63.3 / 63.6 · the role, written through the rule                 */
    /* ================================================================ */

    const { createRole, rolesFor } = await import("../lib/data/clinic-team");

    const first = await createRole({
      clinicOrganizationId: clinic.id,
      byManagerId: admin.id,
      name: "Receptionist",
      capabilities: ["schedule.read"],
    });
    const second = await createRole({
      clinicOrganizationId: clinic.id,
      byManagerId: admin.id,
      name: "Bookkeeper",
      capabilities: ["bills.read"],
    });
    const third = await createRole({
      clinicOrganizationId: clinic.id,
      byManagerId: admin.id,
      name: "One too many",
      capabilities: ["reports.read"],
    });

    check(
      "🔴 63.3 a practice gets TWO custom roles, and the third is refused",
      Boolean(first.id) && Boolean(second.id) && Boolean(third.error),
      third.error ?? "the third one was created",
    );

    const stored = await rolesFor(clinic.id);
    check(
      "🔴 CONTROL …and both of them are there, with the capabilities they were given",
      stored.length === 2 && stored[0]!.capabilities.join(",") === "schedule.read",
      stored.map((role) => `${role.name}:${role.capabilities.join("|")}`).join(" · "),
    );

    /*
     * 🔴 THE DATABASE REFUSES AN UNDELEGATABLE CAPABILITY, whatever the code does.
     *
     * `roleProblem` refuses it and this is the second lock. "Money and membership are
     * never delegable" is the kind of rule that gets around a single guard through a
     * script, a fixture, or an endpoint nobody has written yet.
     */
    let dbRefused = false;
    try {
      await db.execute(sql`
        INSERT INTO clinic_roles (organization_id, slot, name, capabilities)
        VALUES (${clinic.id}, 1, 'Sneaky', '["seats.manage"]'::jsonb)`);
    } catch {
      dbRefused = true;
    }

    check(
      "🔴 63.7 the DATABASE refuses a role holding seats.manage, not only the code",
      dbRefused,
      "a rule with one lock is a rule a script gets around",
    );

    /* ================================================================ */
    /*  63.2 · C352 · one human, two principals, never both at once      */
    /* ================================================================ */

    await db.execute(sql`
      UPDATE clinic_managers SET linked_user_id = ${therapistA.id} WHERE id = ${admin.id}`);

    const [session] = (
      await db.execute(sql`
        INSERT INTO clinic_auth_sessions (clinic_manager_id, token_hash, absolute_expires_at)
        VALUES (${admin.id}, ${`hash-${fixture}`}, now() + interval '1 hour')
        RETURNING id`)
    ).rows as { id: string }[];
    required(session, "a clinic session to revoke");

    const { leaveClinicPrincipal } = await import("../lib/clinic-auth/switch");
    const left = await leaveClinicPrincipal(admin.id);

    check(
      "🔴 63.2 / C352 switching resolves the LINKED clinician, not one named by a caller",
      left.userId === therapistA.id,
      left.error ?? `resolved ${left.userId}`,
    );

    const live = await db.execute(sql`
      SELECT count(*)::int AS n FROM clinic_auth_sessions
       WHERE clinic_manager_id = ${admin.id} AND revoked_at IS NULL`);

    check(
      "🔴 63.2 / C352 …and every session of the principal being LEFT is revoked first",
      Number((live.rows[0] as { n: number }).n) === 0,
      "two live cookies mean one browser holds a clinical grant and a management grant at once",
    );

    const switchAudit = await db.execute(sql`
      SELECT count(*)::int AS n FROM audit_log
       WHERE actor_clinic_manager_id = ${admin.id} AND action = 'principal.switch'`);

    check(
      "🔴 63.2 …and the switch is AUDITED, because 'explicit' without a record is a habit",
      Number((switchAudit.rows[0] as { n: number }).n) >= 1,
      "'they had both grants all afternoon' is what this prevents being true",
    );

    /* ================================================================ */
    /*  63.17 · C334 · the export                                        */
    /* ================================================================ */

    const { exportSchedule } = await import("../lib/data/clinic-export");

    const exported = await exportSchedule({
      actor: adminPrincipal,
      email: `admin-${fixture}@example.test`,
      clinicName: `Clinic ${fixture}`,
      ...window,
    });

    check(
      "🔴 63.17 / C334 the export is watermarked with the requester and the timestamp",
      exported.csv.includes(`admin-${fixture}@example.test`) &&
        /\d{4}-\d{2}-\d{2}T/.test(exported.csv),
      "a filename is discarded the moment somebody attaches the file to an email",
    );

    /*
     * 🔴 THE PATIENT'S NAME IS SHORTENED AND THE CLINICIAN'S IS NOT, and both halves
     * matter.
     *
     * C327 is about the patient: "Sarah Mahmoud, Tuesdays 3pm" identifies somebody
     * and says they are in therapy. The clinician is the practice's own employee
     * whose name is on the invitation the practice sent, so shortening theirs would
     * be theatre rather than privacy, and an export that shortened both would prove
     * nothing about which rule was applied.
     */
    check(
      "🔴 63.17 …and it shows nothing the screen does not: the patient's name is shortened",
      exported.csv.includes("Sarah M") &&
        !exported.csv.includes("Sarah Mahmoud") &&
        exported.csv.includes("Ay One"),
      "an export built from its own SELECT drifts, and always toward more data",
    );

    const exportAudit = await db.execute(sql`
      SELECT count(*)::int AS n FROM audit_log
       WHERE actor_clinic_manager_id = ${admin.id} AND action = 'clinic.schedule.export'`);

    check(
      "🔴 63.17 …and it is AUDITED separately from the read",
      Number((exportAudit.rows[0] as { n: number }).n) === 1,
      "looking at a calendar and taking a copy of it away are different facts",
    );

    let exportRefused = false;
    try {
      await exportSchedule({
        actor: { ...adminPrincipal, role: "viewer", capabilities: ["schedule.read"] },
        email: "x@example.test",
        clinicName: "x",
        ...window,
      });
    } catch {
      exportRefused = true;
    }

    check(
      "🔴 63.17 `export` is its OWN capability: schedule.read alone does not take a copy away",
      exportRefused,
      "reading a calendar and exfiltrating it are different acts with different risks",
    );
  } finally {
    await db.execute(sql`DELETE FROM audit_log WHERE actor_clinic_manager_id IN
      (SELECT id FROM clinic_managers WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM clinic_auth_sessions WHERE clinic_manager_id IN
      (SELECT id FROM clinic_managers WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM clinic_staff_assignments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM clinic_roles WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM clinic_managers WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM sessions WHERE feedback_token LIKE ${`${fixture}%`}`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  /* ================================================================== */
  /*  the source properties a runtime check cannot see                   */
  /* ================================================================== */

  const guard = readSource("lib/clinic-auth/guard.ts");
  const wall = readSource("lib/data/clinic.ts");

  /*
   * 🔴 C324 — AND THE CHECK IS ABOUT WHAT THE PRINCIPAL CANNOT BE HANDED TO.
   *
   * The first version of this asserted the guard file contained no `Actor`, which
   * matched `ClinicActor` on every line and failed against correct code. The property
   * that matters is narrower and stronger: the clinic guard never calls the
   * clinician's or the back office's guard, and the type it returns has no `userId`
   * and no `Role` for anything clinical to accept.
   */
  const session = readSource("lib/clinic-auth/session.ts");

  check(
    "🔴 63.1 / C324 clinic staff is its own table and its own session, never a `users` row",
    /clinicManagers/.test(session) &&
      /clinicAuthSessions/.test(session) &&
      !/\brequireRole\b|\brequireUser\b|\brequireStaff\b/.test(guard),
    "`staff` and `manager` in ROLES are OUR back office, one mistake from a clinical grant",
  );

  check(
    "🔴 63.1 …and the principal it produces has no `userId` and no `Role`",
    !/^\s*userId:/m.test(session) && !/\brole: Role\b/.test(session),
    "nothing on this type can be passed to requireRole, auditPhi or anything clinical",
  );

  check(
    "🔴 63.1 CONTROL the guard scan reads the file, so the absence above means something",
    /requireClinicCapability/.test(guard) && guard.length > 1_000,
    `${guard.length} characters of guard`,
  );

  check(
    "🔴 63.4 / C325 every function in the wall takes a PRINCIPAL, not an organisation id",
    !/export async function clinic\w+\(\s*clinicOrganizationId: string/.test(wall),
    "a function taking a bare id is a door into the wall that needs no principal",
  );

  check(
    "🔴 63.4 CONTROL …and each of them asks for a capability by name",
    (wall.match(/refuseWithout\(/g) ?? []).length >= 6,
    `${(wall.match(/refuseWithout\(/g) ?? []).length} capability checks in the wall`,
  );

  check(
    "🔴 63.7 the two undelegatable capabilities are refused against the ROLE, not the list",
    /NEVER_DELEGABLE\.includes\(capability\) && actor\.role !== "admin"/.test(wall) &&
      /NEVER_DELEGABLE\.includes\(capability\) && actor\.role !== "admin"/.test(guard),
    "a stored set that somehow contained one must still refuse",
  );

  check(
    "🔴 63.4 a therapist-scoped capability filters in the WHERE clause, never afterwards",
    /inArray\(sessions\.therapistId, scope\)/.test(wall),
    "a later .filter leaves the rows in memory, in a log line, in an error",
  );

  const chrome = readSource("components/clinic/chrome.tsx");
  check(
    "🔴 63.8 the navigation draws only what this principal holds",
    /TABS\.filter\(\(tab\) => capabilities\.includes\(tab\.needs\)\)/.test(chrome),
    "a courtesy, not the permission: the page and the query both ask again",
  );

  const joinForm = readSource("components/clinic/join-form.tsx");
  check(
    "🔴 63.9 / C328 the acceptance screen ENUMERATES what the practice will see",
    /clinic\.join\.sees\.calendar/.test(joinForm) &&
      /clinic\.join\.sees\.earnings/.test(joinForm) &&
      /clinic\.join\.never\.notes/.test(joinForm),
    "the colleague has to understand that before, not after",
  );

  check(
    "🔴 63.9 …and the same two lists render on BOTH paths onto that screen",
    (joinForm.match(/<WhatTheySee /g) ?? []).length === 2,
    "a sentence copied into two forms is a sentence that ends up in one",
  );

  const record = readSource("app/(patient)/patient/record/page.tsx");
  check(
    "🔴 63.13 / C354 the full disclosure is a SECTION on the record page, never a wall",
    /clinicVisibilityFor/.test(record) &&
      !/redirect\(|blocked|acknowledge/.test(record),
    "a disclosure wall in front of somebody in crisis is the wrong trade",
  );

  check(
    "🔴 63.13 …and the radar card carries a small persistent label instead",
    /pclinic\.radarLabel/.test(readSource("components/radar/therapist-card.tsx")),
    "informed rather than interrogated",
  );

  const earnings = readSource("app/(clinic)/clinic/earnings/page.tsx");
  check(
    "🔴 63.14 the clinic earnings page shows the withdrawal LOG and can move nothing",
    /withdrawals/.test(earnings) && !/requestPayout|claimPayout/.test(earnings),
    "a therapist withdraws their own earnings; the clinic sees the log",
  );

  check(
    "🔴 63.14 …and no bank detail is selected, on any route",
    !/identifier|accountName|payoutMethod/.test(wall),
    "a practice reading an account number is a practice that can be talked into changing one",
  );

  const apply = readSource("lib/data/clinic-admin.ts");
  check(
    "🔴 63.18 the application takes the practice's registration and the names it expects",
    /registrationNumber/.test(apply) && /intendedClinicians/.test(apply),
    "the questions the operator on the call would have had to ask anyway",
  );

  check(
    "🔴 63.18 / C267 …and a NAME is all it can hold, because the column is a text[]",
    /intended_clinicians text\[\]/.test(readSource("drizzle/0094_clinic_application.sql")),
    "a jsonb of objects has a shape somebody adds a licence number to",
  );

  check(
    "🔴 54.3 …and it still creates a HELD row, so 63.18 did not open a self-serve path",
    /clinicState: "held"/.test(apply),
    "a self-serve path to an active clinic is a self-serve path to clinical records",
  );

  check(
    "🔴 THERAPIST_SCOPED names the capabilities an assignment narrows, and no others",
    THERAPIST_SCOPED.every((capability) => DELEGABLE.includes(capability)) &&
      !THERAPIST_SCOPED.includes("bills.read"),
    "a practice's bill is the practice's, not one clinician's share of it",
  );

  finish("sprint 63");
}

main();
