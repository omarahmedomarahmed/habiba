/**
 * Wave 2, clinician and clinic: the clinic principal's password lifecycle.
 *
 *   npm run verify:w2c
 *
 * 🔴 NEEDS MIGRATION 0131 (`clinic_auth_tokens`). Until it is applied this
 * fails at the first insert, which is the honest result: the table the checks
 * are about does not exist yet.
 *
 * W2-C04: a clinic admin added staff by typing their password; there was no
 * remove, no change of role and no sign-out. W2-C05: no clinic manager or
 * staff member could reset a forgotten password. Everything below is planted
 * and removed by this run (H29), on a clinic nobody else uses.
 */
import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

async function main() {
  writesTo();
  const fixture = `w2c-${randomBytes(4).toString("hex")}`;
  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    const clinic = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, slug, kind, clinic_state)
      VALUES (${fixture}, ${fixture}, 'clinic', 'active') RETURNING id`);
    const other = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, slug, kind, clinic_state)
      VALUES (${`${fixture}-other`}, ${`${fixture}-other`}, 'clinic', 'active') RETURNING id`);
    const admin = await one<{ id: string }>(sql`
      INSERT INTO clinic_managers (organization_id, email, password_hash, role)
      VALUES (${clinic.id}, ${`admin-${fixture}@example.com`}, 'x', 'admin') RETURNING id`);
    const role = await one<{ id: string }>(sql`
      INSERT INTO clinic_roles (organization_id, slot, name, capabilities)
      VALUES (${clinic.id}, 1, 'Reception', '["schedule.read"]'::jsonb) RETURNING id`);
    const role2 = await one<{ id: string }>(sql`
      INSERT INTO clinic_roles (organization_id, slot, name, capabilities)
      VALUES (${clinic.id}, 2, 'Office', '["bills.read"]'::jsonb) RETURNING id`);
    const foreignRole = await one<{ id: string }>(sql`
      INSERT INTO clinic_roles (organization_id, slot, name, capabilities)
      VALUES (${other.id}, 1, 'Theirs', '["schedule.read"]'::jsonb) RETURNING id`);

    const { addStaff, changeStaffRole, removeStaff, signOutStaff } = await import(
      "../lib/data/clinic-team"
    );
    const { checkClinicPassword } = await import("../lib/data/clinic-admin");
    const tokens = await import("../lib/clinic-auth/tokens");

    /* ------------------------------------------------ C04 · invited, not typed */

    const email = `staff-${fixture}@example.com`;
    const added = await addStaff({
      clinicOrganizationId: clinic.id,
      email,
      name: "Dina Example",
      roleId: role.id,
    });
    const staffId = required(added.id, "a staff member");

    const hash = await one<{ password_hash: string | null }>(sql`
      SELECT password_hash FROM clinic_managers WHERE id = ${staffId}`);
    check(
      "🔴 W2-C04 a staff member is created with no password, so nobody chose one for them",
      hash.password_hash === null,
      hash.password_hash === null ? "no password until they choose one" : "a password was set",
    );

    check(
      "🔴 W2-C04 …and cannot sign in until they have used their link",
      Boolean((await checkClinicPassword(email, "anything at all 123")).error),
      "refused",
    );

    const invite = await tokens.issueClinicToken(staffId, "invite");
    const view = await tokens.clinicTokenView(invite);
    check(
      "CONTROL the invitation link resolves to them and their practice",
      view?.purpose === "invite" && view.email === email && view.clinicName === fixture,
      JSON.stringify(view),
    );

    const stored = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM clinic_auth_tokens WHERE token_hash = ${invite}`);
    check("🔴 W2-C04 the raw token is never stored", Number(stored.n) === 0, "only its hash");

    const short = await tokens.setClinicPasswordByToken(invite, "short");
    check(
      "W2-C04 a password that fails the rule is refused, and the link survives it",
      short.error === "password" && (await tokens.clinicTokenView(invite)) !== null,
      short.problem ?? "",
    );

    const chosen = await tokens.setClinicPasswordByToken(invite, "a long enough password");
    check(
      "🔴 W2-C04 the staff member chooses their own password from the link",
      chosen.clinicManagerId === staffId &&
        !(await checkClinicPassword(email, "a long enough password")).error,
      chosen.error ?? "signed in with the password they chose",
    );

    const again = await tokens.setClinicPasswordByToken(invite, "a different password 9");
    check("🔴 W2-C04 a link works once", again.error === "link", again.error ?? "used twice");

    /* ------------------------------------------------ C05 · a reset, by email */

    await db.execute(sql`
      INSERT INTO clinic_auth_sessions (clinic_manager_id, token_hash, absolute_expires_at)
      VALUES (${staffId}, ${`${fixture}-s1`}, now() + interval '1 hour')`);

    const asked = await tokens.requestClinicReset(email);
    const unknown = await tokens.requestClinicReset(`nobody-${fixture}@example.com`);
    check(
      "🔴 W2-C05 a clinic principal can ask for a reset; an unknown address gets nothing",
      asked === staffId && unknown === null,
      `${String(asked)} / ${String(unknown)}`,
    );

    const live = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM clinic_auth_tokens
       WHERE clinic_manager_id = ${staffId} AND purpose = 'password_reset' AND used_at IS NULL`);
    check("W2-C05 exactly one live reset link", Number(live.n) === 1, `${live.n}`);

    const reset = await tokens.issueClinicToken(staffId, "password_reset");
    const superseded = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM clinic_auth_tokens
       WHERE clinic_manager_id = ${staffId} AND purpose = 'password_reset' AND used_at IS NULL`);
    check("W2-C05 a second request supersedes the first", Number(superseded.n) === 1, `${superseded.n}`);

    const used = await tokens.setClinicPasswordByToken(reset, "another long password");
    const sessions = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM clinic_auth_sessions
       WHERE clinic_manager_id = ${staffId} AND revoked_at IS NULL`);
    check(
      "🔴 W2-C05 a reset sets the password and ends every session they held",
      used.clinicManagerId === staffId && Number(sessions.n) === 0,
      `${sessions.n} live session(s) after the reset`,
    );

    const expired = await tokens.issueClinicToken(staffId, "password_reset");
    await db.execute(sql`
      UPDATE clinic_auth_tokens SET expires_at = now() - interval '1 minute'
       WHERE clinic_manager_id = ${staffId} AND used_at IS NULL`);
    check(
      "W2-C05 an expired link is refused",
      (await tokens.setClinicPasswordByToken(expired, "yet another password")).error === "link",
      "expired",
    );

    /* ------------------------------------------------ C04 · the lifecycle */

    const foreign = await changeStaffRole({
      clinicOrganizationId: clinic.id,
      clinicManagerId: staffId,
      roleId: foreignRole.id,
    });
    const own = await changeStaffRole({
      clinicOrganizationId: clinic.id,
      clinicManagerId: staffId,
      roleId: role2.id,
    });
    const now = await one<{ role_id: string }>(sql`
      SELECT role_id FROM clinic_managers WHERE id = ${staffId}`);
    check(
      "🔴 W2-C04 a role can be changed, to one of the practice's own and no other",
      Boolean(foreign.error) && own.ok === true && now.role_id === role2.id,
      `${foreign.error ?? "a foreign role was accepted"}`,
    );

    await db.execute(sql`
      INSERT INTO clinic_auth_sessions (clinic_manager_id, token_hash, absolute_expires_at)
      VALUES (${staffId}, ${`${fixture}-s2`}, now() + interval '1 hour'),
             (${staffId}, ${`${fixture}-s3`}, now() + interval '1 hour')`);
    const out = await signOutStaff({ clinicOrganizationId: clinic.id, clinicManagerId: staffId });
    check("🔴 W2-C04 a staff member can be signed out everywhere", out.ended === 2, `${out.ended}`);

    const notOwner = await removeStaff({ clinicOrganizationId: clinic.id, clinicManagerId: admin.id });
    check(
      "🔴 W2-C04 the practice's owner cannot be removed, re-roled or signed out from here",
      Boolean(notOwner.error) &&
        Boolean((await signOutStaff({ clinicOrganizationId: clinic.id, clinicManagerId: admin.id })).error),
      notOwner.error ?? "the owner was removed",
    );

    const fromElsewhere = await removeStaff({ clinicOrganizationId: other.id, clinicManagerId: staffId });
    const removed = await removeStaff({ clinicOrganizationId: clinic.id, clinicManagerId: staffId });
    check(
      "🔴 W2-C04 a staff member can be removed, by their own practice only, and cannot sign in after",
      Boolean(fromElsewhere.error) &&
        removed.ok === true &&
        Boolean((await checkClinicPassword(email, "another long password")).error),
      removed.error ?? "removed",
    );
  } finally {
    await db.execute(sql`DELETE FROM audit_log WHERE actor_clinic_manager_id IN
      (SELECT id FROM clinic_managers WHERE email LIKE ${`%${fixture}%`})`);
    await db.execute(sql`DELETE FROM clinic_managers WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM clinic_roles WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${fixture}%`})`);
    await db.execute(sql`DELETE FROM organizations WHERE slug LIKE ${`${fixture}%`}`);
    await pool.end();
  }

  finish("wave 2 clinician and clinic");
}

void main();
