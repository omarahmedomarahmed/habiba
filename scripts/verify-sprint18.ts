/**
 * Sprint 18 acceptance — the public site, and a side for patients.
 * PLAN.md 18.1–18.13, C72, C7–C9, C17, C20, C34, C39.
 *
 *   npm run verify:sprint18
 *
 * Two of these checks matter more than the rest, and both are about what a
 * stranger can reach: **18.3**, that help is one tap from every patient page
 * and never behind a signup, and **18.7**, that nothing public names a
 * patient, quotes a session, or implies we can read a record.
 */
import { sql } from "drizzle-orm";

import { type ContentBlock } from "../lib/db/schema";
import { withPublishedContent } from "./_content-ready";
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

const { check, skipUnless, finish } = reporter();

/** Every string anywhere in a page's blocks. */
function stringsOf(blocks: ContentBlock[]): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  walk(blocks);
  return out;
}

/**
 * 🔴 18.7 — the shapes §6 forbids on a public page.
 *
 * Not "words about therapy": a marketing page for a therapy product is
 * *supposed* to talk about therapy. What it may never do is imply the platform
 * can read a record, quote something a patient said as though it happened, or
 * name one.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    pattern:
      /\bwe (can |could )?(read|see|review|access) (your|their|a) (record|notes?|chart|transcript)/i,
    why: "implies we read records",
  },
  {
    // "Our team can read your notes" is the shape a real marketing writer
    // produces, so the modal verbs are part of the rule rather than an
    // afterthought — the first draft of this scan missed exactly that
    // sentence, which is what the control below is for.
    pattern:
      /\bour (clinicians|team|staff)[^.]{0,20}\b(read|review|see|access)s?\b[^.]{0,20}(notes?|records?|transcripts?)/i,
    why: "implies staff read notes",
  },
  {
    pattern: /\b(one|a) (patient|client) (told us|said to us|wrote)\b/i,
    why: "quotes a patient",
  },
  {
    /*
     * 24.1 — the dashes are built from their code points, not typed.
     *
     * This class held a real em dash and an en dash, and the sprint 24 rewrite
     * turned them into hyphens, which silently narrowed a rule about
     * testimonials. The ban is on *copy*; a detector that has to recognise the
     * character still needs it, and building it here keeps this file clean for
     * the scan that enforces the ban.
     */
    pattern: new RegExp(
      `["\u201C][^"\u201D]{40,}["\u201D]\\s*[-\u2014\u2013]\\s*[A-Z][a-z]+,?\\s+(patient|client)`,
      "i",
    ),
    why: "a testimonial attributed to a patient",
  },
  {
    pattern: /\breal (patient|session) (transcript|note)\b/i,
    why: "claims a real record is being shown",
  },
];

async function main() {
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   */
  writesTo();

  /* --------------------------------------------------- 18.2, 18.5, C72 */

  /*
   * 🔴 19.0 / C90 — the precondition, exactly as in sprint 17.
   *
   * Everything about the patients section, the crisis block and the new live
   * demos is *content*, and sprint 18 deliberately did not republish it to
   * production (a `pricing` block in a database whose code cannot render it
   * serves a page with no prices). Until 22.8b runs, these are deferred rather
   * than failed — and the moment it runs they come back on their own.
   */
  const NEED = {
    what: "the sprint 18 public content",
    block: { slug: "for-patients", type: "crisis" },
  };

  await withPublishedContent(
    skipUnless,
    { for: "18.2 / 18.5 / C72", ...NEED },
    (content) => {
      const pages = content.published;
      const patientPages = pages.filter((p) => p.slug === "for-patients");
      check(
        "🔴 18.2 the patients section exists as a real row, in BOTH locales, so 19 and 21 can reach it",
        patientPages.some((p) => p.locale === "en") &&
          patientPages.some((p) => p.locale === "ar"),
        patientPages.map((p) => p.locale).join(", ") || "none",
      );
      check(
        "18.5 …and it is in the navigation rather than an orphan route",
        patientPages.every(
          (p) => p.navLabel !== null && (p.navOrder ?? 99) < 10,
        ),
        patientPages.map((p) => `${p.locale}:${p.navLabel}`).join(", "),
      );

      const topics = stringsOf(
        patientPages.find((p) => p.locale === "en")?.blocks ?? [],
      ).join(" ");
      /*
       * 🔴 SIX OF THE SEVEN ARE PROSE. THE SEVENTH IS A COMPONENT.
       *
       * "Where do I get help right now" is answered by the `crisis` block, and
       * that block's words come from the dictionary (`crisis.bodyDefault`),
       * not from the page row. So `stringsOf(blocks)` could never contain
       * them, and this check was looking for the token "help" in editable
       * marketing copy that has no reason to carry it.
       *
       * It went red when the page was rewritten, on a page that still had the
       * crisis block, which is the product's actual answer to that question.
       * A word a copywriter can rephrase away is a weaker binding than a block
       * that either exists or does not, so the seventh is now checked as the
       * structure it is. The other six stay as prose, because prose is where
       * they are answered.
       */
      const PROSE_TOPICS = ["Radar", "book", "session", "cannot see", "claim", "cost"];
      const missing = PROSE_TOPICS.filter((t) => !new RegExp(t, "i").test(topics));
      const crisis = patientPages
        .find((p) => p.locale === "en")
        ?.blocks.some((b) => b.type === "crisis") ?? false;

      check(
        "18.2 …and it answers the seven questions the ticket names",
        missing.length === 0 && crisis,
        [...missing, crisis ? "" : "where to get help now, which is the crisis block"]
          .filter(Boolean)
          .join(", ") || "six in the copy, and the crisis block for the seventh",
      );

      check(
        "🔴 C72 the Arabic reader no longer falls back to English on pricing",
        pages.some((p) => p.slug === "pricing" && p.locale === "ar"),
      );
    },
  );

  /* ------------------------------------------------------------- 18.3 */

  await withPublishedContent(
    skipUnless,
    { for: "18.3", ...NEED },
    (content) => {
      const patientFacing = content.published.filter((p) =>
        ["home", "for-patients"].includes(p.slug),
      );
      check(
        "🔴 18.3 help now is ON every patient-facing page, in every locale",
        patientFacing.length >= 4 &&
          patientFacing.every((p) => p.blocks.some((b) => b.type === "crisis")),
        patientFacing
          .filter((p) => !p.blocks.some((b) => b.type === "crisis"))
          .map((p) => `${p.slug}[${p.locale}]`)
          .join(", ") || `${patientFacing.length} pages, all carry it`,
      );
    },
  );

  /*
   * 🔴 …and it is never behind a signup. The block's destinations are fixed in
   * the component rather than editable, so this asserts on the rendered
   * output: the buttons must point at the radar, which needs no account, and
   * must not point at /signup or /login.
   */
  const { readFileSync } = await import("node:fs");
  const rendered = readSource("components/public/blocks.tsx");
  const crisisBlock = rendered.slice(rendered.indexOf("function Crisis("));
  check(
    "🔴 18.3 …and it goes to the radar, never to a signup or a login",
    crisisBlock.includes('href="/radar"') &&
      !crisisBlock.includes("/signup") &&
      !crisisBlock.includes("/login"),
  );

  /* ------------------------------------------------------------- 18.7 */

  await withPublishedContent(
    skipUnless,
    { for: "18.7", what: "the page corpus" },
    (content) => {
      const violations: string[] = [];
      for (const page of content.published) {
        for (const text of stringsOf(page.blocks)) {
          for (const rule of FORBIDDEN) {
            if (rule.pattern.test(text)) {
              violations.push(`${page.slug}[${page.locale}]: ${rule.why}`);
            }
          }
        }
      }
      check(
        "🔴 18.7 nothing public names a patient, quotes a session, or implies we can read a record",
        violations.length === 0,
        violations.join(" · ") ||
          `${content.published.length} published pages swept`,
      );
    },
  );

  /*
   * 🔴 The control. This scan is the whole of 18.7, so it had better be able
   * to see the thing it is looking for. Every rule is fired against a sentence
   * written to break it — a scan that has never matched anything is a scan
   * nobody has tested.
   */
  const offenders = [
    "Our team can read your notes and will review them for quality.",
    "Our clinicians review your notes every month.",
    "One patient told us it changed everything.",
    `"This app genuinely saved my life and I will never stop recommending it" ${String.fromCharCode(0x2014)} Sarah, patient`,
    "Below is a real session transcript from our platform.",
  ];
  const caught = offenders.filter((sentence) =>
    FORBIDDEN.some((rule) => rule.pattern.test(sentence)),
  );
  check(
    "🔴 18.7 CONTROL, every rule fires against a sentence written to break it",
    caught.length === offenders.length,
    `${caught.length}/${offenders.length} caught`,
  );

  /* ------------------------------------------------------ 18.8, 18.9, 18.13 */

  const { CONTENT_DEMOS } = await import("../lib/db/schema");
  await withPublishedContent(
    skipUnless,
    { for: "18.8 / 18.9", ...NEED },
    (content) => {
      const used = new Set(
        content.published.flatMap((p) =>
          p.blocks.flatMap((b) =>
            "items" in b
              ? (b.items as { demo?: string }[])
                  .map((i) => i.demo)
                  .filter(Boolean)
              : [],
          ),
        ),
      );
      check(
        "18.9 the patient app and the homework list are shown as the thing itself",
        used.has("patient-sessions") && used.has("homework"),
        [...used].join(", "),
      );
      /*
       * 🔴 21R.9 — this one used to sit outside the deferral, and it PASSED on an
       * empty database: every demo named in no content is trivially drawable. A
       * green that measured nothing is worse than an honest skip.
       */
      check(
        "18.8 …and every demo named in content is one the renderer can actually draw",
        [...used].every((demo) =>
          (CONTENT_DEMOS as readonly string[]).includes(demo as string),
        ),
        [...used]
          .filter(
            (d) => !(CONTENT_DEMOS as readonly string[]).includes(d as string),
          )
          .join(", ") || "all known",
      );
    },
  );

  const showcase = readSource("components/demo/component-showcase.tsx");
  check(
    "🔴 18.8 no screenshot stands in for a product surface, the showcase renders components, not images",
    !/<img|\.png|\.jpg|next\/image/i.test(showcase),
  );

  const { DEMO_FALLBACK, getDemoContent } = await import("../lib/content/demo");
  const demo = await getDemoContent();
  check(
    "18.13 the words inside the live components are content, with a shipped fallback",
    demo.transcript.length > 0 && demo.brief.length > 0,
    `${demo.transcript.length} transcript lines, ${demo.homework.length} steps`,
  );
  check(
    "🔴 18.11 …and that fallback is synthetic, it reaches no clinical table",
    !readSource("lib/content/demo.ts").match(
      /sessionNotes|transcriptSegments|sessionInsights|patients\b/,
    ) &&
      DEMO_FALLBACK.patientSessions.every((s) => s.therapist.startsWith("Dr ")),
  );

  /* --------------------------------------------------- 🔴 18.11 the refusal */

  /*
   * The sweep refuses to photograph a database with real records in it. That
   * refusal is the only thing standing between a permanent PNG in git history
   * and somebody's session, so it is proved by **running the query it runs**
   * against a planted non-demo patient — and then removing it.
   */
  const countReal = async () => {
    const { rows } = (await db.execute(sql`
      SELECT (SELECT COUNT(*) FROM patients p
                JOIN organizations o ON o.id = p.organization_id
               WHERE o.name NOT ILIKE '%demo%' AND p.deleted_at IS NULL) AS real_patients
    `)) as unknown as { rows: { real_patients: string }[] };
    return Number(rows[0]?.real_patients ?? 0);
  };

  /*
   * 🔴 22.1 — the control plants its own offender now.
   *
   * It used to read whatever happened to be in the database, which made it a
   * measurement of the seed rather than a test of the query: on the purged
   * database it reported "0 on 24Therapy" and failed, having proved nothing
   * either way. A control that only works on a full database is a control that
   * stops working the day it matters most — the day before launch.
   */
  const schema = await import("../lib/db/schema");
  const before = await countReal();
  let planted = 0;

  const [realOrg] = await db
    .insert(schema.organizations)
    .values({ name: "Verify18 Clinic", slug: `verify18-${Date.now()}` })
    .returning({ id: schema.organizations.id, name: schema.organizations.name });

  try {
    const [person] = await db
      .insert(schema.people)
      .values({ firstName: "Verify18" })
      .returning({ id: schema.people.id });

    await db.insert(schema.patients).values({
      organizationId: realOrg!.id,
      personId: person!.id,
      firstName: "Verify18",
      // §3b / 0042 — a therapist-created record must carry an E.164 number.
      phone: "+201000000018",
    });

    planted = await countReal();

    /*
     * Relative, not absolute. The first version asserted `before === 0`, which
     * pinned the check to an empty database and went red the moment the 22R
     * walkthrough left one real patient behind — the same borrowed-state
     * mistake as the fixtures it replaced, in the other direction. What the
     * control claims is that planting one MOVES the count.
     */
    check(
      "🔴 18.11 CONTROL, the sweep's own query SEES a patient outside a demo organisation",
      planted === before + 1,
      `${before} before, ${planted} with one planted in "${realOrg!.name}"`,
    );
  } finally {
    await db.execute(
      sql`DELETE FROM patients WHERE organization_id = ${realOrg!.id}`,
    );
    await db.execute(sql`DELETE FROM people WHERE first_name = 'Verify18'`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${realOrg!.id}`);
  }

  /* ------------------------------------------------------------- C17 */

  /*
   * 🔴 The founder's correction, applied: the METHOD, not the figures.
   *
   * This used to sum whatever `ai_request_logs` happened to hold, and the
   * numbers in the build log ("212 → 204") drifted the week after they were
   * written — and on the purged database there were no rows at all, so it
   * failed while proving nothing. It plants three calls whose cost is real and
   * **smaller than one cent**, which is the exact case that made the old
   * `cost_cents` column record zero for 91% of calls, and asserts that the
   * vault reports them.
   */
  const [costOrg] = await db
    .insert(schema.organizations)
    .values({ name: "Verify18 Costs", slug: `verify18-cost-${Date.now()}` })
    .returning({ id: schema.organizations.id });

  /*
   * Measured as the DIFFERENCE the planted calls make, not as a total over the
   * whole table: on a database whose other rows happen to round to the same
   * total ("vault 9¢ · rounded 9¢"), comparing totals failed on a coincidence.
   * Thirty calls of 0.9¢ are 27¢ of real cost and 0¢ in the rounded column,
   * which no per-kind rounding elsewhere can hide.
   */
  const vault = await import("../lib/data/vault");
  const vaultSum = async () =>
    (await vault.costByKind(3650)).reduce((total, row) => total + row.costCents, 0);
  const roundedSum = async () => {
    const { rows } = (await db.execute(
      sql`SELECT COALESCE(SUM(cost_cents), 0)::int AS cents FROM ai_request_logs`,
    )) as unknown as { rows: { cents: number }[] };
    return rows[0]?.cents ?? 0;
  };
  const vaultBefore = await vaultSum();
  const roundedBefore = await roundedSum();

  try {
    await db.insert(schema.aiRequestLogs).values(
      // 0.9¢ each, thirty times: every one of them rounds to zero on write.
      Array.from({ length: 30 }, () => ({
        organizationId: costOrg!.id,
        kind: "note" as const,
        model: "verify18-model",
        // 🔴 The defect in one row: real cost, recorded as nothing.
        costCents: 0,
        costMicrocents: 900,
        status: "success" as const,
      })),
    );

    const vaultAdded = (await vaultSum()) - vaultBefore;
    const roundedAdded = (await roundedSum()) - roundedBefore;

    /*
     * One cent of tolerance: the vault rounds per kind, because each kind is a
     * row somebody reads, so the "note" row can move by 26 or 28 rather than 27
     * depending on what it already held. Rounding once per displayed figure is
     * the rule; rounding once per stored row, which `cost_cents` did, is the bug.
     */
    check(
      "🔴 C17 the vault's cost figures are summed from MICROCENTS, not from the rounded column",
      Math.abs(vaultAdded - 27) <= 1 && roundedAdded === 0,
      `30 calls of 0.9¢ added ${vaultAdded}¢ to the vault and ${roundedAdded}¢ to the old rounded column`,
    );
  } finally {
    await db.execute(
      sql`DELETE FROM ai_request_logs WHERE organization_id = ${costOrg!.id}`,
    );
    await db.execute(sql`DELETE FROM organizations WHERE id = ${costOrg!.id}`);
  }

  finish("sprint 18");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
