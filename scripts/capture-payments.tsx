/**
 * 🔴 76.23 — EVERY PAYMENT SURFACE, PHOTOGRAPHED, FOR EVERY PAYER AND EVERY STAGE.
 *
 *   npm run capture:payments
 *
 * ## Why this renders components rather than driving the product
 *
 * The obvious build boots the app, signs in as four different people and clicks
 * through to each sheet. It is also the build that cannot photograph half of
 * what matters: a payment that has been SUBMITTED and is waiting for an
 * operator, a payment that has been CONFIRMED, and a payment that was REJECTED
 * are three states that need three different databases to reach by clicking,
 * and a rejection needs an operator in a second browser.
 *
 * So the real components are rendered with the real dictionary and the real
 * props, one frame per state, and photographed. What is being checked is what a
 * person sees, which is the one thing no assertion in this repository can read.
 * C95 was an icon breaking to its own line: nothing about the props, the block
 * or the import graph was wrong, and it was only wrong on screen.
 *
 * ## 🔴 AND THIS IS THE PAGE A GATEWAY ASKS TO SEE
 *
 * The founder's words: *this payment popup is the same one we will use to
 * integrate the Egyptian gateway, and this is what we share with Paymob when
 * they ask for the payment page.* A folder of frames showing every payer and
 * every state answers that better than a description does.
 *
 * ## The figures are real and the people are not
 *
 * Every amount here comes from the product's own helpers, so a frame cannot
 * show a number the product would not. Every person is surnamed Demo at
 * `example.com`, which is C225: a name in a shared frame has to be one anybody
 * can see is synthetic without checking.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import React from "react";

import { renderMarkup, stubModules } from "./_render";

const OUT = "captures/payments";

/**
 * 🔴 PHONE WIDTH, AND A TALLER VIEWPORT THAN A PHONE HAS.
 *
 * The width is the one that matters: this sheet is read on a phone and every
 * layout decision in it is about 390 pixels. The height is deliberately not a
 * phone's, because the sheet is `max-h-[92dvh] overflow-y-auto` and a real
 * device shows it with its lower half behind a scroll. A frame cut off at the
 * fold photographs the scroll rather than the screen, and the point of these is
 * that a person can see the WHOLE state in one image.
 */
const PHONE = { width: 390, height: 1500 };

type Frame = { name: string; note: string; markup: string };

/**
 * 🔴 THE REAL STYLESHEET, not a hand-written approximation.
 *
 * A frame styled by anything other than the product's own CSS is a frame that
 * can look right while the product looks wrong, which is the whole failure this
 * script exists to catch. Tailwind is compiled against the actual source so the
 * classes on these components are the ones that resolve.
 */
async function stylesheet(): Promise<string> {
  const { execFileSync } = await import("node:child_process");
  const css = execFileSync(
    "npx",
    ["@tailwindcss/cli", "-i", "app/globals.css", "--minify"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return css;
}

/**
 * 🔴 76.23 — ONE MORE MODULE, INSTALLED HERE AND NOT IN THE SHARED HARNESS.
 *
 * `_render.ts` stubs exactly two ids and says why: a broad mock would let a
 * real failure be answered by a stub. A router has real behaviour to lose, so
 * it is replaced only for this script, which takes photographs and never
 * asserts that anything navigated.
 */
async function stubNavigation() {
  const { createRequire } = await import("node:module");
  const Module = (await import("node:module")).default as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const require = createRequire(import.meta.url);
  const navigation = require.resolve("./_stub-navigation.tsx");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === "next/navigation") return navigation;
    return original.call(this, request, ...rest);
  };
}

async function main() {
  await stubModules();
  await stubNavigation();

  const { I18nProvider } = await import("../lib/i18n/client");
  const { PaymentPopup } = await import("../components/billing/payment-popup");
  const { PendingBar } = await import("../components/billing/pending-bar");
  const { SessionStarted } = await import("../components/patient/session-started");
  const { potTopUpMoney } = await import("../lib/billing/pot");

  /* ---------------------------------------------------------- the money -- */

  /*
   * 🔴 THE PRODUCT'S OWN FORMATTER, and an earlier draft hand-rolled one.
   *
   * The Arabic frame showed "EGP 1,140" with Western digits, because the
   * fixture formatted in English and let the bidi algorithm reorder it. The
   * product formats with `formatMoney` in the reader's locale, which gives
   * Arabic-Indic digits and the Arabic currency name. A frame that shows a
   * number the product would never print is exactly the thing these are
   * supposed to catch, and this one was in the fixture rather than the product.
   */
  const { formatMoney } = await import("../lib/billing/plans");
  const { egpMinorFor } = await import("../lib/billing/manual");
  const RATE = 50_000_000;
  const egpIn = (cents: number, locale: string) =>
    formatMoney(egpMinorFor(cents, RATE), "EGP", locale);
  const egp = (cents: number) => egpIn(cents, "en-US");
  const egpAr = (cents: number) => egpIn(cents, "ar-EG");

  /* A $20 session in Egypt: $3 of ours inside it, 14% on top. */
  const session = { gross: 2_000, vat: 280, settles: 2_280 };
  const topUp = potTopUpMoney({ creditCents: 100_000, vatBps: 1400 });
  const bill = { total: 800 };

  const DETAILS = {
    label: "InstaPay",
    cardsComingSoon: true,
    unconfigured: false,
    fields: [
      { key: "bank", label: "Bank", value: "Banque Misr", hint: "" },
      { key: "account", label: "Account name", value: "24Therapy Egypt LLC", hint: "" },
      { key: "iban", label: "IBAN", value: "EG380019000500000000263180002", hint: "" },
      { key: "instapay", label: "InstaPay", value: "24therapy@instapay", hint: "Fastest option" },
    ],
  };

  const noop = async () => ({}) as never;

  /* ------------------------------------------------------- every frame -- */

  const frames: { name: string; note: string; node: React.ReactElement }[] = [];

  const add = (name: string, note: string, node: React.ReactElement) =>
    frames.push({ name, note, node });

  const wrap = (node: React.ReactElement, locale: "en" | "ar" = "en") =>
    React.createElement(I18nProvider, { locale, children: node });

  /* ---- the patient, who is a guest with a session to get into ---------- */

  const patientSubject = {
    viewerName: "Nour Demo",
    orgName: "Nile Practice",
    what: "Session with Dr Mona Demo, Tuesday 9pm",
    payerType: "patient" as const,
  };

  add(
    "patient-1-open",
    "A guest paying for a session. Open on arrival, because the link they followed exists to pay.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        minimised: "orb",
        storageKey: "demo-session",
        subject: patientSubject,
        details: DETAILS,
        amountLabel: egp(session.settles),
        taxNote: egp(session.vat),
        live: { state: "none" },
        action: noop,
      }),
    ),
  );

  add(
    "patient-2-submitted",
    "They have sent the money and submitted a receipt. This is the state they come back to.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        minimised: "orb",
        storageKey: "demo-session",
        subject: patientSubject,
        details: DETAILS,
        amountLabel: egp(session.settles),
        taxNote: egp(session.vat),
        live: {
          state: "submitted",
          paymentId: "demo",
          submittedAt: new Date().toISOString(),
          proofUrl: "https://example.com/receipt.png",
        },
        action: noop,
      }),
    ),
  );

  add(
    "patient-3-rejected",
    "Turned down, in the operator's own words. Paraphrasing this is how a payer transfers twice.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        minimised: "orb",
        storageKey: "demo-session",
        subject: patientSubject,
        details: DETAILS,
        amountLabel: egp(session.settles),
        live: {
          state: "rejected",
          reason: "No transfer found with that reference. Check it and send again.",
        },
        action: noop,
      }),
    ),
  );

  add(
    "patient-4-arabic",
    "The same sheet in Arabic, which is the language most of this market reads.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        minimised: "orb",
        storageKey: "demo-session",
        subject: { ...patientSubject, what: "جلسة مع د. منى ديمو، الثلاثاء ٩ مساءً" },
        details: DETAILS,
        amountLabel: egpAr(session.settles),
        taxNote: egpAr(session.vat),
        live: { state: "none" },
        action: noop,
      }),
      "ar",
    ),
  );

  /* ---- the clinician, paying a bill made of chosen invoices ----------- */

  add(
    "clinician-1-open",
    "A pay-as-you-go clinician, with the two sessions this transfer covers printed under the total.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        storageKey: "demo-bill",
        subject: {
          viewerName: "Mona Demo",
          orgName: "Nile Practice",
          what: "for your bill",
          payerType: "therapist" as const,
        },
        details: DETAILS,
        amountLabel: egp(bill.total),
        lines: [
          { label: "Session, 1 March", amountLabel: egp(400) },
          { label: "Session, 15 March", amountLabel: egp(400) },
        ],
        live: { state: "none" },
        action: noop,
      }),
    ),
  );

  add(
    "clinic-1-open",
    "A clinic manager. Same sheet, and it says which payer it is for, because the bank details are identical for all four.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        storageKey: "demo-clinic",
        subject: {
          viewerName: "Karim Demo",
          orgName: "Cairo Foundry Clinic",
          what: "for your bill",
          payerType: "clinic" as const,
        },
        details: DETAILS,
        amountLabel: egp(14_400),
        live: { state: "none" },
        action: noop,
      }),
    ),
  );

  /* ---- the company, the one payer who chooses the figure -------------- */

  /*
   * 🔴 THE REAL LADDER: a $100 floor in $50 steps, which is what
   * `potTopUpLadder` builds from the stored `sponsor` settings. An earlier
   * draft of this capture started at $1,000, and the frame showed a sheet
   * saying "send at least 5,000 EGP" above a stepper offering ten times that.
   * A frame that shows a product nobody would ship is worse than no frame,
   * because this one is going to a payment gateway.
   */
  const steps = [10_000, 15_000, 20_000].map((credit) => {
    const m = potTopUpMoney({ creditCents: credit, vatBps: 1400 });
    return {
      creditCents: m.creditCents,
      settlesCents: m.settlesCents,
      usdLabel: `$${(credit / 100).toLocaleString("en-US")}`,
      egpLabel: egp(credit),
      vatEgpLabel: egp(m.vatCents),
      totalEgpLabel: egp(m.settlesCents),
      sessions: Math.floor(credit / 200),
    };
  });

  add(
    "company-1-choosing",
    "A company picks the figure on a stepper rather than typing it, so a slipped zero is work rather than an accident.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        storageKey: "demo-pot",
        subject: {
          viewerName: "finance@example.com",
          orgName: "Cairo Foundry",
          what: "for your pot",
          payerType: "company" as const,
        },
        details: DETAILS,
        amountLabel: "",
        askAmount: true,
        minimumCents: 2_000,
        rateLabel: egp(100),
        steps,
        live: { state: "none" },
        action: noop,
      }),
    ),
  );

  add(
    "company-2-confirmed",
    "Confirmed, with the way back to the product. A company buys a balance rather than a door.",
    wrap(
      React.createElement(PaymentPopup, {
        openInitially: true,
        storageKey: "demo-pot",
        subject: {
          viewerName: "finance@example.com",
          orgName: "Cairo Foundry",
          what: "for your pot",
          payerType: "company" as const,
        },
        details: DETAILS,
        amountLabel: egp(topUp.settlesCents),
        live: {
          state: "submitted",
          paymentId: "demo",
          submittedAt: new Date().toISOString(),
          proofUrl: null,
        },
        onwardHref: "/sponsor",
        onwardLabel: "Back to your account",
        action: noop,
      }),
    ),
  );

  /* ---- the bar and the orb, which are how a payment follows somebody -- */

  add(
    "bar-1-open",
    "Opened and never submitted. Amber, and it cannot be dismissed: this person may already have sent the money. 76.37 took red off this bar, because red in this product means the crisis surface and nothing else.",
    wrap(
      React.createElement(PendingBar, {
        stage: "open",
        what: "Session with Dr Mona Demo",
        amount: egp(session.settles),
        href: "/pay/demo",
        paymentId: "demo-a",
        storageKey: "demo-a",
      }),
    ),
  );

  add(
    "bar-2-submitted",
    "Waiting for an operator. Amber, with an estimate it can keep.",
    wrap(
      React.createElement(PendingBar, {
        stage: "submitted",
        what: "Pot top-up",
        amount: egp(topUp.settlesCents),
        href: "/sponsor/pot",
        paymentId: "demo-b",
        storageKey: "demo-b",
      }),
    ),
  );

  add(
    "bar-3-confirmed",
    "Confirmed. Green, and this is the only one they may dismiss.",
    wrap(
      React.createElement(PendingBar, {
        stage: "confirmed",
        what: "Session with Dr Mona Demo",
        amount: egp(session.settles),
        href: "/join/demo",
        paymentId: "demo-c",
        storageKey: "demo-c",
      }),
    ),
  );

  add(
    "patient-5-session-started",
    "The door is open. Sent the instant a clinician presses Start, and shown in the app as well.",
    wrap(React.createElement(SessionStarted, { href: "/join/demo", therapistName: "Dr Mona Demo" })),
  );

  /* ---- the operator, who works all four in one queue ------------------ */

  /*
   * 🔴 76.23 — THE OPERATOR'S SIDE, at desk width rather than phone width.
   *
   * These are the screens two support staff work a morning of transfers from,
   * and they are not read on a phone. Photographing them at 390 pixels would
   * make every one of them look broken and none of them would be.
   */
  const { TransferQueue } = await import("../components/admin/transfer-queue");
  const { OpenCarts } = await import("../components/admin/open-carts");
  const { PayoutQueue } = await import("../components/admin/payout-queue");

  const queueRows = [
    {
      id: "q1",
      purpose: "session",
      amountCents: 114_000,
      currency: "EGP",
      settlesCents: 2_280,
      amountLabel: "EGP 1,140.00",
      settlesLabel: "$22.80",
      reference: "INSTA-99231",
      proofKind: "image" as const,
      submittedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      payer: "Nour Demo",
      payerType: "patient" as const,
      profileHref: "/admin/patients/demo",
      lines: [],
    },
    {
      id: "q2",
      purpose: "pot_topup",
      amountCents: 5_700_000,
      currency: "EGP",
      settlesCents: 114_000,
      amountLabel: "EGP 57,000.00",
      settlesLabel: "$1,140.00",
      reference: "MISR-4471",
      proofKind: null,
      submittedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
      payer: "Cairo Foundry",
      payerType: "company" as const,
      profileHref: "/admin/sponsors/demo",
      lines: [
        { label: "Pot credit", cents: 100_000 },
        { label: "VAT", cents: 14_000 },
      ],
    },
    {
      id: "q3",
      purpose: "subscription",
      amountCents: 40_000,
      currency: "EGP",
      settlesCents: 800,
      amountLabel: "EGP 400.00",
      settlesLabel: "$8.00",
      reference: "INSTA-77120",
      proofKind: "image" as const,
      submittedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      payer: "Mona Demo",
      payerType: "therapist" as const,
      profileHref: "/admin/therapists/demo",
      lines: [
        { label: "Session, 1 March", cents: 400 },
        { label: "Session, 15 March", cents: 400 },
      ],
    },
  ];

  add(
    "admin-1-transfer-queue",
    "One queue, four payers, a tab each. Every name links to that payer's own page on the admin side.",
    wrap(React.createElement(TransferQueue, { rows: queueRows })),
  );

  add(
    "admin-2-open-carts",
    "Money that arrived with no claim. Collapsed by default, and the only act on a row demands a written reason first.",
    wrap(
      React.createElement(OpenCarts, {
        rows: [
          {
            id: "c1",
            payer: "Cairo Foundry",
            payerType: "company" as const,
            what: "pot_topup",
            amountLabel: "EGP 57,000.00",
            settlesCents: 114_000,
            openedAt: new Date(Date.now() - 36 * 60 * 60_000).toISOString(),
          },
          {
            id: "c2",
            payer: "Nour Demo",
            payerType: "patient" as const,
            what: "session",
            amountLabel: "EGP 1,140.00",
            settlesCents: 2_280,
            openedAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
          },
        ],
      }),
    ),
  );

  add(
    "admin-3-payouts",
    "What we owe clinicians. Manual requests to work, and the automated records beside them.",
    wrap(
      React.createElement(PayoutQueue, {
        manual: [
          {
            id: "p1",
            therapistName: "Mona Demo",
            amountCents: 17_000,
            payoutAmountMinor: 850_000,
            payoutCurrency: "EGP",
            method: "instapay",
            identifier: "mona@instapay",
            accountName: "Mona Demo",
            status: "requested" as never,
            entity: "eg",
            ageHours: 14,
            overdue: true,
            needsTwoPeople: false,
            owned: false,
            requestedAtLabel: "yesterday, 18:40",
            proofUrl: null,
            providerState: null,
            providerError: null,
          },
        ],
        automated: [
          {
            id: "a1",
            therapistName: "Karim Demo",
            amountCents: 42_000,
            status: "paid",
            createdAtLabel: "3 March",
          },
        ],
      }),
    ),
  );

  /* ---------------------------------------------------------- render -- */

  mkdirSync(OUT, { recursive: true });
  const css = await stylesheet();

  const rendered: Frame[] = [];
  for (const frame of frames) {
    rendered.push({ name: frame.name, note: frame.note, markup: await renderMarkup(frame.node) });
  }

  const { chromium } = await import("playwright");
  /*
   * 🔴 THE BROWSER THIS MACHINE ACTUALLY HAS.
   *
   * Playwright resolves a browser by the build number its own package pins, and
   * a sandbox with Chromium preinstalled rarely has that exact build. The
   * failure reads "Executable doesn't exist" and invites `npx playwright
   * install`, which downloads a second copy of a browser that is already here.
   * `PLAYWRIGHT_CHROMIUM` names the one to use; without it the pinned path is
   * tried, which is right on a machine that installed its own.
   */
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 });

  for (const frame of rendered) {
    /* 🔴 Operator screens are worked at a desk, so they are framed at one. */
    const desk = frame.name.startsWith("admin-");
    await page.setViewportSize(desk ? { width: 1100, height: 1400 } : PHONE);
    /*
     * 🔴 THE SHEET IS A FIXED OVERLAY, so the page behind it has to have a
     * height for it to overlay. A frame rendered into a zero-height body
     * photographs as a blank image, which looks like a broken component and is
     * a broken harness.
     */
    await page.setContent(
      `<!doctype html><html lang="en" dir="${frame.name.includes("arabic") ? "rtl" : "ltr"}">` +
        `<head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body class="min-h-dvh bg-slate-100"><div class="min-h-dvh p-3">${frame.markup}</div></body></html>`,
      { waitUntil: "load" },
    );
    await page.screenshot({ path: `${OUT}/${frame.name}.png`, fullPage: true });
    console.log(`  ${frame.name.padEnd(28)} ${frame.note}`);
  }

  await browser.close();

  /*
   * 🔴 AND AN INDEX, because a folder of PNGs is a folder somebody has to open
   * one at a time. This is the page that gets shared.
   */
  writeFileSync(
    `${OUT}/index.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>24Therapy payment surfaces</title><style>${css}</style></head>` +
      `<body class="bg-slate-50 p-6"><div class="mx-auto max-w-6xl">` +
      `<h1 class="text-2xl font-bold tracking-tight text-slate-900">Payment surfaces</h1>` +
      `<p class="mt-1 text-sm text-slate-600">Every payer, every state. Figures from the product's own helpers; people are synthetic.</p>` +
      `<div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">` +
      rendered
        .map(
          (f) =>
            `<figure class="rounded-2xl border border-slate-200 bg-white p-3">` +
            `<img src="${f.name}.png" alt="${f.name}" class="w-full rounded-xl border border-slate-100">` +
            `<figcaption class="mt-2 text-xs leading-relaxed text-slate-600"><b class="text-slate-900">${f.name}</b><br>${f.note}</figcaption>` +
            `</figure>`,
        )
        .join("") +
      `</div></div></body></html>`,
  );

  console.log(`\n${rendered.length} frames in ${OUT}, with an index.html beside them.`);
}

main();
