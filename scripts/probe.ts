/**
 * 🔴 76.58 — THE MINI SIMULATION. Nine main flows, one run, on the dev branch.
 *
 *     npm run build && npm run probe
 *
 * ## Why this exists before the six month run and not after it
 *
 * The six month run is twenty agents, sixty-two sessions, ten dollars of model
 * credit and a database nobody restores afterwards. The two most expensive ways
 * for it to go wrong are both discoverable in an hour: a main path that does not
 * walk, and an obstacle that makes every agent invent the same workaround.
 *
 * So this walks **the main path of each user type, through the browser, once**,
 * and reports what it hit. Not edge cases: `09-THE-EDGES.md` has thirty of those
 * and they are the six month run's job.
 *
 * ## 🔴 EVERY CLAIM CARRIES A ROW ID
 *
 * A screen saying "payment submitted" is a screen. What is recorded here is the
 * row it produced, read back out of the database after the browser pressed the
 * button. `_probe.ts` explains why either half alone is worthless.
 *
 * ## 🔴 IT REFUSES PRODUCTION, and it needs a server
 *
 * `writesTo()` with no argument. Point `PROBE_URL` at a locally running
 * product on the same database. `HAZARDS.md` says how to run one, and why it is
 * `next dev` rather than `next start`.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";
import { BASE, PASSWORD, SURNAME, asPerson, emailFor, gist, go, openBrowser, record, report, shot } from "./probe/_probe";

const { check, finish } = reporter();

/** Every probe person, so one sweep can find all of them by name. */
const PEOPLE = {
  therapist: { first: "Sara", name: `Sara ${SURNAME}` },
  patient: { first: "Laila", name: `Laila ${SURNAME}` },
  clinicManager: { first: "Nour", name: `Nour ${SURNAME}` },
  employer: { first: "Dina", name: `Dina ${SURNAME}` },
  covered: { first: "Omar", name: `Omar ${SURNAME}` },
} as const;

async function main() {
  writesTo();

  const { pool, db } = connect();
  const browser = await openBrowser();

  try {
    /*
     * 🔴 SWEEP FIRST, for the reason `verify:actuals` learned the hard way: a
     * run that died half way leaves people behind, and the next run then fails
     * on a unique email and reports itself as broken rather than the product.
     */
    await sweep(db);

    const up = await reachable();
    check(
      "there is a product to walk",
      up,
      up ? `${BASE} answers` : `${BASE} did not answer. Start one: see HAZARDS.md`,
    );
    if (!up) return;

    await f1TherapistSignsUp(browser, db);
    await f8StaffWorkTheQueues(browser, db);
    await f2PatientPaysOnTheRail(browser, db);
    await f5SubscribeByTransfer(browser, db);
    await f4MoneyOut(browser, db);
    await f6ThePractice(browser, db);
    await f7TheEmployer(browser, db);
    await f3ASession(browser, db);
    await f9TheFoundersScreens(browser);

    report();
  } finally {
    await browser.close();
    await sweep(db);
    await pool.end();
  }

  finish("mini simulation");
}

/* ------------------------------------------------------------------- F1 -- */

/**
 * F1 · A therapist signs herself up and asks to be verified.
 *
 * 🔴 THE FIRST THING EVERY WAVE-1 AGENT DOES, and the place two of the last
 * three walkthroughs found their worst defects. Nothing in the six month run
 * happens until this works: no session, no payment, no note, no radar.
 */
async function f1TherapistSignsUp(browser: Awaited<ReturnType<typeof openBrowser>>, db: ReturnType<typeof connect>["db"]) {
  const flow = "F1 therapist";
  const who = PEOPLE.therapist;
  const email = emailFor(who.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    const status = await go(page, "/signup");
    if (status !== 200) {
      record({ flow, step: "reach the sign-up form", state: "blocked", saw: `/signup answered ${String(status)}`, evidence: null });
      return;
    }

    await page.fill('input[name="firstName"]', who.first);
    await page.fill('input[name="lastName"]', SURNAME);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const row = await db.execute<{ id: string; role: string }>(sql`
      SELECT id, role FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`);

    if (!row.rows[0]) {
      await shot(page, "f1-signup-failed");
      record({
        flow,
        step: "sign up",
        state: "blocked",
        saw: `no users row after submitting. Landed on ${page.url()}: ${await gist(page)}`,
        evidence: null,
      });
      return;
    }

    record({
      flow,
      step: "sign up",
      state: "ok",
      saw: `signed up as ${row.rows[0].role}, landed on ${new URL(page.url()).pathname}`,
      evidence: `users#${row.rows[0].id}`,
    });

    /* ------------------------------------------------- the verification -- */

    const onboarding = await go(page, "/onboarding");
    if (onboarding !== 200) {
      record({ flow, step: "reach onboarding", state: "blocked", saw: `answered ${String(onboarding)}`, evidence: null });
      return;
    }

    await shot(page, "f1-onboarding");

    /*
     * 🔴 THE DETAILS SAVE IS ITS OWN ACT, and the form says so in a comment:
     * somebody who fills the form in and does not press Save details sees their
     * own answers listed as missing beside a submit button that will not
     * respond. If a probe cannot find that button, an agent will not either.
     */
    const country = page.locator('select[name="country"], input[name="country"]').first();
    const hasCountry = (await country.count()) > 0;

    record({
      flow,
      step: "the verification form is on the screen",
      state: hasCountry ? "ok" : "blocked",
      saw: hasCountry
        ? `country, licence body, number and expiry are all askable: ${await gist(page, 100)}`
        : `no country field on /onboarding: ${await gist(page)}`,
      evidence: null,
    });

    if (!hasCountry) return;

    /*
     * 🔴 THE ORDER MATTERS, AND IT IS THE FIRST REAL OBSTACLE THIS FOUND.
     *
     * The country select is a CONTROLLED component: its options are the
     * taxonomy an operator published, their values are country codes, and the
     * regulator field relabels itself the moment the country changes. So an
     * agent that fills the licence fields first and picks a country afterwards
     * has its regulator suggestion overwritten, and an agent that picks the
     * country by its visible label has to know the label carries a flag
     * emoji — `🇪🇬 Egypt`, not `Egypt`.
     *
     * The first version of this probe selected by the label `Egypt`, silently
     * matched nothing, and the form then reported Country and Regulator as
     * missing with the submit button disabled. That is exactly the wave-1
     * obstacle this run exists to find: it looks like the form is broken and it
     * is the agent filling it in the wrong order.
     */
    await country.selectOption("EG").catch(() => undefined);
    await page.waitForTimeout(400);

    const regulator = page.locator('input[name="licenseBody"]');
    if ((await regulator.inputValue().catch(() => "")) === "") {
      /* The chips are suggestions rather than a list, so typing is the path. */
      await regulator.fill("Egyptian Medical Syndicate").catch(() => undefined);
    }

    await page.fill('input[name="licenseNumber"]', "PROBE-0001").catch(() => undefined);
    await page.fill('input[name="licenseExpiry"]', "2030-01").catch(() => undefined);

    /*
     * 🔴 THE CHIPS ARE `sr-only` CHECKBOXES INSIDE A LABEL, AND THEY MUST BE
     * SET BEFORE "SAVE DETAILS". Two obstacles in one control:
     *
     *   - `.check()` refuses them, because the input is visually hidden and the
     *     thing a person clicks is the label around it. Anything driving this
     *     form has to click the label or force the check.
     *   - they are part of the SAME form as the licence fields, so selecting
     *     them after pressing Save details saves nothing, and the screen gives
     *     no sign of it: submit simply stays disabled.
     *
     * This probe got both wrong on its first run, saved country, body, number
     * and expiry, and then sat looking at a disabled button with `languages=0
     * specialties=0` in the database. Nine clinicians walk this in wave 1.
     */
    for (const group of ["languages", "specialties"]) {
      const chip = page.locator(`input[name="${group}"]`).first();
      if ((await chip.count()) > 0) {
        await chip.check({ force: true }).catch(() => undefined);
      }
    }

    const save = page.getByRole("button", { name: /save details/i }).first();
    if ((await save.count()) > 0) {
      await save.click();
      await page.waitForTimeout(1500);
    }

    const verification = await db.execute<{ id: string; state: string; license_number: string | null }>(sql`
      SELECT v.id, v.state, v.license_number
        FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE u.email = ${email} LIMIT 1`);

    record({
      flow,
      step: "save the licence details",
      state: verification.rows[0]?.license_number === "PROBE-0001" ? "ok" : "defect",
      saw: verification.rows[0]
        ? `verification is ${verification.rows[0].state}, licence ${verification.rows[0].license_number ?? "not saved"}`
        : "no verifications row at all",
      evidence: verification.rows[0] ? `verifications#${verification.rows[0].id}` : null,
    });

    /*
     * 🔴 AND THE DOCUMENTS, WHICH ARE A REAL UPLOAD TO THE REAL STORE.
     *
     * A probe that stubbed this would prove nothing about the one step that
     * needs a blob token, a content type and a size limit to all be right, and
     * that step is the gate every clinician in the run passes through.
     */
    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count();
    const png = await onePixel();

    for (let i = 0; i < count; i++) {
      await inputs.nth(i).setInputFiles({ name: "probe.png", mimeType: "image/png", buffer: png }).catch(() => undefined);
      await page.waitForTimeout(1200);
    }

    /*
     * 🔴 WAIT FOR THE ROW, NOT FOR A TIMER.
     *
     * Each upload is a server action that stores a file and then updates one
     * column, and the fourth was still in flight when a fixed 1200ms loop
     * finished and the database was read. The probe reported "3 of 4, headshot
     * still null" for three runs, which is a real-looking finding about the
     * product and was a race in the probe.
     *
     * So it polls, and it reports how long the four took. That number is worth
     * having on its own: an agent that uploads and immediately presses submit
     * is the commonest shape of this mistake, and the six month run has nine
     * clinicians doing it.
     */
    const started = Date.now();
    let filled = 0;
    while (Date.now() - started < 20_000) {
      const now = await db.execute<{ n: string }>(sql`
        SELECT (
          (v.id_front_url IS NOT NULL)::int + (v.id_back_url IS NOT NULL)::int +
          (v.license_doc_url IS NOT NULL)::int + (v.headshot_url IS NOT NULL)::int
        )::text AS n
          FROM therapist_verifications v JOIN users u ON u.id = v.user_id
         WHERE u.email = ${email} LIMIT 1`);
      filled = Number(now.rows[0]?.n ?? 0);
      if (filled >= 4) break;
      await page.waitForTimeout(700);
    }
    const tookMs = Date.now() - started;

    /*
     * 🔴 THE DOCUMENTS ARE URL COLUMNS, NOT A TABLE, which is the shape
     * `therapist_verifications` has had since sprint 20: `id_front_url`,
     * `id_back_url`, `license_doc_url`, `headshot_url`. A probe that counted a
     * `documents` table would have reported zero uploads for ever.
     */
    const documents = await db.execute<{ n: string; missing: string }>(sql`
      SELECT (
        (v.id_front_url IS NOT NULL)::int + (v.id_back_url IS NOT NULL)::int +
        (v.license_doc_url IS NOT NULL)::int + (v.headshot_url IS NOT NULL)::int
      )::text AS n,
      CONCAT_WS(', ',
        CASE WHEN v.id_front_url IS NULL THEN 'id_front' END,
        CASE WHEN v.id_back_url IS NULL THEN 'id_back' END,
        CASE WHEN v.license_doc_url IS NULL THEN 'license_doc' END,
        CASE WHEN v.headshot_url IS NULL THEN 'headshot' END) AS missing
        FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE u.email = ${email} LIMIT 1`);

    record({
      flow,
      step: "upload the identity documents",
      state: Number(documents.rows[0]?.n ?? 0) > 0 ? "ok" : "blocked",
      saw:
        `${count} upload fields on the form, ${documents.rows[0]?.n ?? 0} of 4 URL columns filled` +
        (documents.rows[0]?.missing ? `. Still null: ${documents.rows[0].missing}` : "") +
        `. The last one landed ${String(Math.round(tookMs / 100) / 10)}s after the file was chosen`,
      evidence: `therapist_verifications for users#${row.rows[0].id}`,
    });

    await shot(page, "f1-onboarding-filled");

    /*
     * 🔴 READ THE LIST BEFORE AND AFTER A RELOAD, because the difference is the
     * finding.
     *
     * `missing` is computed on the SERVER from the saved row and handed to a
     * client component. Nothing revalidates the page when "Save details"
     * succeeds or when a document finishes uploading, so the list a clinician
     * is looking at is the list as it was when they opened the tab. The form
     * has a sentence warning that the list reads the saved row rather than the
     * screen; it does not say that the list is also behind the saved row.
     *
     * Two readings tell a reader which of those two things is happening.
     */
    const staleList = await missingList(page);
    await go(page, "/onboarding");
    const freshList = await missingList(page);

    record({
      flow,
      step: "the missing list keeps up with what has been saved",
      state: staleList.length === freshList.length ? "ok" : "defect",
      saw:
        staleList.length === freshList.length
          ? `${String(freshList.length)} outstanding, and the list is the same before and after a reload`
          : `the screen listed ${String(staleList.length)} outstanding and a reload listed ` +
            `${String(freshList.length)}. A clinician who has just saved sees their own answers ` +
            `still listed as missing: ${staleList.filter((x) => !freshList.includes(x)).join(" · ")}`,
      evidence: null,
    });

    /*
     * 🔴 THE SUBMIT BUTTON IS DISABLED UNTIL THE SAVED ROW IS COMPLETE, AND
     * WHAT IS STILL MISSING IS THE FINDING.
     *
     * The first version of this clicked it and timed out for sixty seconds on
     * `element is not enabled`, which reported a harness problem in the words of
     * a product failure. The button being disabled is the product working: the
     * form lists what it is still waiting for, off the SAVED row rather than off
     * the screen. What an agent needs to know is that list, so this reads it.
     */
    const submit = page.getByRole("button", { name: /submit for (review|verification)/i }).first();

    /*
     * 🔴 POLLED, NOT READ ONCE, and the difference was a false defect.
     *
     * The first version read `isEnabled()` immediately after the reload and got
     * false, so the probe reported the form as blocked with every field saved
     * and all four documents uploaded. The screenshot taken at that instant
     * showed "Everything is here" and a blue, enabled button: the page had not
     * finished hydrating, and the disabled attribute is React's until it does.
     *
     * A checker that reads a client-rendered control before hydration is
     * measuring the server's HTML and reporting it as the product.
     */
    await shot(page, "f1-before-submit");
    let enabled = false;
    for (let i = 0; i < 20 && !enabled; i++) {
      enabled = (await submit.count()) > 0 && (await submit.isEnabled());
      if (!enabled) await page.waitForTimeout(500);
    }

    if (!enabled) {
      /*
       * 🔴 SCOPED TO THE CARD THE BUTTON IS IN, not `ul li` on the page.
       *
       * The first version swept every list item and reported the privacy panel's
       * three bullets — "You will write clinical records and take payment" — as
       * things the form was waiting for. A checker that is right about the
       * selector and wrong about the question is the §6 family in a probe.
       */
      const missing = await missingList(page);

      record({
        flow,
        step: "the form says what it is still waiting for",
        state: "ok",
        saw:
          `submit is disabled, and the screen names what is missing: ` +
          `${missing.slice(0, 8).join(" · ") || "(nothing listed, which would be the defect)"}`,
        evidence: null,
      });
    } else {
      await submit.click();
      await page.waitForTimeout(2500);
    }

    const after = await db.execute<{
      state: string;
      country: string | null;
      license_body: string | null;
      languages: string[] | null;
      specialties: string[] | null;
    }>(sql`
      SELECT v.state, v.country, v.license_body, v.languages, v.specialties
        FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE u.email = ${email} LIMIT 1`);

    const row2 = after.rows[0];
    record({
      flow,
      step: "submit for review, so the operator has a queue row",
      state: row2?.state === "submitted" ? "ok" : "blocked",
      saw: row2
        ? `verification is ${row2.state}. country=${row2.country ?? "null"} ` +
          `body=${row2.license_body ?? "null"} ` +
          `languages=${(row2.languages ?? []).length} specialties=${(row2.specialties ?? []).length}`
        : "the verification row is gone",
      evidence: row2 ? `therapist_verifications.state=${row2.state}` : null,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F8 -- */

/**
 * F8 · Support works a queue, under their own name, and is refused the rest.
 *
 * 🔴 THE HALF OF THE PRODUCT NOBODY OUTSIDE THIS COMPANY EVER SEES, and the
 * half every customer flow waits on. A therapist cannot see a patient until
 * somebody approves her licence; a patient cannot join a session until somebody
 * clears her transfer. Six months of that is a queue worked several hundred
 * times, and the run's evidence about it is the audit log.
 *
 * Two things are checked and the second is the one that usually is not: that a
 * `staff` account CAN clear the queue it owns, and that it CANNOT reach the
 * founder-only half. A permission nobody was ever refused by is a permission
 * nobody has tested.
 */
async function f8StaffWorkTheQueues(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F8 support";
  const email = emailFor(PEOPLE.therapist.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    await go(page, "/staff/sign-in");
    await page.fill('input[name="email"]', "admin@24therapy.test");
    await page.fill('input[name="password"]', "Screenshots2026!");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const status = await go(page, "/admin/verifications");
    const waiting = page.getByText(new RegExp(`${PEOPLE.therapist.first}\\s+${SURNAME}`, "i")).first();
    const onQueue = (await waiting.count()) > 0;

    record({
      flow,
      step: "the clinician who just submitted is on the verification queue",
      state: onQueue ? "ok" : "blocked",
      saw: onQueue
        ? `${PEOPLE.therapist.name} is waiting on /admin/verifications`
        : `/admin/verifications answered ${String(status)} and does not name her: ${await gist(page, 140)}`,
      evidence: null,
    });

    await shot(page, "f8-verifications");
    if (!onQueue) return;

    const approve = page.getByRole("button", { name: /^approve$/i }).first();
    if ((await approve.count()) === 0) {
      record({
        flow,
        step: "approve her",
        state: "blocked",
        saw: "no Approve button on the queue row",
        evidence: null,
      });
      return;
    }

    await approve.click();
    await page.waitForTimeout(2500);

    const after = await db.execute<{ state: string; reviewed_by: string | null }>(sql`
      SELECT v.state, v.reviewed_by FROM therapist_verifications v
        JOIN users u ON u.id = v.user_id WHERE u.email = ${email} LIMIT 1`);

    record({
      flow,
      step: "approve her, and the row carries WHO did it",
      state: after.rows[0]?.state === "approved" && after.rows[0].reviewed_by ? "ok" : "defect",
      saw:
        `verification is ${after.rows[0]?.state ?? "gone"}, reviewed_by ` +
        `${after.rows[0]?.reviewed_by ? "set" : "NULL, so the queue cannot say who cleared it"}`,
      evidence: after.rows[0]?.reviewed_by ? `therapist_verifications.reviewed_by=${after.rows[0].reviewed_by}` : null,
    });

    /*
     * 🔴 AND THE AUDIT ROW, which is the whole reason the run gives seven
     * people their own logins. A queue cleared with no attributable row is six
     * months of evidence about nobody.
     */
    const audited = await db.execute<{ n: string; action: string | null }>(sql`
      SELECT COUNT(*)::text AS n, MAX(action) AS action FROM audit_log
       WHERE category = 'auth' AND created_at > now() - interval '2 minutes'
         AND action LIKE 'verification%'`);

    record({
      flow,
      step: "…and the audit log has a row for it",
      state: Number(audited.rows[0]?.n ?? 0) > 0 ? "ok" : "defect",
      saw: `${audited.rows[0]?.n ?? 0} verification audit rows in the last two minutes` +
        (audited.rows[0]?.action ? `, most recent ${audited.rows[0].action}` : ""),
      evidence: null,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F2 -- */

/**
 * F2 · A patient signs herself up and pays on the Egyptian rail.
 *
 * 🔴 THERE IS NO CARD IN THIS MARKET. `topUpPot` refuses `entity = 'eg'`, so
 * every dollar that reaches this company arrives as a bank transfer somebody
 * photographed and somebody else read. Sixty patients walk this in six months,
 * and every one of them is on a spinner while a person looks at a receipt.
 *
 * What is checked: that she can make an account, that the payment sheet shows
 * her a bank account rather than a card form, that she can attach the
 * screenshot her banking app produced, and that a `manual_payments` row exists
 * afterwards with her file on it.
 */
async function f2PatientPaysOnTheRail(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F2 patient";
  const who = PEOPLE.patient;
  const email = emailFor(who.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    const status = await go(page, "/patient/signup");
    if (status !== 200) {
      record({
        flow,
        step: "reach the patient sign-up",
        state: "blocked",
        saw: `/patient/signup answered ${String(status)}`,
        evidence: null,
      });
      return;
    }

    await shot(page, "f2-signup");

    /*
     * 🔴 A PATIENT SIGNS UP WITH A PHONE NUMBER, NOT AN EMAIL, and this probe
     * did not know that until it was refused.
     *
     * `lib/patient-auth/actions.ts`: *the phone is the handle that is never
     * missing, and the address is a second real way in for the people who have
     * one.* So `phone` is required, `email` and `password` are optional, and a
     * form filled the way a clinician's is answers "A phone number is
     * required". Sixty patients walk this in six months.
     *
     * 🔴 AND IT MATTERS TO `verify:cast`, which reads `patient_accounts.email`
     * for seven of the twenty-six logins. A patient signed up without one has
     * no address to sign in with and no row that check can find, so every
     * patient agent has to type the address as well as the number even though
     * the form calls it optional. `12-THE-LOGINS.md` now says so.
     */
    for (const [name, value] of [
      ["firstName", who.first],
      ["lastName", SURNAME],
      ["email", email],
      ["password", PASSWORD],
    ] as const) {
      const field = page.locator(`input[name="${name}"]`).first();
      if ((await field.count()) > 0) await field.fill(value).catch(() => undefined);
    }

    const country = page.locator('select[name="phoneCountry"], input[name="phoneCountry"]').first();
    if ((await country.count()) > 0) await country.selectOption("EG").catch(() => undefined);

    const phone = page.locator('input[name="phone"]').first();
    if ((await phone.count()) > 0) await phone.fill("01009000090").catch(() => undefined);

    await page.getByRole("button", { name: /create|sign up|continue/i }).first().click().catch(() => undefined);

    /*
     * 🔴 POLLED, for the reason F1's submit button was: the button reads
     * "Working…" while a server action runs, and a fixed wait reported a
     * product failure three times over a sign-up that had not finished.
     */
    let account = await db.execute<{ id: string; email: string | null; phone: string | null }>(sql`
      SELECT id, email, phone FROM patient_accounts
       WHERE phone = '+201009000090' AND deleted_at IS NULL LIMIT 1`);
    for (let i = 0; i < 15 && !account.rows[0]; i++) {
      await page.waitForTimeout(700);
      account = await db.execute<{ id: string; email: string | null; phone: string | null }>(sql`
        SELECT id, email, phone FROM patient_accounts
         WHERE phone = '+201009000090' AND deleted_at IS NULL LIMIT 1`);
    }

    record({
      flow,
      step: "sign up as a patient",
      state: account.rows[0] ? "ok" : "blocked",
      saw: account.rows[0]
        ? `a patient_accounts row exists, landed on ${new URL(page.url()).pathname}`
        : `no patient_accounts row. On ${new URL(page.url()).pathname}: ${await gist(page, 140)}`,
      evidence: account.rows[0] ? `patient_accounts#${account.rows[0].id}` : null,
    });

    await shot(page, "f2-after-signup");
    if (!account.rows[0]) return;

    /*
     * 🔴 THE FINDING THIS FLOW EXISTS TO HAVE PRODUCED, and it is about the
     * RUN rather than about the product being broken.
     *
     * The sign-up form asks for a first name, a phone, a time zone and an
     * optional password. **It never asks for an email**, and nothing anywhere
     * else lets a patient add one: `/patient/account` shows the address as "not
     * added" beside a notice calling it *"another way to sign in, and the only
     * way to receive your record"*, and offers no control to add it.
     *
     * So `patient_accounts.email` is null for every patient who signs herself
     * up, and the run's own login list promised seven patient addresses that
     * cannot exist. `verify:cast --complete` would have reported seven people
     * missing at the end of six months, which reads as an agent who never
     * finished a wave.
     *
     * The answer is not to invent the address. A patient signs in with her
     * PHONE and a one-time code, which is the product working: `_cast.ts`
     * carries the number, `verify:cast` looks patients up by it, and
     * `12-THE-LOGINS.md` says so.
     */
    record({
      flow,
      step: "🔴 can a patient have an email address at all",
      state: account.rows[0].email ? "ok" : "defect",
      saw: account.rows[0].email
        ? `she has ${account.rows[0].email}`
        : "the sign-up form never asks for one and no screen lets her add one. " +
          "/patient/account calls it 'the only way to receive your record' and offers no control. " +
          `She signs in with ${account.rows[0].phone ?? "no number either"} and a code`,
      evidence: `patient_accounts#${account.rows[0].id}`,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F5 -- */

/**
 * F5 · A therapist pays us, by bank transfer, with a photograph.
 *
 * 🔴 THE WHOLE OF HOW MONEY REACHES THIS COMPANY IN EGYPT. There is no card:
 * `topUpPot` refuses `entity = 'eg'`, so every dollar arrives as a transfer
 * somebody made in a banking app, photographed, and attached to a claim that a
 * person then reads. `03-THE-MONEY.md` turns on this working.
 *
 * What is checked: that the payment sheet shows a bank account rather than a
 * card form, that the receipt attaches, that a `manual_payments` row exists
 * with the file on it, and that it lands on the operator's queue **unconfirmed**
 * — the gap between declaring and confirming is the design, not a delay.
 */
async function f5SubscribeByTransfer(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F5 transfer";
  const email = emailFor(PEOPLE.therapist.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    await go(page, "/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    /*
     * 🔴 WHICH ENTITY HER PRACTICE IS ON, READ FIRST, because it decides which
     * rail the whole of this flow uses and nothing on the screen says so.
     *
     * 🔴 IT IS `organizations.region`, NOT `entity`, and the probe got that
     * wrong first: `entity` is a column on a PAYMENT, describing which of our
     * legal entities took that money. Which rail a clinician is OFFERED is
     * decided by `organizationNeedsTransfer`, which reads
     * `organizations.region === 'eg'` — *a clinician's PRACTICE region decides
     * it, not their passport*, in that file's own words.
     *
     * It defaults to `us`. On `us` the product offers Stripe; on `eg` it raises
     * a bill and asks for a bank transfer. The operator moves each customer
     * onto the Egyptian region, which `01-THE-CAST.md` mentions in one clause —
     * and the ORDER turns out to be load bearing in a way nothing said.
     */
    const org = await db.execute<{ region: string; id: string }>(sql`
      SELECT o.region, o.id FROM organizations o JOIN users u ON u.organization_id = o.id
       WHERE u.email = ${email} LIMIT 1`);
    const entity = org.rows[0]?.region ?? "unknown";

    const status = await go(page, "/billing");
    await shot(page, "f5-billing");

    const text = await gist(page, 400);
    const showsCard = /card number|cvc|expiry date/i.test(text);

    record({
      flow,
      step: "the billing screen offers a bank account, never a card",
      state: status === 200 && !showsCard ? "ok" : "defect",
      saw: showsCard
        ? "a card form is on the screen, in a market with no card rail"
        : `${String(status)} · ${text.slice(0, 160)}`,
      evidence: null,
    });

    /*
     * 🔴 THE PLAN SHE IS ALREADY ON IS A DISABLED CARD, and that is the fifth
     * obstacle this run found.
     *
     * `/billing` offers three: **Pay as you go** (marked "Yours" and disabled,
     * because it is the plan she is on), **Practice $80 a month** and **Clinic
     * $144 a month**. A locator that took the first button matching /pay/ got
     * the disabled one and hung for thirty seconds on `element is not enabled`,
     * which is exactly what an agent told to "choose a plan" will do.
     *
     * What a therapist who wants to subscribe presses is the PRACTICE card.
     */
    const opener = page.getByRole("button", { name: /practice/i }).first();

    if ((await opener.count()) === 0 || !(await opener.isEnabled())) {
      record({
        flow,
        step: "open the payment sheet",
        state: "blocked",
        saw: `no enabled Practice plan card on /billing: ${text.slice(0, 200)}`,
        evidence: null,
      });
      return;
    }

    await opener.click();
    await page.waitForTimeout(2000);
    await shot(page, "f5-sheet");

    /*
     * 🔴 A CONFIRMATION PANEL FIRST, and what it SAYS is a finding.
     *
     * "Move to Practice? $80 a month, from today... **You will be taken to the
     * card page to finish.**" There is no card page in Egypt: `topUpPot`
     * refuses `entity = 'eg'` and `03-THE-MONEY.md` M3 is explicit — *he
     * presses Subscribe, there is no checkout, a bill is raised, the card asks
     * for it in pounds.* A sentence promising a card page is a sentence the one
     * therapist who reads it in wave 4 will report as a defect, and they will
     * be right.
     */
    const panel = await gist(page, 2000);
    const promisesACard = /card page|card details|checkout/i.test(panel);

    /*
     * 🔴 THE OBSTACLE THAT WOULD HAVE SENT WAVE 4'S MONEY DOWN THE WRONG RAIL.
     *
     * On the default `us` entity the panel says *"You will be taken to the card
     * page to finish"* and Confirm redirects to **checkout.stripe.com**. That
     * is correct for a US customer and catastrophic for this run: `T2`
     * subscribes by transfer in wave 4 and `M3` is the frame the whole Egyptian
     * rail argument rests on. An agent who signs a therapist up and
     * subscribes her straight away never touches the rail, the transfer queue
     * stays empty, and the run's evidence about the half of this product that
     * is new would be a Stripe page nobody in Cairo can pay.
     *
     * The operator moving each customer onto the Egyptian entity is not a
     * tidying step. It comes BEFORE anybody is asked for money.
     */
    record({
      flow,
      step: "🔴 which rail she is offered, and it turns on her entity",
      state: entity === "eg" && promisesACard ? "defect" : "ok",
      saw:
        `her practice is on region '${entity}'. ` +
        (promisesACard
          ? "The panel promises a card page, which is right for 'us' and impossible for 'eg'. " +
            "🔴 THE OPERATOR MUST MOVE EVERY EGYPTIAN CUSTOMER TO region 'eg' BEFORE THEY ARE " +
            "ASKED FOR MONEY, or the run's money goes to Stripe and the transfer queue stays empty"
          : "no card page is mentioned, which is the Egyptian rail"),
      evidence: org.rows[0] ? `organizations#${org.rows[0].id}.region=${entity}` : null,
    });

    /*
     * 🔴 MOVED HERE RATHER THAN THROUGH THE PRODUCT, and said out loud.
     *
     * The operator does this on `/admin/settings` in the real run. This probe
     * writes the column because what it is testing is the RAIL that follows,
     * not the screen that sets it — and a probe that quietly used a shortcut
     * without saying so is a probe whose green means nothing.
     */
    if (entity !== "eg" && org.rows[0]) {
      await db.execute(sql`UPDATE organizations SET region = 'eg' WHERE id = ${org.rows[0].id}`);
      await go(page, "/billing");
      await page.waitForTimeout(1500);

      /* The panel is client state, so the card has to be pressed again. */
      await page.getByRole("button", { name: /practice/i }).first().click().catch(() => undefined);
      await page
        .getByRole("button", { name: /confirm/i })
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => undefined);
      await shot(page, "f5-sheet-eg");

      const afterMove = await gist(page, 2000);
      record({
        flow,
        step: "…and on 'eg' the same button offers the transfer rail instead",
        state: /card page|checkout/i.test(afterMove) ? "defect" : "ok",
        saw: /card page|checkout/i.test(afterMove)
          ? "it STILL promises a card page on the Egyptian region, which would be the defect"
          : "no card page is promised. The region is what switches the rail",
        evidence: null,
      });
    }

    const confirm = page.getByRole("button", { name: /confirm/i }).first();
    if ((await confirm.count()) > 0 && (await confirm.isEnabled())) {
      await confirm.click();
      await page.waitForTimeout(4000);
      await shot(page, "f5-after-confirm");

      record({
        flow,
        step: "…and where Confirm actually lands",
        state: page.url().includes("stripe.com") ? "defect" : "ok",
        saw: page.url().includes("stripe.com")
          ? "🔴 checkout.stripe.com, for an Egyptian therapist"
          : `${new URL(page.url()).pathname} · ${await gist(page, 240)}`,
        evidence: null,
      });
    }

    /*
     * 🔴 THE BILL AND THE DECLARATION ARE TWO ACTS, and the cart between them
     * is the product working.
     *
     * Confirm raises the bill — **EGP 4,000**, which is $80 at the operator's
     * own rate — and leaves an `awaiting_proof` row with a banner reading
     * *"Sent it? Tap to finish."* She then goes to her bank, makes the
     * transfer, comes back and attaches the photograph. A rail that took the
     * reference in the same breath as the bill would be asking for a reference
     * that does not exist yet.
     */
    if ((await page.locator('input[name="reference"]').count()) === 0) {
      await page.getByRole("button", { name: /^open$/i }).first().click().catch(() => undefined);
      await page.waitForTimeout(2500);
      await shot(page, "f5-sheet-open");
    }

    const reference = page.locator('input[name="reference"]').first();
    if ((await reference.count()) === 0) {
      record({
        flow,
        step: "the sheet asks for the reference and the receipt",
        state: "blocked",
        saw: `no reference field after opening it: ${await gist(page, 220)}`,
        evidence: null,
      });
      return;
    }

    await reference.fill("PROBE-TRANSFER-1");

    const proof = page.locator('input[name="proof"]').first();
    if ((await proof.count()) > 0) {
      await proof
        .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: await onePixel() })
        .catch(() => undefined);
      /* The file has to be read before the form is posted with it. */
      await page.waitForTimeout(1500);
    }

    await shot(page, "f5-sheet-filled");

    /*
     * 🔴 SCOPED TO THE SHEET. `/billing` has its own Submit-shaped buttons and
     * the first match on the page was one of them, so the press landed
     * somewhere else and the row stayed `awaiting_proof` while the probe
     * reported it as a missing receipt.
     */
    const sheetSubmit = reference
      .locator("xpath=ancestor::form[1]")
      .getByRole("button", { name: /^submit/i })
      .first();

    if ((await sheetSubmit.count()) > 0) {
      await sheetSubmit.click().catch(() => undefined);
    } else {
      await page.getByRole("button", { name: /^submit$/i }).last().click().catch(() => undefined);
    }

    /* Polled, for the reason every other server action here is. */
    let payment = await declaredPayment(db, email);
    for (let i = 0; i < 20 && payment?.state !== "submitted"; i++) {
      await page.waitForTimeout(700);
      payment = await declaredPayment(db, email);
    }
    await shot(page, "f5-after-submit");

    record({
      flow,
      step: "declare the transfer, with the receipt attached",
      state: payment ? "ok" : "blocked",
      saw: payment
        ? `a ${payment.state} manual_payments row for ${payment.purpose}, ` +
          `receipt ${payment.proof_url ? "attached" : "MISSING"}`
        : `no manual_payments row after submitting: ${await gist(page, 220)}`,
      evidence: payment ? `manual_payments#${payment.id}` : null,
    });

    if (!payment) return;

    /*
     * 🔴 AND IT IS NOT CONFIRMED YET, which is the design rather than a delay.
     *
     * `03-THE-MONEY.md` M3: he presses Subscribe, a bill is raised, he sends
     * the money, **and he is still metered until an operator confirms.** A
     * probe that only checked the row existed would have been equally happy
     * with a rail that granted on declaration.
     */
    /*
     * 🔴 THE THREE STATES, AND THIS CHECK HAD TWO OF THEM WRONG.
     *
     * `awaiting_proof` → `submitted` → `confirmed`. The first version asserted
     * `submitted` and reported `awaiting_proof` as a defect, which is the
     * opposite of the truth: a bill raised with nothing declared against it is
     * MORE conservative, not less. What actually matters is that it is not
     * `confirmed`, because `03-THE-MONEY.md` M3 is *he is still metered until
     * an operator confirms* — the gap is the design, not a delay.
     */
    record({
      flow,
      step: "🔴 nothing is granted until a person confirms it",
      state: payment.state === "confirmed" ? "defect" : "ok",
      saw:
        `the row is ${payment.state}, which is not confirmed. ` +
        "The product granted nothing on the strength of a claim nobody has read",
      evidence: `manual_payments.state=${payment.state}`,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F4 -- */

/**
 * F4 · Money out: what a clinician sees when she asks to be paid.
 *
 * `verify:payout` already walks the module end to end and asserts the four
 * refusals. What it cannot see is the screen: whether a clinician can find the
 * button, whether she is told what she is owed, and whether she can watch the
 * request move. `T1` requests her payout in wave 3 and the run's evidence about
 * the Egyptian rail is what she sees while she waits.
 */
async function f4MoneyOut(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F4 money out";
  const email = emailFor(PEOPLE.therapist.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    await go(page, "/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const status = await go(page, "/earnings");
    await shot(page, "f4-earnings");
    const text = await gist(page, 300);

    record({
      flow,
      step: "she can see what is held for her",
      state: status === 200 ? "ok" : "blocked",
      saw: `${String(status)} · ${text.slice(0, 200)}`,
      evidence: null,
    });

    /*
     * 🔴 SHE HAS EARNED NOTHING YET, so what is checked is the SCREEN rather
     * than a payout. A clinician with a zero balance must be told that, and
     * told what to do about it, rather than shown a withdraw button that fails.
     */
    const withdraw = page.getByRole("button", { name: /withdraw|request|pay me/i }).first();
    const offered = (await withdraw.count()) > 0;

    record({
      flow,
      step: "with nothing held, the screen is honest about it",
      state: /0\.00|nothing|no earnings|not yet/i.test(text) || !offered ? "ok" : "defect",
      saw: offered
        ? `a withdraw control is on the screen with nothing held: ${text.slice(0, 160)}`
        : "no withdraw control, and the screen says why",
      evidence: null,
    });

    const held = await db.execute<{ cents: string }>(sql`
      SELECT COALESCE(-SUM(l.amount_cents), 0)::text AS cents
        FROM ledger_entries l JOIN users u ON u.id = l.user_id
       WHERE l.account = 'therapist_payable' AND u.email = ${email}`);

    record({
      flow,
      step: "…and the ledger agrees with the screen",
      state: "ok",
      saw: `the ledger holds ${(Number(held.rows[0]?.cents ?? 0) / 100).toFixed(2)} for her`,
      evidence: `therapist_payable for ${email}`,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F6 -- */

/**
 * F6 · A practice applies, and somebody approves it.
 *
 * 🔴 A PRACTICE IS NOT A THERAPIST WITH EXTRA SEATS. It is its own principal
 * with its own table, its own cookie and its own sign-in, and `C259` spends a
 * page on why. `C1` Nile Practice is wave 2's whole first half, and the thing
 * its manager must FAIL at — reaching a clinical note — is the evidence wave 2
 * exists to produce.
 */
async function f6ThePractice(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F6 practice";
  const who = PEOPLE.clinicManager;
  const email = emailFor(who.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    const status = await go(page, "/clinic/apply");
    if (status !== 200) {
      record({ flow, step: "reach the application", state: "blocked", saw: `answered ${String(status)}`, evidence: null });
      return;
    }

    await page.fill('input[name="name"]', `${SURNAME} Practice`);
    await page.fill('input[name="contactName"]', who.name);
    await page.fill('input[name="contactEmail"]', email);
    await page.fill('input[name="contactPhone"]', "+20 100 900 0091");
    await page.locator('input[name="registrationNumber"]').fill("PROBE-REG-1").catch(() => undefined);
    /*
     * 🔴 THE BUTTON SAYS "Ask us to call", NOT "Apply" OR "Submit".
     *
     * Both enquiry forms end in that sentence, because 54.3's whole point is
     * that nothing is set up until a person has spoken to them. A probe
     * matching /apply|send|submit/ found nothing, clicked nothing, and reported
     * the application as having failed — which is what an agent told to "submit
     * the application" will do. The last button in the form is the one.
     */
    await page.locator("form button[type=submit]").last().click().catch(() => undefined);

    let applied = await applicationFor(db, email, "clinic");
    for (let i = 0; i < 15 && !applied; i++) {
      await page.waitForTimeout(700);
      applied = await applicationFor(db, email, "clinic");
    }

    await shot(page, "f6-applied");

    record({
      flow,
      step: "a practice can apply, and the operator gets a row",
      state: applied ? "ok" : "blocked",
      saw: applied
        ? `a held organizations row in state ${applied.state}`
        : `no organizations row for her: ${await gist(page, 200)}`,
      evidence: applied ? `organizations#${applied.id}` : null,
    });

    /*
     * 🔴 AND IT IS NOT APPROVED YET. `01-THE-CAST.md` has the practice
     * "applied then approved", in that order, by a person. An application that
     * granted itself a console would be the same defect as a payment that
     * granted itself a plan.
     */
    if (applied) {
      record({
        flow,
        step: "🔴 applying does not grant a console",
        state: applied.state === "approved" ? "defect" : "ok",
        saw: `the application is ${applied.state}, so nothing was granted by asking`,
        evidence: `organizations.clinic_state=${applied.state}`,
      });
    }
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F7 -- */

/**
 * F7 · An employer applies to cover its people.
 *
 * 🔴 THE PRINCIPAL THAT MUST NEVER LEARN WHO ATTENDED. C227 and C243 are the
 * two rulings this product is least able to get wrong quietly: a sponsor sees
 * money and a count, never a name and never a session. `E1` Cairo Foundry
 * funds a pot at 100% coverage and `E1-HR` Dalia watches it drain without ever
 * finding out whose therapy drained it.
 */
async function f7TheEmployer(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F7 employer";
  const who = PEOPLE.employer;
  const email = emailFor(who.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    const status = await go(page, "/sponsor/apply");
    if (status !== 200) {
      record({ flow, step: "reach the application", state: "blocked", saw: `answered ${String(status)}`, evidence: null });
      return;
    }

    await page.fill('input[name="name"]', `${SURNAME} Foundry`);
    await page.fill('input[name="contactName"]', who.name);
    await page.fill('input[name="contactEmail"]', email);
    await page.fill('input[name="contactPhone"]', "+20 100 900 0092");
    /*
     * 🔴 THE BUTTON SAYS "Ask us to call", NOT "Apply" OR "Submit".
     *
     * Both enquiry forms end in that sentence, because 54.3's whole point is
     * that nothing is set up until a person has spoken to them. A probe
     * matching /apply|send|submit/ found nothing, clicked nothing, and reported
     * the application as having failed — which is what an agent told to "submit
     * the application" will do. The last button in the form is the one.
     */
    await page.locator("form button[type=submit]").last().click().catch(() => undefined);

    let applied = await applicationFor(db, email, "sponsor");
    for (let i = 0; i < 15 && !applied; i++) {
      await page.waitForTimeout(700);
      applied = await applicationFor(db, email, "sponsor");
    }

    await shot(page, "f7-applied");

    record({
      flow,
      step: "an employer can apply, and the operator gets a row",
      state: applied ? "ok" : "blocked",
      saw: applied
        ? `a sponsors row in state ${applied.state}`
        : `no sponsors row for her: ${await gist(page, 200)}`,
      evidence: applied ? `sponsors#${applied.id}` : null,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F3 -- */

/**
 * F3 · A session, and what it takes to make one produce a note.
 *
 * 🔴 THE MOST EXPENSIVE FLOW IN THE RUN AND THE ONE THIS PROBE DELIBERATELY
 * DOES NOT COMPLETE.
 *
 * Sixty-two sessions, 286 minutes of audio, a real transcription and a real
 * note on every recorded one. `13-THE-AUDIO.md` costs it: about $4.80 of
 * product-side model spend and another $4 to $5 of synthesis that
 * `npm run spend` cannot see. Spending that here, on a rehearsal, would be
 * spending most of the run's budget to learn something the run itself is going
 * to measure.
 *
 * So what this checks is everything UP TO the money: that a clinician who has
 * been approved can reach the screen that starts one, and that the room, the
 * transcription door and the note are where the run will expect them.
 */
async function f3ASession(
  browser: Awaited<ReturnType<typeof openBrowser>>,
  db: ReturnType<typeof connect>["db"],
) {
  const flow = "F3 session";
  const email = emailFor(PEOPLE.therapist.first);
  const { ctx, page } = await asPerson(browser, flow);

  try {
    await go(page, "/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const approved = await db.execute<{ state: string }>(sql`
      SELECT v.state FROM therapist_verifications v JOIN users u ON u.id = v.user_id
       WHERE u.email = ${email} LIMIT 1`);

    const status = await go(page, "/dashboard");
    const text = await gist(page, 240);
    await shot(page, "f3-dashboard");

    record({
      flow,
      step: "an approved clinician reaches her own dashboard",
      state: status === 200 && !page.url().includes("onboarding") ? "ok" : "blocked",
      saw:
        `verification is ${approved.rows[0]?.state ?? "missing"}, ` +
        `landed on ${new URL(page.url()).pathname}: ${text.slice(0, 140)}`,
      evidence: null,
    });

    /*
     * 🔴 THE DOOR THE RUN FEEDS AUDIO THROUGH, checked for existence rather
     * than walked. `13-THE-AUDIO.md` chose the session-scoped bearer token over
     * a clinician's cookie because it is narrower, audited through
     * `recordIngestUse` and a real product surface. If that route had moved,
     * the run would find out in wave 1 with a synthesised script in hand.
     */
    const ingest = await fetch(`${BASE}/api/sessions/00000000-0000-0000-0000-000000000000/transcribe`, {
      method: "POST",
      cache: "no-store",
    });

    record({
      flow,
      step: "🔴 the transcription door the audio goes through still exists",
      state: ingest.status === 404 ? "defect" : "ok",
      saw:
        `POST /api/sessions/<id>/transcribe answered ${String(ingest.status)}. ` +
        (ingest.status === 404
          ? "The route is gone, and 13-THE-AUDIO.md tells the run to feed every session through it"
          : "Refused, which is right for a request with no token and a session that does not exist"),
      evidence: null,
    });

    /*
     * 🔴 AND WHAT THIS RUN IS NOT DOING, said out loud rather than skipped.
     *
     * A probe that quietly omitted the expensive half and reported nine green
     * flows would be claiming the run's biggest cost had been rehearsed.
     */
    record({
      flow,
      step: "🔴 NOT WALKED HERE: audio, transcription, the note and the copilot",
      state: "ok",
      saw:
        "62 sessions and 286 minutes of audio cost about $4.80 of product-side model spend " +
        "and another $4 to $5 of synthesis that `npm run spend` cannot see. Rehearsing it " +
        "would spend most of the run's budget to learn what the run measures. " +
        "13-THE-AUDIO.md is the document; the first session of the real run is the measurement",
      evidence: null,
    });
  } finally {
    await ctx.close();
  }
}

/* ------------------------------------------------------------------- F9 -- */

/**
 * F9 · The founder's own screens, which nothing else in the run checks.
 *
 * Every other flow is a customer. This is us: does the console open, does the
 * money screen add up, is a `staff` refused the founder-only half. A six month
 * run whose evidence is read off `/admin/actuals` needs that page to work
 * before month 1, not after month 6.
 */
async function f9TheFoundersScreens(browser: Awaited<ReturnType<typeof openBrowser>>) {
  const flow = "F9 founder";
  const { ctx, page } = await asPerson(browser, flow);

  try {
    await go(page, "/staff/sign-in");
    await page.fill('input[name="email"]', "admin@24therapy.test");
    await page.fill('input[name="password"]', "Screenshots2026!");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle").catch(() => undefined);

    if (page.url().includes("sign-in")) {
      record({
        flow,
        step: "sign in",
        state: "blocked",
        saw: "still on the sign-in page. Run `npm run screens:prep` to set the local password",
        evidence: null,
      });
      return;
    }

    record({ flow, step: "sign in", state: "ok", saw: `landed on ${new URL(page.url()).pathname}`, evidence: null });

    for (const path of ["/admin", "/admin/actuals", "/admin/financial-model", "/admin/transfers", "/admin/payouts", "/admin/vault"]) {
      const status = await go(page, path);
      const text = await gist(page, 120);
      const broke = text.startsWith("Something went wrong");

      record({
        flow,
        step: `open ${path}`,
        state: status === 200 && !broke ? "ok" : "defect",
        saw: `${String(status)} · ${text}`,
        evidence: null,
      });

      await shot(page, `f9${path.replace(/\//g, "_")}`);
    }
  } finally {
    await ctx.close();
  }
}

/* ---------------------------------------------------------------- pieces -- */

/**
 * What the onboarding screen says it is still waiting for.
 *
 * 🔴 SCOPED TO THE SUBMIT CARD, not `ul li` on the page. The first version swept
 * every list item and reported the privacy panel's three bullets — "You will
 * write clinical records and take payment" — as things the form wanted. A
 * checker that is right about its selector and wrong about its question is the
 * §6 family in a probe.
 */
async function missingList(page: import("playwright").Page): Promise<string[]> {
  const card = page
    .locator("div")
    .filter({ has: page.getByRole("button", { name: /submit for review|send for review/i }) })
    .last();

  const items = await card.locator("ul li").allInnerTexts().catch(() => [] as string[]);
  /* The privacy panel's bullets are sentences; what is missing is a noun. */
  return items.map((t) => t.replace(/\s+/g, " ").trim()).filter((t) => t.length > 0 && t.length < 40);
}

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE}/staff/sign-in`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * An application of either kind, by the address that made it.
 *
 * 🔴 THERE IS NO `applications` TABLE, and the probe assumed one.
 *
 * A practice's enquiry creates a **held `organizations` row** and nothing else:
 * no manager, no password, no clinician, no portal, which is why the action can
 * be rate limited without being gated. An employer's creates a `sponsors` row
 * the same way. The state lives on the row itself — `clinic_state` on one,
 * `state` on the other — so an operator approving it is a state change rather
 * than a promotion from a queue table.
 */
async function applicationFor(
  db: ReturnType<typeof connect>["db"],
  email: string,
  kind: "clinic" | "sponsor",
): Promise<{ id: string; state: string } | null> {
  const rows = await db.execute<{ id: string; state: string }>(
    kind === "clinic"
      ? sql`SELECT id, clinic_state AS state FROM organizations
             WHERE contact_email = ${email} LIMIT 1`
      : sql`SELECT id, state FROM sponsors WHERE contact_email = ${email} LIMIT 1`,
  );
  return rows.rows[0] ?? null;
}

/** The transfer she has declared, if any, for the polling above. */
async function declaredPayment(
  db: ReturnType<typeof connect>["db"],
  email: string,
): Promise<{ id: string; state: string; purpose: string; proof_url: string | null } | null> {
  const rows = await db.execute<{ id: string; state: string; purpose: string; proof_url: string | null }>(sql`
    SELECT m.id, m.state, m.purpose, m.proof_url
      FROM manual_payments m JOIN users u ON u.id = m.user_id
     WHERE u.email = ${email} ORDER BY m.created_at DESC LIMIT 1`);
  return rows.rows[0] ?? null;
}

/** The smallest valid PNG, so an upload is a real upload without a fixture file. */
async function onePixel(): Promise<Buffer> {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

/**
 * 🔴 EVERYBODY WITH THE SURNAME, GONE, BEFORE AND AFTER.
 *
 * By name rather than by id, because the ids are only known to a run that
 * finished. A run that crashed is exactly the run whose residue has to go.
 */
async function sweep(db: ReturnType<typeof connect>["db"]): Promise<void> {
  const like = `%.${SURNAME.toLowerCase()}@example.com`;

  await db.execute(sql`
    DELETE FROM person_documents WHERE uploaded_by_user_id IN
      (SELECT id FROM users WHERE email LIKE ${like})`);
  await db.execute(sql`
    DELETE FROM therapist_verifications WHERE user_id IN
      (SELECT id FROM users WHERE email LIKE ${like})`);
  await db.execute(sql`
    DELETE FROM manual_payments WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${like})`);
  await db.execute(sql`
    DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${like})`);
  await db.execute(sql`
    DELETE FROM audit_log WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE ${like})`);
  await db.execute(sql`DELETE FROM patient_accounts WHERE email LIKE ${like}`);
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${like}`);
  await db.execute(sql`DELETE FROM eta_documents WHERE kind = 'credit_note' AND sponsor_id IN (SELECT id FROM sponsors WHERE contact_email LIKE ${like} OR name LIKE ${`%${SURNAME}%`})`);
  await db.execute(sql`DELETE FROM eta_documents WHERE sponsor_id IN (SELECT id FROM sponsors WHERE contact_email LIKE ${like} OR name LIKE ${`%${SURNAME}%`})`);
  await db.execute(sql`DELETE FROM pot_returns WHERE sponsor_id IN (SELECT id FROM sponsors WHERE contact_email LIKE ${like} OR name LIKE ${`%${SURNAME}%`})`);
  await db.execute(sql`DELETE FROM sponsors WHERE contact_email LIKE ${like} OR name LIKE ${`%${SURNAME}%`}`);
  await db.execute(sql`DELETE FROM organizations WHERE name LIKE ${`%${SURNAME}%`} OR contact_email LIKE ${like}`);
}

main();
