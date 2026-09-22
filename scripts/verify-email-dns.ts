/**
 * Can anybody send email as us, and does our own email arrive.
 *
 *     npm run verify:email-dns
 *
 * ## The two questions, which are the same three records
 *
 * A domain with no SPF, DKIM or DMARC is a domain anybody can send as. For a
 * product whose mail carries session invitations, password resets and links
 * into a clinical record, that is a phishing kit with our name on it. The same
 * three records are also what decides whether OUR mail is delivered at all: a
 * message that fails authentication is spam-foldered by Gmail and rejected
 * outright by a hospital gateway.
 *
 * So this is one check with two failure modes, and the expensive one is
 * silent. Nobody reports the password reset they never received.
 *
 * ## 🔴 WHY IT IS A RATCHET AND NOT A WALL
 *
 * DNS is not in this repository. No commit can fix it and no reviewer can
 * merge it, so a gate that simply fails is a gate that is red for weeks and
 * then ignored, which is H20 and is worse than not checking.
 *
 * It records what is missing TODAY and fails when more goes missing. Add a
 * record and the run says LOWER THE BASELINE, which is the same shape as the
 * dead export count and the prose sweep.
 *
 * ## 🔴 AND IT DOES NOT INVENT VALUES
 *
 * The exact SPF include and DKIM selector for a sending provider come from
 * that provider's dashboard, and a verifier that hard-codes a guess teaches
 * somebody to paste a wrong record. This asserts PROPERTIES: that a DMARC
 * record exists, that SPF names the provider we actually send through, that a
 * DKIM selector resolves. `docs/EMAIL-DNS.md` says where the values come from.
 */
import { promises as dns } from "node:dns";

import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

const DOMAIN = process.env.EMAIL_DOMAIN ?? "24therapy.app";

/**
 * 🔴 The state on the day this was written, measured rather than assumed.
 *
 * Each `false` is a real gap with a real consequence, and each one is the
 * user's to close in their registrar rather than ours in a commit.
 */
/**
 * 🔴 WHEN THE MONITORING FORTNIGHT RUNS OUT.
 *
 * DMARC was published at `p=none` on 2026-09-22. `docs/EMAIL-DNS.md` asks for
 * a fortnight of reading the `rua` reports before tightening, and this is that
 * fortnight as a date rather than as a thing somebody remembers.
 *
 * On 2026-10-06 this gate starts failing until the policy moves to
 * `p=quarantine`. Moving earlier is fine and turns the line green early.
 */
const MONITORING_UNTIL = new Date("2026-10-06T00:00:00Z");

const BASELINE = {
  /* `v=spf1 include:zohomail.com ~all` — the mailbox host, not the sender. */
  spf: true,
  /*
   * 🔴 BOTH SELECTORS ARE LIVE, AND A COMMENT IN THE PRODUCT SAID OTHERWISE.
   *
   * This baseline first said `false`, taken from `lib/notify/email.ts`, which
   * carried "the Resend domain is not verified yet". The first run of this
   * gate reported DKIM as resolving and asked for the baseline to be lowered,
   * which is the gate doing the one thing a document cannot: asking the world
   * instead of the last person who wrote it down.
   *
   * `resend._domainkey` and `zmail._domainkey` both publish a key.
   */
  dkim: true,
  /*
   * 🔴 Published 2026-09-22, at `p=none`, after this gate spent two days
   * saying it was the real gap. See `MONITORING_UNTIL` above for the clock on
   * moving it to `p=quarantine`.
   */
  dmarc: true,
  /*
   * 🔴 THIS SAID `false` FOR TWO DAYS AND THE SETUP WAS FINE THE WHOLE TIME.
   *
   * The root SPF is `v=spf1 include:zohomail.com ~all`, which names the
   * MAILBOX host and not the sender, so a check looking there concluded the
   * sender was uncovered and a founder was told to go and fix a record that
   * was already correct.
   *
   * Resend puts nothing in the root SPF. Its setup creates `send.<domain>`
   * carrying `v=spf1 include:amazonses.com ~all`, because Resend sends through
   * Amazon SES and the bounce address lives on that subdomain. Under the
   * `aspf=r` in our DMARC record the two are the same organisational domain,
   * so SPF passes and aligns.
   *
   * The lesson is the one in `docs/TRAPS.md`: this check knew where it
   * expected the answer to be rather than where the product actually puts it.
   */
  spfCoversSender: true,
};

async function txt(name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function main() {
  const reachable = await dns
    .resolve(DOMAIN, "NS")
    .then(() => true)
    .catch(() => false);

  await skipUnless(
    reachable,
    "a network that can resolve DNS",
    `${DOMAIN} did not resolve, so nothing below was asked`,
    async () => {
      const root = await txt(DOMAIN);
      const spfRecord = root.find((r) => r.startsWith("v=spf1")) ?? null;
      const dmarcRecord =
        (await txt(`_dmarc.${DOMAIN}`)).find((r) => r.startsWith("v=DMARC1")) ?? null;

      /*
       * 🔴 THIS GATE LOOKED IN THE WRONG PLACE AND REPORTED A REAL SETUP AS A GAP.
       *
       * It asked whether the ROOT domain's SPF names Resend, found
       * `v=spf1 include:zohomail.com ~all`, and said the sender was uncovered.
       * It then told a founder to go and add Resend to SPF, which was work
       * they did not need to do on a record that was already correct.
       *
       * Resend does not put anything in the root SPF. Its domain setup creates
       * a SENDING SUBDOMAIN, `send.<domain>`, carrying
       * `v=spf1 include:amazonses.com ~all`, because Resend sends through
       * Amazon SES and the bounce address lives there.
       *
       * That still aligns for DMARC, and the reason is `aspf=r`: under RELAXED
       * alignment `send.24therapy.app` and `24therapy.app` are the same
       * organisational domain, so SPF passes AND aligns. Under `aspf=s` they
       * are two different domains and every message would fail SPF alignment.
       * So the relaxed setting is not a soft default here, it is what makes
       * this setup work, which is why the check below asserts it.
       */
      const sendingSubdomainSpf =
        (await txt(`send.${DOMAIN}`)).find((r) => r.startsWith("v=spf1")) ?? null;

      /*
       * Selectors are provider specific, so several are tried rather than one
       * guessed at. Finding none is the finding; finding any means DKIM is set
       * up for somebody.
       */
      const SELECTORS = ["resend", "zoho", "zmail", "s1", "s2", "google", "default"];
      const dkim = (
        await Promise.all(
          SELECTORS.map(async (s) => ((await txt(`${s}._domainkey.${DOMAIN}`)).length > 0 ? s : null)),
        )
      ).filter(Boolean) as string[];

      const now = {
        spf: spfRecord !== null,
        dmarc: dmarcRecord !== null,
        dkim: dkim.length > 0,
        /*
         * 🔴 THE ONE THAT LOOKS FINE AND IS NOT.
         *
         * An SPF record exists, so every "do you have SPF" checklist passes.
         * It authorises `zohomail.com`, which is where the MAILBOXES are. The
         * product sends through Resend. So the record is real, correct for
         * what it covers, and does not cover the mail this product actually
         * sends, which is the shape that survives an audit.
         */
        spfCoversSender: spfRecord !== null && (/resend/i.test(spfRecord) || sendingSubdomainSpf !== null),
      };

      const lost = (Object.keys(BASELINE) as (keyof typeof BASELINE)[]).filter(
        (key) => BASELINE[key] && !now[key],
      );
      const gained = (Object.keys(BASELINE) as (keyof typeof BASELINE)[]).filter(
        (key) => !BASELINE[key] && now[key],
      );

      check(
        "🔴 no email authentication record has been LOST since this was recorded",
        lost.length === 0,
        lost.length > 0
          ? `${lost.join(", ")} used to resolve and no longer does`
          : `spf ${String(now.spf)} · dkim ${String(now.dkim)} · dmarc ${String(now.dmarc)} · spf covers the sender ${String(now.spfCoversSender)}`,
      );

      check(
        "🔴 …and the ones still missing are named, so nobody has to remember",
        true,
        gained.length > 0
          ? `${gained.join(", ")} now resolves. LOWER THE BASELINE in this file.`
          : (Object.keys(BASELINE) as (keyof typeof BASELINE)[])
              .filter((key) => !now[key])
              .map((key) => `${key} is still missing`)
              .join(" · ") || "all four are in place, and the baseline should say so",
      );

      /*
       * 🔴 CONTROL — the resolver has to be able to find something and miss
       * something. Four falses from a resolver that cannot reach DNS at all is
       * indistinguishable from four real gaps, and this gate would report the
       * same line either way.
       */
      const invented = await txt(`no-such-record-${Date.now()}.${DOMAIN}`);
      check(
        "🔴 CONTROL the resolver reads a real record and misses an invented one",
        now.spf && invented.length === 0,
        "SPF was read from live DNS, and a name nobody registered came back empty",
      );

      /*
       * 🔴 `p=none` MONITORS AND ENFORCES NOTHING, and this is a CLOCK rather
       * than a permanently red line.
       *
       * It is the right first step and the wrong resting place. The obvious
       * check is `!p=none`, and it went red the hour the record was published,
       * which is C90's defect exactly: *a gate that is red for a known reason
       * is a gate everybody learns to skim, and the next real failure hides
       * inside it.* Two weeks of that and nobody reads this gate at all.
       *
       * So the fortnight `docs/EMAIL-DNS.md` asks for is enforced instead of
       * remembered. `p=none` is FINE until `MONITORING_UNTIL`, and a failure
       * after it. The date is written down once, by the person who published
       * the record, and the gate counts the days.
       *
       * The reports are the point of the fortnight: `rua=` is how you find out
       * who else sends as this domain, and moving to `quarantine` before
       * reading them is how a company discovers its own invoicing system was a
       * sender, by having it stop.
       */
      if (dmarcRecord) {
        const monitoring = /p=none/i.test(dmarcRecord);
        const daysLeft = Math.ceil((MONITORING_UNTIL.getTime() - Date.now()) / 86_400_000);

        check(
          "🔴 the DMARC policy refuses something, or is still inside its monitoring fortnight",
          !monitoring || daysLeft > 0,
          monitoring
            ? daysLeft > 0
              ? `p=none, ${String(daysLeft)} day(s) of report reading left before this fails`
              : `the fortnight is up. Read the rua reports, then move to p=quarantine.`
            : dmarcRecord,
        );

        /*
         * 🔴 AND THE ALIGNMENT IS RELAXED, WHICH IS NOT A DETAIL HERE.
         *
         * SPF names Zoho and the product sends through Resend, so SPF fails on
         * every transactional message and DKIM is the only thing carrying it.
         * Under `aspf=s` that is still true; under a future `p=reject` with
         * strict alignment it would silently quarantine every password reset
         * and session invitation this product sends.
         */
        check(
          "🔴 …and alignment is relaxed while SPF still does not name the sender",
          now.spfCoversSender || (!/aspf=s/i.test(dmarcRecord) && !/adkim=s/i.test(dmarcRecord)),
          now.spfCoversSender
            ? "SPF names the sender, so strict alignment is survivable"
            : "relaxed, which is what keeps transactional mail authenticating on DKIM alone",
        );
      }
    },
  );

  finish("email dns");
}

void main();
