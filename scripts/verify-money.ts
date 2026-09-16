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
   * 🔴 THE BROWSER NEVER CONVERTS, and that is the half a screenshot cannot
   * show. The rate is an operator's setting and changes the afternoon the pound
   * moves; a component that could compute the pounds could show a figure we
   * would not honour. It asks the server and renders the answer.
   */
  const money = readSource("components/ui/money.tsx");
  check(
    "🔴 the pounds come from the server, and the component does no arithmetic",
    /egpFor\(cents\)/.test(money) &&
      !/egpRateMicro|rateMicro|\* *1_000_000|\/ *1_000_000/.test(money),
    "a browser that can compute the rate can show one we would not honour",
  );

  check(
    "🔴 …and nothing is converted until somebody asks",
    !/useEffect\([^)]*\{\s*egpFor/.test(money) && /setTimeout\(reveal/.test(money),
    "a table of forty prices must cost forty conversions only if forty questions are asked",
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

  finish("sprint 76 money");
}

main();
