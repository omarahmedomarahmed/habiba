import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright";

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

test("a therapist can sign up and lands directly in a new session", async () => {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });

  await page.fill("#firstName", "Robin");
  await page.fill("#lastName", "Ellis");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // No onboarding wizard, no admin approval — straight to the product.
  await page.waitForURL(/\/sessions\/new/, { timeout: 30_000 });
  await page.waitForSelector("text=You are in.");
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
  await page.getByRole("button", { name: /Send to patient|Send again/ }).waitFor({ timeout: 15_000 });
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
  await patientPage.waitForSelector("text=waiting room", { timeout: 30_000 });

  await anonymous.close();
});
