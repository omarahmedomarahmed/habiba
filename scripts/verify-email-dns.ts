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
  /* Nothing at `_dmarc.24therapy.app`. This is the real gap. */
  dmarc: false,
  /*
   * SPF names zohomail.com and the product sends through Resend, so SPF FAILS
   * for our transactional mail.
   *
   * It is not the catastrophe it first looks like, and the reason is worth
   * writing down rather than rediscovering: DMARC passes on EITHER aligned SPF
   * or aligned DKIM. Resend signs with `resend._domainkey.24therapy.app` and
   * the From is `noreply@24therapy.app`, so DKIM aligns and the mail
   * authenticates. Adding Resend to SPF is still worth doing, because SPF is
   * what survives when DKIM signatures are broken by a forwarder.
   */
  spfCoversSender: false,
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
        spfCoversSender: spfRecord !== null && /resend/i.test(spfRecord),
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
       * A DMARC policy of `p=none` monitors and enforces nothing. It is the
       * right first step and the wrong resting place, so it is reported as its
       * own line rather than counted as having DMARC.
       */
      if (dmarcRecord) {
        check(
          "🔴 the DMARC policy actually refuses something",
          !/p=none/i.test(dmarcRecord),
          /p=none/i.test(dmarcRecord)
            ? "p=none monitors and enforces nothing. Move to quarantine once the reports are clean."
            : dmarcRecord,
        );
      }
    },
  );

  finish("email dns");
}

void main();
