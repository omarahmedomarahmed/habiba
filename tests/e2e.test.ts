/**
 * 🔴 A KNOWN-FAILING TEST IS A TEST NOBODY READS.
 *
 * This suite was red for fifteen sprints and the redness was explained away as "no headless shell".
 * It was not. A full Chromium was on disk the whole time; `E2E_CHROMIUM` was already read by this
 * file and nothing ever set it. Behind that lid sat two things nobody was looking at:
 *
 *   - Five tests asserting UI that sprints 41 and 47 had deliberately changed. The product moved and
 *     the tests did not, and the failures were indistinguishable from the browser problem.
 *   - 🔴 A REAL PRODUCTION DEFECT. A therapist typing a walk-in's name and pressing Start session now
 *     got nothing, because `startSession` wrote a chart the `patients_phone_present` constraint
 *     refuses. The core flow of the product, broken since sprint 42, guarded by a test that could
 *     not run.
 *
 * **The rule, for anybody who inherits this file: a failure carrying a standing explanation gets
 * RE-DIAGNOSED ON A SCHEDULE, or the explanation becomes a lid.** The longer an explanation stands
 * the more it is trusted and the less it is checked, which is the exact opposite of what it deserves.
 *
 * It is the same shape as the `E2E_CHROMIUM` hook with no setter, and the same shape as the `enrol`
 * comment that described a wiring the code did not have: a signal that was present, wrong, and
 * quietly explained away.
 *
 * And when the product changes, these tests are REWRITTEN, never deleted. A deleted test is a rule
 * nobody notices going; a rewritten one is the rule restated in current vocabulary.
 *
 * Run through `tests/run-e2e.sh`, which builds, starts a server and points OpenAI at a local mock.
 * Running this file with the plain `node --test` command starts no server, so every case fails on
 * a connection refused — which is how the lid got its first coat of paint.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";

import { launchOptions } from "../scripts/_browser";

import { connect, schema } from "../scripts/db";
import { startMockOpenAi, type MockState } from "./mock-openai";

/**
 * End-to-end test of the clinical loop, in a real browser with a real
 * microphone stream.
 *
 * This exists because the riskiest part of the product is the part unit tests
 * cannot reach: capturing audio in the browser, encoding it to WAV, uploading
 * it, and turning the result into a note. The previous codebase shipped an
 * audio pipeline that was broken after the first five seconds of every session
 * and nobody noticed, precisely because nothing ever exercised it end to end.
 *
 * Chromium is launched with a fake capture device, so `getUserMedia` returns a
 * synthetic tone — enough for the AudioWorklet to produce real, non-silent
 * chunks. OpenAI is replaced by `mock-openai.ts`.
 *
 * Requires the app to already be running at BASE_URL with OPENAI_BASE_URL
 * pointed at the mock. `tests/run-e2e.sh` wires all of that up.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 8899);

let browser: Browser;
let page: Page;
let mock: { server: ReturnType<typeof startMockOpenAi>["server"]; state: MockState };

const unique = Date.now().toString(36);
const EMAIL = `e2e-${unique}@example.com`;
const PASSWORD = "e2e-test-password-2026";
const PATIENT = "Jordan";

/**
 * 🔴 C112 / 26.3 — THE ONE APPROVAL SURFACE, AND IT IS A CHECKBOX RATHER THAN A BUTTON.
 *
 * This test clicked a button called "Approve note" and sat red for fifteen sprints while the failure
 * was read as a missing browser. Behind that lid were TWO deliberate product changes, three sprints
 * apart:
 *
 *   - Sprint 26 (C112) consolidated approval onto `SessionApproval`. `NoteReview` is rendered with
 *     `approvals={false}` precisely so there are not two ways to approve one document, because *two
 *     ways to approve the same document is the fatigue the ruling is about*.
 *   - Sprint 47 renamed the act from approving to SIGNING. That is not cosmetic: putting a
 *     clinician's name against text is professional responsibility, which is what signing means and
 *     what approving does not.
 *
 * So the interaction is now: tick "Sign the clinical note", then press the publish button. Two steps
 * rather than one, and that is deliberate friction in front of something the product itself says has
 * no undo: *"Released. There is no unsending."*
 *
 * Rewritten rather than deleted. A deleted test is a rule nobody notices going; a rewritten one is
 * the rule restated in current vocabulary.
 */
async function signTheNote(target: Page, opts: { waitForNote?: boolean } = {}): Promise<void> {
  /*
   * 🔴 THE CHECKBOX, NOT ITS TITLE, AND THAT DISTINCTION IS ITSELF A FINDING.
   *
   * `Choice` in `components/session/session-approval.tsx` wraps an unlabelled `<input
   * type="checkbox">` and TWO spans in one `<label>`: the title and a full explanatory sentence. So
   * the checkbox's accessible name is the title AND the paragraph concatenated, and a screen reader
   * announces the whole explanation as the name of the control.
   *
   * That works for a mouse and it is why `getByText(title)` alone is not the control. Recorded in
   * `docs/walkthrough-2/FINDINGS.md` rather than changed here: what a screen reader announces is a
   * design decision, not a test fix.
   */
  const tick = target.getByRole("checkbox").first();
  await target
    .getByText("Sign the clinical note")
    .waitFor({ timeout: opts.waitForNote ? 90_000 : 30_000 });
  await tick.check();
  await target.getByRole("button", { name: "Publish what is ticked" }).click();
}

/**
 * 🔴 41.2's "WHERE" PICKER, WHICH REPLACED THE VIDEO TOGGLE THIS SUITE WAS ASSERTING.
 *
 * Three tests clicked `button name=/Video/`. That control was removed BY DESIGN in sprint 41: the
 * clinician now answers one question, "Where", whose options are in person, the 24Therapy room, and
 * any meeting provider they have actually connected. `modality` is DERIVED from that answer and
 * never asked, which is the whole point of 41.2 — two questions that could disagree became one that
 * cannot.
 *
 * So the room is chosen by its own name. `portal.new.whereRoom` is "The 24Therapy room", and it is
 * always present: unlike Zoom or Teams it needs no connection, which is why it is the one a test can
 * rely on.
 */
async function chooseTheRoom(target: Page): Promise<void> {
  await target.getByRole("button", { name: "The 24Therapy room" }).click();
}

before(async () => {
  mock = startMockOpenAi(MOCK_PORT);
  /*
   * 🔴 RESOLVED, not configured, and that is what unblocked these thirteen tests.
   *
   * This read `E2E_CHROMIUM` and fell back to Playwright's own resolution, which looked for a build
   * the pinned package expects (`chromium_headless_shell-1234`) against an environment that ships
   * `-1194`. Nothing set the env var, so the hook did nothing and the failures were recorded for
   * four sprints as "no headless shell" — when a full Chromium was present the whole time.
   *
   * `chromiumExecutable` searches for what is actually there. See `scripts/_browser.ts`.
   */
  browser = await chromium.launch(
    launchOptions({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    }),
  );
  const context = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: 390, height: 844 }, // iPhone-sized: this is a phone-first product
  });
  page = await context.newPage();
});

after(async () => {
  await browser?.close();
  mock?.server.close();
});

/**
 * Get the alarm prompt out of the way, the way a clinician would.
 *
 * The portal asks every clinician for permission to make a noise, once per
 * browser session, as a full-screen dialog — because an alarm nobody armed is
 * the failure mode that matters, and a dismissible corner toast is how that
 * gets ignored. It is a real modal, so it really does block everything behind
 * it, and this suite found that out by failing seven tests at once the moment
 * it was added.
 *
 * Dismissing it here rather than special-casing the component is the honest
 * arrangement: the dialog is doing exactly what it is supposed to, and a test
 * driving the product has to answer it like a person does.
 */
/**
 * Start from a known budget.
 *
 * The limiter is keyed on the caller's network, and this whole suite is one
 * caller: every test that joins, books or polls spends from the same buckets,
 * and a test that runs after the one which deliberately fires eighty requests
 * inherits whatever it left behind. That made two tests here depend on their
 * position in the file — passing or failing on ordering rather than on the
 * behaviour they exist to check.
 *
 * Clearing the rows is legitimate setup rather than papering over a bug: the
 * limiter's correctness under concurrency is proved in tests/radar.test.ts
 * against real Postgres. What these tests are for is the flow.
 */
async function resetLimiter() {
  const { pool } = connect();
  try {
    await pool.query("DELETE FROM rate_limits");
  } finally {
    await pool.end();
  }
}

async function dismissAlarmPrompt(target: Page) {
  const later = target.getByRole("button", { name: /^(Later|Not now)$/ });
  if ((await later.count()) > 0) {
    await later.first().click();
    await target.waitForTimeout(200);
  }
}

test("the public home page renders the live hero from real portal components", async () => {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Finish your notes before you leave the room");

  // The transcript panel is the real component from the session room.
  await page.waitForSelector('[aria-label="Session transcript"]');
  await page.waitForSelector("text=Simulated session with invented data");
});

test("a new therapist is sent to verification before they can see a patient", async () => {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });

  await page.fill("#firstName", "Robin");
  await page.fill("#lastName", "Ellis");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await dismissAlarmPrompt(page);

  // The gate. Signing up gets you an account, not a caseload.
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await page.waitForSelector("text=Verify your practice");

  /*
   * And it is a real gate, not a nudge: asking for a page behind it while
   * unverified comes straight back here. This assertion is the whole reason
   * the test exists — a redirect that only fires on the happy path is not a
   * boundary.
   */
  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await dismissAlarmPrompt(page);
  await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
});

test("an approved therapist lands directly in a new session", async () => {
  /*
   * Approval happens in the database rather than by driving the admin queue.
   *
   * Uploading four photographs through Vercel Blob is not what this test is
   * for, and a blob token is not something a CI run should need. What matters
   * downstream is the state, so the state is what we set.
   */
  const { pool, db } = connect();
  try {
    const [user] = await db
      .select({ id: schema.users.id, organizationId: schema.users.organizationId })
      .from(schema.users)
      .where(eq(schema.users.email, EMAIL))
      .limit(1);
    assert.ok(user, "the signup should have created a user");

    await db
      .insert(schema.therapistVerifications)
      .values({
        userId: user.id,
        organizationId: user.organizationId,
        state: "approved",
        country: "GB",
        reviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.therapistVerifications.userId,
        set: { state: "approved", reviewedAt: new Date() },
      });

    await db
      .update(schema.users)
      .set({ verificationStatus: "verified" })
      .where(eq(schema.users.id, user.id));
  } finally {
    await pool.end();
  }

  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await dismissAlarmPrompt(page);
  await page.waitForSelector("#guestName", { timeout: 30_000 });
});

test("starting a session records audio, uploads WAV chunks and shows transcript", async () => {
  await page.fill("#guestName", PATIENT);
  await page.getByRole("button", { name: "Start session now" }).click();

  await page.waitForURL(/\/sessions\/[0-9a-f-]+\/room/, { timeout: 30_000 });
  await page.waitForSelector(`text=${PATIENT}`);

  await page.getByRole("button", { name: "Start session" }).click();
  await page.waitForSelector("text=Recording", { timeout: 15_000 });

  // Chunks are emitted every 8 seconds; wait for at least two round trips so we
  // know chunk 2 is accepted, not just chunk 1. That distinction is the entire
  // reason this pipeline was rewritten.
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-label="Session transcript"] p').length >= 4,
    undefined,
    { timeout: 45_000 },
  );

  assert.ok(
    mock.state.transcriptionRequests.length >= 2,
    `expected at least 2 transcription uploads, got ${mock.state.transcriptionRequests.length}`,
  );

  for (const [index, request] of mock.state.transcriptionRequests.entries()) {
    // Every chunk must be a complete, non-trivial file — including the ones
    // after the first.
    assert.ok(
      request.bytes > 20_000,
      `chunk ${index + 1} was only ${request.bytes} bytes; chunks must be complete WAV files`,
    );
    assert.ok(
      request.contentType.includes("multipart/form-data"),
      `chunk ${index + 1} had content-type ${request.contentType}`,
    );
  }

  const transcript = await page.textContent('[aria-label="Session transcript"]');
  assert.ok(transcript?.includes("Transcribed chunk 1"), "chunk 1 should be in the transcript");
  assert.ok(
    transcript?.includes("Transcribed chunk 2"),
    "chunk 2 should be in the transcript. This is the bug the rewrite fixes",
  );
});

test("off record stops capture and resuming continues it", async () => {
  const before = mock.state.transcriptionRequests.length;

  await page.getByRole("button", { name: "Off record" }).click();
  await page.waitForSelector("text=Off record");
  await new Promise((r) => setTimeout(r, 11_000));

  const during = mock.state.transcriptionRequests.length;
  assert.equal(during, before, "no audio may be uploaded while off record");

  await page.getByRole("button", { name: "Resume" }).click();
});

test("ending the session generates a note the therapist can approve", async () => {
  await page.getByRole("button", { name: "End session" }).click();

  await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 60_000 });

  // Note generation runs in after() and the page polls for it.
  await signTheNote(page, { waitForNote: true });

  const noteText = await page.textContent("body");
  assert.ok(
    noteText?.includes("anticipatory work anxiety"),
    "the generated note should be rendered",
  );

  assert.ok(mock.state.chatRequests.length >= 1, "a note-generation call should have been made");

  // The transcript is sent for note generation; the patient's name must not be.
  const prompt = mock.state.chatRequests[0]!.body;
  assert.ok(
    !prompt.includes(PATIENT),
    "the patient's name must not be sent to the model, context is de-identified",
  );
  assert.ok(prompt.includes("Transcribed chunk"), "the transcript should be sent");

  await signTheNote(page);
  await page.waitForSelector("text=Note approved", { timeout: 30_000 });

  /*
   * There is no "send to patient" button, and its absence is the assertion.
   *
   * A clinician emailing a chart to any address they type was one tap. The
   * patient pulls their own brief instead — by rating the session — so what
   * signing the note does is *release* it, and the card says so.
   */
  await page.waitForSelector("text=Their summary is ready to release", { timeout: 15_000 });
  assert.equal(
    await page.getByRole("button", { name: /Send to patient|Send again/ }).count(),
    0,
    "a clinician must have no way to email a record out of the product",
  );
});

/**
 * The redirect loop that took the portal down.
 *
 * A therapist closes the browser and comes back after the idle window. The
 * cookie outlives the session, so middleware bounces /login → /dashboard,
 * requireUser() bounces /dashboard → /login, and nothing in the cycle can
 * delete the cookie because a Server Component render is not allowed to write
 * one. Every page in the portal was unreachable.
 *
 * Simulated by revoking the session server-side while keeping the cookie —
 * exactly the state an idle-expired session leaves behind.
 */
test("an expired session logs the therapist out instead of looping", async () => {
  const { pool } = connect();
  try {
    await pool.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [EMAIL],
    );
  } finally {
    await pool.end();
  }

  // The browser still holds the cookie, which is the whole point.
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=signed out after a period of inactivity", { timeout: 20_000 });
  assert.match(page.url(), /\/login/, "must land on login, not ping-pong to /dashboard");

  // And a protected page must send them somewhere useful rather than erroring.
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 20_000 });

  // Sign back in so the tests after this one still have a session.
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard|\/sessions/, { timeout: 30_000 });
  await dismissAlarmPrompt(page);
});

test("the note appears in the notes list as approved", async () => {
  await page.goto(`${BASE_URL}/notes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`text=${PATIENT}`);
  await page.waitForSelector("text=Approved");
});

test("a patient can join by link with no account", async () => {
  // Create a video session so a join link exists.
  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await dismissAlarmPrompt(page);
  await chooseTheRoom(page);
  await page.fill("#guestName", "Sam");
  await page.getByRole("button", { name: "Start session now" }).click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]+\/room/, { timeout: 30_000 });

  const joinLink = await page.getAttribute("[data-join-url]", "data-join-url");
  assert.ok(joinLink, "the room should expose a join link for video sessions");

  // A brand-new context: no cookies, no account, nothing.
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const patientPage = await anonymous.newPage();
  await patientPage.goto(joinLink!, { waitUntil: "domcontentloaded" });

  await patientPage.waitForSelector("text=Join your session");
  await patientPage.fill("#name", "Sam");

  /*
   * The consent step is a gate, and this proves it is one: submitting without
   * an answer must not get through. If this ever starts passing without the
   * click below, the gate has become decoration.
   */
  await patientPage.getByRole("button", { name: "Join session" }).click();
  await patientPage.waitForTimeout(500);
  assert.equal(
    await patientPage.locator("text=Do not close this tab").count(),
    0,
    "a patient must not be able to enter the room without answering the recording question",
  );

  await patientPage.getByText("Yes, you may record").click();
  await patientPage.getByRole("button", { name: "Join session" }).click();
  // The room, not a holding card: it names the clinician and says what
  // happens afterwards, whether or not the call itself has started.
  await patientPage.waitForSelector("text=Do not close this tab", { timeout: 30_000 });

  await anonymous.close();
});

/**
 * Crisis Radar, end to end, in a browser: a stranger with no account finds a
 * clinician who is online and is in their waiting room a few seconds later.
 *
 * The clinician is put on the radar with a direct write because going online is
 * a button in the authenticated console and this test is about the *patient*
 * path. Everything after that is the real thing — the public page, the claim,
 * the session, the join.
 */
test("a stranger can book a therapist off the public radar", async () => {
  const { pool } = connect();

  try {
    const therapist = await pool.query<{ id: string; organization_id: string }>(
      "SELECT id, organization_id FROM users WHERE email = $1",
      [EMAIL],
    );
    const row = therapist.rows[0];
    assert.ok(row, "the therapist signed up earlier in this run");

    // Rate zero keeps Stripe out of it; the paid path is covered above.
    await pool.query(
      `INSERT INTO therapist_radar (user_id, organization_id, status, last_seen_at, languages, country)
       VALUES ($1, $2, 'online', now(), '["English"]'::jsonb, 'GB')
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'online', last_seen_at = now(), pending_session_id = NULL, pending_until = NULL`,
      [row!.id, row!.organization_id],
    );
    await pool.query("UPDATE users SET session_rate_cents = 0 WHERE id = $1", [row!.id]);
  } finally {
    await pool.end();
  }

  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const patientPage = await anonymous.newPage();
  await patientPage.goto(`${BASE_URL}/radar`, { waitUntil: "domcontentloaded" });

  /*
   * 🔴 THE VISIBLE COUNT LINE, NOT THE SVG `<title>`.
   *
   * `text=available now` resolved 59 times to a HIDDEN `<title>` inside the globe
   * (`components/radar/globe.tsx:438`) and never to anything visible, so this waited out its
   * timeout against a product that was working. The visible string is the count in
   * `components/radar/public-radar.tsx:116` — "N therapists available now".
   *
   * Worth a moment on its own: an accessible label and a visible label saying the same words means
   * a screen reader announces the availability twice. Recorded as a finding rather than fixed here,
   * because changing what a screen reader says is a design decision rather than a test fix.
   */
  await patientPage
    .getByText(/\d+ therapists? available now/)
    .first()
    .waitFor({ timeout: 30_000 });
  await patientPage.getByRole("button", { name: /Robin Ellis/ }).first().click();

  await patientPage.waitForSelector("text=30 minutes, starting now");
  await patientPage.fill("#radar-name", "Casey");
  await patientPage.getByRole("button", { name: "Start now" }).click();

  await patientPage.waitForURL(/\/join\//, { timeout: 30_000 });

  /*
   * A radar booking never touches the join form, so this is where the
   * recording question gets put to the fastest arrivals in the product — the
   * ones who were, until it was added, the only patients nobody asked.
   */
  await patientPage.waitForSelector("text=One question before you go in", { timeout: 30_000 });
  await patientPage.getByText("Yes, you may record").click();
  await patientPage.getByRole("button", { name: "Go in" }).click();

  // The room, not a holding card: it names the clinician and says what
  // happens afterwards, whether or not the call itself has started.
  await patientPage.waitForSelector("text=Do not close this tab", { timeout: 30_000 });

  await anonymous.close();

  // Take the test clinician back off the radar. This suite runs against a real
  // database, and the radar is a *public* page — leaving a fixture online would
  // advertise a fake therapist to anyone who visited the site.
  const cleanup = connect();
  try {
    await cleanup.pool.query(
      "UPDATE therapist_radar SET status = 'offline', last_seen_at = NULL, pending_session_id = NULL WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [EMAIL],
    );
  } finally {
    await cleanup.pool.end();
  }
});

/**
 * The paywall is a server-side gate, not a disabled button.
 *
 * A priced session is put into the state it would be in after a therapist set a
 * price, then an anonymous patient is pointed at the link. The assertion that
 * matters is the negative one: no room, no iframe, no meeting token — the only
 * way past this point is a completed Stripe charge.
 */
test("a session with a price will not admit a patient who has not paid", async () => {
  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await dismissAlarmPrompt(page);
  await chooseTheRoom(page);
  await page.fill("#guestName", "Robin");
  await page.getByRole("button", { name: "Start session now" }).click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]+\/room/, { timeout: 30_000 });

  const joinLink = await page.getAttribute("[data-join-url]", "data-join-url");
  const token = joinLink!.split("/join/")[1]!;

  // Price the session the way the therapist's own form would.
  const { pool } = connect();
  try {
    const updated = await pool.query(
      "UPDATE sessions SET price_cents = 6000, payment_status = 'pending' WHERE join_token = $1",
      [token],
    );
    assert.equal(updated.rowCount, 1, "the join token should resolve to exactly one session");
  } finally {
    await pool.end();
  }

  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const patientPage = await anonymous.newPage();
  await patientPage.goto(joinLink!, { waitUntil: "domcontentloaded" });

  await patientPage.waitForSelector("text=$60");
  await patientPage.fill("#name", "Robin");
  await patientPage.getByText("Yes, you may record").click();
  await patientPage.getByRole("button", { name: /Pay \$60 and join/ }).click();

  // Stripe is not configured in this environment, so the attempt fails — and
  // the point is what does *not* happen next.
  await patientPage.waitForSelector('[role="alert"]', { timeout: 30_000 });
  assert.equal(await patientPage.locator("iframe").count(), 0, "no room may be handed over");
  assert.equal(
    await patientPage.locator("text=Do not close this tab").count(),
    0,
    "an unpaid patient must not reach the session room",
  );

  await anonymous.close();
});

/**
 * Rate limiting, over real HTTP against the running app.
 *
 * Runs last on purpose: it deliberately exhausts a bucket, and the buckets are
 * keyed on the caller's address, which for every test in this file is the same
 * one. The limiter is proved atomic under concurrency in tests/radar.test.ts;
 * what this adds is that it is actually *wired in* — a limit that exists in a
 * library and is never called protects nothing.
 */
test("the public radar endpoint refuses a flood", async () => {
  await resetLimiter();
  const codes = await Promise.all(
    Array.from({ length: 80 }, async () => {
      const response = await fetch(`${BASE_URL}/api/radar`, { cache: "no-store" });
      return { status: response.status, retryAfter: response.headers.get("retry-after") };
    }),
  );

  const limited = codes.filter((c) => c.status === 429);
  assert.ok(limited.length > 0, "a flood must start getting 429s");
  assert.ok(
    codes.some((c) => c.status === 200),
    "and legitimate requests before the limit must still succeed",
  );
  assert.ok(
    limited.every((c) => Number(c.retryAfter) > 0),
    "every 429 must carry a Retry-After the caller can act on",
  );
});

/**
 * Two people, one room.
 *
 * The single most important thing this product claims, and the one thing
 * nothing had ever exercised. Every other test drives one browser: the
 * therapist records, or the patient joins, but never both at once — so
 * "a stranger in crisis is in a room with a clinician inside a minute" was an
 * assertion nobody had checked end to end.
 *
 * What it actually proves depends on the environment, and that is stated
 * rather than hidden. With DAILY_API_KEY set, both sides mount a real Daily
 * iframe against a real private room with per-participant tokens. Without it,
 * the room degrades to "video is not configured" — and the test still checks
 * everything around the call, because the surrounding choreography is where
 * the bugs have actually been: the join link, the consent gate, the patient's
 * arrival reaching the clinician's screen, the recording indicator.
 */
test("a therapist and a patient are in the same room at the same time", async () => {
  // This runs straight after a test that deliberately floods the limiter from
  // the same address; without this the patient is refused entry for a reason
  // that has nothing to do with what is being checked.
  await resetLimiter();

  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await dismissAlarmPrompt(page);
  await chooseTheRoom(page);
  await page.fill("#guestName", "Alex");
  await page.getByRole("button", { name: "Start session now" }).click();
  await page.waitForURL(/\/sessions\/[0-9a-f-]+\/room/, { timeout: 30_000 });

  const joinLink = await page.getAttribute("[data-join-url]", "data-join-url");
  assert.ok(joinLink, "a video session must expose a join link");

  const videoConfigured =
    (await page.locator("text=Video is not configured").count()) === 0;

  // Second browser context: a different person, on a different device.
  const anonymous = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["camera", "microphone"],
  });
  const patientPage = await anonymous.newPage();

  try {
    await patientPage.goto(joinLink!, { waitUntil: "domcontentloaded" });
    await patientPage.waitForSelector("text=Join your session");
    await patientPage.fill("#name", "Alex");
    await patientPage.getByText("Yes, you may record").click();
    await patientPage.getByRole("button", { name: "Join session" }).click();

    /*
     * Say what went wrong instead of timing out.
     *
     * This test runs straight after the one that deliberately floods the
     * limiter from this same address, and a join refused for that reason looks
     * identical to a broken room from a bare waitForSelector: thirty seconds,
     * then "element not found". Reading the form's own error first turns a
     * mystery into a sentence.
     */
    /*
     * Say what went wrong instead of timing out.
     *
     * This runs straight after a test that deliberately floods the limiter
     * from the same address, and a refusal looks identical to a broken room
     * from a bare waitForSelector: thirty seconds, then "element not found".
     *
     * `:not(:empty)` is load-bearing. The form renders its alert container
     * unconditionally, so racing against a bare [role="alert"] resolves
     * instantly against an empty box and reports a failure that never
     * happened — which is exactly what the first version of this did.
     */
    const refusal = patientPage.locator('[role="alert"]:not(:empty)');
    const outcome = await Promise.race([
      patientPage
        .waitForSelector("text=Do not close this tab", { timeout: 30_000 })
        .then(() => "room" as const),
      refusal
        .first()
        .waitFor({ timeout: 30_000 })
        .then(() => "refused" as const),
    ]).catch(() => "timeout" as const);

    if (outcome !== "room") {
      const said = (await refusal.first().textContent().catch(() => null))?.trim();
      assert.fail(
        said ? `the patient was refused entry: ${said}` : "the patient never reached the room",
      );
    }

    /*
     * The clinician's screen learns the patient arrived.
     *
     * This is the half that cannot be tested with one browser, and the half
     * that matters: a clinician sitting in a room with no idea somebody is on
     * the other side of it is the failure the whole alarm exists to prevent.
     */
    await page.locator("[data-patient-joined]").first().waitFor({ timeout: 30_000 });
    assert.match(
      (await page.locator("[data-patient-joined]").first().textContent()) ?? "",
      /Alex/,
      "the clinician is told who arrived, by name",
    );

    if (videoConfigured) {
      // Both sides mount the call against the same private room.
      await page.locator("iframe[title*='call' i], iframe[src*='daily']").first().waitFor({
        timeout: 30_000,
      });
      await patientPage
        .locator("iframe[title*='call' i], iframe[src*='daily']")
        .first()
        .waitFor({ timeout: 30_000 });
    } else {
      // Say so out loud rather than reporting a pass that proved less than it
      // looks like it did.
      console.log(
        "  ! DAILY_API_KEY is not set: the call itself was not exercised, only the flow around it",
      );
    }

    // And the patient can see whether the microphone is running, which is the
    // promise made to them on the way in.
    assert.ok(
      (await patientPage.locator("text=/recording|not being recorded/i").count()) > 0,
      "the patient must be told the recording state at all times",
    );
  } finally {
    await anonymous.close();
  }
});
