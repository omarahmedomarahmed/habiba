/**
 * Boot guard. Runs in module scope so a serverless cold start cannot skip it.
 *
 * This is the one piece of the old backend carried over almost verbatim: it had
 * a real test suite behind it and it is the only thing that ever stopped a
 * deploy going out with a default secret.
 */

const KNOWN_WEAK_SECRETS = new Set([
  "",
  "secret",
  "change-me",
  "change-me-in-production",
  "dev-only-secret-change-me",
  "fallback-secret",
  "your-secret-here",
  "auth-secret",
  "cookie-secret",
  "jwt-secret",
]);

/**
 * Vars without which the app must refuse to start in production.
 *
 * 🔴 EXPORTED, because `verify:sprint16` spawns a production child to prove C37
 * and has to supply every one of them. It used to carry a hand-copied list,
 * which went stale the moment this one grew and reported a money-safety
 * property as BROKEN because a key was missing. A list in two places is a list
 * that disagrees with itself.
 */
export const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  /*
   * 🔴 MOVED UP FROM RECOMMENDED, because "recommended" meant one console.warn
   * and then every scheduled job returning 401 forever.
   *
   * The scheduled-job route is fail-closed on this, which is right. What
   * was wrong is the pairing: a production deploy that forgot the variable
   * booted cleanly, warned once into a log nobody reads, and then silently
   * stopped running:
   *
   *   - `sweepUndeliveredAlerts`, which that file itself calls the single most
   *     safety-relevant scheduled job in the system. A crisis alert whose
   *     notification insert failed stays pending FOREVER and never reaches a
   *     clinician
   *   - `sweepOverrunSessions`, so sessions stay in_progress and their
   *     clinician stays marked unavailable on the public radar
   *   - `releaseAllHeldEarnings`, which is other people's money
   *   - `lapseOverdue`, dunning, and every appointment reminder
   *
   * Nothing anywhere surfaces "the crons have not run". A missing secret that
   * silently disables the crisis sweeper is not a degraded feature.
   */
  "CRON_SECRET",
  /*
   * 🔴 AND THIS ONE BLOCKS ONBOARDING ENTIRELY, which nothing said either.
   *
   * Without it `uploadsConfigured()` is false and every upload returns "File
   * uploads are not configured on this deployment". That is:
   *
   *   - therapist verification: identity document, licence, headshot. So
   *     `isCleared` never returns true, `requireVerified` bounces every
   *     clinician back to /onboarding forever, and NOBODY can go on the radar
   *     or start a session
   *   - the Egyptian transfer receipt, so a patient who attaches the screenshot
   *     their bank app produced is hard-blocked from declaring payment
   *
   * It was in neither list and not in `.env.example`, which made it the
   * clearest "works in dev, fails only in production" hazard in the product:
   * locally you set ALLOW_LOCAL_UPLOADS=1 and never find out.
   */
  "BLOB_READ_WRITE_TOKEN",
] as const;

/** Vars whose absence degrades a feature but must not stop the boot. */
const RECOMMENDED = [
  "DAILY_API_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

/**
 * 🔴 76.43 — THE SIMULATION BRANCH, AND THE DATABASE IT IS ALLOWED TO TOUCH.
 *
 * ## The failure this refuses
 *
 * The six month simulation runs as its own deployment off its own git branch,
 * and the one thing it must never do is write into the live product. It creates
 * clinics, patients, sessions, payments and ledger entries by the hundred; a
 * deployment pointed at the wrong database would put all of it on the real
 * board, and nothing about the running product would look wrong while it
 * happened.
 *
 * Vercel scopes environment variables per branch, which is the right mechanism
 * and is also a checkbox in a dashboard. A checkbox nobody ticked is the most
 * likely way this goes wrong, and it fails silently: the deploy is green, the
 * pages render, and the damage is in a database.
 *
 * So the branch name and the database endpoint are checked against each other
 * on boot, in both directions:
 *
 *   - the simulation branch may ONLY reach the simulation database
 *   - and no other deployment may reach it, because a production build serving
 *     the simulation's cast as if they were customers is the same mistake
 *     mirrored
 *
 * `VERCEL_GIT_COMMIT_REF` is set by Vercel at build and at runtime. Absent
 * locally, which is why every check here is skipped when it is.
 *
 * 🔴 THE ENDPOINT, NOT THE VARIABLE NAME. A variable is a label somebody typed;
 * the endpoint is where the bytes go.
 */
/**
 * 🔴 76.49 — THE SWITCH THAT SAYS A SIMULATION IS RUNNING ON THIS DEPLOYMENT.
 *
 * ## The hole this closes, and it was found by testing rather than reasoning
 *
 * The decision to run the six month simulation on production rested partly on
 * "production is not publicly reachable", read off Vercel's SSO setting, which
 * protects everything `all_except_custom_domains`. That was inferred and it was
 * WRONG, and that setting is the reason rather than the exception: a custom
 * domain is precisely what `all_except_custom_domains` does NOT cover. So
 * `24therapy.app` answers 200 to anybody, and so does the `24t.vercel.app`
 * subdomain still attached beside it, both
 * with no sign-in. `robots.txt` allows `/radar`, and the radar page carries
 * `index, follow` on purpose, because somebody searching "talk to a therapist
 * now" is exactly who it is for.
 *
 * So during a run, nine invented clinicians carrying `DEMO-` licence numbers
 * would be on a public page, bookable by a stranger and crawlable by Google.
 * That is the disclosure `scripts/demo.ts` warns about in its own header and the
 * reason every write script refuses production by name.
 *
 * ## What this does
 *
 * Set on the deployment for the duration of the run. While it is set:
 *
 *   - `robots.txt` disallows everything rather than allowing the marketing
 *     pages and the radar
 *   - the violet strip renders on every page, so a deployment left in this
 *     state announces itself rather than hiding
 *
 * ## 🔴 WHY A LOUD SWITCH RATHER THAN A QUIET ONE
 *
 * A flag that changes how production behaves is a flag somebody leaves on. The
 * mitigation is not discipline, it is that leaving it on is impossible to miss:
 * every page in the product grows a violet bar naming the database. A silent
 * `noindex` would be the version nobody notices for a month.
 *
 * It does NOT stop a person who has the URL. Nothing here can, short of taking
 * the site down, and the run needs the site up because the point is to test the
 * journeys a real patient walks. What it stops is the permanent half: an index
 * entry outlives the run and the restore both.
 */
export const SIMULATION_RUNNING = process.env.SIMULATION_RUNNING === "1";

export const SIMULATION_BRANCH = "simulation";
export const SIMULATION_ENDPOINT = "ep-empty-queen-a62vlkkp";

export type EnvProblem = { level: "error" | "warn"; message: string };

export function inspectEnv(
  env: NodeJS.ProcessEnv = process.env,
): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!env[key]) {
        problems.push({ level: "error", message: `${key} is required in production` });
      }
    }
    for (const key of RECOMMENDED) {
      if (!env[key]) {
        problems.push({
          level: "warn",
          message: `${key} is not set, the feature it powers will degrade`,
        });
      }
    }
  }

  /*
   * 🔴 76.43 — the branch and the database have to agree. See above.
   *
   * Checked in every environment rather than only in production, because a
   * preview deployment is exactly what the simulation is, and `NODE_ENV` on a
   * Vercel preview is `production` anyway.
   */
  const branch = env.VERCEL_GIT_COMMIT_REF;
  const url = env.DATABASE_URL ?? "";
  if (branch) {
    const onSimulationBranch = branch === SIMULATION_BRANCH;
    const onSimulationDatabase = url.includes(SIMULATION_ENDPOINT);

    if (onSimulationBranch && !onSimulationDatabase) {
      problems.push({
        level: "error",
        message:
          `this deployment is the ${SIMULATION_BRANCH} branch but DATABASE_URL does not point at ` +
          `${SIMULATION_ENDPOINT}. Scope DATABASE_URL to this branch in the Vercel project's ` +
          "environment variables. A simulation writing into another database puts hundreds of " +
          "invented sessions on a real board.",
      });
    }

    if (!onSimulationBranch && onSimulationDatabase) {
      problems.push({
        level: "error",
        message:
          `DATABASE_URL points at the simulation database (${SIMULATION_ENDPOINT}) on branch ` +
          `"${branch}". Only the ${SIMULATION_BRANCH} branch may read it: everybody in it is invented.`,
      });
    }
  }

  // AUTH_SECRET is checked in every environment: a weak value in dev has a
  // habit of being copied into prod.
  const secret = env.AUTH_SECRET ?? "";
  if (isProd) {
    if (!secret) {
      problems.push({ level: "error", message: "AUTH_SECRET is required in production" });
    } else if (KNOWN_WEAK_SECRETS.has(secret.toLowerCase())) {
      problems.push({ level: "error", message: "AUTH_SECRET is a known placeholder value" });
    } else if (secret.length < 32) {
      problems.push({
        level: "error",
        message: "AUTH_SECRET must be at least 32 characters (`openssl rand -hex 32`)",
      });
    }
  }

  return problems;
}

function assertEnv() {
  /**
   * Skip during `next build`.
   *
   * The build compiles and prerenders; it does not serve traffic, and a build
   * machine has no business needing a Stripe webhook secret. Validating here
   * would make a missing runtime credential fail the build rather than fail
   * loudly on boot, which is both later feedback and the wrong signal.
   * `NEXT_PHASE` is set by Next itself for exactly this distinction.
   */
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const problems = inspectEnv();
  const errors = problems.filter((p) => p.level === "error");
  for (const p of problems.filter((p) => p.level === "warn")) {
    console.warn(`[env] ${p.message}`);
  }
  if (errors.length > 0) {
    throw new Error(
      `Refusing to start, invalid environment:\n${errors.map((e) => `  - ${e.message}`).join("\n")}`,
    );
  }
}

assertEnv();

function required(key: string, devFallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && devFallback !== undefined) {
    return devFallback;
  }
  throw new Error(`Missing required environment variable: ${key}`);
}

/**
 * `DATABASE_SSL` is deliberately tri-state. `undefined` is not `false`:
 * unset means "on in production, off locally". Collapsing it to a boolean
 * breaks either Neon or local Postgres, and it has broken both before.
 */
function resolveSsl(): boolean {
  const raw = process.env.DATABASE_SSL;
  if (raw === undefined || raw === "") return process.env.NODE_ENV === "production";
  return raw !== "false" && raw !== "0";
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",

  databaseUrl: required("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/24therapy"),
  /** Non-pooled connection for maintenance that cannot run through PgBouncer. */
  databaseUrlDirect: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "",
  databaseSsl: resolveSsl(),

  authSecret: required("AUTH_SECRET", "dev-insecure-secret-not-for-production-use-0123"),

  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  /** Override the OpenAI endpoint. Used for end-to-end testing against a mock. */
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "",
  dailyApiKey: process.env.DAILY_API_KEY || "",

  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",

  /*
   * 🔴 64.1 — THE EGYPTIAN RAIL, AND BOTH OF THESE ARE EMPTY ON PURPOSE.
   *
   * Sprint 64 is blocked on a licensed Egyptian entity, a merchant account and a
   * signed gateway contract. These exist so `whatTheRailNeeds()` can name what is
   * missing in a sentence an operator can act on, rather than the product discovering
   * the absence when somebody in Cairo tries to pay.
   *
   * No vendor is named here either. Which gateway goes behind these is a decision
   * nobody has made, and putting one in an environment variable name would be making
   * it in a place nobody reviews.
   */
  egyptGatewayKey: process.env.EGYPT_GATEWAY_KEY || "",
  egyptMerchantId: process.env.EGYPT_MERCHANT_ID || "",
  /*
   * Which adapter sits behind the seam (`lib/billing/gateway`): empty for none,
   * `fake` for the development simulator, or the contracted adapter's name once
   * one is written. The callback signing secret is the gateway's own.
   */
  egyptGateway: (process.env.EGYPT_GATEWAY || "").trim().toLowerCase(),
  egyptGatewayHmac: process.env.EGYPT_GATEWAY_HMAC || "",
  /* The payouts provider, by the same three rules. */
  egyptPayouts: (process.env.EGYPT_PAYOUTS || "").trim().toLowerCase(),
  egyptPayoutsKey: process.env.EGYPT_PAYOUTS_KEY || "",
  egyptPayoutsHmac: process.env.EGYPT_PAYOUTS_HMAC || "",
  /**
   * The deployment real people use. Not `isProduction`, which is also true of
   * `next start` on a laptop; a simulator is refused only where it could take
   * a real patient's payment for a pretend one.
   */
  liveDeployment: process.env.VERCEL_ENV === "production",

  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "24Therapy <noreply@24therapy.app>",

  cronSecret: process.env.CRON_SECRET || "",

  /*
   * 🔴 41.3 / 41.6 — the meeting bot's three secrets.
   *
   * `tokenEncryptionKey` seals a clinician's OAuth refresh token, which is the
   * one secret in this product that has to come back out again (see
   * lib/crypto/secretbox.ts). Absent, connecting a meeting account is refused
   * rather than done in plaintext.
   *
   * Read at module load like everything else here, and read AGAIN inside
   * `secretbox.ts`, because a verifier that sets the variable and then imports
   * would otherwise get whatever the process started with.
   */
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "",
  recallApiKey: process.env.RECALL_API_KEY || "",
  recallBaseUrl: process.env.RECALL_BASE_URL || "https://api.recall.ai",

  /*
   * 🔴 43.2 — ONE CLIENT ID FOR THE WHOLE PRODUCT, AND NO PER-HOSPITAL SECRET HERE.
   *
   * We are the OAuth client, so these are OUR credentials with the vendor, registered out of
   * band, and they are the same whichever hospital is connecting. A hospital's own tenant is
   * identified by the FHIR base URL on its `ehr_connections` row, never by a second secret.
   *
   * The secret is optional on purpose: SMART's public-client profile uses PKCE and no secret,
   * which is what a browser-launched connection uses, and the confidential profile adds one for
   * server-to-server refresh. A deployment with neither has no EHR feature, which `features.ehr`
   * reports rather than discovering at the token exchange.
   */
  ehrClientId: process.env.EHR_CLIENT_ID || "",
  ehrClientSecret: process.env.EHR_CLIENT_SECRET || "",

} as const;

/** Feature availability, derived — never a separate FEATURE_* flag. */
export const features = {
  get ai() {
    return Boolean(env.openaiApiKey);
  },
  get video() {
    return Boolean(env.dailyApiKey);
  },
  get billing() {
    return Boolean(env.stripeSecretKey);
  },
  get email() {
    return Boolean(env.resendApiKey);
  },
  /*
   * 🔴 41.3 — BOTH, and the page says which half is missing.
   *
   * A bot with no way to seal a refresh token cannot hold a connection, and a
   * sealed connection with no bot to dispatch is a Connect button that leads
   * nowhere. Either alone is a screen that lies about what it can do, which is
   * the exact defect `lib/integrations/registry.ts` exists to prevent.
   */
  get meetingBots() {
    return Boolean(env.recallApiKey) && Boolean(env.tokenEncryptionKey);
  },
  /*
   * 🔴 43.1c — BOTH, and the Connect screen says which half is missing.
   *
   * The same argument as `meetingBots` one ticket over: a client id with no way to seal a refresh
   * token cannot hold a connection past its first hour, and a sealing key with no client id is a
   * Connect button that leads to a vendor error page. Either alone is a screen that lies about
   * what it can do, which is what `lib/integrations/registry.ts` exists to prevent.
   */
  get ehr() {
    return Boolean(env.ehrClientId) && Boolean(env.tokenEncryptionKey);
  },
};
