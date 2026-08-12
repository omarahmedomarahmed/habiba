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

/** Vars without which the app must refuse to start in production. */
const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
] as const;

/** Vars whose absence degrades a feature but must not stop the boot. */
const RECOMMENDED = [
  "DAILY_API_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET",
] as const;

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
          message: `${key} is not set — the feature it powers will degrade`,
        });
      }
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
      `Refusing to start — invalid environment:\n${errors.map((e) => `  - ${e.message}`).join("\n")}`,
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

  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "24Therapy <noreply@24therapy.ai>",

  cronSecret: process.env.CRON_SECRET || "",

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
};
