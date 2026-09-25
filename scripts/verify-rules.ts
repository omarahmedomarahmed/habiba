/**
 * 🔴 0161 — EVERY RULE IS A SETTING (docs/DECISIONS.md, rounds one and two).
 *
 * Proves, against the dev database:
 *   - the rules group seeds to the founder's rulings and parses a bad value to
 *     its default rather than to something unintended;
 *   - session VAT is exempt by default and the country rate only on `standard`;
 *   - every settings write leaves a history row with the whole value before
 *     and after;
 *   - the two-person rule with its switch off keeps only "not your own money";
 *   - the two acts that keep two people ask, refuse the asker, and go on the
 *     second person's word, with the database refusing the asker too;
 *   - each place a switch is meant to be read actually reads it.
 */
import { readFileSync } from "node:fs";

import { and, eq, sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const fixture = `rules-${Date.now().toString(36)}`;
/* AE68: a user-assigned ISO code, so no real country's settings are touched. */
const CRISIS_CODE = "XQ";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function main() {
  writesTo();
  const { check, finish } = reporter();
  const { pool, db } = connect();

  const defs = await import("../lib/settings/defs");
  const { RULES_DEFAULTS, parseGroup, sessionVatBpsFor, topUpVatBpsFor } = defs;
  const { settingsChanges } = await import("../lib/settings/changes");
  const { fourEyesProblem } = await import("../lib/billing/four-eyes");

  /* ------------------------------------------------ the rulings, as seeded */
  const seeded = parseGroup("rules", undefined);
  check(
    "ruling 2: a session price is VAT-exempt by default",
    seeded.tax.sessionVat === "exempt" && sessionVatBpsFor(seeded, 1400) === 0,
    JSON.stringify(seeded.tax),
  );
  check(
    "ruling 2 CONTROL: `standard` charges the country rate",
    sessionVatBpsFor({ ...seeded, tax: { ...seeded.tax, sessionVat: "standard" } }, 1400) === 1400,
  );
  check(
    "top-up VAT follows its own rule, country rate by default until counsel answers",
    topUpVatBpsFor(seeded, 1400) === 1400 &&
      topUpVatBpsFor({ ...seeded, tax: { ...seeded.tax, topUpVat: "exempt" } }, 1400) === 0,
  );
  check(
    "ruling 13 / 13c: two people on refunds, transfers without proof and ledger edits; one on the rest",
    seeded.approvals.refunds &&
      seeded.approvals.transferWithoutProof &&
      seeded.approvals.ledgerAdjustments &&
      !seeded.approvals.payouts &&
      !seeded.approvals.potReturns &&
      !seeded.approvals.verifications,
    JSON.stringify(seeded.approvals),
  );
  check(
    "ruling 16: a full refund up to 24 hours before; ruling 3: withholding 0 until counsel rules",
    seeded.refunds.patientCancelWindowHours === 24 && seeded.tax.payoutWithholdingBps === 0,
  );
  const junk = parseGroup("rules", {
    tax: { sessionVat: "maybe", payoutWithholdingBps: -5 },
    approvals: { payouts: "yes", payoutDetailsCooldownHours: 99_999 },
    links: { radarLinkHours: 0 },
  });
  check(
    "a bad stored value parses to the ruling, never to something nobody chose",
    junk.tax.sessionVat === RULES_DEFAULTS.tax.sessionVat &&
      junk.tax.payoutWithholdingBps === 0 &&
      junk.approvals.payouts === RULES_DEFAULTS.approvals.payouts &&
      junk.approvals.payoutDetailsCooldownHours === RULES_DEFAULTS.approvals.payoutDetailsCooldownHours &&
      junk.links.radarLinkHours === RULES_DEFAULTS.links.radarLinkHours,
    JSON.stringify(junk.approvals),
  );
  check(
    "a change is described field by field",
    settingsChanges(seeded, { ...seeded, approvals: { ...seeded.approvals, payouts: true } }).join() ===
      "approvals.payouts false to true",
  );

  /* ---------------------------------------------- the switch, both positions */
  const base = {
    actorUserId: "me",
    payeeUserId: "clinician",
    editorUserId: "me",
    amountCents: 90_000,
    thresholdCents: 50_000,
    ownerUserId: null,
    movesMoney: true,
  };
  check(
    "🔴 switch ON: the editor and the second-person rules refuse",
    fourEyesProblem({ ...base, twoPeople: true }) === "editor" &&
      fourEyesProblem({ ...base, editorUserId: null, twoPeople: true }) === "second_person",
  );
  check(
    "🔴 switch OFF: one person may act, but never on money they are paid",
    fourEyesProblem({ ...base, twoPeople: false }) === null &&
      fourEyesProblem({ ...base, payeeUserId: "me", twoPeople: false }) === "payee",
  );

  /* --------------------------------------------------- history, on the row */
  const { readGroupRaw, writeSettingsGroup } = await import("../lib/settings");
  const { settingsHistory, pendingApprovals, organizations, users } = await import("../lib/db/schema");
  const stored = await readGroupRaw("rules");
  const flipped = { ...seeded, links: { ...seeded.links, radarLinkHours: 4 } };
  try {
    await writeSettingsGroup({ group: "rules", value: flipped, updatedBy: null });
    const [last] = await db
      .select()
      .from(settingsHistory)
      .where(and(eq(settingsHistory.scope, "platform"), eq(settingsHistory.key, "rules")))
      .orderBy(sql`${settingsHistory.changedAt} DESC`)
      .limit(1);
    const after = last?.after as { links?: { radarLinkHours?: number } } | undefined;
    check(
      "every settings write leaves the whole value before and after",
      after?.links?.radarLinkHours === 4,
      JSON.stringify(after?.links ?? null),
    );
  } finally {
    await writeSettingsGroup({ group: "rules", value: stored?.value ?? RULES_DEFAULTS, updatedBy: null });
  }

  /* --------------------------------- the two acts that keep a second person */
  const [org] = await db
    .insert(organizations)
    .values({ name: `${fixture} ops`, region: "eg", slug: fixture })
    .returning({ id: organizations.id });
  const [a] = await db
    .insert(users)
    .values({
      organizationId: required(org, "org").id,
      email: `a.${fixture}@example.com`,
      firstName: "Asker",
      lastName: "A",
      role: "super_admin",
      passwordHash: "x",
    })
    .returning({ id: users.id });
  const [b] = await db
    .insert(users)
    .values({
      organizationId: required(org, "org").id,
      email: `b.${fixture}@example.com`,
      firstName: "Second",
      lastName: "B",
      role: "super_admin",
      passwordHash: "x",
    })
    .returning({ id: users.id });

  try {
    const { closeApproval, secondPersonGate } = await import("../lib/billing/approvals");
    const ask = (actor: string, enabled = true) =>
      secondPersonGate({
        kind: "ledger_adjustment",
        subjectId: fixture,
        payload: { amountCents: 100 },
        reason: "A bank fee the statement shows and the books do not",
        actorUserId: actor,
        enabled,
      });
    const off = await ask(required(a, "a").id, false);
    check("switch OFF: the act goes ahead at once", off.go === true && off.approvalId === null);

    const first = await ask(required(a, "a").id);
    const again = await ask(required(a, "a").id);
    const second = await ask(required(b, "b").id);
    check(
      "🔴 switch ON: the first person asks, the same person is refused, a second person goes",
      first.go === false && again.go === false && second.go === true && Boolean(second.approvalId),
      JSON.stringify({ first, again, second: second.go }),
    );
    const byAsker =
      second.go && second.approvalId
        ? await closeApproval({ approvalId: second.approvalId, decidedBy: required(a, "a").id, state: "done" })
        : true;
    const forged = await db
      .execute(
        sql`UPDATE pending_approvals SET state = 'done', decided_by = asked_by, decided_at = now()
             WHERE kind = 'ledger_adjustment' AND subject_id = ${fixture}`,
      )
      .then(
        () => "written",
        () => "refused",
      );
    const bySecond =
      second.go && second.approvalId
        ? await closeApproval({ approvalId: second.approvalId, decidedBy: required(b, "b").id, state: "done" })
        : false;
    check(
      "🔴 the asker cannot close it, not even by hand in the database; the second person can, once",
      byAsker === false && forged === "refused" && bySecond === true,
      JSON.stringify({ byAsker, forged, bySecond }),
    );

    /*
     * 🔴 K3 / 0172: with one owner a ledger adjustment could never be posted,
     * because nothing could make a second. An owner invite is now a kind the
     * database accepts (before 0172 its CHECK refused the insert and this
     * threw), and once another owner exists the invite waits for them.
     */
    const { otherActiveOwners } = await import("../lib/data/admin-team");
    const others = await otherActiveOwners(required(a, "a").id);
    const invite = (actor: string) =>
      secondPersonGate({
        kind: "owner_invite",
        subjectId: `owner.${fixture}@example.com`,
        payload: { email: `owner.${fixture}@example.com`, firstName: "Owner", lastName: "Three" },
        reason: "A third owner to share the approvals",
        actorUserId: actor,
        enabled: others > 0,
      });
    const ownerAsked = await invite(required(a, "a").id);
    const ownerSecond = await invite(required(b, "b").id);
    check(
      "🔴 K3: an owner invite is recorded, and a second owner completes it",
      others >= 1 && ownerAsked.go === false && ownerSecond.go === true && Boolean(ownerSecond.approvalId),
      JSON.stringify({ others, asked: ownerAsked.go, second: ownerSecond.go }),
    );
    const team = read("app/(admin)/admin/team/actions.ts");
    const inviteBody = team.slice(team.indexOf("export async function inviteOwner("));
    check(
      "K3: the owner invite needs a reason, and a second owner whenever another one exists",
      /reasonProblem\(reason\)/.test(inviteBody) &&
        /kind: "owner_invite"[\s\S]*enabled: \(await otherActiveOwners\(actor\.userId\)\) > 0/.test(inviteBody) &&
        /role: "super_admin"/.test(inviteBody),
    );

    /*
     * 🔴 AE68: the crisis line's "checked by, on" moves only when the line
     * does. Every country save used to re-stamp it with whoever saved, so a
     * VAT edit claimed somebody had checked a crisis number they never read.
     * Planted on a user-assigned code nobody serves.
     */
    const { writeCountrySettings } = await import("../lib/settings");
    const { parseCountry } = defs;
    const line = (label: string, vatBps: number) =>
      parseCountry({
        code: CRISIS_CODE,
        name: `Verifier ${fixture}`,
        vatBps,
        currency: "usd",
        paymentMethods: [],
        crisisLineLabel: label,
        crisisLineTel: label.replace(/ /g, ""),
        enabled: false,
      });
    const stamp = async () =>
      (
        await db.execute<{ at: string | null; by: string | null }>(
          sql`SELECT crisis_line_verified_at::text AS at, crisis_line_verified_by::text AS by
                FROM country_settings WHERE code = ${CRISIS_CODE}`,
        )
      ).rows[0];
    await writeCountrySettings({ country: line("+100 555 0101", 0), updatedBy: required(a, "a").id });
    await db.execute(sql`UPDATE country_settings SET crisis_line_verified_at = '2026-01-02T03:04:05Z' WHERE code = ${CRISIS_CODE}`);
    const checkedByA = await stamp();
    await writeCountrySettings({ country: line("+100 555 0101", 1400), updatedBy: required(b, "b").id });
    const afterVat = await stamp();
    check(
      "🔴 AE68 saving a country without touching its crisis line keeps who checked the line, and when",
      afterVat?.by === required(a, "a").id && afterVat?.at === checkedByA?.at,
      JSON.stringify({ checkedByA, afterVat }),
    );
    await writeCountrySettings({ country: line("+100 555 0199", 1400), updatedBy: required(b, "b").id });
    const afterNumber = await stamp();
    check(
      "AE68 CONTROL a new number is stamped with the person who saved it",
      afterNumber?.by === required(b, "b").id && afterNumber?.at !== checkedByA?.at,
      JSON.stringify(afterNumber),
    );
  } finally {
    await db.execute(sql`DELETE FROM country_settings WHERE code = ${CRISIS_CODE}`);
    await db.execute(sql`DELETE FROM settings_history WHERE scope = 'country' AND key = ${CRISIS_CODE}`);
    await db.delete(pendingApprovals).where(eq(pendingApprovals.subjectId, fixture));
    await db.delete(pendingApprovals).where(eq(pendingApprovals.subjectId, `owner.${fixture}@example.com`));
    await db.execute(sql`DELETE FROM settings_history WHERE changed_by IN (SELECT id FROM users WHERE email LIKE ${`%.${fixture}@example.com`})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%.${fixture}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
  }

  /* ------------------------------- each switch is read where it is meant to be */
  const reads: [string, string, RegExp][] = [
    ["payouts: approve, send by hand, send by provider", "lib/billing/payouts.ts", /rules\.approvals\.payouts[\s\S]*approverSends[\s\S]*detailsCoolingDown/],
    ["refunds: send, cancel, company share", "lib/billing/refunds.ts", /rules\.approvals\.refunds/],
    ["money back to a company", "lib/billing/pot-return.ts", /rules\.approvals\.potReturns/],
    ["verification", "lib/data/verification.ts", /rules\.approvals\.verifications/],
    ["a transfer without proof", "app/(admin)/admin/transfers/actions.ts", /rules\.approvals\.transferWithoutProof/],
    ["a ledger adjustment", "app/(admin)/admin/actions.ts", /rules\.approvals\.ledgerAdjustments/],
    ["the pay page's VAT", "app/pay/[token]/actions.ts", /sessionVatBpsFor\(/],
    ["the transfer quote's VAT", "lib/billing/manual-entry.ts", /sessionVatBpsFor\(/],
    ["the new-session preview's VAT", "app/(app)/sessions/new/page.tsx", /sessionVatBpsFor\(/],
    ["top-up VAT", "lib/billing/pot.ts", /topUpVatBpsFor\(/],
    ["which card gateway and payouts provider", "lib/billing/gateway/index.ts", /rules\.providers/],
    ["the card fee the checkout charges", "lib/billing/gateway/session.ts", /cardFeeMinorFor\(/],
    ["the card fee line on the pay page", "app/pay/[token]/page.tsx", /cardFeeMinorFor\(/],
    ["session and radar link lifetimes", "lib/data/sessions.ts", /rules\.links\.sessionLinkHours[\s\S]*rules\.links\.radarLinkHours/],
    ["booking link lifetime", "lib/data/scheduling.ts", /rules\.links\.bookingLinkHoursAfterStart/],
    ["the daily one-person digest runs", "app/api/cron/[job]/route.ts", /sendOneHandDigest/],
  ];
  for (const [what, path, pattern] of reads) {
    check(`the switch is read: ${what}`, pattern.test(read(path)), path);
  }
  const payouts = read("lib/billing/payouts.ts");
  for (const fn of ["approvePayout", "markPayoutSent", "sendViaProvider"]) {
    const body = payouts.slice(payouts.indexOf(`export async function ${fn}(`));
    check(
      `🔴 ${fn} waits out a payout destination somebody else just changed`,
      /detailsCoolingDown\(/.test(body.slice(0, body.indexOf("\n}\n"))),
    );
  }

  await pool.end();
  finish("rules");
}

void main();
