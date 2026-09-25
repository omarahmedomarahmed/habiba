/**
 * 🔴 0170: A MESSAGE TO NOBODY IS KEPT, NOT SENT.
 *
 * Proves, against the dev database:
 *   - an email to an invented address is kept in full (subject, body, the link)
 *     and reported as sent, and nothing is handed to the mail provider;
 *   - while the simulation runs, a WhatsApp message is kept, not sent;
 *   - CONTROL: with the simulation off, a WhatsApp message is not kept, and an
 *     email to a real address is never written to the outbox;
 *   - the cast can read it back with sim:inbox.
 */
import { execFileSync } from "node:child_process";

import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const tag = `ob${Date.now().toString(36)}`;
const invented = `nour.${tag}@example.com`;
const real = `someone.${tag}@24therapy.app`;
const phone = `+2010${String(Date.now()).slice(-8)}`;

async function main() {
  writesTo();
  const { db, pool } = connect();
  const count = async (to: string) =>
    Number(((await db.execute(sql`SELECT count(*)::int AS n FROM sim_outbox WHERE to_address = ${to.toLowerCase()}`)).rows[0] as { n: number }).n);

  /* The mail provider must never be reached for an invented address. */
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    const { sendNotification } = await import("../lib/mail");
    const sent = await sendNotification({
      to: invented,
      subject: "Set your password",
      body: "Your code is 482913.\n\nOr open the link.",
      link: { label: "Set password", url: `https://24therapy.app/set-password?token=${tag}` },
      footing: { reader: "patient", occasion: "asked" },
    });
    const [row] = (await db.execute(sql`SELECT channel, subject, body, reason FROM sim_outbox WHERE to_address = ${invented}`)).rows as {
      channel: string; subject: string; body: string; reason: string;
    }[];
    check(
      "🔴 an email to an invented address is kept in full and reported sent",
      sent === true && row?.channel === "email" && row.subject === "Set your password" && row.body.includes("482913") && row.body.includes(tag),
      JSON.stringify({ sent, reason: row?.reason }),
    );
    check("…and the mail provider was never called", !calls.some((u) => /resend/i.test(u)), calls.join(", "));

    const { sendWhatsapp } = await import("../lib/notify/whatsapp");
    const message = { kind: "session.started", subject: "Your session has started", body: "The door is open.", variables: ["Dr Nour"] } as never;
    process.env.SIMULATION_RUNNING = "";
    await sendWhatsapp(phone, message);
    const before = await count(phone);
    process.env.SIMULATION_RUNNING = "1";
    await sendWhatsapp(phone, message);
    const after = await count(phone);
    check("🔴 CONTROL with the simulation off, WhatsApp keeps nothing", before === 0, String(before));
    check("🔴 while the simulation runs, WhatsApp is kept, not sent", after === 1 && !calls.some((u) => /graph\.facebook/.test(u)), String(after));

    /* A phone-only person reached through notify() is kept even with WhatsApp unconfigured. */
    const phone2 = `${phone}9`;
    const { notify } = await import("../lib/notify");
    await notify({ email: null, phone: phone2 }, { kind: "claim.code", subject: "Your code", body: "Code 771204", variables: ["771204"] } as never);
    check("🔴 notify() keeps a phone-only message while the simulation runs, configured or not", (await count(phone2)) === 1, String(await count(phone2)));
    await db.execute(sql`DELETE FROM sim_outbox WHERE to_address = ${phone2}`);
    process.env.SIMULATION_RUNNING = "";

    const { isInventedEmail } = await import("../lib/notify/outbox");
    check(
      "🔴 a subdomain of example.com is invented too, and a lookalike is not",
      isInventedEmail("hoda@staff.example.com") && isInventedEmail("A@EXAMPLE.COM") && !isInventedEmail("x@example.com.eg") && !isInventedEmail("x@notexample.com"),
    );

    await sendNotification({ to: real, subject: "Hello", body: "A real address.", footing: { reader: "patient", occasion: "account" } });
    check("🔴 CONTROL an email to a real address is never written to the outbox", (await count(real)) === 0);

    const inbox = execFileSync("node", ["--env-file-if-exists=.env.local", "--import", "tsx", "scripts/sim-inbox.ts", invented], { encoding: "utf8" });
    check(
      "the cast reads it back: the code and the link come out of sim:inbox",
      inbox.includes("482913") && inbox.includes(`token=${tag}`),
      inbox.split("\n").slice(0, 6).join(" | "),
    );
  } finally {
    globalThis.fetch = realFetch;
    await db.execute(sql`DELETE FROM sim_outbox WHERE to_address IN (${invented}, ${real}, ${phone})`);
  }
  await pool.end();
  finish("outbox");
}

void main();
