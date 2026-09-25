/**
 * 🔴 TASK 40 PART 1: THE LAUNCH BLOCKERS IN CODE AND CONFIG, EACH ONE ASSERTED.
 *
 *     npm run verify:launch
 *
 * Seven things the 25 September inventory found that would have been wrong on
 * the day real people arrived:
 *
 *   1. the crisis sweep ran once a day, and one throw stopped all of it
 *   2. check-ins ran at 03:05 UTC, inside every Egyptian patient's quiet window
 *   3. production refused to boot without the secret of a rail nobody uses
 *   4. email could be silently off on the live deployment
 *   5. nothing noticed a stopped cron job or a run of server errors
 *   6. the design gallery of sample screens was public on the live site
 *   7. the public, sign-in and room screens had no loading or error boundary
 *
 * Most of this reads files and calls pure functions, so it runs anywhere. The
 * last section exercises the lease and the once-a-day alert against a DEV
 * database when migration 0165 is there, and defers when it is not. It refuses
 * production by name, like every writing verifier here.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readSource, reporter, writesTo } from "./_verify";

const { check, skipUnless, finish } = reporter();

const read = (path: string) => readFileSync(path, "utf8");

/** Every `page.tsx` under a directory. */
function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...pagesUnder(path));
    else if (name === "page.tsx") out.push(path);
  }
  return out;
}

/** The body of one job in the cron route's `JOBS` map, from its name to the next job. */
function jobBody(route: string, job: string, next: string): string {
  const start = route.indexOf(`async ${job}()`);
  const end = route.indexOf(`async ${next}()`, start + 1);
  return start >= 0 && end > start ? route.slice(start, end) : "";
}

async function main() {
  const route = readSource("app/api/cron/[job]/route.ts");
  const vercel = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const scheduleOf = (job: string) => vercel.crons.find((c) => c.path === `/api/cron/${job}`)?.schedule ?? "";
  const hourly = (schedule: string) => /^\d+ \* \* \* \*$/.test(schedule);
  const daily = (schedule: string) => /^\d+ \d+ \* \* \*$/.test(schedule);

  /* ============================================ 1 · the crisis sweep, hourly */
  console.log("\n1. the crisis sweep");

  check(
    "🔴 crisis runs at least hourly in vercel.json",
    hourly(scheduleOf("crisis")),
    `crisis: "${scheduleOf("crisis")}"`,
  );
  check(
    "…on the same minute as reminders, so the two share one wake of the database",
    scheduleOf("crisis") !== "" && scheduleOf("crisis") === scheduleOf("reminders"),
    `crisis "${scheduleOf("crisis")}", reminders "${scheduleOf("reminders")}"`,
  );
  check(
    "the heavy jobs stay daily: billing, retention, extract",
    ["billing", "retention", "extract"].every((job) => daily(scheduleOf(job))),
    ["billing", "retention", "extract"].map((job) => `${job} "${scheduleOf(job)}"`).join(", "),
  );

  const crisis = jobBody(route, "crisis", "licences");
  const crisisSteps = [
    "sweepUndeliveredAlerts",
    "sweepRadar",
    "sweepAbandonedPatients",
    "sweepUnratedSessions",
    "sweepOverrunSessions",
    "watchdog",
  ];
  const unstepped = crisisSteps.filter(
    (name) => !new RegExp(`step\\(failed, "${name}", \\(\\) => ${name}\\(`).test(crisis),
  );
  check(
    "🔴 every piece of the crisis job is wrapped in step(), so one throw does not stop the rest",
    crisis !== "" && unstepped.length === 0,
    unstepped.length === 0 ? `${crisisSteps.length} steps` : `not wrapped: ${unstepped.join(", ")}`,
  );
  const bareAwaits = [...crisis.matchAll(/=\s*await (sweep\w+|watchdog)\(/g)].map((m) => m[1]);
  check(
    "…and none is awaited bare",
    bareAwaits.length === 0,
    bareAwaits.length === 0 ? "no bare awaits" : bareAwaits.join(", "),
  );
  check(
    "…with the alert retry first",
    crisis.indexOf("sweepUndeliveredAlerts") >= 0 &&
      crisisSteps.every((name) => crisis.indexOf(name) >= crisis.indexOf("sweepUndeliveredAlerts")),
  );
  check(
    "…and the job reports the steps that failed",
    /failedSteps: failed\.join\(","\) \|\| undefined/.test(crisis),
  );
  check(
    "the licence sweep kept its daily cadence: it moved to retention, inside step()",
    !/sweepLicences\(\)/.test(crisis) &&
      /step\(failed, "sweepLicences", \(\) => sweepLicences\(\)\)/.test(jobBody(route, "retention", "reminders")),
  );

  /* ============================================ 2 · check-ins, hourly */
  console.log("\n2. check-ins reach Egypt");

  const reminders = jobBody(route, "reminders", "webhooks");
  const billing = jobBody(route, "billing", "radar");
  check(
    "🔴 sweepCheckins runs in the hourly reminders job, inside step()",
    /step\(failed, "sweepCheckins", \(\) => sweepCheckins\(\)\)/.test(reminders),
  );
  check("…and no longer in the daily billing job", billing !== "" && !/sweepCheckins/.test(billing));
  check("…and reminders is hourly", hourly(scheduleOf("reminders")), scheduleOf("reminders"));

  const { shouldSend, MIN_HOURS_BETWEEN } = await import("../lib/checkins/policy");
  const policy = { enabled: true, everyHours: 24, quietFromHour: 21, quietToHour: 9, muteRateHalt: 0.2 };
  const base = { settings: policy, muteRate: 0, muted: false, reachable: true, lastSentAt: null };
  const at = (iso: string) => new Date(iso);
  const cairoAtOldRun = shouldSend({ ...base, timezone: "Africa/Cairo", now: at("2026-09-25T03:05:00Z") });
  check(
    "CONTROL: at the old 03:05 UTC run, a Cairo patient is inside their quiet window",
    !cairoAtOldRun.send && cairoAtOldRun.because === "quiet_hours",
    JSON.stringify(cairoAtOldRun),
  );
  const cairoMidday = shouldSend({ ...base, timezone: "Africa/Cairo", now: at("2026-09-25T09:20:00Z") });
  check("🔴 …and an hourly run reaches them in their own daytime", cairoMidday.send, JSON.stringify(cairoMidday));
  const anHourLater = shouldSend({
    ...base,
    timezone: "Africa/Cairo",
    lastSentAt: at("2026-09-25T09:20:00Z"),
    now: at("2026-09-25T10:20:00Z"),
  });
  check(
    "🔴 the next hourly run does not send again: everyHours is per person",
    !anHourLater.send && anHourLater.because === "too_soon",
    JSON.stringify(anHourLater),
  );
  const typedOne = shouldSend({
    ...base,
    settings: { ...policy, everyHours: 1 },
    timezone: "Africa/Cairo",
    lastSentAt: at("2026-09-25T09:20:00Z"),
    now: at("2026-09-25T11:20:00Z"),
  });
  check(
    `…and a setting of 1 hour is still clamped to ${MIN_HOURS_BETWEEN}, so hourly runs cannot become hourly messages`,
    !typedOne.send && typedOne.because === "too_soon",
  );
  const send = readSource("lib/checkins/send.ts");
  check(
    "🔴 two overlapping runs cannot both send: the sweep claims a lease first and releases it after",
    /claimLease\(LEASE, LEASE_MINUTES\)/.test(send) && /finally \{\s*await releaseLease\(LEASE\)/.test(send) &&
      send.indexOf("claimLease(") < send.indexOf("sweepUnderLease(limit)"),
  );

  /* ============================================ 3 + 4 · the environment rules */
  console.log("\n3 and 4. the environment rules");

  const envModule = await import("../lib/env");
  const { inspectEnv, REQUIRED_IN_PRODUCTION, REQUIRED_WHEN_STRIPE_ENABLED, REQUIRED_ON_LIVE_DEPLOYMENT } = envModule;
  const prod = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    OPENAI_API_KEY: "sk-x",
    APP_URL: "https://x",
    CRON_SECRET: "cron-x",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    AUTH_SECRET: "a".repeat(48),
  };
  const errors = (vars: Record<string, string>) =>
    inspectEnv(vars as NodeJS.ProcessEnv).filter((p) => p.level === "error").map((p) => p.message);

  check(
    "🔴 ruling 17: production boots without STRIPE_WEBHOOK_SECRET while Stripe is off",
    errors(prod).length === 0 && !(REQUIRED_IN_PRODUCTION as readonly string[]).includes("STRIPE_WEBHOOK_SECRET"),
    errors(prod).join("; ") || "no errors",
  );
  check(
    "…and refuses to boot without it once STRIPE_ENABLED=true",
    errors({ ...prod, STRIPE_ENABLED: "true" }).some((m) => m.startsWith("STRIPE_WEBHOOK_SECRET")) &&
      errors({ ...prod, STRIPE_ENABLED: "true", STRIPE_WEBHOOK_SECRET: "whsec_x" }).length === 0,
  );
  check(
    "🔴 the live deployment refuses to boot without RESEND_API_KEY",
    errors({ ...prod, VERCEL_ENV: "production" }).some((m) => m.startsWith("RESEND_API_KEY")) &&
      errors({ ...prod, VERCEL_ENV: "production", RESEND_API_KEY: "re_x" }).length === 0,
  );
  check(
    "…while a preview deployment only warns",
    errors({ ...prod, VERCEL_ENV: "preview" }).length === 0 &&
      inspectEnv({ ...prod, VERCEL_ENV: "preview" } as NodeJS.ProcessEnv).some(
        (p) => p.level === "warn" && p.message.startsWith("RESEND_API_KEY"),
      ),
  );
  check(
    "CONTROL: the other production requirements are unchanged, each one still refused when missing",
    ["DATABASE_URL", "OPENAI_API_KEY", "APP_URL", "CRON_SECRET", "BLOB_READ_WRITE_TOKEN"].every((key) => {
      const without: Record<string, string> = { ...prod };
      delete without[key];
      return errors(without).some((m) => m.startsWith(key));
    }),
  );
  const sprint16 = readSource("scripts/verify-sprint16.ts");
  check(
    "verify:sprint16's production child is given every list lib/env requires, derived rather than typed",
    ["REQUIRED_IN_PRODUCTION", "REQUIRED_WHEN_STRIPE_ENABLED", "REQUIRED_ON_LIVE_DEPLOYMENT"].every((name) =>
      new RegExp(`\\.\\.\\.${name}`).test(sprint16),
    ),
    `${REQUIRED_IN_PRODUCTION.length} + ${REQUIRED_WHEN_STRIPE_ENABLED.length} + ${REQUIRED_ON_LIVE_DEPLOYMENT.length} keys`,
  );

  const admin = readSource("app/(admin)/layout.tsx");
  const messages = read("lib/i18n/messages.ts");
  const bothLanguages = (key: string) => (messages.match(new RegExp(`"${key.replace(".", "\\.")}":`, "g")) ?? []).length === 2;
  check(
    "🔴 the admin console shows a banner when email or WhatsApp is not configured",
    /features\.email \? null : t\("anav\.emailOff"\)/.test(admin) &&
      /whatsappConfigured\(\) \? null : t\("anav\.whatsappOff"\)/.test(admin) &&
      /role="alert"/.test(admin),
  );
  check(
    "…in English and Arabic",
    bothLanguages("anav.emailOff") && bothLanguages("anav.whatsappOff"),
  );

  /* ============================================ 5 · the heartbeat and the alert */
  console.log("\n5. the heartbeat and the alert");

  const migrations = readdirSync("drizzle").filter((name) => /^0165_.*\.sql$/.test(name));
  const migration = migrations[0] ? read(join("drizzle", migrations[0])) : "";
  const journal = JSON.parse(read("drizzle/meta/_journal.json")) as { entries: { tag: string; when: number }[] };
  const entry = journal.entries.find((e) => e.tag === migrations[0]?.replace(/\.sql$/, ""));
  check(
    "🔴 migration 0165 creates the heartbeat, alert and lease tables",
    migrations.length === 1 &&
      ["cron_heartbeats", "ops_alerts", "cron_leases"].every((t) => migration.includes(`CREATE TABLE IF NOT EXISTS "${t}"`)),
    migrations.join(", ") || "no 0165 file",
  );
  check(
    "…and is in the journal, after every entry before it and before every one after",
    Boolean(entry) &&
      journal.entries.every((e, i) => {
        const at = journal.entries.indexOf(entry!);
        return i === at || (i < at ? e.when < entry!.when : e.when > entry!.when);
      }),
    entry ? `${entry.tag} @ ${entry.when}` : "missing",
  );
  check(
    "…seeding a heartbeat for every scheduled job, so a job that never runs is still late",
    vercel.crons.every((c) => migration.includes(`('${c.path.replace("/api/cron/", "")}', now())`)),
  );
  check(
    "every cron run records a heartbeat, clean or thrown",
    /await recordHeartbeat\(job, \{ failedSteps \}\)/.test(route) && /await recordHeartbeat\(job, \{ threw: true \}\)/.test(route),
  );

  const heartbeat = await import("../lib/observability/heartbeat");
  const intervalOf = (schedule: string) => (hourly(schedule) ? 1 : daily(schedule) ? 24 : NaN);
  const disagreements = vercel.crons
    .map((c) => [c.path.replace("/api/cron/", ""), intervalOf(c.schedule)] as const)
    .filter(([job, hours]) => heartbeat.CRON_INTERVAL_HOURS[job] !== hours);
  check(
    "🔴 the watchdog's idea of each schedule matches vercel.json",
    disagreements.length === 0 && Object.keys(heartbeat.CRON_INTERVAL_HOURS).length === vercel.crons.length,
    disagreements.length === 0 ? `${vercel.crons.length} jobs` : JSON.stringify(disagreements),
  );
  check("…and a job is late at twice its interval", heartbeat.OVERDUE_FACTOR === 2);

  const watchdogSource = readSource("lib/observability/heartbeat.ts");
  check(
    "🔴 the watchdog runs hourly, in both hourly jobs, so either stopping is noticed by the other",
    /step\(failed, "watchdog", \(\) => watchdog\(\)\)/.test(crisis) &&
      /step\(failed, "watchdog", \(\) => watchdog\(\)\)/.test(reminders),
  );
  check(
    "…emails the super admins through notify, with its own kind",
    /eq\(users\.role, "super_admin"\)/.test(watchdogSource) &&
      /kind: "ops\.watchdog"/.test(watchdogSource) &&
      /\| "ops\.watchdog"/.test(readSource("lib/notify/index.ts")),
  );
  check(
    "🔴 …at most once per problem per day: the ops_alerts row is claimed BEFORE the email",
    /onConflictDoNothing\(\)/.test(watchdogSource) &&
      watchdogSource.indexOf(".insert(opsAlerts)") < watchdogSource.indexOf("await notify("),
  );
  check(
    "…and reports only server errors from the last hour, grouped, top five",
    /eq\(errorEvents\.kind, "server"\)/.test(watchdogSource) && /\.limit\(5\)/.test(watchdogSource),
  );
  const sample =
    "Could not parse 'Sara feels hopeless tonight' for jane.doe@example.com at row 12345: patient said \"help\"";
  const scrubbed = heartbeat.alertSafeMessage(sample);
  check(
    "🔴 an alert never carries patient data: quoted words, emails and numbers are removed",
    !/Sara|hopeless|jane|example\.com|12345|help/.test(scrubbed) && scrubbed.length <= 120,
    scrubbed,
  );

  /* ============================================ 6 · the design gallery */
  console.log("\n6. the design gallery");

  const guard = readSource("app/design/_ds/guard.ts");
  check(
    "🔴 the gallery guard is not found on the live deployment unless a super admin is signed in",
    /if \(!env\.liveDeployment\) return;/.test(guard) &&
      /actor\?\.role !== "super_admin"\) notFound\(\)/.test(guard),
  );
  const galleryPages = pagesUnder("app/design");
  const unguarded = [...galleryPages, "app/design/layout.tsx"].filter(
    (file) => !/await guardDesignGallery\(\)/.test(readSource(file)),
  );
  check(
    "🔴 …called from the layout AND every page, because a layout alone can be walked past",
    galleryPages.length > 0 && unguarded.length === 0,
    unguarded.length === 0 ? `${galleryPages.length} pages and the layout` : `unguarded: ${unguarded.join(", ")}`,
  );

  /* ============================================ 7 · loading and error screens */
  console.log("\n7. loading and error screens");

  const groups = ["(public)", "(auth)", "(room)", "(app)", "(clinic)", "(patient)", "(sponsor)", "(partner)", "(admin)", "pay", "join"];
  const missing = groups.flatMap((group) =>
    ["loading.tsx", "error.tsx"].filter((file) => !existsSync(join("app", group, file))).map((file) => `${group}/${file}`),
  );
  check(
    "🔴 every route group has a loading and an error screen",
    missing.length === 0,
    missing.length === 0 ? `${groups.length} groups` : `missing: ${missing.join(", ")}`,
  );
  const leaky = groups
    .map((group) => join("app", group, "error.tsx"))
    .filter((file) => existsSync(file))
    .filter((file) => /error\.message|error\.stack|(?<!=)\{error\s*\}|String\(error\)/.test(readSource(file)));
  const routeError = readSource("components/patient/route-error.tsx");
  check(
    "🔴 no error screen renders the message or the stack",
    leaky.length === 0 && !/error\.message|error\.stack/.test(routeError),
    leaky.length === 0 ? "digest only" : leaky.join(", "),
  );
  const room = readSource("app/(room)/error.tsx");
  check(
    "the new screens read their words from the dictionary, in both languages",
    /t\("error\.roomBody"\)/.test(room) && bothLanguages("error.roomBody") &&
      /RouteError/.test(readSource("app/(public)/error.tsx")) &&
      /RouteError/.test(readSource("app/(auth)/error.tsx")) &&
      ["(public)", "(room)"].every((g) => /t\("common\.loading"\)/.test(readSource(join("app", g, "loading.tsx")))),
  );

  /* ============================================ the database half */
  console.log("\nthe lease and the once-a-day alert, against the database");

  const url = process.env.DATABASE_URL ?? "";
  let tablesThere = false;
  if (url) {
    writesTo();
    const { sql } = await import("drizzle-orm");
    const { controlDb } = await import("../lib/db");
    const found = await controlDb.execute(sql`
      SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_name IN ('cron_heartbeats', 'ops_alerts', 'cron_leases')`);
    tablesThere = Number((found.rows[0] as { n: number } | undefined)?.n ?? 0) === 3;
  }

  await skipUnless(tablesThere, "migration 0165", "the tables are not on this database yet", async () => {
    const { sql } = await import("drizzle-orm");
    const { controlDb } = await import("../lib/db");
    const fixture = `verify-launch-${Date.now().toString(36)}`;
    try {
      const both = await Promise.all([
        heartbeat.claimLease(fixture, 5),
        heartbeat.claimLease(fixture, 5),
      ]);
      check(
        "🔴 of two runs claiming the lease at once, exactly one gets it",
        both.filter(Boolean).length === 1,
        JSON.stringify(both),
      );
      await heartbeat.releaseLease(fixture);
      check("…and once released, the next run gets it", await heartbeat.claimLease(fixture, 5));

      const day = new Date().toISOString().slice(0, 10);
      const insertOnce = () =>
        controlDb.execute(sql`
          INSERT INTO ops_alerts (key, day) VALUES (${fixture}, ${day}::date)
          ON CONFLICT DO NOTHING RETURNING key`);
      const first = await insertOnce();
      const second = await insertOnce();
      check(
        "🔴 the same alert on the same day is claimed once",
        first.rows.length === 1 && second.rows.length === 0,
      );

      await heartbeat.recordHeartbeat(fixture, { failedSteps: "someStep" });
      const [beat] = (
        await controlDb.execute(sql`SELECT last_success_at, failed_steps FROM cron_heartbeats WHERE job = ${fixture}`)
      ).rows as { last_success_at: string | null; failed_steps: string | null }[];
      check(
        "a run with a failed step records the run but not a clean success",
        beat?.last_success_at === null && beat?.failed_steps === "someStep",
      );
    } finally {
      await controlDb.execute(sql`DELETE FROM cron_leases WHERE name = ${fixture}`);
      await controlDb.execute(sql`DELETE FROM ops_alerts WHERE key = ${fixture}`);
      await controlDb.execute(sql`DELETE FROM cron_heartbeats WHERE job = ${fixture}`);
    }
  });

  finish("launch blockers");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
