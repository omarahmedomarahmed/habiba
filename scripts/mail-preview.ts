/**
 * 🔴 76.80 — EVERY AUTOMATED EMAIL THIS PRODUCT SENDS, RENDERED, AND OPTIONALLY SENT.
 *
 *     npm run mail:preview                        # writes .render/mail/*.html
 *     npm run mail:preview -- --send you@example.com
 *
 * ## Why this exists
 *
 * Fourteen messages go out to patients, clinicians and finance teams and there
 * has never been a way to look at them all. They were written across ten
 * functions in `lib/mail.ts` and five call sites that build a subject and a body
 * and hand them to the notification shell, so the only way to see one was to
 * make the thing happen that sends it.
 *
 * That is how transactional email rots: a footer that says "sent by your
 * therapist" on a message we sent ourselves, a link built from a stale
 * `APP_URL`, a layout that broke in Outlook nine months ago. Nobody looks,
 * because looking is expensive.
 *
 * ## 🔴 IT CALLS THE REAL FUNCTIONS
 *
 * Not copies of them. `sendSessionReport` and friends are imported and invoked,
 * so what is written to `.render/mail/` is the exact HTML Resend would be handed.
 * A template that changes changes here, and a template that throws fails here.
 *
 * The HTML is captured by patching `fetch`, because that is the one seam
 * between building a message and posting it, and patching the seam is how the
 * preview stays honest rather than reimplementing the layout. The render pass
 * sets a placeholder key so the SDK builds the request at all; nothing leaves
 * the process unless `--send` was passed. See the note in `main`.
 *
 * ## 🔴 --send GOES TO ONE ADDRESS AND NAMES IT
 *
 * No list, no roster, no database read. The address is typed on the command line
 * by the person who wants the mail, and it is printed before anything is sent.
 * There is no code path here that could reach a real patient's inbox, which is
 * the property that makes this safe to keep in the repository.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import type { NoteContent } from "../lib/db/schema";
import { stubModules } from "./_render";

const OUT = ".render/mail";

const args = process.argv.slice(2);
const sendTo = args.includes("--send") ? args[args.indexOf("--send") + 1] : null;

/** Captured outbound messages, in order, whether or not they were delivered. */
type Captured = { subject: string; html: string; to: string };
const captured: Captured[] = [];

/**
 * 🔴 The seam. Resend's SDK posts JSON to `api.resend.com`; everything before
 * that call is this product's own code and everything after it is theirs.
 *
 * Intercepting here rather than exporting the templates keeps one copy of every
 * layout decision in `lib/mail.ts`. A preview built from a second renderer would
 * be a picture of a different email, which is worse than no picture.
 */
function capture(deliver: boolean) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("api.resend.com") && init?.body) {
      try {
        const body = JSON.parse(String(init.body)) as {
          subject?: string;
          html?: string;
          to?: string | string[];
        };
        captured.push({
          subject: body.subject ?? "(no subject)",
          html: body.html ?? "",
          to: Array.isArray(body.to) ? body.to.join(", ") : (body.to ?? ""),
        });
      } catch {
        /* A body we cannot read is one we do not record. Never a throw here. */
      }
      if (!deliver) {
        /* Rendering only: answer as Resend would, and post nothing. */
        return new Response(JSON.stringify({ id: "preview" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return real(input as RequestInfo, init);
  }) as typeof fetch;
}

function slug(subject: string, i: number): string {
  const base = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${String(i + 1).padStart(2, "0")}-${base || "untitled"}`;
}

async function main() {
  /*
   * 🔴 A PLACEHOLDER KEY FOR THE RENDER PASS, and the reason is not convenience.
   *
   * `send()` in `lib/mail.ts` returns early when `RESEND_API_KEY` is unset, so
   * with no key the message is never built into a request and the capture below
   * sees nothing — the tool prints "0 of 14 rendered" and reads as a broken
   * template rather than a missing variable. Setting a fake key makes the SDK
   * build the request, which the patched `fetch` intercepts and answers
   * locally. Nothing leaves this process unless `--send` was passed.
   */
  process.env.RESEND_API_KEY ||= "re_preview_not_a_real_key";
  await stubModules();

  const to = sendTo ?? "preview@example.com";
  const mail = await import("../lib/mail");

  /*
   * 🔴 Every figure and every name below is invented, and the surnames are Demo
   * and Example at a domain RFC 2606 reserves. C127 has no preview exemption:
   * a tool that rendered a real note would put clinical content in a file on
   * somebody's laptop.
   */
  const when = new Date(Date.UTC(2026, 2, 12, 15, 0));
  const note: NoteContent = {
    soap: {
      subjective:
        "Reports a return of middle-insomnia over the past week, waking around 03:00 with ruminative thinking about an upcoming performance review.",
      objective: "Arrived on time. Engaged throughout. No acute distress observed.",
      assessment:
        "Recurrence of anxiety-driven sleep disruption in the context of a time-limited work stressor. Adherence, not strategy, appears to be the limiting factor.",
      plan: "Increase the wind-down routine target to four nights and record which nights were completed.",
    },
    summary:
      "Follow-up session addressing a one-week recurrence of middle-insomnia linked to anticipatory work anxiety.",
    patientBrief:
      "Two of seven nights went better, and that is worth naming. Keep the wind-down going and we will look at it again in two weeks.",
    patientSteps: ["Wind-down routine, four nights", "Note which nights you managed it"],
    patientNext: "Same time next week. Bring the nights you wrote down.",
    talkingPoints: ["The review, and what happens after it", "What made the two better nights different"],
    observations: "Engaged, no acute distress, no risk indicators elicited or observed.",
    impressions: "Consistent with the established formulation rather than a new process.",
    recommendations: ["Raise the adherence target", "Review if middle-insomnia outlasts the review date"],
    followUp: "One week.",
  };

  const app = process.env.APP_URL ?? "https://24therapy.app";

  /* The ten templates in `lib/mail.ts`, each called for real. */
  const templates: [string, () => Promise<boolean>][] = [
    ["session report", () => mail.sendSessionReport({
      to, patientName: "Mariam Demo", therapistName: "Nour Demo",
      note, sessionDate: when, timezone: "Africa/Cairo", language: "en",
    })],
    ["session invite", () => mail.sendSessionInvite({
      to, therapistName: "Nour Demo", joinUrl: `${app}/j/DEMO1234`, priceCents: 6000,
    })],
    ["rating reminder", () => mail.sendRatingReminder({
      to, therapistName: "Nour Demo", therapistFirstName: "Nour",
      url: `${app}/r/DEMO1234`, sessionDate: when, timezone: "Africa/Cairo",
    })],
    ["therapist message", () => mail.sendTherapistMessage({
      to, firstName: "Mariam", subject: "About next week",
      body: "I have moved us to Thursday at the same time. Tell me if that does not work.",
    })],
    ["password reset", () => mail.sendPasswordReset({ to, url: `${app}/reset/DEMO-TOKEN` })],
    ["claim code", () => mail.sendClaimCode({ to, code: "419026" })],
    ["record export", () => mail.sendRecordExport({
      to, patientName: "Mariam Demo", clinicianName: "Nour Demo",
      url: `${app}/export/DEMO-TOKEN`, expiresInHours: 24,
    })],
    ["walk-in directions", () => mail.sendWalkInDirections({
      to, therapistName: "Nour Demo", practiceName: "Nile Practice",
      address: "12 Road 9, Maadi, Cairo",
      mapsUrl: "https://maps.google.com/?q=Maadi+Cairo",
    })],
    /*
     * The notification shell, once per kind that reaches a PERSON. The copy is
     * lifted from the call sites rather than invented, so the preview shows the
     * sentence that actually goes out.
     */
    ["booking confirmed", () => mail.sendNotification({
      to, subject: "A session with Nour Demo",
      body: "Nour Demo has kept Thursday 12 March at 17:00 for you.\n\nIf that does not work, tell them as early as you can and the hour goes back on their calendar for somebody else.",
      link: { label: "Open your session", url: `${app}/sessions/demo` },
    })],
    ["booking reminder", () => mail.sendNotification({
      to, subject: "Your session with Nour Demo",
      body: "A reminder that your session with Nour Demo is tomorrow at 17:00.\n\nIf you cannot make it, tell them as early as you can. The hour goes back on their calendar for somebody else.",
      link: { label: "Open your session", url: `${app}/sessions/demo` },
    })],
    ["session started", () => mail.sendNotification({
      to, subject: "Nour Demo is ready for you",
      body: "The door is open. Join when you are ready.",
      link: { label: "Go in", url: `${app}/sessions/demo` },
    })],
    ["summary ready", () => mail.sendNotification({
      to, subject: "Your session summary is ready",
      body: "Nour Demo has approved the summary from your session. It is on your record.",
      link: { label: "Read it", url: `${app}/patient/sessions` },
    })],
    ["payout sent", () => mail.sendNotification({
      to, subject: "Your withdrawal is on its way",
      body: "We have sent 1,840.00 EGP to Nour Demo. The transfer receipt is on your earnings page.",
      link: { label: "Your earnings", url: `${app}/billing` },
    })],
    ["payment due", () => mail.sendNotification({
      to, subject: "A session is waiting to be paid",
      body: "Your session on 12 March has an unpaid balance of 60.00 EGP. Nothing about your record changes until it is settled.",
      link: { label: "Pay for it", url: `${app}/patient/billing` },
    })],
  ];

  capture(sendTo !== null);

  if (sendTo) {
    console.log(`\n🔴 SENDING ${String(templates.length)} real emails to ${sendTo}`);
    console.log(`   from ${process.env.EMAIL_FROM ?? "(EMAIL_FROM unset)"}\n`);
  } else {
    console.log(`\nRendering ${String(templates.length)} emails to ${OUT}/ (nothing is sent)\n`);
  }

  mkdirSync(OUT, { recursive: true });

  let ok = 0;
  for (const [name, run] of templates) {
    const before = captured.length;
    const delivered = await run();
    const message = captured[before];
    if (!message) {
      console.log(`  ??  ${name}: nothing reached the transport`);
      continue;
    }
    const file = `${OUT}/${slug(name, before)}.html`;
    writeFileSync(file, message.html);
    if (sendTo) {
      console.log(`  ${delivered ? "ok " : "FAIL"} ${name.padEnd(20)} ${message.subject}`);
      if (delivered) ok += 1;
    } else {
      console.log(`  ok  ${name.padEnd(20)} ${message.subject}`);
      ok += 1;
    }
  }

  console.log(
    sendTo
      ? `\n${String(ok)} of ${String(templates.length)} sent to ${sendTo}. HTML also in ${OUT}/`
      : `\n${String(ok)} of ${String(templates.length)} rendered into ${OUT}/`,
  );
  if (sendTo && ok === 0) {
    console.log("\nNothing was delivered. RESEND_API_KEY is probably unset in this shell.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
