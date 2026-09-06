/**
 * Prove the WhatsApp wiring end to end, the moment a key exists.
 *
 *   WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... \
 *   node --import tsx --conditions=react-server scripts/whatsapp-check.ts +201234567890
 *
 * Sends one **real** message to the number you pass, using the
 * `session_reminder` template. Nothing else in the product does that yet, and
 * this exists so that "WhatsApp works" is something somebody has seen rather
 * than something a comment claims.
 *
 * ## What to do before running it
 *
 * 1. A Meta Business account, a WhatsApp Business Account, and a phone number
 *    inside it. The number cannot be one already on consumer WhatsApp.
 * 2. In the Meta app dashboard: WhatsApp → API Setup gives you the
 *    **phone number ID** (a long integer, *not* the phone number) and a
 *    temporary 24-hour token. For production, make a System User with the
 *    `whatsapp_business_messaging` permission and mint a permanent token.
 * 3. WhatsApp → Message Templates: create the four templates named in
 *    `lib/notify/whatsapp.ts`, in the language `WHATSAPP_TEMPLATE_LANGUAGE`
 *    is set to (`ar` by default), each with the numbered variables the
 *    mapping expects. **They must be approved before anything sends.**
 *    Approval is usually minutes and is occasionally refused.
 * 4. The recipient must have messaged the business, or be on the test-number
 *    allowlist, until the number is out of sandbox.
 *
 * ## What it does not prove
 *
 * That the templates say something sensible in Arabic. Read them.
 */
import { sendWhatsapp, whatsappConfigured } from "../lib/notify/whatsapp";
import { e164Problem, isE164, toE164 } from "../lib/phone/e164";

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error("Usage: scripts/whatsapp-check.ts +201234567890");
    process.exit(1);
  }

  /*
   * 11R.13 — refuse anything that is not already E.164, and say what is wrong.
   *
   * `sendWhatsapp` now refuses these too and falls back to email, which is the
   * right behaviour in the product and the wrong one here: a check that
   * quietly reports "not sent" when the argument was malformed teaches you
   * nothing about whether WhatsApp works. `toE164` is called only to produce
   * the sentence explaining the refusal — the script never guesses a country.
   */
  if (!isE164(to)) {
    const parsed = toE164(to, null);
    console.error(
      `"${to}" is not an E.164 number. ${e164Problem(parsed) ?? ""}\n` +
        "Pass it the way Meta needs it: a plus, the country code, then the number — +201001234567.",
    );
    process.exit(1);
  }

  if (!whatsappConfigured()) {
    console.error(
      "WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not both set.\n" +
        "Nothing is wired up yet — see the comment at the top of this file.",
    );
    process.exit(1);
  }

  console.log(`Sending a session_reminder template to ${to}…`);

  const sent = await sendWhatsapp(to, {
    kind: "booking.reminder",
    subject: "Reminder",
    body: "This is a test from 24Therapy.",
    // Two variables, in the order the template expects.
    variables: ["Dr Test", "tomorrow at 19:00"],
  });

  if (sent) {
    console.log("\nSENT. Check the handset.");
    console.log("If nothing arrives, the template is probably not approved yet.");
  } else {
    console.log("\nNOT SENT — and this is the honest failure, not a crash.");
    console.log("Most likely: the template name or its language does not match, or it is");
    console.log("awaiting approval. The rejection code is in the log line above.");
  }

  process.exitCode = sent ? 0 : 1;
}

main();
