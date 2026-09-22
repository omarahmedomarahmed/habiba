/**
 * Everything the product tells somebody is findable again inside the product.
 *
 *     npm run verify:notices
 *
 * ## 🔴 WHY THIS EXISTS
 *
 * `notify()` sends by email and WhatsApp. `patient_notifications` is the log a
 * patient opens in the app. For a long time those were two systems that almost
 * nobody wired together: twenty-six files sent messages and three wrote the
 * log, and all three of those were about the employer benefit.
 *
 * So a clinician invited a patient to a paid session on production, the patient
 * opened the app, and there was nothing there. No invitation, no price, no
 * door. The email had gone out and the product had no memory of it.
 *
 * That is worse than a missing feature. A person who deletes the email, or
 * never gets it because their number was never collected, has no way back to
 * the thing they were invited to, and nothing on any screen says a thing exists.
 *
 * ## The rule
 *
 * A message that a PERSON should be able to find again carries `notice` and a
 * `personId`, and `notify()` writes the row. A message to staff does not, and
 * neither does one whose whole content is a link that expires in minutes.
 *
 * ## 🔴 A RATCHET, NOT A WALL
 *
 * Twenty-six call sites cannot be decided in one commit, and a gate that fails
 * on all of history on day one is a gate somebody disables on day two. The
 * number of unwired sends may only fall, and lowering it is the work.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { reporter } from "./_verify";
import { stripCommentsKeepingLines } from "./_dashes";

const { check, finish } = reporter();

/**
 * 🔴 How many `notify()` calls still have no in-app home.
 *
 * Measured on the commit that built the seam. It may only fall.
 */
const UNWIRED_BASELINE = 18;

/** Sends that are deliberately outbound only, each with the reason. */
const OUTBOUND_ONLY: Record<string, string> = {
  "lib/patient-auth/reset.ts":
    "a password reset is a link that expires in minutes; a copy of it sitting in a log is a second place to steal it from",
  "lib/patient-auth/code-signin.ts":
    "a sign-in code is worth nothing after it is used and dangerous while it is not, so it is never written down",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/**
 * 🔴 Comments stripped first. `docs/TRAPS.md` T1: a file explaining that it
 * does not write a notice would otherwise read as one that does.
 */
const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));

/** Files that call `notify(` and are not the implementation of it. */
function senders(): string[] {
  return walk("lib")
    .concat(walk("app"))
    .filter((file) => !file.startsWith(join("lib", "notify")))
    .filter((file) => /\bnotify\(/.test(read(file)));
}

/** A sender that never passes a `notice`, so nothing it says reaches the app. */
function unwired(file: string): boolean {
  if (OUTBOUND_ONLY[file]) return false;
  return !/notice:\s*\{/.test(read(file));
}

function main() {
  const all = senders();
  const missing = all.filter(unwired);

  check(
    "🔴 the seam exists: notify() writes the in-app row itself",
    /patientNotifications/.test(read("lib/notify/index.ts")) &&
      /to\.personId/.test(read("lib/notify/index.ts")),
    "one place writes it, so a call site gains it by naming a person rather than by remembering a table",
  );

  /*
   * 🔴 AND IT IS WRITTEN BEFORE THE SEND, which is not a detail.
   *
   * Email and WhatsApp are best effort. The log inside the app is the one place
   * a person can always come back to, so it must not depend on a provider
   * having answered.
   */
  const body = read("lib/notify/index.ts");
  const rowAt = body.indexOf("patientNotifications");
  const sendAt = body.indexOf("sendNotificationEmail");
  check(
    "🔴 …and it is written BEFORE the channels, so a failed send still leaves something to open",
    rowAt > 0 && sendAt > 0 && rowAt < sendAt,
    "the in-app row does not depend on a third party having answered",
  );

  check(
    "🔴 the number of sends with no in-app home only falls",
    missing.length <= UNWIRED_BASELINE,
    missing.length < UNWIRED_BASELINE
      ? `${String(missing.length)} of ${String(all.length)}, LOWER THE BASELINE to ${String(missing.length)}`
      : `${String(missing.length)} of ${String(all.length)}, baseline ${String(UNWIRED_BASELINE)}`,
  );

  /*
   * 🔴 CONTROL — the detector has to be able to say both words.
   *
   * A scan that finds every file unwired passes this gate for as long as the
   * baseline holds and then blocks every improvement. A scan that finds none
   * passes it forever while nothing is wired at all. So one of each, named.
   */
  check(
    "🔴 CONTROL the detector sees a wired sender and an unwired one",
    unwired("lib/data/session-invite.ts") === false && missing.length > 0 && all.length > missing.length,
    `${String(all.length - missing.length)} wired · ${String(missing.length)} not`,
  );

  /*
   * 🔴 AND AN EXEMPTION THAT HAS STOPPED BEING NEEDED IS DELETED.
   *
   * The same rule `verify:traps` T3 applies to a fixture allow-list: a
   * permission covering nothing reads as a considered decision, and the next
   * unwired send slips under it unremarked.
   */
  const stale = Object.keys(OUTBOUND_ONLY).filter(
    (file) => !all.includes(file) || /notice:\s*\{/.test(read(file)),
  );

  check(
    "🔴 every outbound-only exemption still applies, and says why",
    stale.length === 0 &&
      Object.values(OUTBOUND_ONLY).every((why) => why.split(/\s+/).length >= 15),
    stale.length > 0 ? `${stale.join(" · ")} no longer needs its exemption` : "each one earns its place",
  );

  if (missing.length > 0) {
    console.log("\n  still outbound only:");
    for (const file of missing.sort()) console.log(`    ${file}`);
  }

  finish("notices");
}

main();
