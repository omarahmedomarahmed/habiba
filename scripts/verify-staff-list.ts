/**
 * 🔴 0162 / RULING 15 — EVERY WAY IN IS AN EMAIL, AND THE STAFF LIST IS UNREADABLE.
 *
 * Proves, against the dev database:
 *   - an employee ID cannot be the way in by itself: the company cannot add
 *     one before an email rule, and cannot leave one alone;
 *   - an email on the uploaded list enrols and waits for its code; one off the
 *     list does not;
 *   - when the company also asks for an ID, the email alone is refused;
 *   - nothing on the list is stored as an address;
 *   - an upload that leaves someone off marks them, and past the grace period
 *     their benefit pauses.
 */
import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const fixture = `list-${Date.now().toString(36)}`;

async function main() {
  writesTo();
  const { check, finish } = reporter();
  const { pool, db } = connect();
  const one = async <T,>(text: ReturnType<typeof sql>) =>
    required((await db.execute(text)).rows[0] as T | undefined, "a planted row");

  const { parseEmailList, replaceEmailList, pauseDroppedFromLists } = await import("../lib/data/sponsor-email-list");
  const parsed = parseEmailList('email\n"Amal@Example.com", amal@example.com; not-an-email\nomar@example.com');
  check(
    "a pasted list is cleaned: the header and a bad line skipped, case and duplicates folded",
    parsed.emails.length === 2 && parsed.skipped === 2 && parsed.emails.includes("amal@example.com"),
    JSON.stringify(parsed),
  );

  const sponsor = await one<{ id: string }>(sql`
    INSERT INTO sponsors (name, kind, entity, currency, state)
    VALUES (${`List Co ${fixture}`}, 'company', 'eg', 'EGP', 'active') RETURNING id`);
  const code = fixture.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  await db.execute(sql`INSERT INTO sponsor_codes (sponsor_id, code) VALUES (${sponsor.id}, ${code})`);
  const person = async (first: string) =>
    one<{ id: string }>(sql`INSERT INTO people (first_name, last_name, region) VALUES (${first}, 'Demo', 'eg') RETURNING id`);

  try {
    const { setIdentifierField, removeIdentifierField } = await import("../lib/data/sponsor-admin");
    const idAlone = await setIdentifierField({
      sponsorId: sponsor.id,
      kind: "id_number",
      domain: null,
      pattern: "[0-9]{6}",
      shapeHint: "six digits",
    });
    check("🔴 an employee ID cannot be added before an email rule", Boolean(idAlone.error), idAlone.error ?? "ADDED");

    const listed = await setIdentifierField({ sponsorId: sponsor.id, kind: "listed_email", domain: null, pattern: null, shapeHint: null });
    const idAlso = await setIdentifierField({
      sponsorId: sponsor.id,
      kind: "id_number",
      domain: null,
      pattern: "[0-9]{6}",
      shapeHint: "six digits",
    });
    check("…and after the staff list rule it can, as well as the email", Boolean(listed.ok) && Boolean(idAlso.ok));

    const fields = (await db.execute(sql`SELECT id, kind FROM sponsor_identifier_fields WHERE sponsor_id = ${sponsor.id}`))
      .rows as { id: string; kind: string }[];
    const listField = required(fields.find((f) => f.kind === "listed_email"), "the list rule");
    const leftAlone = await removeIdentifierField(sponsor.id, listField.id);
    check("🔴 the email rule cannot be removed while it would leave the ID rule alone", Boolean(leftAlone.error));

    const staff = `amal.${fixture}@example.com`;
    const uploaded = await replaceEmailList(sponsor.id, [staff, `omar.${fixture}@example.com`]);
    const rows = (await db.execute(sql`SELECT email_hash FROM sponsor_email_list WHERE sponsor_id = ${sponsor.id}`))
      .rows as { email_hash: string }[];
    check(
      "🔴 the list stores no address: two rows, neither of them readable",
      uploaded.onList === 2 && rows.length === 2 && rows.every((r) => !r.email_hash.includes("@")),
      JSON.stringify(uploaded),
    );

    const { enrol } = await import("../lib/data/enrolment");
    const amal = await person("Amal");
    const noId = await enrol({ personId: amal.id, code, identifier: staff });
    check("🔴 with an ID asked as well, the email alone is refused", !noId.ok);

    const joined = await enrol({ personId: amal.id, code, identifier: staff, employeeId: "123456" });
    const row = await one<{ kind: string; verified: string | null }>(sql`
      SELECT identifier_kind AS kind, last_verified_at AS verified FROM enrolments
       WHERE sponsor_id = ${sponsor.id} AND person_id = ${amal.id}`);
    check(
      "🔴 an email on the list with its ID enrols, and waits for its code before any money",
      joined.ok && joined.needsVerification === true && row.kind === "listed_email" && row.verified === null,
      JSON.stringify({ joined, row }),
    );

    const stranger = await person("Stranger");
    const off = await enrol({ personId: stranger.id, code, identifier: `nobody.${fixture}@example.com`, employeeId: "123456" });
    check("an email that is not on the list is refused", !off.ok);

    await db.execute(sql`UPDATE enrolments SET last_verified_at = now() WHERE sponsor_id = ${sponsor.id}`);
    const again = await replaceEmailList(sponsor.id, [`omar.${fixture}@example.com`]);
    const kept = await pauseDroppedFromLists(14);
    const keptRow = await one<{ paused: string | null }>(sql`
      SELECT paused_at AS paused FROM enrolments WHERE sponsor_id = ${sponsor.id} AND person_id = ${amal.id}`);
    check(
      "taken off the list, the benefit keeps going through the grace period",
      again.removed === 1 && kept.paused === 0 && keptRow.paused === null,
      JSON.stringify({ again, kept }),
    );
    await db.execute(sql`UPDATE sponsor_email_list SET removed_at = now() - interval '15 days'
                          WHERE sponsor_id = ${sponsor.id} AND removed_at IS NOT NULL`);
    const paused = await pauseDroppedFromLists(14);
    const pausedRow = await one<{ paused: string | null }>(sql`
      SELECT paused_at AS paused FROM enrolments WHERE sponsor_id = ${sponsor.id} AND person_id = ${amal.id}`);
    check(
      "🔴 …and pauses once it has passed, told to the person",
      paused.paused === 1 && pausedRow.paused !== null,
      JSON.stringify(paused),
    );
  } finally {
    await db.execute(sql`DELETE FROM patient_notifications WHERE person_id IN
      (SELECT person_id FROM enrolments WHERE sponsor_id = ${sponsor.id})`);
    await db.execute(sql`DELETE FROM enrolment_attestations WHERE sponsor_id = ${sponsor.id}`);
    const people = (await db.execute(sql`SELECT person_id FROM enrolments WHERE sponsor_id = ${sponsor.id}`))
      .rows as { person_id: string }[];
    await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsor.id}`);
    for (const p of people) await db.execute(sql`DELETE FROM people WHERE id = ${p.person_id}`);
    await db.execute(sql`DELETE FROM people WHERE first_name IN ('Amal', 'Stranger') AND last_name = 'Demo'
                          AND NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.person_id = people.id)
                          AND NOT EXISTS (SELECT 1 FROM patient_accounts a WHERE a.person_id = people.id)
                          AND created_at > now() - interval '1 hour'`);
    await db.execute(sql`DELETE FROM sponsor_email_list WHERE sponsor_id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM sponsor_identifier_fields WHERE sponsor_id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM sponsor_codes WHERE sponsor_id = ${sponsor.id}`);
    await db.execute(sql`DELETE FROM rate_limits WHERE key LIKE ${`%${code}%`}`);
    await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsor.id}`);
  }

  await pool.end();
  finish("staff list");
}

void main();
