/**
 * Every price a person reads can tell them what it is in pounds.
 *
 *   npm run verify:money
 *
 * ## 🔴 THE PROPERTY
 *
 * The product quotes dollars and the launch market thinks in pounds. The
 * decision was that dollars are the text and the pounds are one interaction
 * away, on the figure itself, fetched when somebody asks rather than on page
 * load.
 *
 * That is only true if it is true EVERYWHERE. A price that renders as a bare
 * string is a price with no answer, and the person who meets it is the one who
 * had the question. So this bans the bare render rather than checking that the
 * component exists: `<Money>` being imported somewhere proves nothing about the
 * table three files over.
 *
 * ## 🔴 THE TWO POSITIONS, AND ONLY ONE OF THEM IS A DEFECT
 *
 * A formatter in JSX TEXT position renders a figure a person reads, and that is
 * what must be wrapped. A formatter passed as a STRING PROP — `label={...}`,
 * `{ label: ... }` — is feeding a component that wants a string, often for an
 * aria-label, a chart legend or a server-composed sentence. Those are listed
 * rather than banned, because wrapping a string in a React element would break
 * the call site, and pretending otherwise is how a check gets an exemption list
 * nobody reads.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

/**
 * 🔴 Screens where the PAYER is being told what to send, and the operative
 * figure is pounds rather than dollars.
 *
 * The rule everywhere else is dollars with the pounds revealed on demand. Here
 * it is the other way round on purpose: this is the number somebody types into
 * a banking app, and putting it one hover away would be a transfer for the
 * wrong amount. The stepper and the transfer screens format their own EGP on
 * the server and are exempt by name rather than by accident.
 */
const PAYS_IN_POUNDS = [
  "components/billing/pay-by-transfer.tsx",
  "components/billing/top-up-stepper.tsx",
  "components/billing/payment-popup.tsx",
  "components/billing/pending-bar.tsx",
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith(".tsx")) out.push(path);
    }
  };
  walk("app");
  walk("components");
  return out;
}

/**
 * `{formatUsd(…)}` in JSX text, or `{formatMoney(…, "USD", …)}` in JSX text.
 *
 * 🔴 ONLY DOLLARS, and the first version of this check did not say so. It
 * flagged four renders that were already in POUNDS — a therapist's payout in
 * their own currency, the price tag that quotes a patient in EGP — and demanded
 * they be made to reveal their pounds. They were the pounds.
 *
 * That is the §6 family again, in the check written to enforce a rule about
 * dollars: it matched the FORMATTER rather than the CURRENCY. A figure already
 * in the reader's money has nothing to reveal and belongs nowhere near this.
 */
const TEXT_POSITION = /(^|[^=:\s])\s*\{\s*(formatUsd\s*\(|formatMoney\s*\([^)]*"[Uu][Ss][Dd]")/;

function main() {
  const files = sourceFiles().filter((f) => !PAYS_IN_POUNDS.includes(f));

  const bare: string[] = [];
  for (const file of files) {
    const src = readSource(file);
    for (const line of src.split("\n")) {
      /* Already wrapped on this line, or feeding a prop: not a bare render. */
      if (/<Money|<UsdMoney/.test(line)) continue;
      if (/=\s*\{\s*(formatUsd|formatMoney)|:\s*(formatUsd|formatMoney)/.test(line)) continue;
      /* Inside a template literal it is a string being built, not a render. */
      if (/\$\{/.test(line) || /`/.test(line)) continue;
      if (TEXT_POSITION.test(line)) {
        bare.push(`${file}: ${line.trim().slice(0, 60)}`);
        break;
      }
    }
  }

  check(
    "🔴 no price is rendered as a bare string where a person reads it",
    bare.length === 0,
    bare.slice(0, 6).join(" · ") || `${files.length} files scanned, none bare`,
  );

  /*
   * 🔴 CONTROL, because the check above is an absence and §6 says an absence
   * assertion is worth nothing until it is watched finding something.
   */
  check(
    "🔴 CONTROL the same scan catches the render it was written to find",
    TEXT_POSITION.test("        <p>{formatUsd(row.amountCents)}</p>") &&
      !TEXT_POSITION.test('        <Stat label={formatUsd(row.amountCents)} />') &&
      /* 🔴 And a figure already in pounds is not this rule's business. */
      !TEXT_POSITION.test('        <p>{formatMoney(payMinor, "EGP", locale)}</p>'),
    "watched catching a dollar render, clearing a string prop, and clearing a pound figure",
  );

  /*
   * 🔴 AND NO `<Money>` IS SITTING INSIDE A TEMPLATE LITERAL, which is not a
   * hypothetical: sprint 76 put fifteen of them there.
   *
   * The codemod that wrapped every figure skipped a formatter in a PROP
   * position by looking at the character before the brace, and `${` is not one
   * of the two characters it knew about. So `` `Released ${formatUsd(x)}` ``
   * became `` `Released $<Money cents={x} />` ``, which is a STRING. It
   * compiles, it typechecks, it renders the angle brackets to the reader, and
   * the only way to see it is to look at the screen.
   *
   * Cheap to check and impossible to notice, which is the definition of a
   * thing worth a gate.
   */
  const inTemplate: string[] = [];
  for (const file of sourceFiles()) {
    const src = readSource(file);
    if (/\$<(Money|UsdMoney)\b/.test(src) || /`[^`\n]*<(Money|UsdMoney)\b/.test(src)) {
      inTemplate.push(file);
    }
  }

  check(
    "🔴 no price component is stranded inside a template literal, where it renders as text",
    inTemplate.length === 0,
    inTemplate.slice(0, 5).join(", ") || "none, checked across every tsx file",
  );

  check(
    "🔴 CONTROL the same scan catches the fifteen this sprint actually wrote",
    /\$<(Money|UsdMoney)\b/.test("setMessage(`Released $<Money cents={n} />`)"),
    "watched catching the exact corruption the codemod produced",
  );

  /*
   * 🔴 THE RATE IS THE SERVER'S, AND THE ARITHMETIC IS THE ONE THE PAYMENT USES.
   *
   * Pounds now lead on every signed-in screen, so every figure converts at
   * render rather than on a hover. What must still hold is the point of the
   * old rule: no screen invents a rate. The rate arrives with the page from
   * the operator's setting (root layout), and the component converts only
   * through `moneyLabels`, whose `egpMinorFor` is the same function a transfer
   * and a card are asked for with.
   */
  const money = readSource("components/ui/money.tsx");
  const root = readSource("app/layout.tsx");
  check(
    "🔴 the rate comes from the operator's setting with the page, and the component converts only through the shared function",
    /moneyLabels\(/.test(money) && /useMoneyDisplay\(\)/.test(money) &&
      !/\d{2}_?000_?000|egpRateMicro/.test(money) &&
      /egpRateMicro\(\)/.test(root) && /MoneyDisplayProvider primary="EGP" rateMicro=\{rateMicro\}/.test(root) &&
      /export \{ egpMinorFor \} from "@\/lib\/money\/convert"/.test(readSource("lib/billing/manual.ts")),
    "a browser that could pick its own rate could show a figure we would not honour",
  );

  check(
    "🔴 …pounds lead for everybody using the product; dollars lead on the website and the console, whose switch is the console's alone",
    /primary="USD"/.test(readSource("app/(public)/layout.tsx")) &&
      /adminCurrencyFrom\(/.test(readSource("app/(admin)/layout.tsx")) &&
      /requireStaff\(\)/.test(readSource("app/actions/admin-currency.ts")),
    "the founder's rule: users read EGP, the website and staff read USD, and a staff switch changes no user's screen",
  );

  check(
    "🔴 …and it answers a pointer, a tap and a keyboard, because a phone has no hover",
    /onMouseEnter/.test(money) && /onClick/.test(money) && /onFocus/.test(money),
    "hover alone would make this desktop-only, in a market that is mostly phones",
  );

  /*
   * 🔴 AND THE PAYMENT SCREENS ARE EXEMPT BY NAME, which is a decision rather
   * than an oversight. Listed here so that removing one from the list is a
   * visible act in a diff.
   */
  check(
    "🔴 the screens that quote POUNDS as the headline are exempt deliberately",
    PAYS_IN_POUNDS.every((f) => readSource(f).length > 0),
    PAYS_IN_POUNDS.join(" · "),
  );

  /* ================================================================== */
  /*  🔴 76.46 · SETTLING IS NOT THE SAME AS SHOWING                     */
  /* ================================================================== */

  /*
   * ## The defect this is named after
   *
   * `components/public/pricing-tiers.tsx` priced the pounds on the PUBLIC
   * PRICING PAGE with `quoteFor("usd", "egp")`. C37 makes `quoteFor` refuse a
   * static rate in production, and there is no rate provider configured, so in
   * production it returned null on every render. `PriceTag` renders no toggle
   * without a rate, so **nobody in the launch market could see a single price
   * in pounds**, and it logged an `error` each time: 198 of them across 17
   * people over nine days, on the busiest route in the product.
   *
   * The same call refused an Egyptian therapist setting their session price in
   * pounds on `/settings`, and told them to "try again shortly".
   *
   * ## 🔴 THE PROPERTY, AND IT IS A DISTINCTION RATHER THAN A BAN
   *
   * `quoteFor` is correct where money SETTLES. A rate nobody checked must not
   * price a charge, and refusing is the right answer: the refusal is a bug
   * report and the wrong rate is a receipt.
   *
   * Showing somebody what a price is worth in their own currency settles
   * nothing, and neither does checking one against a floor and a cap. Those use
   * `egpRateMicro()`, the rate an operator sets on `/admin/settings`, which is
   * the number every payment screen already shows them, so the marketing page
   * and the checkout agree by construction.
   *
   * `lib/billing/manual.ts` wrote this down for the payment rail before the
   * pricing page existed. The rail learned it and the page did not, which is
   * why it is a check now rather than a paragraph.
   */
  const SETTLES = [
    "lib/billing/payouts.ts",
    "lib/billing/connect.ts",
    "app/pay/[token]/actions.ts",
  ];

  const everyTsFile = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (at: string) => {
      for (const entry of readdirSync(at, { withFileTypes: true })) {
        const full = join(at, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
      }
    };
    walk(dir);
    return out;
  };

  const callers = [...everyTsFile("app"), ...everyTsFile("components"), ...everyTsFile("lib")]
    .filter((f) => f !== "lib/billing/fx.ts")
    .filter((f) => /\bquoteFor\s*\(/.test(readSource(f)));

  const strays = callers.filter((f) => !SETTLES.includes(f));

  check(
    "🔴 76.46 only the surfaces that SETTLE money reach `quoteFor`",
    strays.length === 0,
    strays.length === 0
      ? `${callers.length} callers, all of them settling: ${SETTLES.join(" · ")}`
      : `showing a price is not settling one: ${strays.join(" · ")}`,
  );

  check(
    "🔴 76.46 CONTROL the scan FINDS the settling callers, so zero strays cannot mean zero found",
    callers.length >= SETTLES.length && SETTLES.every((f) => callers.includes(f)),
    `${callers.length} found`,
  );

  /*
   * 🔴 AND THE TWO SURFACES THE DEFECT WAS ON NOW READ THE OPERATOR'S RATE.
   *
   * Named, because "no stray callers" is satisfied just as well by a page that
   * shows no pounds at all, which is the state this is fixing.
   */
  for (const [file, what] of [
    ["components/public/pricing-tiers.tsx", "the public pricing page"],
    ["app/(app)/settings/actions.ts", "a therapist pricing in pounds"],
  ] as const) {
    check(
      `🔴 76.46 ${what} prices off the operator's rate`,
      /egpRateMicro\s*\(/.test(readSource(file)),
      file,
    );
  }

  finish("sprint 76 money");
}

main();
