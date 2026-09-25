/**
 * 🔴 TASK 40: EVERY WHATSAPP TEMPLATE META MUST APPROVE, AND NONE DROPS A MESSAGE.
 *
 * Proves:
 *   - the list holds every template the launch needs, each with an English and
 *     an Arabic body that use exactly the variables it declares;
 *   - an authentication template carries one code and no link;
 *   - every sender passes the number of variables its template takes;
 *   - a template Meta has not approved is never sent, and the message still
 *     lands: by email, or as an in-app notice, with the reason recorded.
 *
 *   npm run verify:whatsapp
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { stripCommentsKeepingLines } from "./_dashes";
import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string) => stripCommentsKeepingLines(readFileSync(join(ROOT, path), "utf8"));
const fixture = `wat${Date.now().toString(36)}`;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

/** Items in the first `variables: [...]` of a call, counted at the top level. */
function variableCount(text: string): number | null {
  const start = text.indexOf("variables: [");
  if (start < 0) return null;
  let depth = 0;
  let items = 0;
  let seen = false;
  for (let i = start + "variables: [".length; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === "[" || c === "(" || c === "{") depth += 1;
    else if (c === ")" || c === "}") depth -= 1;
    else if (c === "]") {
      if (depth === 0) return seen ? items + 1 : 0;
      depth -= 1;
    } else if (c === "," && depth === 0) {
      /* A trailing comma before `]` is not another item. */
      if (/^\s*\]/.test(text.slice(i + 1))) continue;
      items += 1;
    } else if (!/\s/.test(c)) seen = true;
  }
  return null;
}

async function main() {
  const { WHATSAPP_TEMPLATES, templateStatus } = await import("../lib/notify/templates");
  const variablesIn = (body: string) => [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))];
  const approvedTemplates = (names: string | undefined) =>
    new Set((names ?? "").split(",").map((n) => n.trim()).filter(Boolean));
  const entries = Object.entries(WHATSAPP_TEMPLATES) as [string, { name: string; category: string; variables: number; en: string; ar: string }][];

  /* -------------------------------------------------------------- list -- */
  const needed = [
    "phone_verify",
    "payment_rejected",
    "payout_sent",
    "payout_rejected",
    "payout_returned",
    "support_reply",
    "checkin_asking",
    "session_cancelled",
    "session_rescheduled",
    "patient_cancelled",
    "patient_moved",
  ];
  const names = entries.map(([, t]) => t.name);
  check(
    "🔴 every template the launch needs is on the list",
    needed.every((name) => names.includes(name)),
    needed.filter((name) => !names.includes(name)).join(", "),
  );
  check("each name is registered once", new Set(names).size === names.length);
  const badBodies = entries.filter(([, t]) => {
    const want = Array.from({ length: t.variables }, (_, i) => i + 1).join(",");
    return (
      [...variablesIn(t.en)].sort().join(",") !== want ||
      [...variablesIn(t.ar)].sort().join(",") !== want ||
      !/[؀-ۿ]/.test(t.ar) ||
      /[\u2013\u2014]/.test(t.en + t.ar)
    );
  });
  check(
    "🔴 each has an English and a real Arabic body using exactly its variables, and no dashes",
    badBodies.length === 0,
    badBodies.map(([kind]) => kind).join(", "),
  );
  const badAuth = entries.filter(([, t]) => t.category === "authentication" && (t.variables !== 1 || /https?:|\{\{2\}\}/.test(t.en + t.ar)));
  check("an authentication template carries one code and no link", badAuth.length === 0, badAuth.map(([k]) => k).join(", "));

  const notifyKinds = read("lib/notify/index.ts");
  const unknownKinds = entries.filter(([kind]) => !notifyKinds.includes(`| "${kind}"`));
  check("every template belongs to a message kind `notify` knows", unknownKinds.length === 0, unknownKinds.map(([k]) => k).join(", "));

  /* ---------------------------------------------------------- senders -- */
  const files = ["app", "lib"].flatMap(sourceFiles).filter((file) => !file.startsWith("lib/notify/"));
  const mismatches: string[] = [];
  let senders = 0;
  for (const file of files) {
    const text = read(file);
    for (const [kind, template] of entries) {
      let at = text.indexOf(`kind: "${kind}"`);
      while (at >= 0) {
        /* Inside the same message object: up to the call's close. */
        const window = text.slice(at, at + 1500).split(/\n\s{0,6}\);/)[0]!;
        const count = variableCount(window);
        if (count !== null) {
          senders += 1;
          if (count !== template.variables) mismatches.push(`${file} ${kind}: ${count} for ${template.variables}`);
        }
        at = text.indexOf(`kind: "${kind}"`, at + 1);
      }
    }
  }
  check(
    "🔴 every sender that fills a template passes the number of variables it takes",
    mismatches.length === 0 && senders >= 12,
    mismatches.join("; ") || `${senders} senders`,
  );

  /* ------------------------------------------------------------ status -- */
  check(
    "approval is configuration: named templates are approved, the rest are not, and a kind with none has none",
    templateStatus("phone.verify", approvedTemplates("phone_verify, session_confirmed")) === "approved" &&
      templateStatus("payment.rejected", approvedTemplates("phone_verify")) === "not_approved" &&
      templateStatus("clinic.removed", approvedTemplates("phone_verify")) === "none" &&
      approvedTemplates(undefined).size === 0,
  );
  check(
    "🔴 CONTROL the gate opens: a template named as approved reads approved, and the same name absent reads not approved",
    templateStatus("payment.rejected", approvedTemplates("payment_rejected")) === "approved" &&
      templateStatus("payment.rejected", approvedTemplates("")) === "not_approved",
  );
  const whatsapp = read("lib/notify/whatsapp.ts");
  check(
    "🔴 the WhatsApp sender refuses a template Meta has not approved",
    /templateStatus\(message\.kind\) !== "approved"\) \{[\s\S]{0,200}return false;/.test(whatsapp) && !/const TEMPLATES/.test(whatsapp),
  );

  /* ------------------------------------------------- the fallback, live -- */
  if (process.env.DATABASE_URL) {
    writesTo();
    const saved = { token: process.env.WHATSAPP_TOKEN, phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID, approved: process.env.WHATSAPP_APPROVED_TEMPLATES };
    process.env.WHATSAPP_TOKEN = "unused-in-this-check";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "0";
    process.env.WHATSAPP_APPROVED_TEMPLATES = "";
    const { db, pool } = connect();
    let orgId: string | null = null;
    let personId: string | null = null;
    try {
      const org = (await db.execute(sql`
        INSERT INTO organizations (name, region, slug) VALUES ('WhatsApp Demo', 'eg', ${fixture}) RETURNING id`)).rows[0] as { id: string };
      orgId = org.id;
      const person = (await db.execute(sql`
        INSERT INTO people (first_name, last_name, region) VALUES ('Huda', 'Demo', 'eg') RETURNING id`)).rows[0] as { id: string };
      personId = person.id;

      /* Stop any real request leaving: an unapproved template must never reach Meta. */
      const realFetch = globalThis.fetch;
      let calledMeta = false;
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        if (String(args[0]).includes("graph.facebook.com")) calledMeta = true;
        return realFetch(...args);
      }) as typeof fetch;

      const { notify } = await import("../lib/notify");
      const delivery = await notify(
        { personId: person.id, email: null, phone: "+201001234567", organizationId: org.id },
        { kind: "payment.rejected", subject: "Transfer", body: "We could not match your transfer.", variables: ["EGP 100.00"] },
      );
      globalThis.fetch = realFetch;

      const notice = (await db.execute(sql`
        SELECT kind, message_key FROM patient_notifications WHERE person_id = ${person.id}`)).rows as { kind: string; message_key: string }[];
      const attempt = (await db.execute(sql`
        SELECT reason FROM delivery_attempts WHERE organization_id = ${org.id}`)).rows as { reason: string | null }[];
      check(
        "🔴 a phone-only person, an unapproved template: Meta is never called, and the message lands in the app",
        !calledMeta && !delivery.sent && notice.length === 1 && notice[0]!.kind === "message_fallback",
        JSON.stringify({ calledMeta, delivery, notice }),
      );
      check(
        "…and the reason is written down, not only logged",
        attempt.length === 1 && attempt[0]!.reason === "whatsapp template not approved",
        JSON.stringify(attempt),
      );
    } finally {
      process.env.WHATSAPP_TOKEN = saved.token;
      process.env.WHATSAPP_PHONE_NUMBER_ID = saved.phoneId;
      process.env.WHATSAPP_APPROVED_TEMPLATES = saved.approved;
      if (personId) {
        await db.execute(sql`DELETE FROM patient_notifications WHERE person_id = ${personId}`);
        await db.execute(sql`DELETE FROM people WHERE id = ${personId}`);
      }
      if (orgId) {
        await db.execute(sql`DELETE FROM delivery_attempts WHERE organization_id = ${orgId}`);
        await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
      }
      await pool.end();
    }
  }

  finish("whatsapp templates");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
