/**
 * Photograph the live room at the two widths that matter.
 *
 *   DATABASE_URL=… E2E_BASE_URL=http://localhost:3100 npx tsx scripts/shoot-room.ts
 *
 * Sprint 2 is a layout sprint, and "the classes changed and `tsc` is happy" is
 * not evidence that anybody can see their patient and the transcript at the
 * same time. This drives a real browser through signup, approval and a real
 * session, then measures the thing the ticket is actually about: **is the
 * transcript inside the viewport, without scrolling, on a desktop screen?**
 *
 * It writes PNGs to look at *and* prints the geometry, because a screenshot
 * proves it looked right once and a number can be asserted. The numbers are the
 * verification; the images are for the human.
 *
 * Reuses `tests/e2e.test.ts`'s approach — the same fake capture device, the same
 * database-side approval — rather than inventing a second way to get a therapist
 * into a room.
 */
import { eq } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";

import { connect, schema } from "./db";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const OUT = process.env.SHOT_DIR ?? "/tmp/room-shots";

const unique = Date.now().toString(36);
const EMAIL = `shot-${unique}@example.com`;
const PASSWORD = "shot-test-password-2026";

type Geometry = {
  viewport: { width: number; height: number };
  video: { top: number; height: number; width: number } | null;
  transcript: { top: number; height: number; visibleHeight: number };
  controls: { top: number; height: number } | null;
  pageScrollsVertically: boolean;
  bodyScrollWidth: number;
};

/**
 * Answer the alarm prompt the way a clinician would.
 *
 * It is a real full-screen modal and it really does block everything behind it,
 * which is the point — an unarmed alarm is the failure mode that matters. Its
 * dismiss button is worded three different ways depending on state ("Later"
 * offline, "Not now" online, "I will fix it in my browser" when the browser has
 * blocked notifications outright), and matching only the first two is what made
 * this script time out clicking the orb through an invisible overlay.
 */
async function dismissAlarmPrompt(page: Page) {
  const dismiss = page.getByRole("button", {
    name: /^(Later|Not now|I will fix it in my browser)$/,
  });
  if ((await dismiss.count()) > 0) {
    await dismiss.first().click();
    await page.waitForTimeout(250);
  }
}

/**
 * Measure in the page, where the real layout is.
 *
 * The probe is a string rather than a closure on purpose: `tsx` compiles with
 * esbuild's `keepNames`, which rewrites function declarations to reference a
 * `__name` helper that exists in this process and not in the browser. A closure
 * passed to `page.evaluate` therefore throws `__name is not defined` the moment
 * it contains a named inner function. A string is compiled by the browser and
 * cannot pick up our build's helpers.
 */
const PROBE = `(() => {
  const vh = window.innerHeight;
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) };
  };

  const video = box("iframe") || box('[class*="aspect-"]');
  const t = document.querySelector('[aria-label="Session transcript"]');
  const tr = t ? t.getBoundingClientRect() : null;

  // How much of the transcript is actually on screen. This is the number the
  // ticket is about: a transcript that exists but begins at y=900 on a 900px
  // screen is a transcript the clinician cannot read.
  const visible = tr ? Math.max(0, Math.min(tr.bottom, vh) - Math.max(tr.top, 0)) : 0;
  const controls = box(".safe-bottom.sticky");

  return {
    viewport: { width: window.innerWidth, height: vh },
    video,
    transcript: {
      top: tr ? Math.round(tr.top) : -1,
      height: tr ? Math.round(tr.height) : -1,
      visibleHeight: Math.round(visible),
    },
    controls: controls ? { top: controls.top, height: controls.height } : null,
    pageScrollsVertically: document.documentElement.scrollHeight > vh + 2,
    bodyScrollWidth: document.documentElement.scrollWidth,
  };
})()`;

async function measure(page: Page): Promise<Geometry> {
  return page.evaluate(PROBE) as Promise<Geometry>;
}

async function main() {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(OUT, { recursive: true });

  let browser: Browser | undefined;
  let failures = 0;

  try {
    browser = await chromium.launch({
      ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });

    const context = await browser.newContext({
      permissions: ["microphone"],
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // ---------------------------------------------------------- sign up
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });
    await page.fill("#firstName", "Layout");
    await page.fill("#lastName", "Check");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await dismissAlarmPrompt(page);
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });

    // ------------------------------------------------- approve in the database
    const { pool, db } = connect();
    try {
      const [user] = await db
        .select({ id: schema.users.id, organizationId: schema.users.organizationId })
        .from(schema.users)
        .where(eq(schema.users.email, EMAIL))
        .limit(1);
      if (!user) throw new Error("signup did not create a user");

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

    // ------------------------------------------------------ into a real room
    await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
    await dismissAlarmPrompt(page);
    await page.waitForSelector("#guestName", { timeout: 30_000 });
    await page.fill("#guestName", "Sam");

    /*
     * A **video** session, explicitly.
     *
     * The first run of this script measured an in-person session, because
     * `in_person` is the form's default — and an in-person room has no video
     * element at all, so the transcript was never pushed anywhere and the whole
     * check passed against a case that never had the defect. The bug being
     * fixed is specific to a video room: that is the one where a full-bleed
     * `aspect-video` element takes the top of the screen.
     *
     * Daily.co is not configured here, so what renders is the placeholder —
     * which is itself `aspect-video w-full`, i.e. exactly the geometry under
     * test. Measuring the placeholder is measuring the real layout.
     */
    await page.getByText("Send a join link").click();
    await page.getByRole("button", { name: /Start session|Create/ }).first().click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]+\/room/, { timeout: 30_000 });
    await page.waitForSelector('[aria-label="Session transcript"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);

    const roomUrl = page.url();

    for (const [name, size] of [
      ["desktop-1440", { width: 1440, height: 900 }],
      ["laptop-1280", { width: 1280, height: 800 }],
      ["tablet-834", { width: 834, height: 1112 }],
      ["phone-390", { width: 390, height: 844 }],
    ] as const) {
      await page.setViewportSize(size);
      await page.goto(roomUrl, { waitUntil: "domcontentloaded" });
      await dismissAlarmPrompt(page);
      await page.waitForSelector('[aria-label="Session transcript"]', { timeout: 30_000 });
      await page.waitForTimeout(900);

      const g = await measure(page);
      await page.screenshot({ path: `${OUT}/${name}.png` });

      const wide = size.width >= 1024;
      console.log(`\n${name}  ${g.viewport.width}x${g.viewport.height}`);
      console.log(
        `  video      ${g.video ? `${g.video.width}x${g.video.height} at y=${g.video.top}` : "none"}`,
      );
      console.log(
        `  transcript y=${g.transcript.top} h=${g.transcript.height} visible=${g.transcript.visibleHeight}px`,
      );
      console.log(`  h-scroll   ${g.bodyScrollWidth > g.viewport.width ? "YES (bad)" : "no"}`);

      /*
       * The acceptance, as arithmetic.
       *
       * A clinician has to be able to look at their patient and read the
       * transcript at once, so on any screen the transcript must start inside
       * the viewport and show a usable amount of itself. 200px is roughly four
       * lines — enough to follow a conversation rather than to know one exists.
       */
      const check = (label: string, ok: boolean, detail = "") => {
        console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
        if (!ok) failures += 1;
      };

      check(
        "transcript starts inside the viewport",
        g.transcript.top >= 0 && g.transcript.top < g.viewport.height,
        `y=${g.transcript.top}`,
      );
      check(
        "at least 200px of transcript is visible",
        g.transcript.visibleHeight >= 200,
        `${g.transcript.visibleHeight}px`,
      );
      check("the page does not scroll sideways", g.bodyScrollWidth <= g.viewport.width + 1);

      if (wide && g.video) {
        check(
          "the video is beside the transcript, not above it",
          g.video.width < g.viewport.width * 0.6,
          `video ${g.video.width}px of ${g.viewport.width}px`,
        );
      }
    }

    /*
     * And /on-call, which sprint 2.5 adds session history to.
     *
     * This therapist has exactly the session created above, so the history has
     * one real row rather than an empty state — which is the case worth
     * photographing: an empty list proves only that the page did not crash.
     */
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/on-call`, { waitUntil: "domcontentloaded" });
    await dismissAlarmPrompt(page);
    await page.waitForSelector("text=Session history", { timeout: 30_000 });
    await page.screenshot({ path: `${OUT}/on-call-1440.png`, fullPage: true });

    const historyRows = await page.evaluate(
      `document.querySelectorAll('ul li').length`,
    );
    console.log(`\non-call: session history rendered, ${historyRows} list item(s)`);

    /*
     * The orb, driven through its states.
     *
     * The five states are the whole ticket, and four of them are database
     * states rather than anything a browser can click into — so they are set
     * directly on `therapist_radar` and the page reloaded, which is exactly
     * what the poll would have produced.
     */
    const orbStates: Array<[string, Record<string, unknown>]> = [
      ["off", { status: "offline", pendingSessionId: null, pendingUntil: null }],
      ["live", { status: "online", pendingSessionId: null, pendingUntil: null, lastSeenAt: new Date() }],
      [
        "viewing",
        {
          status: "pending",
          pendingSessionId: null,
          pendingUntil: new Date(Date.now() + 60_000),
          reservedBy: "someone",
        },
      ],
      ["in-session", { status: "in_session", pendingSessionId: null, pendingUntil: null }],
    ];

    const { pool: p2, db: db2 } = connect();
    let orbFailures = 0;
    try {
      const [me] = await db2
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, EMAIL))
        .limit(1);

      await page.setViewportSize({ width: 1440, height: 900 });

      for (const [label, patch] of orbStates) {
        await db2
          .update(schema.therapistRadar)
          .set(patch as never)
          .where(eq(schema.therapistRadar.userId, me!.id));

        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
        await dismissAlarmPrompt(page);

        const orb = page.getByRole("button", { name: /Open radar controls/ });
        await orb.waitFor({ timeout: 20_000 });

        /*
         * Dismiss again, after the orb exists.
         *
         * The first call fires on `domcontentloaded`, which is before React has
         * hydrated and rendered the alarm modal — so it found nothing, and the
         * modal then appeared over the orb and ate every click. The prompt
         * re-renders on every load while the clinician is online, so this is
         * not a one-time setup step.
         */
        await dismissAlarmPrompt(page);

        // The accessible name carries the state, so this asserts what a screen
        // reader would say rather than what colour a div happens to be.
        const name = await orb.getAttribute("aria-label");
        const expected: Record<string, RegExp> = {
          off: /Off the radar/,
          live: /Live on the radar/,
          viewing: /looking at your profile/,
          "in-session": /In a session/,
        };
        const ok = expected[label]!.test(name ?? "");
        console.log(`  ${ok ? "ok  " : "FAIL"} orb state "${label}" — ${name}`);
        if (!ok) orbFailures += 1;

        await orb.click();
        await page.waitForSelector('[role="dialog"][aria-label="Crisis Radar"]', {
          timeout: 10_000,
        });
        // Let `animate-fade-rise` finish, or the shot catches a half-faded
        // panel and looks like a rendering bug that is not there.
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/orb-${label}.png` });
        await page.keyboard.press("Escape");
      }

      // Put them back where the room shots left them.
      await db2
        .update(schema.therapistRadar)
        .set({ status: "offline", pendingSessionId: null, pendingUntil: null, reservedBy: null } as never)
        .where(eq(schema.therapistRadar.userId, me!.id));
    } finally {
      await p2.end();
    }
    failures += orbFailures;

    console.log(`\nscreenshots in ${OUT}`);
  } finally {
    await browser?.close();
  }

  console.log(failures === 0 ? "\nroom layout: PASS" : `\nroom layout: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
