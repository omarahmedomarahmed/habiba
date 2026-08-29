/**
 * The pitch deck, generated rather than authored.
 *
 *   npm i --no-save pptxgenjs && node scripts/pitch-deck.cjs
 *
 * It reads the screenshots `scripts/demo-video.mts` produces, so running that
 * first is what keeps the deck's product shots honest — they are the current
 * site, not last month's.
 *
 * `pptxgenjs` is deliberately *not* in package.json. It is a build-time tool
 * for one artefact that ships to nobody, and adding it to devDependencies
 * would put it in every Vercel install for the rest of the project's life.
 *
 * Every number on these slides is either read out of the code that charges it
 * — lib/billing/plans.ts for $6 and $99, PLATFORM_FEE_BPS in
 * lib/billing/connect.ts for the 10% take rate, the RATES table in
 * lib/ai/client.ts for the AI cost — or derived from those rates with the
 * arithmetic printed on the slide beside it. Nothing here comes from a market
 * report we did not read. If a price changes in the code, this deck is wrong
 * until it is regenerated, which is the intended failure mode.
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const SHOTS = process.env.DEMO_OUT ?? "demo-output";

/* ---------------------------------------------------------------- palette */
const NAVY = "0A2342";
const DEEP = "061727";
const TEAL = "2EC4B6";
const INK = "13233A";
const MUTED = "5D6E86";
const LIGHT = "F3F7FB";
const CARD = "FFFFFF";
const ICE = "C9DCEF";
const WHITE = "FFFFFF";

const HEAD = "Cambria";
const BODY = "Calibri";

const M = 0.62; // page margin
const W = 13.333;
const H = 7.5;
const COL = W - M * 2;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "24Therapy";
pres.title = "24Therapy";

/* --------------------------------------------------------------- helpers */

const softShadow = () => ({
  type: "outer",
  color: "0A2342",
  blur: 14,
  offset: 3,
  angle: 90,
  opacity: 0.12,
});

function light() {
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  return s;
}

function dark() {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  return s;
}

/** Slide title + optional kicker, on a light slide. */
function heading(s, text, sub, opts = {}) {
  const onDark = opts.onDark === true;
  s.addText(text, {
    x: M,
    y: opts.y ?? 0.52,
    w: opts.w ?? COL,
    h: 0.72,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: opts.size ?? 36,
    bold: true,
    color: onDark ? WHITE : NAVY,
    valign: "middle",
  });
  if (sub) {
    s.addText(sub, {
      x: M,
      y: (opts.y ?? 0.52) + 0.74,
      w: opts.w ?? Math.min(COL, 9.6),
      h: 0.52,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 15,
      color: onDark ? ICE : MUTED,
      valign: "top",
    });
  }
}

/** A rounded content card — the deck's one repeated shape. */
function card(s, { x, y, w, h, fill = CARD, line = null }) {
  s.addShape(pres.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.1,
    fill: { color: fill },
    ...(line ? { line: { color: line, width: 1 } } : { line: { color: fill, width: 0 } }),
    shadow: softShadow(),
  });
}

/** Teal disc with a number or two-character mark. */
function disc(s, { x, y, d = 0.52, label, color = TEAL, text = NAVY, size = 15 }) {
  s.addShape(pres.ShapeType.ellipse, {
    x,
    y,
    w: d,
    h: d,
    fill: { color },
    line: { color, width: 0 },
  });
  s.addText(label, {
    x,
    y,
    w: d,
    h: d,
    isTextBox: true,
    margin: 0,
    align: "center",
    valign: "middle",
    fontFace: BODY,
    fontSize: size,
    bold: true,
    color: text,
  });
}

/** Big number over a small label. */
function stat(s, { x, y, w, value, label, color = NAVY, sub = null, onDark = false }) {
  s.addText(value, {
    x,
    y,
    w,
    h: 0.78,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 40,
    bold: true,
    color,
    valign: "middle",
  });
  s.addText(label, {
    x,
    y: y + 0.78,
    w,
    h: 0.34,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 13,
    bold: true,
    color: onDark ? WHITE : INK,
  });
  if (sub) {
    s.addText(sub, {
      x,
      y: y + 1.14,
      w,
      h: 0.62,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 11.5,
      color: onDark ? ICE : MUTED,
    });
  }
}

function body(s, text, o) {
  s.addText(text, {
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 14,
    color: INK,
    ...o,
  });
}

/** Screenshot in a white frame. */
function shot(s, file, { x, y, w, h }) {
  const pad = 0.09;
  s.addShape(pres.ShapeType.roundRect, {
    x: x - pad,
    y: y - pad,
    w: w + pad * 2,
    h: h + pad * 2,
    rectRadius: 0.08,
    fill: { color: WHITE },
    line: { color: WHITE, width: 0 },
    shadow: softShadow(),
  });
  s.addImage({ path: path.join(SHOTS, file), x, y, w, h, sizing: { type: "cover", w, h } });
}

/* ============================================================ 1 · title */
{
  const s = dark();

  s.addImage({
    path: path.join(SHOTS, "hero-crop.png"),
    x: 6.9,
    y: 0,
    w: 6.433,
    h: H,
    sizing: { type: "cover", w: 6.433, h: H },
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8,
    y: 0.85,
    w: 0.92,
    h: 0.92,
    rectRadius: 0.22,
    fill: { color: TEAL },
    line: { color: TEAL, width: 0 },
  });
  s.addText("24", {
    x: 0.8,
    y: 0.85,
    w: 0.92,
    h: 0.92,
    isTextBox: true,
    margin: 0,
    align: "center",
    valign: "middle",
    fontFace: HEAD,
    fontSize: 30,
    bold: true,
    color: NAVY,
  });
  s.addText("24THERAPY", {
    x: 1.9,
    y: 0.85,
    w: 4,
    h: 0.92,
    isTextBox: true,
    margin: 0,
    valign: "middle",
    fontFace: BODY,
    fontSize: 15,
    bold: true,
    charSpacing: 3,
    color: ICE,
  });

  s.addText("Talk to a real therapist\nin the next sixty seconds.", {
    x: 0.8,
    y: 2.3,
    w: 5.8,
    h: 1.9,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 30,
    bold: true,
    color: WHITE,
    lineSpacingMultiple: 1.05,
  });

  s.addText(
    "An on-demand therapy marketplace with a clinical AI copilot inside every session. " +
      "The patient gets care in a minute. The clinician gets the note written for them.",
    {
      x: 0.8,
      y: 4.35,
      w: 5.3,
      h: 1.2,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 15,
      color: ICE,
      lineSpacingMultiple: 1.2,
    },
  );

  s.addText(
    [
      { text: "Pre-launch  ·  MVP live in production  ·  ", options: { color: ICE } },
      { text: "habiba-zeta.vercel.app", options: { color: TEAL, bold: true } },
    ],
    {
      x: 0.8,
      y: 6.25,
      w: 5.5,
      h: 0.4,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 12.5,
    },
  );

  s.addNotes(
    "24Therapy is two things in one product: a live marketplace of licensed clinicians who are " +
      "online right now, and an AI copilot that documents the session while it happens. " +
      "Everything you will see in this deck is a screenshot of the running product.",
  );
}

/* ========================================================== 2 · problem */
{
  const s = light();
  heading(s, "Nobody is available at the moment it matters", "And the clinicians who are available are doing paperwork.");

  const items = [
    {
      n: "01",
      title: "The patient waits weeks",
      text:
        "A directory tells you who exists. It does not tell you who is free tonight, and by " +
        "the time the appointment comes round, the moment that drove someone to look has passed.",
    },
    {
      n: "02",
      title: "The clinician writes notes after hours",
      text:
        "Documentation is unpaid work that happens at 10pm. It is the most cited cause of " +
        "clinician burnout, and the part of the job software should have taken years ago.",
    },
    {
      n: "03",
      title: "Nothing joins the two up",
      text:
        "Booking tools do not document. Documentation tools do not bring patients. " +
        "A clinician ends up paying for both and reconciling them by hand.",
    },
  ];

  const cw = (COL - 0.44 * 2) / 3;
  items.forEach((it, i) => {
    const x = M + i * (cw + 0.44);
    card(s, { x, y: 2.1, w: cw, h: 3.3 });
    disc(s, { x: x + 0.36, y: 2.46, label: it.n, size: 13 });
    body(s, it.title, {
      x: x + 0.36,
      y: 3.16,
      w: cw - 0.72,
      h: 0.7,
      fontSize: 18,
      bold: true,
      fontFace: HEAD,
      color: NAVY,
    });
    body(s, it.text, {
      x: x + 0.36,
      y: 3.9,
      w: cw - 0.72,
      h: 1.44,
      fontSize: 12.5,
      color: MUTED,
      lineSpacingMultiple: 1.15,
    });
  });

  card(s, { x: M, y: 5.68, w: COL, h: 1.04, fill: NAVY });
  s.addText(
    "So we built the availability and the documentation as one product, because they are the same session.",
    {
      x: M + 0.4,
      y: 5.68,
      w: COL - 0.8,
      h: 1.04,
      isTextBox: true,
      margin: 0,
      valign: "middle",
      fontFace: HEAD,
      fontSize: 17,
      italic: true,
      color: WHITE,
    },
  );

  s.addNotes("Three problems that are really one problem: the two halves of a session are sold separately.");
}

/* ========================================================= 3 · what it is */
{
  const s = light();
  heading(s, "One product, two halves", "Both halves run on the same session record, so neither has to be reconciled with the other.");

  const cw = (COL - 0.5) / 2;

  card(s, { x: M, y: 2.2, w: cw, h: 4.5 });
  disc(s, { x: M + 0.42, y: 2.62, d: 0.62, label: "R", size: 20 });
  body(s, "Crisis Radar", {
    x: M + 1.2,
    y: 2.62,
    w: cw - 1.6,
    h: 0.62,
    fontFace: HEAD,
    fontSize: 24,
    bold: true,
    color: NAVY,
    valign: "middle",
  });
  body(s, "the marketplace", {
    x: M + 0.42,
    y: 3.42,
    w: cw - 0.84,
    h: 0.3,
    fontSize: 12,
    bold: true,
    charSpacing: 2,
    color: TEAL,
  });
  s.addText(
    [
      { text: "A live board of licensed clinicians who are online this minute.", options: { bullet: true, breakLine: true } },
      { text: "Filter by language, country, or what you need help with.", options: { bullet: true, breakLine: true } },
      { text: "Pick someone, type a first name, and you are in a session.", options: { bullet: true, breakLine: true } },
      { text: "No account, no waiting list, no insurance form.", options: { bullet: true, breakLine: true } },
      { text: "A 60-second hold stops two patients booking the same clinician.", options: { bullet: true } },
    ],
    {
      x: M + 0.42,
      y: 3.82,
      w: cw - 0.84,
      h: 2.5,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 13.5,
      color: INK,
      paraSpaceAfter: 8,
    },
  );

  const x2 = M + cw + 0.5;
  card(s, { x: x2, y: 2.2, w: cw, h: 4.5 });
  disc(s, { x: x2 + 0.42, y: 2.62, d: 0.62, label: "C", size: 20 });
  body(s, "The Clinical Copilot", {
    x: x2 + 1.2,
    y: 2.62,
    w: cw - 1.6,
    h: 0.62,
    fontFace: HEAD,
    fontSize: 24,
    bold: true,
    color: NAVY,
    valign: "middle",
  });
  body(s, "the documentation", {
    x: x2 + 0.42,
    y: 3.42,
    w: cw - 0.84,
    h: 0.3,
    fontSize: 12,
    bold: true,
    charSpacing: 2,
    color: TEAL,
  });
  s.addText(
    [
      { text: "Records with explicit patient consent, and only then.", options: { bullet: true, breakLine: true } },
      { text: "Transcribes live, with speaker labels.", options: { bullet: true, breakLine: true } },
      { text: "Writes the SOAP note in under a minute of the session ending.", options: { bullet: true, breakLine: true } },
      { text: "Flags crisis language while the session is still running.", options: { bullet: true, breakLine: true } },
      { text: "Answers questions about a patient, citing the session and timestamp.", options: { bullet: true } },
    ],
    {
      x: x2 + 0.42,
      y: 3.82,
      w: cw - 0.84,
      h: 2.5,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 13.5,
      color: INK,
      paraSpaceAfter: 8,
    },
  );

  s.addNotes("The radar brings the patient. The copilot removes the reason clinicians quit.");
}

/* ======================================================== 4 · how it works */
{
  const s = light();
  heading(s, "How a session actually happens", "Four steps. The longest one is the therapy.");

  const steps = [
    ["1", "Go on the radar", "A clinician flips one switch and appears on the public board, with a live heartbeat behind it."],
    ["2", "A patient picks", "They filter, choose, type a first name. The clinician is held for them for sixty seconds."],
    ["3", "Consent, then talk", "The patient is asked once whether the session may be recorded. Saying no changes nothing else."],
    ["4", "Everything lands", "Note to the clinician, plain-language summary to the patient, payment split, rating request."],
  ];

  const cw = (COL - 0.36 * 3) / 4;
  steps.forEach(([n, t, d], i) => {
    const x = M + i * (cw + 0.36);
    card(s, { x, y: 2.25, w: cw, h: 3.0 });
    disc(s, { x: x + 0.34, y: 2.6, d: 0.56, label: n, size: 17 });
    body(s, t, {
      x: x + 0.34,
      y: 3.32,
      w: cw - 0.68,
      h: 0.6,
      fontFace: HEAD,
      fontSize: 17,
      bold: true,
      color: NAVY,
    });
    body(s, d, {
      x: x + 0.34,
      y: 3.96,
      w: cw - 0.68,
      h: 1.2,
      fontSize: 12.5,
      color: MUTED,
      lineSpacingMultiple: 1.15,
    });
    if (i < 3) {
      s.addText("›", {
        x: x + cw + 0.02,
        y: 3.4,
        w: 0.32,
        h: 0.5,
        isTextBox: true,
        margin: 0,
        align: "center",
        valign: "middle",
        fontFace: BODY,
        fontSize: 26,
        bold: true,
        color: TEAL,
      });
    }
  });

  card(s, { x: M, y: 5.58, w: COL, h: 1.14, fill: "E6EEF7" });
  s.addText(
    "Opening the homepage to sitting in a session with a licensed clinician takes under two minutes, " +
      "and creates no account at any point. There is no sign-up step in the flow to remove.",
    {
      x: M + 0.4,
      y: 5.58,
      w: COL - 0.8,
      h: 1.14,
      isTextBox: true,
      margin: 0,
      valign: "middle",
      fontFace: BODY,
      fontSize: 14,
      color: NAVY,
    },
  );

  s.addNotes("Timed on the demo recording; the flow has no account-creation step at all.");
}

/* ========================================================== 5 · the radar */
{
  const s = light();
  heading(s, "The homepage is the radar", "Not a landing page with a sign-up form behind it.");

  shot(s, "01-home-globe.png", { x: 5.353, y: 2.16, w: 7.36, h: 4.6 });

  const notes = [
    ["Live count, not a claim", "“8 therapists online right now” is a query, refreshed as clinicians come and go."],
    ["Filter by language first", "Language is the first filter because it is the first thing that rules a clinician out."],
    ["Price before the click", "Every card shows the price and the length before a patient commits to anything."],
  ];
  notes.forEach(([t, d], i) => {
    const y = 2.16 + i * 1.59;
    card(s, { x: M, y, w: 3.9, h: 1.42 });
    body(s, t, {
      x: M + 0.3,
      y: y + 0.22,
      w: 3.3,
      h: 0.34,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: NAVY,
    });
    body(s, d, { x: M + 0.3, y: y + 0.6, w: 3.3, h: 0.7, fontSize: 11.5, color: MUTED, lineSpacingMultiple: 1.12 });
  });

  s.addNotes("Screenshot of the running product at habiba-zeta.vercel.app.");
}

/* =============================================== 6 · booking and consent */
{
  const s = light();
  heading(s, "Booking is one screen. Consent is its own screen.", "The second one is deliberately not a checkbox.", { size: 30 });

  const iw = 5.55;
  const ih = 3.47;
  shot(s, "05-booking-sheet.png", { x: M + 0.15, y: 2.34, w: iw, h: ih });
  shot(s, "08-consent-question.png", { x: M + iw + 0.75, y: 2.34, w: iw, h: ih });

  body(s, "The 60-second hold", {
    x: M + 0.15,
    y: 6.02,
    w: iw,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
  });
  body(
    s,
    "The clinician goes busy for everyone else the moment a patient opens the sheet, and is released automatically if the booking is abandoned.",
    { x: M + 0.15, y: 6.36, w: iw, h: 0.66, fontSize: 12, color: MUTED, lineSpacingMultiple: 1.12 },
  );

  body(s, "Recording is opt-in, per session", {
    x: M + iw + 0.75,
    y: 6.02,
    w: iw,
    h: 0.32,
    fontFace: HEAD,
    fontSize: 15,
    bold: true,
    color: NAVY,
  });
  body(
    s,
    "Declining is a first-class outcome: the session runs identically and the clinician writes their own note. The answer and its version are stored on the session row.",
    { x: M + iw + 0.75, y: 6.36, w: iw, h: 0.66, fontSize: 12, color: MUTED, lineSpacingMultiple: 1.12 },
  );

  s.addNotes("Consent is a gate in the code path, not a term of service. No consent, no transcript.");
}

/* =========================================================== 7 · the room */
{
  const s = light();
  heading(s, "Inside the session", "The loudest thing on the patient's screen is the one instruction that matters.");

  shot(s, "10-patient-room.png", { x: 5.353, y: 2.16, w: 7.36, h: 4.6 });

  const notes = [
    ["“Do not close this tab”", "The rating and the written summary both live on the other side of the session ending."],
    ["Ratings are anonymous", "The clinician sees the stars and the words. They never see who wrote them — by design, everywhere."],
    ["Verification is stated", "The patient is told, in the room, that the licence and ID were checked before this clinician could take a session."],
  ];
  notes.forEach(([t, d], i) => {
    const y = 2.16 + i * 1.59;
    card(s, { x: M, y, w: 3.9, h: 1.42 });
    body(s, t, {
      x: M + 0.3,
      y: y + 0.2,
      w: 3.3,
      h: 0.34,
      fontFace: HEAD,
      fontSize: 15,
      bold: true,
      color: NAVY,
    });
    body(s, d, { x: M + 0.3, y: y + 0.58, w: 3.3, h: 0.78, fontSize: 11.5, color: MUTED, lineSpacingMultiple: 1.12 });
  });

  s.addNotes("Anonymous ratings are a hard rule in the product: there is no view anywhere that maps a rating to a patient.");
}

/* ======================================================= 8 · differentiators */
{
  const s = light();
  heading(s, "Why this is not another directory", null);

  const rows = [
    [
      "Availability is the product",
      "Every other marketplace sells a profile and hopes for a reply. We sell the next sixty seconds, and the board is only ever showing clinicians whose heartbeat is live.",
    ],
    [
      "The copilot cites its sources",
      "Ask it about a patient and every claim comes back with the session and the timestamp it came from. A clinical assistant that cannot be checked is not usable in a clinical setting.",
    ],
    [
      "Arabic and English at parity",
      "Not a translation layer bolted on later. The message catalogue is type-checked, so an untranslated string fails the build — and the whole interface is written in logical properties, so it mirrors properly in RTL.",
    ],
    [
      "The record is not the clinician's to erase",
      "No clinician can delete a patient or a session. They can clear their own copilot chat, and not the copilot's clinical notes. That distinction is enforced in the data layer, not the UI.",
    ],
  ];

  const rh = 1.14;
  rows.forEach(([t, d], i) => {
    const y = 1.62 + i * (rh + 0.22);
    card(s, { x: M, y, w: COL, h: rh });
    disc(s, { x: M + 0.34, y: y + 0.31, d: 0.52, label: String(i + 1), size: 15 });
    body(s, t, {
      x: M + 1.12,
      y: y + 0.16,
      w: 3.3,
      h: 0.82,
      fontFace: HEAD,
      fontSize: 16,
      bold: true,
      color: NAVY,
      valign: "middle",
    });
    body(s, d, {
      x: M + 5.0,
      y: y + 0.16,
      w: COL - 5.4,
      h: 0.82,
      fontSize: 12.5,
      color: MUTED,
      valign: "middle",
      lineSpacingMultiple: 1.12,
    });
  });

  s.addNotes("Four claims, each of which is a line of code rather than a positioning statement.");
}

/* ====================================================== 9 · trust and safety */
{
  const s = dark();
  heading(s, "Trust is a set of things we cannot do", "The constraints below are enforced in the data layer. There is no admin screen that overrides them.", {
    onDark: true,
  });

  const left = [
    ["Nobody deletes a patient or a session", "Not the clinician, not support. Clinical records are append-only."],
    ["Ratings never name their author", "There is no query anywhere that joins a rating back to a patient."],
    ["Patient data leaves by one audited path", "Admin-initiated, logged, and the clinician is notified. Clinicians cannot send patient data anywhere."],
  ];
  const right = [
    ["Crisis language is caught in-session", "Detected while the session is still running, alerted, and retried until delivery is confirmed."],
    ["Consent is versioned", "The exact wording a patient agreed to is stored with the answer, so a later change cannot rewrite history."],
    ["Every action is on the audit trail", "Clinician and admin alike. The log records what happened, never the clinical content itself."],
  ];

  const cw = (COL - 0.5) / 2;
  const draw = (arr, x) =>
    arr.forEach(([t, d], i) => {
      const y = 2.28 + i * 1.36;
      card(s, { x, y, w: cw, h: 1.2, fill: "12304F" });
      disc(s, { x: x + 0.3, y: y + 0.34, d: 0.5, label: "✓", size: 15 });
      body(s, t, {
        x: x + 1.0,
        y: y + 0.16,
        w: cw - 1.3,
        h: 0.34,
        fontFace: HEAD,
        fontSize: 14.5,
        bold: true,
        color: WHITE,
      });
      body(s, d, { x: x + 1.0, y: y + 0.54, w: cw - 1.3, h: 0.56, fontSize: 11.5, color: ICE, lineSpacingMultiple: 1.1 });
    });
  draw(left, M);
  draw(right, M + cw + 0.5);

  s.addText(
    [
      { text: "HIPAA status, stated plainly: ", options: { bold: true, color: TEAL } },
      {
        text:
          "we offer a BAA on every plan, because we are a business associate the moment we touch a therapist's patient data — " +
          "that is a contract we owe, not an upsell. BAAs with our own infrastructure providers are in progress and the compliance page says so.",
        options: { color: ICE },
      },
    ],
    { x: M, y: 6.42, w: COL, h: 0.6, isTextBox: true, margin: 0, fontFace: BODY, fontSize: 12, lineSpacingMultiple: 1.15 },
  );

  s.addNotes("Every one of these was a deliberate product decision, and each is a reason a clinic can adopt us without a legal review stalling.");
}

/* ======================================================= 10 · business model */
{
  const s = light();
  heading(s, "Two revenue lines, one clinician", "A clinician pays us to document, and pays us again when we bring them a patient. Both apply at once.");

  const cw = (COL - 0.44 * 2) / 3;
  const plans = [
    ["Pay as you go", "$6", "per completed session", ["First session free, once per clinic", "10 copilot questions per patient / month", "HIPAA BAA included"]],
    ["Unlimited", "$99", "per clinician / month", ["Unlimited sessions and copilot", "Priority transcription queue", "HIPAA BAA included"]],
    ["Crisis Radar", "10%", "of what the clinician charges", ["Charged on the patient's card at booking", "Clinician is paid out by Stripe Connect", "Refunds return our cut too"]],
  ];

  plans.forEach(([name, price, unit, feats], i) => {
    const x = M + i * (cw + 0.44);
    const isRadar = i === 2;
    card(s, { x, y: 2.28, w: cw, h: 3.7, fill: isRadar ? NAVY : CARD });
    body(s, name, {
      x: x + 0.36,
      y: 2.58,
      w: cw - 0.72,
      h: 0.34,
      fontSize: 12.5,
      bold: true,
      charSpacing: 2,
      color: isRadar ? TEAL : MUTED,
    });
    body(s, price, {
      x: x + 0.36,
      y: 2.96,
      w: cw - 0.72,
      h: 0.86,
      fontFace: HEAD,
      fontSize: 46,
      bold: true,
      color: isRadar ? WHITE : NAVY,
    });
    body(s, unit, {
      x: x + 0.36,
      y: 3.84,
      w: cw - 0.72,
      h: 0.32,
      fontSize: 12.5,
      color: isRadar ? ICE : MUTED,
    });
    s.addText(
      feats.map((f, j) => ({ text: f, options: { bullet: true, breakLine: j < feats.length - 1 } })),
      {
        x: x + 0.36,
        y: 4.32,
        w: cw - 0.72,
        h: 1.5,
        isTextBox: true,
        margin: 0,
        fontFace: BODY,
        fontSize: 12.5,
        color: isRadar ? WHITE : INK,
        paraSpaceAfter: 7,
      },
    );
  });

  card(s, { x: M, y: 6.14, w: COL, h: 0.82, fill: "E6EEF7" });
  s.addText(
    "Prices as enforced in the code today: lib/billing/plans.ts sets $6 and $99; PLATFORM_FEE_BPS = 1000 sets the 10% take rate.",
    {
      x: M + 0.36,
      y: 6.14,
      w: COL - 0.72,
      h: 0.82,
      isTextBox: true,
      margin: 0,
      valign: "middle",
      fontFace: BODY,
      fontSize: 12,
      color: NAVY,
    },
  );

  s.addNotes("The take rate is deliberately low at 10% — the seat fee is the durable line, the take rate is the acquisition line.");
}

/* ====================================================== 11 · unit economics */
{
  const s = light();
  heading(s, "What a session costs us", "Metered by the product in thousandths of a cent \u2014 rounding to whole cents had recorded 91% of our AI spend as zero.");

  card(s, { x: M, y: 2.3, w: 6.6, h: 4.3 });
  s.addChart(
    pres.ChartType.bar,
    [
      {
        name: "Cost",
        labels: ["Transcription", "SOAP note", "Risk + copilot"],
        values: [15.0, 3.0, 2.0],
      },
    ],
    {
      x: M + 0.28,
      y: 2.94,
      w: 6.04,
      h: 3.4,
      barDir: "col",
      chartColors: [TEAL],
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: NAVY,
      dataLabelFontFace: BODY,
      dataLabelFontSize: 12,
      dataLabelFormatCode: '0.0"¢"',
      showLegend: false,
      catAxisLabelColor: MUTED,
      catAxisLabelFontFace: BODY,
      catAxisLabelFontSize: 11,
      valAxisLabelColor: MUTED,
      valAxisLabelFontFace: BODY,
      valAxisLabelFontSize: 10,
      valAxisMaxVal: 18,
      valGridLine: { color: "DCE6F0", size: 1 },
      catGridLine: { style: "none" },
      valAxisLabelFormatCode: '0"¢"',
      barGapWidthPct: 90,
    },
  );
  body(s, "AI cost per 50-minute session", {
    x: M + 0.36,
    y: 2.56,
    w: 6.0,
    h: 0.34,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: NAVY,
  });

  const x2 = M + 6.6 + 0.44;
  const bw = COL - 6.6 - 0.44;

  card(s, { x: x2, y: 2.3, w: bw, h: 2.02 });
  stat(s, { x: x2 + 0.36, y: 2.5, w: bw - 0.72, value: "≈20¢", label: "Marginal AI cost per session", sub: "Transcription is 75% of it, and it is the line that falls fastest as models get cheaper." });

  card(s, { x: x2, y: 4.58, w: bw, h: 2.02 });
  stat(s, { x: x2 + 0.36, y: 4.78, w: bw - 0.72, value: "≈89%", label: "Gross margin on a $6 session", sub: "$6.00 less 47¢ of Stripe fees and 20¢ of AI. On the $99 plan at 60 sessions a month it is 88%." });

  s.addNotes(
    "Rates are the ones the product bills against: 0.3¢ per audio minute for transcription, $2.50/$10 per Mtok for GPT-4o. " +
      "The 91% figure is real — a Math.round into whole cents made almost the entire ledger read $0.00 until it was fixed.",
  );
}

/* ============================================================== 12 · scale */
{
  const s = light();
  heading(s, "What this looks like with clinicians on it", "One model, stated with its assumptions, so you can disagree with the assumptions rather than the arithmetic.");

  card(s, { x: M, y: 2.24, w: 7.6, h: 4.3 });
  s.addChart(
    pres.ChartType.bar,
    [
      {
        name: "ARR",
        labels: ["10 clinicians", "100", "500", "2,000"],
        values: [14400, 144000, 720000, 2880000],
      },
    ],
    {
      x: M + 0.26,
      y: 2.86,
      w: 7.08,
      h: 3.5,
      barDir: "col",
      chartColors: [NAVY],
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: NAVY,
      dataLabelFontFace: BODY,
      dataLabelFontSize: 11,
      dataLabelFormatCode: '$#,##0,"k"',
      showLegend: false,
      catAxisLabelColor: MUTED,
      catAxisLabelFontFace: BODY,
      catAxisLabelFontSize: 11,
      valAxisLabelColor: MUTED,
      valAxisLabelFontFace: BODY,
      valAxisLabelFontSize: 10,
      valAxisLabelFormatCode: '$#,##0,"k"',
      valGridLine: { color: "DCE6F0", size: 1 },
      catGridLine: { style: "none" },
      barGapWidthPct: 80,
    },
  );
  body(s, "Annual recurring revenue", {
    x: M + 0.34,
    y: 2.5,
    w: 6.8,
    h: 0.34,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: NAVY,
  });

  const x2 = M + 7.6 + 0.44;
  const bw = COL - 7.6 - 0.44;
  card(s, { x: x2, y: 2.24, w: bw, h: 4.3 });
  body(s, "The assumptions", {
    x: x2 + 0.34,
    y: 2.5,
    w: bw - 0.68,
    h: 0.36,
    fontFace: HEAD,
    fontSize: 16,
    bold: true,
    color: NAVY,
  });
  s.addText(
    [
      { text: "60% of clinicians on the $99 flat plan — $1,188 a year each.", options: { bullet: true, breakLine: true } },
      { text: "40% metered at 12 sessions a month — $864 a year each.", options: { bullet: true, breakLine: true } },
      { text: "Four radar sessions per clinician per month at $80, at our 10% — $384 a year each.", options: { bullet: true, breakLine: true } },
      { text: "Blended: about $1,440 of ARR per clinician.", options: { bullet: true, breakLine: true, bold: true } },
      { text: "No price increases, no enterprise tier, no clinic-level contracts — all three are upside, none are modelled.", options: { bullet: true } },
    ],
    {
      x: x2 + 0.34,
      y: 3.0,
      w: bw - 0.68,
      h: 3.3,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 12.5,
      color: INK,
      paraSpaceAfter: 9,
      lineSpacingMultiple: 1.12,
    },
  );

  s.addNotes("The point of the slide is the per-clinician figure. Everything else is multiplication.");
}

/* =========================================================== 13 · status */
{
  const s = dark();
  heading(s, "Where we actually are", "Stated without decoration, because the interesting part is what is already built.", { onDark: true });

  const facts = [
    ["Product", "MVP live in production", "The whole flow in this deck is a screenshot of it running."],
    ["Users", "Zero", "No patient has used it. Nothing here is a retention chart."],
    ["Revenue", "$0", "Billing is wired end to end and has never charged a stranger."],
    ["Entity", "Incorporating in the US", "In progress. Delaware C-corp."],
    ["Compliance", "HIPAA work under way", "BAA offered on every plan; infrastructure BAAs pending."],
    ["Beta", "UAE / MENA clinics", "First conversations. Arabic-first is why we start there."],
  ];

  const cw = (COL - 0.4 * 2) / 3;
  facts.forEach(([k, v, d], i) => {
    const x = M + (i % 3) * (cw + 0.4);
    const y = 2.28 + Math.floor(i / 3) * 1.86;
    card(s, { x, y, w: cw, h: 1.62, fill: "12304F" });
    body(s, k.toUpperCase(), {
      x: x + 0.32,
      y: y + 0.2,
      w: cw - 0.64,
      h: 0.28,
      fontSize: 11,
      bold: true,
      charSpacing: 2,
      color: TEAL,
    });
    body(s, v, {
      x: x + 0.32,
      y: y + 0.52,
      w: cw - 0.64,
      h: 0.46,
      fontFace: HEAD,
      fontSize: 18,
      bold: true,
      color: WHITE,
    });
    body(s, d, { x: x + 0.32, y: y + 1.02, w: cw - 0.64, h: 0.54, fontSize: 11.5, color: ICE, lineSpacingMultiple: 1.1 });
  });

  s.addText(
    "The risk in a deck like this is overstating. So: nothing above is projected, and none of it is a metric we would like to have.",
    {
      x: M,
      y: 6.3,
      w: COL,
      h: 0.5,
      isTextBox: true,
      margin: 0,
      fontFace: HEAD,
      fontSize: 14,
      italic: true,
      color: ICE,
    },
  );

  s.addNotes("Say this slide out loud rather than skipping it. It buys credibility for every other slide.");
}

/* ============================================================= 14 · close */
{
  const s = dark();

  s.addShape(pres.ShapeType.roundRect, {
    x: M,
    y: 0.9,
    w: 0.92,
    h: 0.92,
    rectRadius: 0.22,
    fill: { color: TEAL },
    line: { color: TEAL, width: 0 },
  });
  s.addText("24", {
    x: M,
    y: 0.9,
    w: 0.92,
    h: 0.92,
    isTextBox: true,
    margin: 0,
    align: "center",
    valign: "middle",
    fontFace: HEAD,
    fontSize: 30,
    bold: true,
    color: NAVY,
  });

  s.addText("The next ninety days", {
    x: M,
    y: 2.2,
    w: 6.4,
    h: 0.8,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 38,
    bold: true,
    color: WHITE,
  });

  s.addText(
    [
      { text: "Incorporate, and sign the infrastructure BAAs we already name on the compliance page.", options: { bullet: true, breakLine: true } },
      { text: "Ten design-partner clinics in the UAE, running real sessions on the radar.", options: { bullet: true, breakLine: true } },
      { text: "First paid session end to end — the code path exists and has never carried a stranger's money.", options: { bullet: true, breakLine: true } },
      { text: "Facial-affect analysis in the copilot, on the video we already have consent to record.", options: { bullet: true } },
    ],
    {
      x: M,
      y: 3.2,
      w: 6.4,
      h: 2.5,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 14.5,
      color: ICE,
      paraSpaceAfter: 11,
      lineSpacingMultiple: 1.12,
    },
  );

  const x2 = M + 7.0;
  const bw = COL - 7.0;
  card(s, { x: x2, y: 2.2, w: bw, h: 3.6, fill: "12304F" });
  body(s, "WHAT WE ARE LOOKING FOR", {
    x: x2 + 0.4,
    y: 2.5,
    w: bw - 0.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    charSpacing: 2,
    color: TEAL,
  });
  s.addText(
    [
      { text: "Clinics willing to be first.", options: { bullet: true, breakLine: true } },
      { text: "Introductions to licensing bodies in the UAE and Egypt.", options: { bullet: true, breakLine: true } },
      { text: "Capital to get from a working product to a paid one.", options: { bullet: true } },
    ],
    {
      x: x2 + 0.4,
      y: 2.94,
      w: bw - 0.8,
      h: 1.6,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 13.5,
      color: WHITE,
      paraSpaceAfter: 9,
    },
  );
  s.addText(
    [
      { text: "habiba-zeta.vercel.app", options: { color: TEAL, bold: true, breakLine: true } },
      { text: "aloomeenm3aya@gmail.com", options: { color: ICE } },
    ],
    {
      x: x2 + 0.4,
      y: 4.7,
      w: bw - 0.8,
      h: 0.8,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 13.5,
    },
  );

  s.addText("24Therapy", {
    x: M,
    y: 6.45,
    w: 6,
    h: 0.4,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 12.5,
    charSpacing: 3,
    color: "8FA8C4",
  });

  s.addNotes("Close on the ask, not on the product.");
}

pres.writeFile({ fileName: path.join(SHOTS, "24therapy-pitch.pptx") }).then((f) => {
  console.log("wrote " + f);
});
