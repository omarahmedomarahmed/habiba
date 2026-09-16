/**
 * 🔴 76.42 — THE THREE DATABASES THIS PRODUCT HAS, NAMED, WITH ONE VARIABLE EACH.
 *
 * ## Why this file exists
 *
 * Every script in this repository reads `DATABASE_URL` and does what it is told.
 * That is correct for a script that operates on one database and it is the
 * whole problem for a question about three: "do production, dev and the
 * simulation hold the same settings" cannot be asked by a process that can only
 * see one of them at a time.
 *
 * It was also the shape of the worst near miss of sprint 76. `.env.local`
 * pointed at PRODUCTION for part of an afternoon while write scripts were being
 * run, and nothing in the repository could have said so, because the only thing
 * any of them knew was "a URL". An environment with a NAME can be printed, and
 * a host that matches no name is a fact worth shouting about.
 *
 * ## 🔴 THE ENDPOINT IS PART OF THE DECLARATION, DELIBERATELY
 *
 * A variable called `DATABASE_URL_PRODUCTION` holding the dev branch is a
 * variable that lies, and nothing about its name would stop it. Each entry
 * carries the Neon endpoint host it is supposed to reach, so a mismatch is
 * caught by comparing the URL against its own label rather than by trusting it.
 *
 * Those hosts are not secrets. They are in `HAZARDS.md`, in the Neon console
 * and in half the comments in `scripts/`. The password is the secret and it
 * lives in `.env.local`, which is gitignored and which the founder rotates.
 */
export type EnvironmentName = "production" | "dev" | "simulation";

export type Environment = {
  name: EnvironmentName;
  /** The environment variable holding this one's connection string. */
  variable: string;
  /** The Neon compute endpoint this variable must point at. */
  endpoint: string;
  /** The Neon branch, for a person reading a failure. */
  branch: string;
  /** What this database is for, in one line. */
  purpose: string;
};

export const ENVIRONMENTS: Environment[] = [
  {
    name: "production",
    variable: "DATABASE_URL_PRODUCTION",
    endpoint: "ep-wild-lake-a6tgm2r6",
    branch: "main",
    purpose: "the live product. Nothing in this repository writes to it without a typed override.",
  },
  {
    name: "dev",
    variable: "DATABASE_URL_DEV",
    endpoint: "ep-aged-dust-a6huadss",
    branch: "sprint-1-settings",
    purpose: "what the gates run against, and what `npm run dev` points at.",
  },
  {
    name: "simulation",
    variable: "DATABASE_URL_SIMULATION",
    endpoint: "ep-empty-queen-a62vlkkp",
    branch: "simulation-q1",
    purpose: "the six month run, and the database the deployed simulation reads.",
  },
];

/**
 * Which of the three a connection string actually reaches, by endpoint.
 *
 * 🔴 Returns null rather than guessing. A URL matching no known endpoint is the
 * interesting case — a throwaway branch, a local Postgres, somebody's laptop —
 * and a function that picked the closest match would turn that into a silent
 * wrong answer.
 */
export function environmentOf(url: string | undefined): Environment | null {
  if (!url) return null;
  return ENVIRONMENTS.find((env) => url.includes(env.endpoint)) ?? null;
}

/** The connection string for one environment, or null when it is not configured. */
export function urlFor(env: Environment): string | null {
  const url = process.env[env.variable];
  return url && url.length > 0 ? url : null;
}
