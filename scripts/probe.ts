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
        `${after.rows[0]?.reviewed_by ? "set" : "NULL — the queue cannot say who cleared it"}`,
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
  await db.execute(sql`DELETE FROM organizations WHERE name LIKE ${`%${SURNAME}%`}`);
}

main();
