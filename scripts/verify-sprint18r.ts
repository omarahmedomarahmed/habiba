/**
 * Sprint 18R acceptance — contact, and two companies. PLAN.md 18R.1–18R.8, C91.
 *
 *   npm run verify:sprint18r
 *
 * The check that matters is 18R.4: what a stranger types into a public form is
 * clinical material the moment it lands. That is asserted three ways — the
 * database refuses a ticket nobody can answer, the queue query cannot carry a
 * message body, and **no prompt-building module can import the one module that
 * reads one** — each with a control.
 */
import { eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { supportTicketEvents, supportTickets } from "../lib/db/schema";
import { withPublishedContent } from "./_content-ready";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

async function refused(
  fn: () => Promise<unknown>,
  fragment: string,
): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const TAG = "verify18r";

async function main() {
  console.log(
    `checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );

  try {
    /* ------------------------------------------- 18R.2 · a real ticket */

    const { fileTicket, openTickets, FIRST_REPLY_HOURS } =
      await import("../lib/data/support");

    const filed = await fileTicket({
      name: `${TAG} Someone`,
      email: `${TAG}@example.test`,
      phone: null,
      country: null,
      topic: "my_record",
      message:
        "I think my therapist has a record for me and I would like to claim it.",
      locale: "en",
      entity: "us",
    });

    check(
      "18R.2 a message from the public form becomes a ticket, with a reference to quote back",
      filed.ok === true && "reference" in filed && filed.reference.length >= 6,
      filed.ok ? filed.reference : filed.error,
    );

    const [row] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.email, `${TAG}@example.test`))
      .limit(1);

    check(
      "🔴 18R.3 …with a topic, an age and a deadline — a queue, not an inbox",
      row?.topic === "my_record" &&
        row?.status === "open" &&
        row?.dueAt !== null &&
        Math.round(
          (row!.dueAt.getTime() - row!.createdAt.getTime()) / 3_600_000,
        ) === FIRST_REPLY_HOURS,
      `${row?.topic}, due in ${row ? Math.round((row.dueAt.getTime() - row.createdAt.getTime()) / 3_600_000) : "?"}h`,
    );

    check(
      "18R.3 …and every move on it is recorded from the moment it arrives",
      (
        await db
          .select({ kind: supportTicketEvents.kind })
          .from(supportTicketEvents)
          .where(eq(supportTicketEvents.ticketId, row!.id))
      ).length === 1,
    );

    /* --------------------------------------- 🔴 the database's own rules */

    check(
      "🔴 18R.2 a ticket with NEITHER an email nor a phone is refused BY THE DATABASE",
      await refused(
        () =>
          db.insert(supportTickets).values({
            reference: `${TAG}NOHANDLE`,
            name: `${TAG} nobody`,
            topic: "something_else",
            message: "There is no way to answer this message at all.",
            dueAt: new Date(),
          }),
        "support_tickets_one_handle",
      ),
    );

    check(
      "18R.2 …and a topic that is not on the list is refused, so the queue can sort",
      await refused(
        () =>
          db.insert(supportTickets).values({
            reference: `${TAG}TOPIC`,
            name: `${TAG} nobody`,
            email: `${TAG}b@example.test`,
            topic: "urgent_shouting" as "account",
            message: "A topic nobody can triage or count.",
            dueAt: new Date(),
          }),
        "support_tickets_topic_known",
      ),
    );

    check(
      "18R.3 a ticket closed with no date on it is refused — 'closed' with no time cannot be reported",
      await refused(
        () =>
          db.insert(supportTickets).values({
            reference: `${TAG}CLOSED`,
            name: `${TAG} nobody`,
            email: `${TAG}c@example.test`,
            topic: "account",
            message: "Closed without a timestamp, which no report can count.",
            status: "closed",
            dueAt: new Date(),
          }),
        "support_tickets_closed_dated",
      ),
    );

    /* --------------------------------------------- 🔴 18R.4 · C82 */

    const queue = await openTickets();
    const mine = queue.find(
      (t) => t.reference === (filed.ok ? filed.reference : ""),
    );
    check(
      "🔴 18R.4 the QUEUE cannot carry a message body — triage is topic, age and owner",
      mine !== undefined && !("message" in mine),
      mine ? Object.keys(mine).sort().join(",") : "not in the queue",
    );

    /*
     * 🔴 The import graph. C82: a support message never enters a prompt.
     *
     * `lib/data/support.ts` is the only module that reads `message`, so the
     * rule is enforceable as a statement about *who may import it* — the same
     * technique as 10.2's assistant and 15.8's patient view. Asserted by
     * walking the actual import statements of every prompt-building module,
     * not by reading their prose.
     */
    const { readFileSync, readdirSync } = await import("node:fs");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(`${dir}/${entry.name}`)
          : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
            ? [`${dir}/${entry.name}`]
            : [],
      );

    const promptModules = walk("lib/ai").concat(
      walk("lib/assistant").filter(Boolean),
    );
    const importsSupport = promptModules.filter((file) =>
      /from\s+["'](@\/lib\/data\/support|\.\.\/data\/support|\.\/support)["']/.test(
        readFileSync(file, "utf8"),
      ),
    );
    check(
      "🔴 18R.4 / C82 no prompt-building module imports the support reader",
      importsSupport.length === 0,
      importsSupport.join(", ") ||
        `${promptModules.length} modules under lib/ai checked`,
    );

    /*
     * 🔴 The control, planted as a FILE rather than as a string.
     *
     * A regex tested against a literal in this script proves the regex; it
     * does not prove the scan, which walks a directory. So a real offender is
     * written into `lib/ai`, the same walk is re-run, and it must be found —
     * then removed. This is the fourth-checker lesson applied before the fact.
     */
    const { writeFileSync, rmSync } = await import("node:fs");
    const planted = "lib/ai/_verify18r-offender.ts";
    let caughtPlanted = false;
    try {
      writeFileSync(
        planted,
        `import { readTicket } from "@/lib/data/support";\nexport const leak = readTicket;\n`,
      );
      caughtPlanted = walk("lib/ai").some((file) =>
        /from\s+["'](@\/lib\/data\/support|\.\.\/data\/support|\.\/support)["']/.test(
          readFileSync(file, "utf8"),
        ),
      );
    } finally {
      rmSync(planted, { force: true });
    }

    check(
      "🔴 C82 CONTROL — the same walk FINDS a deliberate offender planted in lib/ai",
      caughtPlanted,
      caughtPlanted ? "planted, caught, removed" : "THE SCAN IS BLIND",
    );

    check(
      "🔴 18R.4 a support message is never written to the application log",
      !/log\.(info|warn|error)\([^)]*message/.test(
        readFileSync("lib/data/support.ts", "utf8"),
      ),
    );

    /* ------------------------------------------------ 18R.5 · the limit */

    const flood = [];
    for (let i = 0; i < 5; i += 1) {
      flood.push(
        await fileTicket({
          name: `${TAG} flood`,
          email: `${TAG}flood${i}@example.test`,
          phone: null,
          country: null,
          topic: "something_else",
          message: `A message filed in a burst, number ${i}, to see where the limiter bites.`,
          locale: "en",
          entity: "us",
        }),
      );
    }
    check(
      "🔴 18R.5 a burst from one caller is refused before it can fill the queue",
      flood.some((result) => result.ok === false),
      `${flood.filter((r) => r.ok).length} of 5 accepted`,
    );

    const contactForm = readFileSync(
      "components/public/contact-form.tsx",
      "utf8",
    );
    check(
      "🔴 18R.5 …without a third-party widget watching the reader",
      !/recaptcha|hcaptcha|turnstile|googletagmanager|analytics/i.test(
        contactForm,
      ),
    );

    /* ------------------------------------------ 18R.2, 18R.6–18R.8 · content */

    /*
     * 🔴 21R.9 / C93 — every check below reads published content, so every one
     * of them is DEFERRABLE FROM THE START. Sprint 18R shipped these as hard
     * failures three weeks after C90 ruled that they should not be, which is
     * how a database with no content in it (an empty branch, or production
     * between the purge and 22.8b) makes a whole gate red for a reason
     * everybody already knows.
     */
    await withPublishedContent(
      skipUnless,
      { for: "18R.2 / 18R.6", what: "the contact page", slug: "contact" },
      (content) => {
        const contact = content.published.filter((p) => p.slug === "contact");

        check(
          "18R.2 the contact page carries a real form, in BOTH locales",
          contact.length >= 2 &&
            contact.every((p) =>
              p.blocks.some((b) => b.type === "contact_form"),
            ),
          contact.map((p) => p.locale).join(", "),
        );

        const companies = contact.map((p) =>
          p.blocks.find((b) => b.type === "companies"),
        );
        check(
          "🔴 18R.6 BOTH companies are named, in both locales, with contact details",
          companies.every(
            (block) =>
              block !== undefined &&
              "items" in block &&
              block.items.length === 2 &&
              block.items.some((i) => i.entity === "us") &&
              block.items.some((i) => i.entity === "eg") &&
              block.items.every(
                (i) => (i.email ?? "").length > 3 && (i.hours ?? "").length > 3,
              ),
          ),
          companies
            .map((b) =>
              b && "items" in b ? `${b.items.length} entities` : "missing",
            )
            .join(", "),
        );
      },
    );

    await withPublishedContent(
      skipUnless,
      { for: "18R.2", what: "any page" },
      (content) => {
        check(
          "🔴 18R.2 …and no page anywhere still offers a mailto: link as the way to reach us",
          !content.published.some((p) =>
            JSON.stringify(p.blocks).includes("mailto:"),
          ),
          content.published
            .filter((p) => JSON.stringify(p.blocks).includes("mailto:"))
            .map((p) => `${p.slug}[${p.locale}]`)
            .join(", ") || "none",
        );
      },
    );

    check(
      "🔴 18R.6 …and every field of them is CONTENT — nothing about a company is hardcoded",
      !readFileSync("components/public/blocks.tsx", "utf8").match(
        /24Therapy (Inc|Egypt)|support@24therapy|egypt@24therapy/,
      ),
      "no company name, address or address-of-record in the renderer",
    );

    check(
      "18R.7 the international entity is rendered first and the Egyptian one second, both always",
      readFileSync("components/public/blocks.tsx", "utf8").includes(
        'return a.entity === "eg" ? 1 : -1;',
      ),
    );

    /*
     * 21R.8 moved these sentences out of the component and into the
     * dictionary, so an Arabic reader gets the warning in Arabic. The check
     * follows the words rather than the file, and gains something on the way:
     * the Arabic must be its OWN sentence, not the English copied across.
     */
    const { en, ar } = await import("../lib/i18n/messages");

    check(
      "🔴 18R.4 the page says plainly not to send anything urgent, with the crisis route beside it",
      /do not send anything urgent/i.test(en["contact.urgentLead"]) &&
        contactForm.includes('href="/radar"'),
      "warning in the dictionary, radar link in the form",
    );

    check(
      "🔴 18R.4 …and it says it in ARABIC too, in its own words",
      ar["contact.urgentLead"] !== en["contact.urgentLead"] &&
        /[\u0600-\u06FF]/.test(ar["contact.urgentBody"]) &&
        /[\u0600-\u06FF]/.test(ar["contact.urgentLead"]),
      ar["contact.urgentLead"],
    );

    check(
      "18R.8 the confirmation says what happens next and when, not just thanks",
      /\{reference\}/.test(en["contact.reference"]) &&
        /within \{hours\} hours/.test(en["contact.reference"]) &&
        /\{hours\}/.test(ar["contact.reference"]),
    );

    /* ------------------------------------------------------------ 18R.1 */

    await withPublishedContent(
      skipUnless,
      { for: "18R.1", what: "the marketing pages" },
      (content) => {
        const publicPages = content.published.filter((p) =>
          ["home", "for-patients", "features", "pricing", "contact"].includes(
            p.slug,
          ),
        );
        const revamped = publicPages.filter((p) =>
          p.blocks.some((b) =>
            [
              "pricing",
              "crisis",
              "companies",
              "contact_form",
              "showcase",
            ].includes(b.type),
          ),
        );
        check(
          "18R.1 every marketing page carries at least one of the revamp's blocks — none left in the old style",
          revamped.length === publicPages.length,
          publicPages
            .filter((p) => !revamped.includes(p))
            .map((p) => `${p.slug}[${p.locale}]`)
            .join(", ") || `${publicPages.length} pages`,
        );
      },
    );
  } finally {
    await db
      .delete(supportTicketEvents)
      .where(
        sql`ticket_id IN (SELECT id FROM support_tickets WHERE name LIKE ${`${TAG}%`})`,
      );
    await db.delete(supportTickets).where(like(supportTickets.name, `${TAG}%`));
    await db.execute(
      sql`DELETE FROM rate_limits WHERE key LIKE '%support.ticket%'`,
    );
  }

  finish("sprint 18R");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
