/**
 * 🔴 WAVE 2, THE PATIENT: EVERY DEAD END GETS A WAY FORWARD.
 *
 *   npm run verify:w2p
 *
 * One section per item in `takeover/FIX-PLAN.md` that needs rows to prove.
 * The ones that do not are in `tests/patient-stuck.test.ts`. Each was written
 * to fail on the code before its fix.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w2p${Date.now().toString(36)}`;

async function main() {
  writesTo();

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug, kind)
      VALUES ('Wave 2 Patient Demo Practice', 'eg', ${fixture}, 'solo') RETURNING id`);

    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash)
      VALUES (${org.id}, ${`salma.${fixture}@example.com`}, 'Salma', 'Demo', 'therapist', 'x')
      RETURNING id`);

    const person = await one<{ id: string }>(sql`
      INSERT INTO people (first_name, last_name, email)
      VALUES ('Laila', 'Demo', ${`laila.${fixture}@example.com`}) RETURNING id`);

    const account = await one<{ id: string }>(sql`
      INSERT INTO patient_accounts (person_id, phone)
      VALUES (${person.id}, ${`+2010${String(Date.now()).slice(-8)}`}) RETURNING id`);

    /* ================================================================ */
    /*  W2-P03 · AN EMAIL CAN BE ADDED, AND ONLY ONCE IT IS PROVED       */
    /* ================================================================ */

    const { issueEmailCode, confirmEmailCode } = await import("../lib/patient-auth/email");
    const address = `laila.${fixture}@example.com`;

    const issued = await issueEmailCode(account.id, address);
    const before = await one<{ email: string | null }>(sql`
      SELECT email FROM patient_accounts WHERE id = ${account.id}`);
    check(
      "W2-P03 asking for a code writes no address yet, so nobody can park a stranger's",
      issued.ok && issued.code !== null && before.email === null,
      `issued=${issued.ok}, email=${before.email}`,
    );

    const code = issued.ok ? (issued.code ?? "") : "";
    const elsewhere = await confirmEmailCode(account.id, `someone.${fixture}@example.com`, code);
    check(
      "🔴 W2-P03 CONTROL the right code for a DIFFERENT address writes nothing",
      !elsewhere.ok,
      elsewhere.ok ? "IT WROTE AN ADDRESS NOBODY PROVED" : "refused",
    );

    const proved = await confirmEmailCode(account.id, address, code);
    const after = await one<{ email: string | null; verified: boolean }>(sql`
      SELECT email, email_verified_at IS NOT NULL AS verified FROM patient_accounts
       WHERE id = ${account.id}`);
    check(
      "🔴 W2-P03 the code and the address together add it, verified",
      proved.ok && after.email === address && after.verified,
      `email=${after.email}, verified=${after.verified}`,
    );
  } finally {
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patients WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM patient_accounts WHERE person_id IN
      (SELECT id FROM people WHERE email LIKE ${`%${fixture}@example.com`})`);
    await db.execute(sql`DELETE FROM people WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("wave 2, the patient");
}

main();
