/**
 * Wave 1D acceptance: privacy and the console audit. `takeover/FIX-PLAN.md`.
 *
 *   npm run verify:w1d
 *
 * Every check here was written first and seen to FAIL on the code it describes,
 * then the fix made it pass. Fixtures are planted and removed in a `finally`
 * (H29), and nothing here may run against production.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { stubModules } from "./_render";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w1d-${Date.now().toString(36)}`;

/** The body of one exported function, comments already stripped. */
function bodyOf(source: string, name: string): string {
  const start = source.search(new RegExp(`(export )?(async )?function ${name}\\b`));
  if (start === -1) return "";
  const end = source.indexOf("\n}\n", start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

/* ================================================================== */
/*  W1-14 · Total View: every clinical read is audited, with a reason  */
/* ================================================================== */

async function totalView(db: ReturnType<typeof connect>["db"]) {
  const page = readSource("app/(admin)/admin/tv/page.tsx");
  const actions = readSource("app/(admin)/admin/tv/actions.ts");

  /*
   * The page renders whatever it reads. A read it makes itself is a read no
   * reason was asked for, so the three clinical reads must not appear there.
   */
  const direct = ["sessionDetail(", "conversationFor(", "sessionsFor("].filter((call) =>
    page.includes(call),
  );
  check(
    "W1-14 the Total View page makes no clinical read of its own",
    direct.length === 0,
    direct.join(", ") || "reads go through the audited path",
  );

  const mail = bodyOf(actions, "mailRecordToPerson");
  check(
    "W1-14 emailing a record copies nobody, and asks for a reason",
    mail.length > 0 && !/copyTo/.test(mail) && /reason/.test(mail),
    mail ? "read mailRecordToPerson" : "mailRecordToPerson not found",
  );

  const [org] = (
    await db.execute(sql`
      INSERT INTO organizations (name, slug) VALUES (${`Org ${fixture}`}, ${fixture}) RETURNING id`)
  ).rows as { id: string }[];
  const orgId = required(org, "an organisation").id;

  const [op] = (
    await db.execute(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES (${orgId}, ${`op-${fixture}@example.com`}, 'x', 'Op', 'Erator', 'super_admin')
      RETURNING id`)
  ).rows as { id: string }[];
  const [th] = (
    await db.execute(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role,
                         verification_status)
      VALUES (${orgId}, ${`th-${fixture}@example.com`}, 'x', 'Tee', 'Aitch', 'therapist', 'verified')
      RETURNING id`)
  ).rows as { id: string }[];
  const operator = required(op, "an operator");
  const therapist = required(th, "a therapist");

  const [pat] = (
    await db.execute(sql`
      INSERT INTO patients (organization_id, therapist_id, first_name, last_name, email, phone)
      VALUES (${orgId}, ${therapist.id}, 'Pat', 'Ient', ${`pat-${fixture}@example.com`},
              ${`+2010${Date.now() % 100000000}`})
      RETURNING id`)
  ).rows as { id: string }[];
  const patient = required(pat, "a patient");

  const [ses] = (
    await db.execute(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            scheduled_at, feedback_token, price_cents)
      VALUES (${orgId}, ${therapist.id}, ${patient.id}, 'completed', 'video', now(),
              ${`${fixture}-s`}, 5000)
      RETURNING id`)
  ).rows as { id: string }[];
  const session = required(ses, "a session");

  await db.execute(sql`
    INSERT INTO transcript_segments (session_id, organization_id, sequence, speaker, text, start_ms, end_ms)
    VALUES (${session.id}, ${orgId}, 1, 'patient', 'A line nobody should read unaudited.', 0, 4000)`);

  const [thr] = (
    await db.execute(sql`
      INSERT INTO copilot_threads (patient_id, organization_id, therapist_id)
      VALUES (${patient.id}, ${orgId}, ${therapist.id}) RETURNING id`)
  ).rows as { id: string }[];
  await db.execute(sql`
    INSERT INTO copilot_messages (thread_id, role, content)
    VALUES (${required(thr, "a thread").id}, 'therapist', 'A question about this person.')`);

  const actor = {
    userId: operator.id,
    organizationId: orgId,
    role: "super_admin",
    email: `op-${fixture}@example.com`,
    firstName: "Op",
    lastName: "Erator",
  } as never;

  const gate = (await import("../lib/console/reads")) as Record<string, unknown>;
  const readSession = gate.readSession as
    | ((a: unknown, id: string, reason: string) => Promise<unknown>)
    | undefined;
  const readPerson = gate.readPerson as
    | ((a: unknown, ids: string[], reason: string) => Promise<unknown>)
    | undefined;

  const rows = async (action: string) =>
    (
      await db.execute(sql`
        SELECT category, reason, resource_id::text AS resource_id, patient_id::text AS patient_id
          FROM audit_log WHERE actor_user_id = ${operator.id} AND action = ${action}`)
    ).rows as { category: string; reason: string; resource_id: string; patient_id: string }[];

  const reason = "Complaint from the patient, case review";

  if (!readSession || !readPerson) {
    check("W1-14 reading a session writes a phi_access row with the typed reason", false, "no audited read exists");
    check("W1-14 reading a person's copilot conversation writes a phi_access row", false, "no audited read exists");
    return;
  }

  let refusedShort = false;
  try {
    const result = (await readSession(actor, session.id, "because")) as { error?: string } | null;
    refusedShort = Boolean(result && "error" in result && result.error);
  } catch {
    refusedShort = true;
  }
  const beforeReason = await rows("console.read.session");
  check(
    "W1-14 a reason under ten characters is refused, and nothing is read or written",
    refusedShort && beforeReason.length === 0,
    `${beforeReason.length} row(s)`,
  );

  const detail = (await readSession(actor, session.id, reason)) as {
    transcript?: unknown[];
  } | null;
  const sessionRows = await rows("console.read.session");
  check(
    "W1-14 reading a session writes a phi_access row with the typed reason",
    sessionRows.length === 1 &&
      sessionRows[0]!.category === "phi_access" &&
      sessionRows[0]!.reason === reason &&
      sessionRows[0]!.resource_id === session.id &&
      sessionRows[0]!.patient_id === patient.id,
    JSON.stringify(sessionRows),
  );
  check(
    "W1-14 CONTROL …and the read still returns the transcript",
    (detail?.transcript?.length ?? 0) === 1,
    `${detail?.transcript?.length ?? 0} segment(s)`,
  );

  const person = (await readPerson(actor, [patient.id], reason)) as {
    conversation?: unknown[];
  } | null;
  const personRows = await rows("console.read.person");
  check(
    "W1-14 reading a person's copilot conversation writes a phi_access row",
    personRows.length === 1 &&
      personRows[0]!.category === "phi_access" &&
      personRows[0]!.reason === reason &&
      personRows[0]!.patient_id === patient.id,
    JSON.stringify(personRows),
  );
  check(
    "W1-14 CONTROL …and the conversation is returned",
    (person?.conversation?.length ?? 0) === 1,
    `${person?.conversation?.length ?? 0} message(s)`,
  );

  /*
   * 🔴 W1-26: THE TIMELINE IS NOT A SIDE DOOR.
   *
   * The same page rendered a timeline with 140 characters of every copilot
   * message, the risk assessment's recommended action and the rating comment,
   * with no reason asked and nothing audited. Clinical text comes only through
   * `readSession` and `readPerson` above; the timeline says that something
   * happened, never what was said.
   */
  await db.execute(sql`
    INSERT INTO risk_assessments (session_id, organization_id, therapist_id, patient_id, level, source,
                                  recommended_action)
    VALUES (${session.id}, ${orgId}, ${therapist.id}, ${patient.id}, 'moderate', 'keyword',
            'Safety plan review about the thing they said.')`);
  await db.execute(sql`
    INSERT INTO session_feedback (session_id, organization_id, therapist_id, service_stars,
                                  therapist_stars, comment)
    VALUES (${session.id}, ${orgId}, ${therapist.id}, 5, 4, 'What I told them about my marriage.')`);
  const timelineRead = gate.timeline as (opts: { sinceHours?: number }) => Promise<{ kind: string; what: string }[]>;
  const events = await timelineRead({ sinceHours: 1 });
  const leaked = events.filter((event) =>
    ["A question about this person", "Safety plan review", "about my marriage"].some((text) =>
      event.what.includes(text),
    ),
  );
  check(
    "🔴 W1-26 the Total View timeline carries no copilot, risk or rating text",
    leaked.length === 0,
    leaked.map((event) => `${event.kind}: ${event.what}`).join(" | ") || "no clinical text",
  );
  const kinds = new Set(events.map((event) => event.kind));
  check(
    "W1-26 CONTROL …and it still says that each of them happened",
    kinds.has("copilot.therapist") && kinds.has("risk") && kinds.has("rating"),
    [...kinds].join(", "),
  );

  /*
   * 🔴 THE INVESTIGATION PAGE READS ON A GRANT, NOT ON A REASON IN THE URL.
   *
   * `/admin/radar/investigate/[id]` took `?why=` and wrote a break-glass row
   * on every render. The reason is POSTed now and its one row is the grant:
   * this reader, this session, for a window. Anybody else's grant, another
   * session's, or one past the window opens nothing.
   */
  const { audit, investigationGrantHolds, INVESTIGATION_WINDOW_MINUTES } = await import("../lib/audit");
  const grantId = await audit({
    actor: { userId: operator.id, organizationId: orgId },
    category: "phi_access",
    action: "break_glass.investigate",
    resourceType: "session",
    resourceId: session.id,
    patientId: patient.id,
    reason: `Report verifier, abuse: ${reason}`,
  });
  const holds = (grant: string | null, actorUserId: string, sessionId: string) =>
    investigationGrantHolds({ grantId: grant, actorUserId, sessionId });
  const mine = await holds(grantId, operator.id, session.id);
  const someoneElse = await holds(grantId, therapist.id, session.id);
  const otherSession = await holds(grantId, operator.id, patient.id);
  const forged = await holds("00000000-0000-4000-8000-000000000000", operator.id, session.id);
  await db.execute(sql`
    UPDATE audit_log SET created_at = now() - make_interval(mins => ${INVESTIGATION_WINDOW_MINUTES + 1})
     WHERE id = ${grantId}`);
  const stale = await holds(grantId, operator.id, session.id);
  check(
    "🔴 an investigation opens on this reader's own break-glass row for this session, and only inside its window",
    mine && !someoneElse && !otherSession && !forged && !stale,
    JSON.stringify({ mine, someoneElse, otherSession, forged, stale }),
  );
}

/* ================================================================== */
/*  W1-15 · the clinic sees first name and last initial, and no more   */
/* ================================================================== */

async function clinicNames(db: ReturnType<typeof connect>["db"]) {
  const { shortenForClinic, clinicSchedule } = await import("../lib/data/clinic");
  const { exportSchedule } = await import("../lib/data/clinic-export");
  const { en } = await import("../lib/i18n/messages");

  /*
   * A chart can hold the whole name in the first-name field: a walk-in typed
   * as one string, an import with one name column. "Never in full" has to hold
   * for that row too, or the rule protects only the tidy records.
   */
  check(
    "W1-15 a whole name typed into the first-name field still reaches the clinic shortened",
    shortenForClinic("Sarah Mahmoud", null) === "Sarah M" &&
      shortenForClinic("  Sarah   van der Berg ", "") === "Sarah v",
    `${shortenForClinic("Sarah Mahmoud", null)} · ${shortenForClinic("  Sarah   van der Berg ", "")}`,
  );
  check(
    "W1-15 CONTROL …and a tidy record is unchanged",
    shortenForClinic("Sarah", "Mahmoud") === "Sarah M" &&
      shortenForClinic("Sarah", null) === "Sarah" &&
      shortenForClinic("سارة", "محمود") === "سارة م",
    "the rule the founder set: first name and last initial",
  );

  const slug = `${fixture}-c`;
  const [org] = (
    await db.execute(sql`
      INSERT INTO organizations (name, slug, kind, clinic_state)
      VALUES (${`Clinic ${fixture}`}, ${slug}, 'clinic', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const clinicId = required(org, "a clinic").id;
  const [th] = (
    await db.execute(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role,
                         verification_status)
      VALUES (${clinicId}, ${`c-${fixture}@example.com`}, 'x', 'Cee', 'Linician', 'therapist', 'verified')
      RETURNING id`)
  ).rows as { id: string }[];
  const [mgr] = (
    await db.execute(sql`
      INSERT INTO clinic_managers (organization_id, email, password_hash, role)
      VALUES (${clinicId}, ${`m-${fixture}@example.com`}, 'x', 'admin') RETURNING id`)
  ).rows as { id: string }[];
  const phone = `+2011${Date.now() % 100000000}`;
  const email = `sarah-${fixture}@example.com`;
  const [pat] = (
    await db.execute(sql`
      INSERT INTO patients (organization_id, therapist_id, first_name, last_name, email, phone)
      VALUES (${clinicId}, ${required(th, "a clinician").id}, 'Sarah Mahmoud', '', ${email}, ${phone})
      RETURNING id`)
  ).rows as { id: string }[];
  await db.execute(sql`
    INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                          scheduled_at, feedback_token, price_cents)
    VALUES (${clinicId}, ${th!.id}, ${required(pat, "a patient").id}, 'scheduled', 'video', now(),
            ${`${fixture}-c`}, 5000)`);

  const { ADMIN_CAPABILITIES } = await import("../lib/clinic-auth/capabilities");
  const actor = {
    clinicManagerId: required(mgr, "a clinic admin").id,
    clinicOrganizationId: clinicId,
    role: "admin" as const,
    capabilities: ADMIN_CAPABILITIES,
    therapistIds: null,
  };
  const window = {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  const rota = await clinicSchedule({ actor, ...window });
  const exported = await exportSchedule({
    actor,
    email: `m-${fixture}@example.com`,
    clinicName: `Clinic ${fixture}`,
    ...window,
    zone: "Africa/Cairo",
  });
  const shown = JSON.stringify(rota) + exported.csv;

  check(
    "W1-15 the rota and its export show Sarah M, never the surname, the email or the phone",
    rota.length === 1 &&
      rota[0]!.patientName === "Sarah M" &&
      exported.csv.includes("Sarah M") &&
      !/Mahmoud/.test(shown) &&
      !shown.includes(email) &&
      !shown.includes(phone),
    rota.map((row) => row.patientName).join(", ") || "no rows",
  );

  const audited = (
    await db.execute(sql`
      SELECT category FROM audit_log
       WHERE actor_clinic_manager_id = ${actor.clinicManagerId} AND action = 'clinic.schedule.read'`)
  ).rows as { category: string }[];
  check(
    "W1-15 the rota still reads patient rows, so every read keeps its phi_access row",
    audited.length >= 1 && audited.every((row) => row.category === "phi_access"),
    `${audited.length} row(s)`,
  );

  /* The copy says the same rule, in the same words, wherever the clinic reads it. */
  const rule = /first name, last initial/i;
  check(
    "W1-15 the rota, the apply table and the join list say first name and last initial",
    rule.test(en["clinic.scheduleBody"]) &&
      rule.test(en["clinic.apply.seesSchedule"]) &&
      /* W2-C08: the join list's line now names the patient list too, same rule. */
      rule.test(en["clinic.join.sees.patients"]),
    `${en["clinic.scheduleBody"]} · ${en["clinic.apply.seesSchedule"]}`,
  );

  const walls = [
    "components/clinic/chrome.tsx",
    "app/(clinic)/clinic/apply/page.tsx",
  ].filter((file) => !readSource(file).includes(`t("clinic.neverContact")`));
  check(
    "W1-15 the 'never show you' wall says the full name, email and phone stay out",
    walls.length === 0 && /full name/.test((en as Record<string, string>)["clinic.neverContact"] ?? ""),
    walls.join(", ") || "both walls carry it",
  );
}

/* ================================================================== */
/*  W1-19 · a cell in a clinic export is never a formula               */
/* ================================================================== */

async function csvFormulas(db: ReturnType<typeof connect>["db"]) {
  const exportModule = (await import("../lib/data/clinic-export")) as Record<string, unknown>;
  const { exportSchedule } = await import("../lib/data/clinic-export");
  const csvCell = exportModule.csvCell as ((value: string | number | null) => string) | undefined;

  const hostile = ["=1+2", "+1+2", "-1+2", "@SUM(A1)", "\t=1", "\r=1"];
  const escaped = csvCell ? hostile.map((value) => csvCell(value)) : [];
  check(
    "W1-19 a cell starting with = + - @ tab or return is prefixed with a quote",
    escaped.length === hostile.length && escaped.every((out) => /^"?'/.test(out)),
    escaped.map((out) => JSON.stringify(out)).join(" ") || "csvCell is not exported",
  );
  check(
    "W1-19 CONTROL …and ordinary text, a date and a number are left alone",
    Boolean(csvCell) &&
      csvCell!("Sarah M") === "Sarah M" &&
      csvCell!("2026-09-24T09:00:00.000Z") === "2026-09-24T09:00:00.000Z" &&
      csvCell!(-12.5) === "-12.5" &&
      csvCell!('a "b", c') === '"a ""b"", c"',
    "a bill total below zero is a number, not a formula",
  );

  /* Through the real export, with names somebody could have typed. */
  const slug = `${fixture}-f`;
  const [org] = (
    await db.execute(sql`
      INSERT INTO organizations (name, slug, kind, clinic_state)
      VALUES (${`Clinic ${fixture}`}, ${slug}, 'clinic', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const clinicId = required(org, "a clinic").id;
  const [th] = (
    await db.execute(sql`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role,
                         verification_status)
      VALUES (${clinicId}, ${`f-${fixture}@example.com`}, 'x', '@Dee', 'Octor', 'therapist', 'verified')
      RETURNING id`)
  ).rows as { id: string }[];
  const [mgr] = (
    await db.execute(sql`
      INSERT INTO clinic_managers (organization_id, email, password_hash, role)
      VALUES (${clinicId}, ${`fm-${fixture}@example.com`}, 'x', 'admin') RETURNING id`)
  ).rows as { id: string }[];
  await db.execute(sql`
    INSERT INTO sessions (organization_id, therapist_id, status, modality, scheduled_at,
                          feedback_token, price_cents, guest_name)
    VALUES (${clinicId}, ${required(th, "a clinician").id}, 'scheduled', 'video', now(),
            ${`${fixture}-f`}, 5000, '=HYPERLINK("https://example.com") x')`);

  const { ADMIN_CAPABILITIES } = await import("../lib/clinic-auth/capabilities");
  const exported = await exportSchedule({
    actor: {
      clinicManagerId: required(mgr, "a clinic admin").id,
      clinicOrganizationId: clinicId,
      role: "admin" as const,
      capabilities: ADMIN_CAPABILITIES,
      therapistIds: null,
    },
    email: `fm-${fixture}@example.com`,
    clinicName: `Clinic ${fixture}`,
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    zone: "Africa/Cairo",
  });
  const cells = exported.csv.split("\r\n").flatMap((line) => line.split(","));
  const live = cells.filter((value) => /^"?[=+\-@\t\r]/.test(value));
  check(
    "W1-19 the schedule export carries no cell a spreadsheet would run",
    live.length === 0 && /'=HYPERLINK/.test(exported.csv) && /'@Dee/.test(exported.csv),
    live.join(" | ") || "every hostile cell is quoted",
  );
}

/* ================================================================== */
/*  W1-20 · one pot alert per period, from the daily job, never "when" */
/* ================================================================== */

async function potAlerts(db: ReturnType<typeof connect>["db"]) {
  const pot = readSource("lib/billing/pot.ts");
  const cron = readSource("app/api/cron/[job]/route.ts");

  check(
    "W1-20 a booking that hits an empty pot sends nothing, so no email marks the moment",
    !/alertSponsorPotEmpty|pot-alerts/.test(bodyOf(pot, "payFromPot")),
    "payFromPot",
  );
  check(
    "W1-20 the daily billing job sends the pot alerts",
    /alertPots\(\)/.test(cron),
    "app/api/cron/[job]/route.ts",
  );

  const alerts = (await import("../lib/billing/pot-alerts")) as Record<string, unknown>;
  const alertPots = alerts.alertPots as (() => Promise<{ alerted: number }>) | undefined;
  const words = bodyOf(readSource("lib/billing/pot-alerts.ts"), "potAlertMessage");
  if (!alertPots || !words) {
    check("W1-20 at most one alert per pot per period, and a low-balance warning first", false, "no daily sweep exists");
    return;
  }

  check(
    "W1-20 the alert carries no time of day and names nobody but the company",
    !/\d{1,2}:\d{2}|today|this morning|just now|someone|somebody|\$\{(?!sponsorName)/i.test(words),
    "potAlertMessage interpolates the company name and nothing else",
  );

  const started = new Date();
  const name = `W1D Pot ${fixture}`;
  const [sp] = (
    await db.execute(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${name}, 'company', 'us', 'USD', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const sponsorId = required(sp, "a sponsor").id;
  await db.execute(sql`
    INSERT INTO sponsor_users (sponsor_id, email, role)
    VALUES (${sponsorId}, ${`hr-${fixture}@example.com`}, 'admin')`);

  try {
    const { openPot } = await import("../lib/data/sponsor-admin");
    await openPot({
      sponsorId,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      overdraftCents: 0,
      welcomeCreditCents: 10_000,
    });

    const sent = async (kind: string) =>
      Number(
        (
          (
            await db.execute(sql`
              SELECT count(*)::int AS n FROM audit_log
               WHERE action = ${`sponsor.pot_alert.${kind}`}
                 AND resource_id = (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsorId})`)
          ).rows[0] as { n: number }
        ).n,
      );

    await alertPots();
    check("W1-20 CONTROL a full pot is not alerted", (await sent("low")) + (await sent("empty")) === 0);

    /*
     * 🔴 C7: the live balance crossing the line is not enough. The warning reads
     * the balance the company's own page shows, so its arrival dates nobody's
     * session.
     */
    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 1000, published_balance_cents = 10000 WHERE sponsor_id = ${sponsorId}`);
    await alertPots();
    check(
      "🔴 C7 a pot whose LIVE balance fell, and whose published one has not, is not warned",
      (await sent("low")) === 0,
      `${await sent("low")} low`,
    );

    await db.execute(sql`UPDATE sponsor_pots SET published_balance_cents = 1000 WHERE sponsor_id = ${sponsorId}`);
    await alertPots();
    await alertPots();
    check(
      "W1-20 a pot below a fifth of its last top up is warned, once",
      (await sent("low")) === 1 && (await sent("empty")) === 0,
      `${await sent("low")} low, ${await sent("empty")} empty`,
    );

    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 0 WHERE sponsor_id = ${sponsorId}`);
    await alertPots();
    await alertPots();
    check(
      "W1-20 an empty pot is alerted once per period, however many days it stays empty",
      (await sent("empty")) === 1,
      `${await sent("empty")} empty alert(s) over two runs`,
    );
  } finally {
    await db.execute(sql`DELETE FROM audit_log WHERE resource_id IN
      (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM delivery_attempts
      WHERE kind IN ('sponsor.pot_empty', 'sponsor.pot_low') AND created_at >= ${started}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM sponsor_users WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsorId}`);
  }
}

/* ================================================================== */
/*  W1-21 · no company screen counts real enrolments over a week       */
/* ================================================================== */

async function companyCounters(db: ReturnType<typeof connect>["db"]) {
  const chrome = readSource("components/sponsor/chrome.tsx");
  check(
    "W1-21 the Integrations tab is not in the company nav",
    !chrome.includes('"/sponsor/integrations"'),
    "components/sponsor/chrome.tsx",
  );

  const page = readSource("app/(sponsor)/sponsor/integrations/page.tsx");
  check(
    "W1-21 /sponsor/integrations sends the reader to /sponsor",
    /redirect\("\/sponsor"\)/.test(page) && !/failedAttemptsFor/.test(page),
    "app/(sponsor)/sponsor/integrations/page.tsx",
  );

  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = `${dir}/${entry}`;
      return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(entry) ? [path] : [];
    });
  const routes = walk("app/(sponsor)").filter((file) => /\/(page|layout)\.tsx$/.test(file));
  const showing = routes.filter((file) => readSource(file).includes("failedAttemptsFor"));
  check(
    "W1-21 no company page shows failedAttemptsFor",
    routes.length > 5 && showing.length === 0,
    showing.join(", ") || `${routes.length} company routes read`,
  );

  /* The code page's count, through the real enrolment, success then failure. */
  const code = `W1D${Date.now().toString(36).toUpperCase()}`;
  const [sp] = (
    await db.execute(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${`W1D Code ${fixture}`}, 'company', 'us', 'USD', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const sponsorId = required(sp, "a sponsor").id;
  const [pe] = (
    await db.execute(sql`
      INSERT INTO people (first_name, last_name, region) VALUES ('Em', 'Ployee', 'us') RETURNING id`)
  ).rows as { id: string }[];
  const personId = required(pe, "a person").id;

  const { subjectKey, callerKey } = await import("../lib/rate-limit");
  try {
    await db.execute(sql`INSERT INTO sponsor_codes (sponsor_id, code) VALUES (${sponsorId}, ${code})`);
    /* 🔴 0162 / ruling 15: every way in is an email, so the code's gate is a staff list. */
    await db.execute(sql`
      INSERT INTO sponsor_identifier_fields (sponsor_id, kind) VALUES (${sponsorId}, 'listed_email')`);
    const staffEmail = `em.${code.toLowerCase()}@example.com`;
    const { replaceEmailList } = await import("../lib/data/sponsor-email-list");
    await replaceEmailList(sponsorId, [staffEmail]);

    const { enrol } = await import("../lib/data/enrolment");
    const { attemptsOnCode } = await import("../lib/data/sponsors");

    const joined = await enrol({ personId, code, identifier: staffEmail });
    const afterSuccess = await attemptsOnCode(code);
    check(
      "W1-21 a successful enrolment is not counted as an attempt on the code",
      joined.ok && afterSuccess === 0,
      `${joined.ok ? "enrolled" : "not enrolled"}, count ${afterSuccess}`,
    );

    await enrol({ personId, code, identifier: "not.on.the.list@example.com" });
    check(
      "W1-21 CONTROL …and a failed attempt is",
      (await attemptsOnCode(code)) === afterSuccess + 1,
      `count ${await attemptsOnCode(code)}`,
    );
  } finally {
    await db.execute(sql`DELETE FROM rate_limits WHERE key IN
      (${subjectKey("enrol-code", code)}, ${await callerKey(`enrol:${code}`)})`);
    await db.execute(sql`DELETE FROM enrolment_attestations WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM patient_notifications WHERE person_id = ${personId}`);
    await db.execute(sql`DELETE FROM sponsor_identifier_fields WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM sponsor_email_list WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM sponsor_codes WHERE sponsor_id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE id = ${sponsorId})`);
    await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsorId}`);
    await db.execute(sql`DELETE FROM people WHERE id = ${personId}`);
  }
}

async function main() {
  await stubModules();
  writesTo();

  const { pool, db } = connect();
  try {
    await totalView(db);
    await clinicNames(db);
    await csvFormulas(db);
    await potAlerts(db);
    await companyCounters(db);
  } finally {
    await db.execute(sql`DELETE FROM audit_log WHERE actor_user_id IN
      (SELECT id FROM users WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM audit_log WHERE actor_clinic_manager_id IN
      (SELECT id FROM clinic_managers WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM clinic_managers WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM copilot_messages WHERE thread_id IN
      (SELECT id FROM copilot_threads WHERE organization_id IN
        (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`}))`);
    await db.execute(sql`DELETE FROM copilot_threads WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM transcript_segments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    // W1-26's plants, before the sessions and patients they point at.
    await db.execute(sql`DELETE FROM risk_assessments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM session_feedback WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM sessions WHERE feedback_token LIKE ${`${fixture}%`}`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug LIKE ${`${fixture}%`}`);
    await pool.end();
  }

  finish("wave 1D");
}

main();
