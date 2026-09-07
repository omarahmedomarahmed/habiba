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

import { db } from "../lib/db";
import { type ContentBlock } from "../lib/db/schema";
import { withPublishedContent } from "./_content-ready";
import { reporter } from "./_verify";

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
    pattern: /["“][^"”]{40,}["”]\s*[—-]\s*[A-Z][a-z]+,?\s+(patient|client)/i,
    why: "a testimonial attributed to a patient",
  },
  {
    pattern: /\breal (patient|session) (transcript|note)\b/i,
    why: "claims a real record is being shown",
  },
];

async function main() {
  console.log(
    `checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`,
  );

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
        "🔴 18.2 the patients section exists as a real row — in BOTH locales, so 19 and 21 can reach it",
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
      check(
        "18.2 …and it answers the seven questions the ticket names",
        [
          "Radar",
          "book",
          "session",
          "cannot see",
          "claim",
          "cost",
          "help",
        ].every((topic) => new RegExp(topic, "i").test(topics)),
        ["Radar", "book", "session", "cannot see", "claim", "cost", "help"]
          .filter((t) => !new RegExp(t, "i").test(topics))
          .join(", ") || "all seven",
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
  const rendered = readFileSync("components/public/blocks.tsx", "utf8");
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
    '"This app genuinely saved my life and I will never stop recommending it" — Sarah, patient',
    "Below is a real session transcript from our platform.",
  ];
  const caught = offenders.filter((sentence) =>
    FORBIDDEN.some((rule) => rule.pattern.test(sentence)),
  );
  check(
    "🔴 18.7 CONTROL — every rule fires against a sentence written to break it",
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

  const showcase = readFileSync(
    "components/demo/component-showcase.tsx",
    "utf8",
  );
  check(
    "🔴 18.8 no screenshot stands in for a product surface — the showcase renders components, not images",
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
    "🔴 18.11 …and that fallback is synthetic — it reaches no clinical table",
    !readFileSync("lib/content/demo.ts", "utf8").match(
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

    check(
      "🔴 18.11 CONTROL — the sweep's own query SEES a patient outside a demo organisation",
      before === 0 && planted === 1,
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

  try {
    await db.insert(schema.aiRequestLogs).values(
      // 0.4¢, 0.3¢ and 0.25¢ — every one of them rounds to zero on write.
      [400, 300, 250].map((microcents) => ({
        organizationId: costOrg!.id,
        kind: "note" as const,
        model: "verify18-model",
        // 🔴 The defect in one row: real cost, recorded as nothing.
        costCents: 0,
        costMicrocents: microcents,
        status: "success" as const,
      })),
    );

    const { rows: cost } = (await db.execute(sql`
      SELECT ROUND(SUM(cost_microcents) / 1000.0)::int AS exact_cents,
             SUM(cost_cents)::int AS rounded_cents,
             COUNT(*) FILTER (WHERE cost_cents = 0 AND cost_microcents > 0)::int AS lost_rows
      FROM ai_request_logs
    `)) as unknown as {
      rows: { exact_cents: number; rounded_cents: number; lost_rows: number }[];
    };

    const vault = await import("../lib/data/vault");
    const kinds = await vault.costByKind(3650);
    const vaultTotal = kinds.reduce((total, row) => total + row.costCents, 0);

    /*
     * The tolerance is one cent, and it is a real one rather than slack: the
     * vault rounds **per kind** because each kind is a row somebody reads, so
     * five rows can round to a cent more or less than the single exact total.
     * Rounding once per displayed figure is the rule; rounding once per
     * *stored row*, which is what `cost_cents` did, is the bug.
     */
    check(
      "🔴 C17 the vault's cost figures are summed from MICROCENTS, not from the rounded column",
      Math.abs(vaultTotal - (cost[0]?.exact_cents ?? 0)) <= 1 &&
        (cost[0]?.lost_rows ?? 0) === 3 &&
        vaultTotal !== cost[0]?.rounded_cents,
      `vault ${vaultTotal}¢ · exact ${cost[0]?.exact_cents}¢ · the old rounded column ${cost[0]?.rounded_cents}¢ over ${cost[0]?.lost_rows} sub-cent calls`,
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
