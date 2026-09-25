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

  /*
   * 🔴 77.12: THE LIST LIVES IN `lib/mail-previews.ts` NOW, NOT HERE.
   *
   * They were typed into this file, and then `/admin/settings` needed the same
   * fourteen because this script cannot send: `RESEND_API_KEY` is a sensitive
   * variable on Vercel, which is write-only, so the only process holding the
   * key is the deployed product. Two copies of a subject line is C60's shape
   * applied to a message — the day one changes, the other is the one somebody
   * is reading. One list, two callers: this renders them, the console sends
   * them.
   */
  const { previewMessages } = await import("../lib/mail-previews");
  const templates = previewMessages().map(
    (message) => [message.name, () => message.send(to)] as [string, () => Promise<boolean>],
  );

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
