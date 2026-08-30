/**
 * Drive the whole product, both sides, and photograph every screen.
 *
 *   npx tsx scripts/demo-speech.mts       # once — synthesises the session audio
 *   npx tsx scripts/demo-full.mts
 *
 * `demo-video.mts` films the patient's ninety seconds. This films everything
 * else: a clinician signing up, uploading a licence, being approved by an
 * administrator, going on the radar, being rung by a patient, running a
 * recorded session, having the note written, signing it, the patient rating
 * the session and pulling their own summary by email, the copilot answering
 * questions about that patient afterwards, and the money.
 *
 * ## Three people, one browser
 *
 * Clinician, administrator and patient run in three separate contexts, which
 * is the only way to hold three sessions at once — and the only way to film
 * the moment that makes the radar work, where the patient's booking rings on
 * the clinician's screen while they are looking at something else.
 *
 * ## The audio is real
 *
 * Chromium is pointed at `demo-output/session-audio.wav` as its microphone, so
 * the transcript is transcribed, the note is written from that transcript, and
 * the copilot answers from that note. None of the clinical text in the film is
 * a fixture. The camera feed is Chromium's synthetic test pattern, because
 * there is nobody in front of a camera — that part, and only that part, is not
 * real.
 *
 * ## What this writes
 *
 * Real rows, in whatever database DEMO_BASE is pointed at, including a
 * clinician who appears on the public radar. The run takes them offline and
 * prints every id it created so the account can be found and removed. Read
 * `--dry-run` output first if you are pointing this at anything you care
 * about.
 */
import { existsSync, mkdirSync, rmSync, globSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const BASE = process.env.DEMO_BASE ?? "http://localhost:3100";
const OUT = process.env.DEMO_OUT ?? "demo-output";
const SHOTS = join(OUT, "full");
const AUDIO = resolve(join(OUT, "session-audio.wav"));
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = Number(process.env.DEMO_SCALE ?? 2);

/** How long to let the microphone run before ending the session. */
const SESSION_SECONDS = Number(process.env.DEMO_SESSION_SECONDS ?? 150);

const stamp = Date.now().toString(36);
const THERAPIST = {
  firstName: "Nadia",
  lastName: "Haddad",
  email: `demo.nadia.${stamp}@24therapy.test`,
  password: "demo-account-2026",
};
/** Where the patient's summary is emailed. Their own inbox, nobody else's. */
const PATIENT_EMAIL = process.env.DEMO_PATIENT_EMAIL ?? "aloomeenm3aya@gmail.com";
const PATIENT_NAME = "Sam";

const created: Record<string, string> = {};
let shot = 0;
const failures: string[] = [];

/* ------------------------------------------------------------- utilities */

async function step(page: Page, label: string, hold = 900) {
  await page.waitForTimeout(hold);
  shot += 1;
  const name = `${String(shot).padStart(2, "0")}-${label}`;
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`    · ${name}`);
}

/** Run an act; a failure is recorded and the rest of the film still gets made. */
async function act(name: string, fn: () => Promise<void>) {
  console.log(`\n▸ ${name}`);
  try {
    await fn();
  } catch (error) {
    const message = (error as Error).message.split("\n")[0];
    failures.push(`${name}: ${message}`);
    console.log(`  ! ${message}`);
  }
}

/**
 * A placeholder credential image, drawn in the browser.
 *
 * Marked SPECIMEN across the front on purpose. This gets uploaded to a
 * verification queue and looked at by a human; a plausible-looking licence
 * with a real regulator's name on it is not a thing to leave lying in a
 * database.
 */
async function makeDocument(page: Page, title: string, lines: string[]): Promise<string> {
  const data = await page.evaluate(
    ({ title, lines }) => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 700;
      const x = c.getContext("2d")!;
      x.fillStyle = "#EEF3F8";
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#FFFFFF";
      x.fillRect(40, 40, c.width - 80, c.height - 80);
      x.strokeStyle = "#0A2342";
      x.lineWidth = 3;
      x.strokeRect(40, 40, c.width - 80, c.height - 80);
      x.fillStyle = "#0A2342";
      x.font = "700 42px Arial, sans-serif";
      x.fillText(title, 88, 140);
      x.font = "400 26px Arial, sans-serif";
      x.fillStyle = "#33475F";
      lines.forEach((l, i) => x.fillText(l, 88, 220 + i * 46));
      x.save();
      x.translate(c.width / 2, c.height / 2);
      x.rotate(-Math.PI / 9);
      x.font = "800 120px Arial, sans-serif";
      x.fillStyle = "rgba(46,196,182,0.28)";
      x.textAlign = "center";
      x.fillText("SPECIMEN", 0, 40);
      x.restore();
      return c.toDataURL("image/png");
    },
    { title, lines },
  );
  const file = join(SHOTS, `.doc-${title.toLowerCase().replace(/\W+/g, "-")}.png`);
  writeFileSync(file, Buffer.from(data.split(",")[1]!, "base64"));
  return file;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

/* ------------------------------------------------------------------ main */

async function main() {
  if (!existsSync(AUDIO)) {
    console.error(`Missing ${AUDIO}. Run: npx tsx scripts/demo-speech.mts`);
    process.exit(1);
  }
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const executablePath = globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome").sort().at(-1);
  const browser: Browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      // The line that makes the clinical half of this film real rather than
      // illustrated: the browser's microphone is a recording of a conversation.
      `--use-file-for-fake-audio-capture=${AUDIO}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const make = async (): Promise<[BrowserContext, Page]> => {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      permissions: ["camera", "microphone"],
    });
    return [context, await context.newPage()];
  };

  const [clinicCtx, clinician] = await make();
  const [adminCtx, admin] = await make();
  const [patientCtx, patient] = await make();

  for (const [who, page] of [["clinician", clinician], ["admin", admin], ["patient", patient]] as const) {
    page.on("pageerror", (e) => console.log(`    (${who} page error: ${e.message.split("\n")[0]})`));
  }

  /* ============================================ ACT 1 — the clinician signs up */
  await act("A clinician signs up", async () => {
    await clinician.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    await step(clinician, "signup-empty", 1200);
    await clinician.getByLabel("First name").fill(THERAPIST.firstName);
    await clinician.getByLabel("Last name").fill(THERAPIST.lastName);
    await clinician.getByLabel("Work email").fill(THERAPIST.email);
    await clinician.getByLabel("Password").fill(THERAPIST.password);
    await step(clinician, "signup-filled", 700);
    await clinician.getByRole("button", { name: /create account/i }).click();
    await clinician.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30_000 });
    created.therapistEmail = THERAPIST.email;
    await step(clinician, "onboarding-arrived", 2200);
  });

  /* ================================== ACT 2 — credentials, and the upload */
  await act("Uploading credentials for verification", async () => {
    await clinician.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded" });
    await step(clinician, "verify-form", 1500);

    // The country select carries ISO codes, not the labels it renders.
    await clinician.locator('select[name="country"]').selectOption("AE");
    await clinician.waitForTimeout(1200);
    await step(clinician, "verify-country", 500);

    await clinician.locator("#licenseBody").fill("Dubai Health Authority");
    await clinician.locator("#licenseNumber").fill("DHA-P-0198472");
    await clinician.locator("#licenseExpiry").fill("2028-04");
    await step(clinician, "verify-licence", 700);

    /*
     * Click the label, not the input.
     *
     * These are chips: a visually hidden checkbox inside a styled label. The
     * input has no size, so `.check()` waits for it to become actionable and
     * never gets there — and with the failure swallowed, the form saved
     * without a language or a specialty and the submit button stayed disabled
     * for reasons the script could not see.
     */
    const pick = async (group: string, value: string) => {
      const input = clinician.locator(`input[name="${group}"][value="${value}"]`).first();
      if ((await input.count()) === 0) throw new Error(`no ${group} option "${value}"`);
      await input.locator("xpath=ancestor::label[1]").click();
      await clinician.waitForTimeout(180);
      if (!(await input.isChecked())) throw new Error(`could not select ${group} "${value}"`);
    };
    for (const value of ["Arabic", "English"]) await pick("languages", value);
    for (const value of ["Anxiety", "Work stress & burnout"]) await pick("specialties", value);
    await step(clinician, "verify-scope", 700);

    /*
     * Save before submitting. These are two different actions and the second
     * one stays disabled until the first has run — the checklist under it is
     * reading the saved row, not the form. Filling the fields and going
     * straight for "Submit for verification" clicks a disabled button until it
     * times out, which is exactly what the first run of this script did.
     */
    await clinician.getByRole("button", { name: /save details/i }).click();
    await clinician.waitForTimeout(2500);
    await step(clinician, "verify-saved", 900);

    const docs: [string, string, string[]][] = [
      ["idFront", "IDENTITY CARD", ["Nadia Haddad", "Issued 2021 · Expires 2031", "Demonstration document"]],
      ["idBack", "IDENTITY CARD — REVERSE", ["Nadia Haddad", "Demonstration document"]],
      ["licenseDoc", "PRACTISING CERTIFICATE", ["Nadia Haddad", "Clinical Psychologist", "Licence DHA-P-0198472", "Demonstration document"]],
      ["headshot", "PHOTOGRAPH", ["Nadia Haddad"]],
    ];
    for (const [slot, title, lines] of docs) {
      const file = await makeDocument(clinician, title, lines);
      const input = clinician.locator(`input[type="file"]`).nth(docs.findIndex((d) => d[0] === slot));
      if (await input.count()) {
        await input.setInputFiles(file);
        await clinician.waitForTimeout(1600);
      }
    }
    await step(clinician, "verify-uploaded", 1600);

    const submit = clinician.getByRole("button", { name: /submit for verification/i });
    await submit.scrollIntoViewIfNeeded();
    await step(clinician, "verify-ready", 700);
    await submit.click({ timeout: 15_000 });
    await clinician.waitForTimeout(3000);
    await step(clinician, "verify-submitted", 1500);
  });

  /* ============================== ACT 3 — an administrator looks at it */
  await act("An administrator reviews the documents", async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set");
    await signIn(admin, email, password);
    await step(admin, "admin-dashboard", 1800);

    await admin.goto(`${BASE}/admin/verifications`, { waitUntil: "domcontentloaded" });
    await step(admin, "admin-queue", 2000);

    const row = admin.getByText(`${THERAPIST.firstName} ${THERAPIST.lastName}`).first();
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded();
      await row.click().catch(() => {});
      await admin.waitForTimeout(1500);
    }
    await step(admin, "admin-documents", 1800);

    const approve = admin.getByRole("button", { name: /^Approve$/ }).first();
    if (await approve.count()) {
      await approve.click();
      await admin.waitForTimeout(2500);
    }
    await step(admin, "admin-approved", 1500);
  });

  /* ================================ ACT 4 — practice details and the radar */
  await act("Setting up the practice and going on the radar", async () => {
    await clinician.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded" });
    await step(clinician, "verified", 2000);

    await clinician.goto(`${BASE}/on-call`, { waitUntil: "domcontentloaded" });
    await clinician.waitForTimeout(2000);

    /*
     * The alarm prompt is the first thing on this page, not a consequence of
     * going online — and it covers everything behind it, which is why the
     * first attempt at this act timed out clicking a button it could see.
     *
     * It is also a scene worth having: a browser will not make a sound until
     * somebody taps something, so this modal is the reason a clinician can be
     * rung at all.
     */
    const alarm = clinician.getByRole("button", { name: /^Turn the alarm on$/ }).first();
    if (await alarm.count()) {
      await step(clinician, "alarm-permission", 1200);
      await alarm.click({ timeout: 15_000 }).catch(() => {});
      await clinician.waitForTimeout(2500);
    }
    // Whatever happened above, nothing may be left covering the console.
    const later = clinician.getByRole("button", { name: /^Later$/ }).filter({ visible: true }).first();
    if (await later.count()) await later.click().catch(() => {});
    await step(clinician, "oncall-before", 1800);

    const practice = clinician.locator('[name="practiceName"]').first();
    if (await practice.count()) {
      await practice.fill("Haddad Psychology, Dubai");
      await clinician.waitForTimeout(400);
      const save = clinician.getByRole("button", { name: /save practice/i }).first();
      if (await save.count()) {
        await save.click();
        await clinician.waitForTimeout(2000);
      }
      await step(clinician, "practice-saved", 1200);
    }

    const go = clinician.getByRole("button", { name: /^Go on the radar$/ }).first();
    await go.scrollIntoViewIfNeeded();
    await step(clinician, "oncall-ready", 800);
    await go.click();
    await clinician.waitForTimeout(1800);

    /*
     * It asks twice, and the second time is the one that matters.
     *
     * "Turn on your alarm" on arrival is housekeeping. This one — "Can we ring
     * you? You are about to be visible to people in crisis" — is the actual
     * confirmation, and going live is on the far side of it. Missing it is why
     * an earlier run pressed every button correctly and still put nobody on
     * the board.
     */
    const confirm = clinician
      .getByRole("button", { name: /turn the alarm on and go live/i })
      .first();
    if (await confirm.count()) {
      await step(clinician, "going-live-confirm", 1400);
      await confirm.click();
      await clinician.waitForTimeout(3500);
    }
    await step(clinician, "online", 2200);

    // Confirm it from the outside: the public board is the only thing that
    // proves a clinician is actually reachable.
    const onBoard = await clinician.evaluate(async (last: string) => {
      const r = await fetch("/api/radar");
      const d = await r.json();
      return (d.therapists ?? []).some((t: { lastName?: string }) => t.lastName === last);
    }, THERAPIST.lastName);
    if (!onBoard) throw new Error("went through the motions but the clinician is not on the board");
    console.log("    · confirmed on the public board");
  });

  /* =================================== ACT 5 — a patient books, and it rings */
  let joinUrl: string | null = null;
  await act("A patient books, and the radar rings", async () => {
    /*
     * Put the clinician somewhere else first.
     *
     * The point of the alarm is that it reaches them anywhere in the portal,
     * so filming it on the page that has the "go online" switch undersells it
     * — and an earlier run caught the on-call console scrolled halfway down
     * its own settings rather than the banner that had just appeared.
     */
    await clinician.goto(`${BASE}/patients`, { waitUntil: "domcontentloaded" });
    await clinician.waitForTimeout(1500);
    await step(clinician, "clinician-elsewhere", 900);

    await patient.goto(`${BASE}/radar`, { waitUntil: "domcontentloaded" });
    await patient.waitForTimeout(3500);
    await step(patient, "patient-board", 1200);

    const card = patient.getByRole("button", { name: new RegExp(THERAPIST.lastName) }).first();
    if (!(await card.count())) throw new Error("the new clinician is not on the public board");
    await card.click();
    await step(patient, "patient-sheet", 2200);

    await patient.locator("#radar-name").fill(PATIENT_NAME);
    await step(patient, "patient-name", 900);
    await patient.getByRole("button", { name: /start now/i }).first().click();
    await patient.waitForURL(/\/join\//, { timeout: 40_000 });
    joinUrl = patient.url();
    created.joinUrl = joinUrl;
    await step(patient, "patient-joined", 2200);

    // Meanwhile, on the other screen.
    await clinician.bringToFront();
    await clinician.evaluate(() => window.scrollTo(0, 0));
    await clinician.waitForTimeout(3500);
    await step(clinician, "radar-ringing", 1500);
  });

  /* ============================================= ACT 6 — the session itself */
  await act("The session", async () => {
    const consent = patient.getByText("Yes, you may record").first();
    if (await consent.count()) {
      await step(patient, "consent-asked", 1600);
      await consent.click();
      await patient.waitForTimeout(600);
      const go = patient.getByRole("button", { name: /go in|join session/i }).first();
      if (await go.count()) await go.click();
      await patient.waitForTimeout(3000);
      await step(patient, "patient-room", 1800);
    }

    const answer = clinician
      .getByRole("link", { name: /join|answer|open the room|go to the session/i })
      .first();
    if (await answer.count()) {
      await answer.click();
    } else {
      await clinician.goto(`${BASE}/sessions`, { waitUntil: "domcontentloaded" });
      await clinician.waitForTimeout(1200);
      const open = clinician.getByRole("link", { name: new RegExp(PATIENT_NAME, "i") }).first();
      if (await open.count()) await open.click();
    }
    await clinician.waitForURL(/\/room/, { timeout: 40_000 }).catch(() => {});
    created.roomUrl = clinician.url();
    await clinician.waitForTimeout(3500);
    await step(clinician, "room-before-start", 1500);

    const start = clinician.getByRole("button", { name: /start session/i }).first();
    if (!(await start.count())) throw new Error("no Start session button in the room");
    await start.click();
    await clinician.waitForTimeout(6000);
    await step(clinician, "room-recording", 1500);

    // Let the microphone run. The transcript arrives in chunks, the copilot's
    // in-session notes follow it, and both need real seconds to happen.
    const until = Date.now() + SESSION_SECONDS * 1000;
    let n = 0;
    while (Date.now() < until) {
      await clinician.waitForTimeout(22_000);
      n += 1;
      await clinician.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await step(clinician, `room-transcript-${n}`, 900);
    }
    await clinician.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await step(clinician, "room-full-transcript", 1400);
    await clinician.evaluate(() => window.scrollTo(0, 0));
    await step(clinician, "room-top", 900);

    await clinician.getByRole("button", { name: /end session/i }).first().click();
    await clinician.waitForTimeout(4000);
    await step(clinician, "session-ended", 2000);
  });

  /* ================================================= ACT 7 — the note */
  await act("The note writes itself", async () => {
    await clinician.waitForURL(/\/sessions\//, { timeout: 40_000 }).catch(() => {});
    created.sessionUrl = clinician.url();
    await step(clinician, "note-writing", 2500);

    // Generation is a background job; poll the page until the note lands.
    for (let i = 0; i < 20; i++) {
      const written = await clinician.getByText(/subjective|assessment|plan/i).count();
      if (written > 0) break;
      await clinician.waitForTimeout(6000);
      await clinician.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    }
    await step(clinician, "note-soap", 2500);
    await clinician.mouse.wheel(0, 500);
    await step(clinician, "note-soap-detail", 1600);

    const patientTab = clinician.getByRole("button", { name: /patient|their summary|plain/i }).first();
    if (await patientTab.count()) {
      await patientTab.click();
      await clinician.waitForTimeout(1200);
      await step(clinician, "note-patient-version", 1800);
    }
  });

  /* ============================ ACT 8 — the patient rates, and pulls the note */
  await act("The patient rates the session and asks for their summary", async () => {
    await patient.bringToFront();
    await patient.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await patient.waitForTimeout(3000);
    await step(patient, "patient-rating-prompt", 1500);

    /*
     * Each rating is a radiogroup of five radios labelled "N out of 5", and
     * the submit stays disabled until the clinician, the session and the app
     * have all been rated. Guessing star positions by index found nothing and
     * left the button dead, so ask for the control by the name it exposes.
     */
    const groups = patient.getByRole("radiogroup");
    const total = await groups.count();
    for (let i = 0; i < total; i++) {
      const five = groups.nth(i).getByRole("radio", { name: "5 out of 5" });
      if (await five.count()) {
        await five.click();
        await patient.waitForTimeout(400);
      }
    }
    if (total === 0) throw new Error("no rating controls on the feedback page");
    await step(patient, "patient-rated", 900);

    const email = patient.locator("#feedback-email");
    if (await email.count()) {
      await email.fill(PATIENT_EMAIL);
      await step(patient, "patient-email", 900);
      const send = patient.getByRole("button", { name: /send|get my summary|finish/i }).first();
      if (await send.count()) {
        await send.click();
        await patient.waitForTimeout(3000);
      }
      await step(patient, "patient-thanks", 1800);
    }
  });

  /*
   * Two signatures, filmed as two.
   *
   * The chart and the patient's copy are separate approvals now, and the second
   * one is the interesting shot: it is the moment a real person gets something.
   * Filming only the first would show a clinician pressing a button and nothing
   * reaching anybody.
   */
  await act("The clinician signs the chart, then releases the patient's summary", async () => {
    await clinician.bringToFront();
    await clinician.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await clinician.waitForTimeout(2000);

    const sign = clinician.getByRole("button", { name: /sign the note/i }).first();
    if (!(await sign.count())) throw new Error("no Sign the note button");
    await step(clinician, "note-before-approve", 1200);
    await sign.click();
    await clinician.waitForTimeout(2500);
    await step(clinician, "note-signed", 1600);

    // Signing the chart switches to the patient tab by itself, because that is
    // the half with somebody waiting on it.
    const release = clinician.getByRole("button", { name: /approve and send/i }).first();
    if (!(await release.count())) throw new Error("no Approve and send button");
    await step(clinician, "patient-note-before-approve", 1600);
    await release.click();
    await clinician.waitForTimeout(4000);
    await step(clinician, "note-approved", 2200);
  });

  /* ======================================== ACT 9 — the copilot, afterwards */
  await act("Asking the copilot about the patient", async () => {
    await clinician.goto(`${BASE}/copilot`, { waitUntil: "domcontentloaded" });
    await clinician.waitForTimeout(2000);
    await step(clinician, "copilot-index", 1200);

    const first = clinician.getByRole("link", { name: new RegExp(PATIENT_NAME, "i") }).first();
    if (await first.count()) {
      await first.click();
      await clinician.waitForTimeout(2500);
    }
    await step(clinician, "copilot-patient", 1500);

    const box = clinician.locator("textarea").first();
    if (await box.count()) {
      await box.fill("What did they say about sleep, and what did we agree to try?");
      await step(clinician, "copilot-question", 900);
      // Enter inserts a newline here; the question is sent by the button.
      await clinician.getByRole("button", { name: /^Ask$/ }).first().click();
      // The answer streams, and it cites the session it came from.
      await clinician.waitForTimeout(18_000);
      await step(clinician, "copilot-answer", 2500);
      await clinician.mouse.wheel(0, 400);
      await step(clinician, "copilot-citation", 1600);
    }
  });

  /* ============================================= ACT 10 — the money, the record */
  await act("Billing, ratings and the clinician's record", async () => {
    await clinician.goto(`${BASE}/billing`, { waitUntil: "domcontentloaded" });
    await step(clinician, "billing", 2200);

    await admin.bringToFront();
    await admin.goto(`${BASE}/admin/ratings`, { waitUntil: "domcontentloaded" });
    await step(admin, "admin-ratings", 2000);

    await admin.goto(`${BASE}/admin/therapists`, { waitUntil: "domcontentloaded" });
    await admin.waitForTimeout(1500);
    const link = admin.getByRole("link", { name: new RegExp(THERAPIST.lastName) }).first();
    if (await link.count()) {
      await link.click();
      await admin.waitForTimeout(2500);
    }
    await step(admin, "admin-therapist-profile", 2000);
    await admin.mouse.wheel(0, 600);
    await step(admin, "admin-therapist-detail", 1600);

    await admin.goto(`${BASE}/admin/usage`, { waitUntil: "domcontentloaded" });
    await step(admin, "admin-usage", 2200);

    await admin.goto(`${BASE}/admin/audit`, { waitUntil: "domcontentloaded" });
    await step(admin, "admin-audit", 2200);
  });

  /* ---------------------------------------------------------- put it back */
  await act("Taking the demo clinician back off the radar", async () => {
    await clinician.goto(`${BASE}/on-call`, { waitUntil: "domcontentloaded" });
    await clinician.waitForTimeout(1500);
    const off = clinician.getByRole("button", { name: /go offline/i }).first();
    if (await off.count()) {
      await off.click();
      await clinician.waitForTimeout(2000);
      console.log("    · clinician is offline");
    }
  });

  for (const ctx of [clinicCtx, adminCtx, patientCtx]) await ctx.close();
  await browser.close();

  console.log(`\n✓ ${shot} stills in ${SHOTS}/`);
  console.log("\nCreated, for cleanup:");
  for (const [k, v] of Object.entries(created)) console.log(`  ${k}: ${v}`);
  if (failures.length > 0) {
    console.log(`\n! ${failures.length} act(s) did not complete:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

void main();
