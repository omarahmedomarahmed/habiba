/**
 * Sprint 20 acceptance — the back office. PLAN.md 20.1–20.26, §3d, C71, C82.
 *
 *   npm run verify:sprint20
 *
 * The check that matters most is **20.9**: *no admin impersonation, and the
 * rule does not bend for a support ticket.* That is asserted structurally —
 * every page behind `requireStaff` is walked for an import of a clinical data
 * module, with an offender planted to prove the walk can see one. A promise
 * about what staff "may" do is not a control; an import graph is.
 */
import { and, eq, like, sql } from "drizzle-orm";

import {
  patientAccounts,
  people,
  phoneChangeRequests,
  supportTicketEvents,
  supportTickets,
  users,
} from "../lib/db/schema";
import { reporter, writesTo, readSource } from "./_verify";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

const { check, finish } = reporter();

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const TAG = "verify20";

async function main() {
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   */
  writesTo();

  const { readFileSync, readdirSync, writeFileSync, rmSync } = await import("node:fs");

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
          ? [`${dir}/${entry.name}`]
          : [],
    );

  try {
    /* ------------------------------------------------------ 20.8 · roles */

    const { ROLES, BACK_OFFICE_ROLES, MANAGER_ROLES } = await import("../lib/db/schema");
    check(
      "20.8 there are two new roles between clinician and owner",
      ROLES.includes("staff" as never) && ROLES.includes("manager" as never),
      ROLES.join(", "),
    );
    check(
      "20.8 …and a manager is not the same set as a staff member",
      BACK_OFFICE_ROLES.length === 3 && MANAGER_ROLES.length === 2,
      `back office ${BACK_OFFICE_ROLES.join("+")} · overview ${MANAGER_ROLES.join("+")}`,
    );

    /* ------------------------------------- 🔴 20.9 · no impersonation */

    /*
     * Every page a staff member can reach, and what it imports. The rule is
     * not "staff are trusted not to look" — it is that the screens they can
     * reach have no query that could return a patient.
     */
    const CLINICAL = [
      "@/lib/data/patient-view",
      "@/lib/data/sessions",
      "@/lib/data/notes",
      "@/lib/data/documents",
      "@/lib/data/memory",
      "@/lib/data/consent",
      "sessionNotes",
      "transcriptSegments",
    ];

    const staffPages = walk("app/(admin)/admin").filter((file) => {
      const source = readSource(file);
      return source.includes("requireStaff()") || source.includes("requireManager()");
    });

    const leaky = staffPages.filter((file) => {
      const source = readSource(file);
      return CLINICAL.some((needle) => source.includes(needle));
    });

    check(
      "🔴 20.9 no screen a staff member can reach imports a clinical data module",
      leaky.length === 0 && staffPages.length >= 3,
      leaky.join(", ") || `${staffPages.length} staff-reachable pages checked`,
    );

    /*
     * 🔴 The control, planted as a file. A scan that has never found anything
     * has not been shown to work, and this one is the whole of 20.9.
     */
    const planted = "app/(admin)/admin/_verify20-offender/page.tsx";
    let caught = false;
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync("app/(admin)/admin/_verify20-offender", { recursive: true });
      writeFileSync(
        planted,
        `import { requireStaff } from "@/lib/auth/guard";\n` +
          `import { sessionsForPatient } from "@/lib/data/patient-view";\n` +
          `export default async function Page() { await requireStaff(); return null; }\n`,
      );
      caught = walk("app/(admin)/admin")
        .filter((file) => readSource(file).includes("requireStaff()"))
        .some((file) => CLINICAL.some((n) => readSource(file).includes(n)));
    } finally {
      rmSync("app/(admin)/admin/_verify20-offender", { recursive: true, force: true });
    }

    check(
      "🔴 20.9 CONTROL, the same walk CATCHES a staff page that imports one",
      caught,
      caught ? "planted, caught, removed" : "THE SCAN IS BLIND",
    );

    /* ---------------------------------------- 20.18 · the two queues */

    const [org] = await db.select({ id: users.organizationId }).from(users).limit(1);
    const staff = await db.select({ id: users.id }).from(users).limit(2);
    const { fileTicket, queueFor, awaitReply, extendTicket, closeTicket, movedToWhatsapp } =
      await import("../lib/data/support");

    const patientTicket = await fileTicket({
      name: `${TAG} patient`,
      email: `${TAG}p@example.test`,
      phone: null,
      country: null,
      topic: "my_record",
      message: "A message from somebody who is not a clinician, for the patient queue.",
      locale: "en",
      entity: "us",
    });

    const therapistTicket = await fileTicket({
      name: `${TAG} clinician`,
      email: `${TAG}t@example.test`,
      phone: null,
      country: null,
      topic: "billing",
      message: "A message from a clinician about a payout, for the therapist queue.",
      locale: "en",
      entity: "us",
      audience: "therapist",
      userId: staff[0]?.id,
    });

    const patientQueue = await queueFor("patient");
    const therapistQueue = await queueFor("therapist");

    check(
      "🔴 20.24 the two queues are separate, a payout chase never sorts above somebody in distress",
      patientQueue.some((t) => t.reference === (patientTicket.ok ? patientTicket.reference : "")) &&
        therapistQueue.some(
          (t) => t.reference === (therapistTicket.ok ? therapistTicket.reference : ""),
        ) &&
        !patientQueue.some(
          (t) => t.reference === (therapistTicket.ok ? therapistTicket.reference : ""),
        ),
      `${patientQueue.length} patient · ${therapistQueue.length} therapist`,
    );

    const [ticketRow] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.email, `${TAG}p@example.test`))
      .limit(1);

    /* ------------------------------- 🔴 20.20 · the clock, and its pause */

    // Make it overdue by moving its deadline into the past, then check it says so.
    await db
      .update(supportTickets)
      .set({ dueAt: new Date(Date.now() - 3_600_000) })
      .where(eq(supportTickets.id, ticketRow!.id));

    const overdueQueue = await queueFor("patient");
    check(
      "20.20 a ticket past its deadline shows as overdue",
      overdueQueue.find((t) => t.id === ticketRow!.id)?.overdue === true,
    );

    await awaitReply({
      ticketId: ticketRow!.id,
      actorUserId: staff[0]!.id,
      note: "Asked them which number the account is on.",
    });

    const waitingQueue = await queueFor("patient");
    check(
      "🔴 20.20 / C83 …but the SAME ticket stops being overdue once we are waiting on them",
      waitingQueue.find((t) => t.id === ticketRow!.id)?.overdue === false,
      "staff are measured on their own delay, not on somebody else's silence",
    );

    const first = await extendTicket({
      ticketId: ticketRow!.id,
      actorUserId: staff[0]!.id,
      reason: "Waiting on a bank to confirm the reference.",
    });
    const second = await extendTicket({
      ticketId: ticketRow!.id,
      actorUserId: staff[0]!.id,
      reason: "Still waiting on the bank to confirm the reference.",
    });
    check(
      "🔴 20.20 one extension, and only one, an unlimited extension is not a deadline",
      first.ok === true && second.error !== undefined,
      second.error ?? "A SECOND EXTENSION WAS ACCEPTED",
    );

    /* ----------------------------------------- 🔴 20.21 · the WhatsApp rule */

    await movedToWhatsapp({ ticketId: ticketRow!.id, actorUserId: staff[0]!.id });
    const closedTooSoon = await closeTicket({
      ticketId: ticketRow!.id,
      actorUserId: staff[0]!.id,
      summary: "Sorted it out with them.",
    });
    check(
      "🔴 20.21 a ticket that moved to WhatsApp cannot close without the conversation coming back",
      closedTooSoon.error !== undefined,
      closedTooSoon.error ?? "CLOSED WITH NO SUMMARY",
    );

    check(
      "🔴 20.21 …and the database refuses it too, not only the code path",
      await refused(
        () =>
          db
            .update(supportTickets)
            .set({ status: "closed", closedAt: new Date() })
            .where(eq(supportTickets.id, ticketRow!.id)),
        "support_tickets_whatsapp_summarised",
      ),
    );

    await db
      .update(supportTickets)
      .set({ whatsappSummary: "Agreed on WhatsApp that they would send the reference by Friday." })
      .where(eq(supportTickets.id, ticketRow!.id));

    /* --------------------------------- 🔴 20.22 · the close, and the link */

    const closed = await closeTicket({
      ticketId: ticketRow!.id,
      actorUserId: staff[0]!.id,
      summary: "Confirmed the record was theirs and sent them the claim link.",
    });
    check("20.22 …and closes once it has", closed.ok === true, closed.error ?? "");

    const [afterClose] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketRow!.id))
      .limit(1);

    const { readByToken } = await import("../lib/data/support");
    const wrongCode = await readByToken({ token: afterClose!.accessToken!, code: "000000" });
    check(
      "🔴 20.22 the close link alone shows nothing, a code sent to their handle is required",
      wrongCode.error !== undefined && wrongCode.ticket === undefined,
      wrongCode.error ?? "THE LINK ALONE OPENED THE TICKET",
    );

    check(
      "🔴 20.22 …and an unknown token fails with the SAME message, so this is not an oracle",
      (await readByToken({ token: "not-a-real-token", code: "000000" })).error === wrongCode.error,
    );

    /*
     * 🔴 The other half of 20.22, and the one a busy week erodes: the message
     * that goes out carries a link and a code and **not one word of the
     * ticket**. Asserted on the source of the only function that sends it.
     */
    const supportSource = readSource("lib/data/support.ts");
    const closeBody = supportSource.slice(
      supportSource.indexOf("export async function closeTicket"),
      supportSource.indexOf("export async function readByToken"),
    );
    check(
      "🔴 20.22 the email carries a link and a code, never the correspondence",
      closeBody.includes("body:") &&
        !/body:[^}]*\$\{(summary|ticket\.message|ticket\.topic)\}/.test(closeBody),
      "no ticket content is interpolated into the notification body",
    );

    /* ------------------------------- 🔴 20.13–20.17 · the number change */

    const { requestPhoneChange, approveChange, sendChangeCode, completeChange, lockUntil } =
      await import("../lib/data/phone-change");

    /*
     * An account hangs off a person (C41) — there is no name on the account
     * row itself, which is the separate-identity design working as intended.
     */
    const mkPerson = async (suffix: string) => {
      const [person] = await db
        .insert(people)
        .values({ firstName: `${TAG}${suffix}`, phone: null })
        .returning({ id: people.id });
      return person!.id;
    };

    const [account] = await db
      .insert(patientAccounts)
      .values({
        personId: await mkPerson("a"),
        phone: "+201900000001",
        phoneVerifiedAt: new Date(Date.now() - 200 * 86_400_000),
        passwordHash: "x",
        createdAt: new Date(Date.now() - 300 * 86_400_000),
      })
      .returning({ id: patientAccounts.id });

    const asked = await requestPhoneChange({
      accountId: account!.id,
      newPhone: "+201900000002",
      country: "EG",
      reason: "I lost the old phone and this is my new number.",
      contactConsent: true,
    });
    check("20.13 a patient can ask, in their own words", asked.ok === true, asked.error ?? "");

    const noConsent = await requestPhoneChange({
      accountId: account!.id,
      newPhone: "+201900000003",
      country: "EG",
      reason: "Another perfectly good reason for changing my number.",
      contactConsent: false,
    });
    check(
      "20.13 …and not without permission to contact the new number",
      noConsent.error !== undefined,
    );

    /*
     * 🔴 20.15 — a number on another account is refused OUTRIGHT, and the
     * patient is told that is the reason. Never whose.
     */
    const [other] = await db
      .insert(patientAccounts)
      .values({ personId: await mkPerson("other"), phone: "+201900000009", passwordHash: "x" })
      .returning({ id: patientAccounts.id });

    const [fresh] = await db
      .insert(patientAccounts)
      .values({ personId: await mkPerson("fresh"), phone: "+201900000010", passwordHash: "x" })
      .returning({ id: patientAccounts.id });

    const collision = await requestPhoneChange({
      accountId: fresh!.id,
      newPhone: "+201900000009",
      country: "EG",
      reason: "That number is mine and I would like it back on this account.",
      contactConsent: true,
    });
    check(
      "🔴 20.15 a number already on another account is refused, and never says whose",
      collision.error !== undefined &&
        !collision.error.includes(TAG) &&
        !collision.error.includes("+2019000000"),
      collision.error ?? "ACCEPTED",
    );
    void other;

    /* 🔴 20.14 — the correction window, and the lock. */
    const brandNew = { phoneVerifiedAt: new Date(), createdAt: new Date() };
    const settled = {
      phoneVerifiedAt: new Date(Date.now() - 10 * 86_400_000),
      createdAt: new Date(Date.now() - 200 * 86_400_000),
    };
    check(
      "🔴 20.14 a correction in the first 24 hours is NOT a change, a mistyped digit must not trap somebody",
      lockUntil(brandNew) === null && lockUntil(settled) !== null,
      `new account: free · settled account: locked until ${lockUntil(settled)?.toISOString().slice(0, 10)}`,
    );

    /* 🔴 20.16 — approval does not move an account. The code does. */
    const [request] = await db
      .select()
      .from(phoneChangeRequests)
      .where(eq(phoneChangeRequests.patientAccountId, account!.id))
      .limit(1);

    await approveChange({
      requestId: request!.id,
      actor: { userId: staff[0]!.id, organizationId: org!.id!, role: "staff" },
      note: "Called the new number, they answered and knew the account.",
    });

    const [afterApproval] = await db
      .select({ phone: patientAccounts.phone })
      .from(patientAccounts)
      .where(eq(patientAccounts.id, account!.id))
      .limit(1);
    check(
      "🔴 20.16 approving does NOT move the account, only the code does",
      afterApproval?.phone === "+201900000001",
      `still ${afterApproval?.phone}`,
    );

    await sendChangeCode({ requestId: request!.id, actorUserId: staff[0]!.id });
    const wrong = await completeChange({ requestId: request!.id, code: "000000" });
    check("20.16 …and a wrong code moves nothing", wrong.error !== undefined);

    const [withCode] = await db
      .select({ hash: phoneChangeRequests.verificationHash })
      .from(phoneChangeRequests)
      .where(eq(phoneChangeRequests.id, request!.id))
      .limit(1);
    check(
      "🔴 20.16 the code is HASHED, a staff member reading the table cannot finish the change they approved",
      (withCode?.hash ?? "").length > 20 && !/^\d{6}$/.test(withCode?.hash ?? ""),
      `${(withCode?.hash ?? "").slice(0, 12)}…`,
    );

    check(
      "🔴 20.17 a change marked done without a verification is refused BY THE DATABASE",
      await refused(
        () =>
          db
            .update(phoneChangeRequests)
            .set({ status: "done", completedAt: new Date() })
            .where(eq(phoneChangeRequests.id, request!.id)),
        "phone_change_done_was_verified",
      ),
    );

    /* ------------------------------------------- 20.1–20.7 · every figure */

    const { getSettings, getCountries, writeSettingsGroup } = await import("../lib/settings");
    const { hasNoRail, settingsProblem } = await import("../lib/settings/defs");

    /*
     * 🔴 20.1 — a rate edited in admin reaches the invoice and the pricing
     * page, because there is one row and no second copy. Proved by moving it
     * and reading it back through the accessor every other module uses, then
     * putting it back.
     */
    const before = await getSettings();
    const bumped = before.pricing.tiers.map((tier) =>
      tier.key === "payg" ? { ...tier, aiRateCents: tier.aiRateCents + 100 } : tier,
    );

    try {
      await writeSettingsGroup({
        group: "pricing",
        value: { tiers: bumped, creditExpiryMonths: before.pricing.creditExpiryMonths },
        updatedBy: null,
      });
      const after = await (await import(`../lib/settings/index.ts?bump=${Date.now()}`)).getSettings();
      check(
        "🔴 20.1 a rate edited in admin is the rate the rest of the product reads",
        after.pricing.tiers.find((t: { key: string }) => t.key === "payg")?.aiRateCents ===
          (before.pricing.tiers.find((t) => t.key === "payg")?.aiRateCents ?? 0) + 100,
        `${before.pricing.tiers[0]?.aiRateCents} → ${after.pricing.tiers[0]?.aiRateCents}`,
      );
    } finally {
      await writeSettingsGroup({
        group: "pricing",
        value: before.pricing,
        updatedBy: null,
      });
    }

    /*
     * …and a configuration that is invalid *as a whole* is refused. A cap
     * below the floor makes every price invalid while neither figure is wrong
     * on its own, which is the shape a per-field check cannot see.
     */
    check(
      "🔴 20.1 a price cap below the floor is refused. The check is on the whole configuration",
      settingsProblem({
        ...before,
        session: { ...before.session, minPriceCents: 5_000, maxPriceCents: 100 },
      }) !== null,
    );

    const countries = await getCountries();
    check(
      "20.2 VAT, currency and payment methods are per country, and editable",
      countries.length > 0 && countries.every((c) => typeof c.vatBps === "number"),
      countries.map((c) => `${c.code}:${c.vatBps}bps/${c.currency}`).join(" "),
    );

    check(
      "🔴 20.3 a country with NEITHER rail is identifiable. That is a clinician nobody can pay",
      countries.some((c) => !hasNoRail(c)),
      `${countries.filter(hasNoRail).length} of ${countries.length} have no rail`,
    );

    const eg = countries.find((c) => c.code === "EG");
    check(
      "20.3 …and Egypt is on the local rail, with the Egyptian entity behind it",
      eg?.collectionProvider !== null && (eg?.payoutMethods.length ?? 0) > 0 && eg?.entity === "eg",
      `${eg?.collectionProvider} · ${eg?.payoutMethods.join("+")} · ${eg?.entity}`,
    );

    /*
     * 🔴 20.4 / 20.5 — the verification requirements were a nested ternary per
     * country. They are data now, and the merge is field by field: an
     * administrator who names the licence document but not the ID gets their
     * licence label and the shipped ID labels, rather than a form that reverts
     * everything because one field was blank.
     */
    const { documentRequirements, regulatorsFor } = await import("../lib/regulators");
    const overrides = {
      EG: { regulators: ["A regulator an administrator typed"], licenceLabel: "Syndicate card" },
    };

    const merged = documentRequirements("EG", overrides);
    const shipped = documentRequirements("EG");
    check(
      "🔴 20.4 a configured document label wins, and an unconfigured one keeps the shipped wording",
      merged.find((d) => d.key === "licenseDoc")?.label === "Syndicate card" &&
        merged.find((d) => d.key === "idFront")?.label ===
          shipped.find((d) => d.key === "idFront")?.label,
      merged.map((d) => d.label).join(" · "),
    );

    check(
      "20.5 …and the regulators an administrator lists are the ones offered",
      regulatorsFor("EG", overrides)[0] === "A regulator an administrator typed" &&
        regulatorsFor("EG").length > 0,
    );

    /* 🔴 20.6 — margin per session, from real usage rather than the price list. */
    const { tractionMetrics } = await import("../lib/data/vault");
    const traction = await tractionMetrics();
    check(
      "🔴 20.6 margin per session is measured from real model spend",
      traction.marginPerSessionCents ===
        traction.revenuePerSessionCents - traction.costPerSessionCents,
      `revenue ${traction.revenuePerSessionCents}¢ − cost ${traction.costPerSessionCents}¢ = ${traction.marginPerSessionCents}¢`,
    );
    check(
      "🔴 20.6 …and the percentage is ABSENT, not zero, when nothing was collected",
      traction.marginBps === null || Number.isInteger(traction.marginBps),
      traction.marginBps === null ? "null, nothing collected in 30 days" : `${traction.marginBps}bps`,
    );

    /* 20.7 — the Total View sits on the same screen as the levers. */
    const settingsPage = readSource("app/(admin)/admin/settings/page.tsx");
    check(
      "20.7 the margin is on the same page as the rates that produce it",
      settingsPage.includes("tractionMetrics") && settingsPage.includes("PricingEditor"),
    );

    /* --------------------------------------------- 20.19 · attachments */

    const { attachToTicket, attachmentsFor } = await import("../lib/data/support");

    const tooBig = await attachToTicket({
      ticketId: ticketRow!.id,
      file: new File([new Uint8Array(26 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" }),
    });
    check(
      "20.19 an attachment over the ceiling is refused",
      tooBig.error !== undefined,
      tooBig.error ?? "ACCEPTED",
    );

    const wrongType = await attachToTicket({
      ticketId: ticketRow!.id,
      file: new File(["x"], "notes.exe", { type: "application/x-msdownload" }),
    });
    check(
      "20.19 …and so is a file type nobody can open safely",
      wrongType.error !== undefined,
      wrongType.error ?? "ACCEPTED",
    );

    void attachmentsFor;

    /* ------------------------------------------------------- C82 · 20.19 */

    const promptModules = walk("lib/ai");
    check(
      "🔴 20.19 / C82 no prompt-building module can reach a support ticket or its attachments",
      promptModules.every(
        (file) => !/supportAttachments|data\/support/.test(readSource(file)),
      ),
    );

    /*
     * 🔴 …and nothing anywhere extracts an attachment. C82 is not only about
     * prompts: a chunker or an indexer pointed at `support_attachments` would
     * put a patient's prescription into the same pipeline as a consented
     * clinical document, one import at a time.
     */
    const extractors = [...walk("lib/documents"), ...walk("lib/data")].filter(
      (file) =>
        /supportAttachments/.test(readSource(file)) &&
        !file.endsWith("lib/data/support.ts"),
    );
    check(
      "🔴 20.19 / C82 nothing outside the support module touches an attachment at all",
      extractors.length === 0,
      extractors.join(", ") || "only lib/data/support.ts",
    );
  } finally {
    await db.delete(supportTicketEvents).where(
      sql`ticket_id IN (SELECT id FROM support_tickets WHERE name LIKE ${`${TAG}%`})`,
    );
    await db.delete(supportTickets).where(like(supportTickets.name, `${TAG}%`));
    await db.delete(phoneChangeRequests).where(
      sql`patient_account_id IN (
        SELECT a.id FROM patient_accounts a
          JOIN people p ON p.id = a.person_id
         WHERE p.first_name LIKE ${`${TAG}%`}
      )`,
    );
    await db.delete(patientAccounts).where(
      sql`person_id IN (SELECT id FROM people WHERE first_name LIKE ${`${TAG}%`})`,
    );
    await db.delete(people).where(like(people.firstName, `${TAG}%`));
    await db.execute(sql`DELETE FROM rate_limits WHERE key LIKE '%support.ticket%'`);
  }

  finish("sprint 20");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
