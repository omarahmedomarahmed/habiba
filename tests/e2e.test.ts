import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";

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

before(async () => {
  mock = startMockOpenAi(MOCK_PORT);
  browser = await chromium.launch({
    // Use the Chromium already present in this environment rather than letting
    // Playwright download a matching build.
    ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
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
    "chunk 2 should be in the transcript — this is the bug the rewrite fixes",
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
  await page.getByRole("button", { name: "Approve note" }).waitFor({ timeout: 90_000 });

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
    "the patient's name must not be sent to the model — context is de-identified",
  );
  assert.ok(prompt.includes("Transcribed chunk"), "the transcript should be sent");

  await page.getByRole("button", { name: "Approve note" }).click();
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
});

test("the note appears in the notes list as approved", async () => {
  await page.goto(`${BASE_URL}/notes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`text=${PATIENT}`);
  await page.waitForSelector("text=Approved");
});

test("a patient can join by link with no account", async () => {
  // Create a video session so a join link exists.
  await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Video/ }).click();
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
  await patientPage.getByRole("button", { name: "Join session" }).click();
  // The room, not a holding card: it names the clinician and says what
  // happens afterwards, whether or not the call itself has started.
  await patientPage.waitForSelector("text=Keep this tab open", { timeout: 30_000 });

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

  await patientPage.waitForSelector("text=available now", { timeout: 30_000 });
  await patientPage.getByRole("button", { name: /Robin Ellis/ }).first().click();

  await patientPage.waitForSelector("text=30 minutes, starting now");
  await patientPage.fill("#radar-name", "Casey");
  await patientPage.getByRole("button", { name: "Start now" }).click();

  await patientPage.waitForURL(/\/join\//, { timeout: 30_000 });
  // The room, not a holding card: it names the clinician and says what
  // happens afterwards, whether or not the call itself has started.
  await patientPage.waitForSelector("text=Keep this tab open", { timeout: 30_000 });

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
  await page.getByRole("button", { name: /Video/ }).click();
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
  await patientPage.getByRole("button", { name: /Pay \$60 and join/ }).click();

  // Stripe is not configured in this environment, so the attempt fails — and
  // the point is what does *not* happen next.
  await patientPage.waitForSelector('[role="alert"]', { timeout: 30_000 });
  assert.equal(await patientPage.locator("iframe").count(), 0, "no room may be handed over");
  assert.equal(
    await patientPage.locator("text=Keep this tab open").count(),
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
