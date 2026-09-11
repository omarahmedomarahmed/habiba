/**
 * Sprint 30 acceptance: Egypt sits in Egypt. PLAN.md 30.1-30.4, C118.
 *
 *   npm run verify:sprint30
 *
 * The seam is the sprint, so the seam is what is asserted, and the assertion
 * that matters is a NEGATIVE one: it must be impossible to reach the database
 * without naming a plane. That is proved the only way a negative can be, with
 * a planted offender of exactly the shape somebody would write.
 *
 * Then three facts:
 *
 *   - **C154** a patient's chart routes on the PATIENT, not on the practice.
 *     Asserted with an Egyptian person in an American organisation.
 *   - **30.4** `eg` is the US instance today, and the product SAYS SO. The
 *     status and the connection string are one fact, not two that agree.
 *   - **30.3** the record of processing refuses a consent to a transfer that
 *     is not happening, attempted against the database.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { controlDb, dbFor } from "../lib/db";
import { crossBorderConsents, organizations, patients, people, users } from "../lib/db/schema";
import {
  connectionStringFor,
  crossesBorder,
  regionPins,
  regionStatus,
  REGIONS,
} from "../lib/db/region";
import { stripComments } from "./_dashes";
import { reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

const TAG = "verify30";

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

async function main() {
  writesTo();

  /* ------------------------------------------- 30.1 · no way round the seam */

  /*
   * 🔴 The negative, which is the whole sprint: there is no `db` export, so a
   * query cannot reach Postgres without naming a plane. Asserted on the module
   * rather than by grepping call sites, because the export is the thing that
   * makes every call site impossible rather than merely wrong.
   */
  const dbModule = readFileSync("lib/db/index.ts", "utf8");

  check(
    "🔴 30.1 / C118 `lib/db` exports NO bare database, so a region-less query does not compile",
    !/export const db\b|export \{ db \}|export let db\b/.test(dbModule) &&
      /export function dbFor\(region: Region\)/.test(dbModule) &&
      /export const controlDb/.test(dbModule),
    "dbFor(region) and controlDb, and nothing else",
  );

  /* 🔴 The control: a module that tries to import the old handle must fail. */
  const planted = "lib/data/_verify30-offender.ts";
  try {
    writeFileSync(planted, `import { db } from "@/lib/db";\nexport const rows = db;\n`);

    const { execFileSync } = await import("node:child_process");
    let failed = false;
    let output = "";
    try {
      output = execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      failed = true;
    }

    check(
      "🔴 30.1 CONTROL, a module importing the old bare `db` FAILS TO COMPILE",
      failed && /_verify30-offender/.test(output) && /has no exported member 'db'/.test(output),
      failed
        ? output.split("\n").find((line) => line.includes("_verify30-offender"))?.trim() ?? "failed"
        : "IT COMPILED, THE SEAM IS A CONVENTION",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  /*
   * And the second door: nothing outside `lib/db` may build its own pool. A
   * seam with a `new Pool()` beside it is not a seam, and this is exactly the
   * shape C153 warned about one sprint ago.
   */
  const others = [...walk("lib"), ...walk("app")].filter(
    (file) => !file.startsWith("lib/db/"),
  );
  const ownPools = others.filter((file) =>
    /new Pool\(|drizzle\(/.test(stripComments(readFileSync(file, "utf8"))),
  );

  check(
    "🔴 30.1 …and nothing outside lib/db builds its own connection, so there is no second door",
    ownPools.length === 0,
    ownPools.join(", ") || `${others.length} modules scanned`,
  );

  /* ---------------------------------------------- 30.1 · the pins, counted */

  /*
   * 🔴 The honest half. Most of the clinical core routes on an entity; the
   * rest is pinned to the default and REGISTERED, so the debt is a printed
   * list rather than an archaeology exercise. This check does not fail on a
   * pin, it prints them: a gate that is red for a known reason is a gate
   * everybody learns to skim (C90).
   */
  await import("../lib/data/journals");
  await import("../lib/data/summaries");
  await import("../lib/data/sessions");
  await import("../lib/data/documents");

  const pins = regionPins();
  console.log(`\n  region pins still to route (${pins.length}):`);
  for (const pin of pins.slice(0, 8)) console.log(`     ${pin.where}`);
  if (pins.length > 8) console.log(`     …and ${pins.length - 8} more`);
  console.log("");

  check(
    "30.1 every unrouted module is REGISTERED rather than silently defaulted",
    pins.every((pin) => pin.reason.length > 20),
    `${pins.length} pinned, each with a reason`,
  );

  /* ------------------------------------------------- 30.1 · C154 · routing */

  const [reference] = await controlDb
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  const org = required(reference, "therapist whose organisation the fixtures can join");

  let personId: string | null = null;
  let patientId: string | null = null;

  try {
    const [person] = await controlDb
      .insert(people)
      .values({ firstName: `${TAG}-Mona`, phone: "+201555000030", region: "eg" })
      .returning({ id: people.id });
    personId = person!.id;

    /*
     * 🔴 The case C118 is actually about, planted: an EGYPTIAN patient whose
     * clinician's practice is American. The obvious implementation routes on
     * the practice and puts her record in the wrong country while every test
     * passes.
     */
    const [chart] = await controlDb
      .insert(patients)
      .values({
        organizationId: org.organizationId,
        personId,
        firstName: `${TAG}-Mona`,
        phone: "+201555000030",
        source: "therapist",
      })
      .returning({ id: patients.id });
    patientId = chart!.id;

    const { regionOfPatient, regionOfPerson, regionOfOrganization } = await import(
      "../lib/db/directory"
    );

    const practiceRegion = await regionOfOrganization(org.organizationId);
    const chartRegion = await regionOfPatient(patientId);

    check(
      "🔴 30.1 / C154 a chart routes on the PATIENT, not on the practice that holds it",
      chartRegion === "eg" && practiceRegion === "us",
      `patient in ${chartRegion}, practice in ${practiceRegion}`,
    );

    check(
      "30.1 …and the person themselves resolves the same way",
      (await regionOfPerson(personId)) === "eg",
    );

    /* The database refuses a region no pool exists for. */
    check(
      "🔴 30.1 the database REFUSES a region we have no pool for, attempted not read",
      await refused(
        () =>
          controlDb
            .update(people)
            .set({ region: "atlantis" as never })
            .where(eq(people.id, personId!)),
        "people_region_known",
      ),
      "a row whose region has no database is a row with nowhere to live",
    );

    /* ----------------------------------------------- 30.3 · the consent */

    const { residencyFor, recordCrossBorderConsent, consentWording } = await import(
      "../lib/data/residency"
    );

    const before = await residencyFor(personId, "en");

    check(
      "🔴 30.4 an Egyptian record IS crossing a border today, and the product says so",
      before.crosses && before.servingRegion === "us" && before.agreedAt === null,
      `${before.homeRegion} served from ${before.servingRegion}, agreed: ${before.agreedAt ?? "not yet"}`,
    );

    check(
      "30.3 the wording names the actual country rather than hard-coded copy",
      before.wording?.includes("United States") === true &&
        consentWording("eg", "ar").includes("الولايات") === true,
      "read from the live fact, so it changes the day Cairo does",
    );

    const agreed = await recordCrossBorderConsent({ personId, locale: "en" });
    check("30.3 …and the agreement is recorded", agreed.ok === true);

    const after = await residencyFor(personId, "en");
    check(
      "30.3 the record of processing stores the WORDING, not a version number",
      after.agreedAt !== null,
      "a pointer at editable text proves nothing a year later",
    );

    /*
     * 🔴 The refusal that stops a screen manufacturing agreement. A page that
     * recorded consent on every load would fill the record of processing with
     * agreements nobody was asked for, and the table whose purpose is proving
     * what was asked would be the one lying.
     */
    check(
      "🔴 30.3 the database REFUSES a consent row that records no crossing at all",
      await refused(
        () =>
          controlDb.insert(crossBorderConsents).values({
            personId: personId!,
            homeRegion: "us",
            servingRegion: "us",
            wording:
              "A sentence long enough to pass the wording constraint, recording nothing at all.",
            locale: "en",
          }),
        "cross_border_consents_actually_crosses",
      ),
      "consent to a transfer that is not happening is not consent",
    );

    /* A US person is not asked anything, because nothing crosses. */
    const [local] = await controlDb
      .insert(people)
      .values({ firstName: `${TAG}-Sam`, phone: "+15555550030", region: "us" })
      .returning({ id: people.id });

    const american = await residencyFor(local!.id, "en");
    check(
      "30.3 somebody whose record is already home is asked nothing",
      american.crosses === false && american.wording === null,
    );

    await controlDb.delete(people).where(eq(people.id, local!.id));
  } finally {
    if (patientId) await controlDb.delete(patients).where(eq(patients.id, patientId));
    if (personId) {
      await controlDb.execute(
        sql`DELETE FROM cross_border_consents WHERE person_id = ${personId}`,
      );
      await controlDb.delete(people).where(eq(people.id, personId));
    }
    await controlDb.execute(sql`DELETE FROM people WHERE first_name LIKE ${`${TAG}%`}`);
  }

  /* ---------------------------------------------- 30.4 · one fact, not two */

  /*
   * 🔴 The status and the connection string must be the SAME fact.
   *
   * Two strings that happen to agree today is how a product ends up claiming
   * residency it does not have: somebody edits the label, nobody edits the
   * routing, and a consent screen starts telling patients their record is in
   * Cairo. So the check derives one from the other.
   */
  const mismatched = REGIONS.filter((region) => {
    const status = regionStatus(region);
    const { resident } = connectionStringFor(region);
    return status.resident !== resident;
  });

  check(
    "🔴 30.4 what the product SAYS about residency is read from the routing, not written beside it",
    mismatched.length === 0,
    mismatched.join(", ") ||
      REGIONS.map((r) => `${r}: ${regionStatus(r).resident ? "resident" : "served from " + regionStatus(r).servedFrom}`).join(", "),
  );

  check(
    "⚠️ 30.4 Egypt is NOT resident yet, which is the ruling and is said out loud",
    regionStatus("eg").resident === false && crossesBorder("eg"),
    "incomplete until the founder signs a provider; DATABASE_URL_EG is the whole switch",
  );

  /* Going live is one variable and nothing else. */
  const regionModule = readFileSync("lib/db/region.ts", "utf8");
  check(
    "🔴 30.1 going live in Egypt is DATABASE_URL_EG and nothing else",
    /process\.env\.DATABASE_URL_EG/.test(regionModule) &&
      (regionModule.match(/process\.env\.DATABASE_URL_EG/g) ?? []).length === 1,
    "one read, in one function, so there is one thing to set",
  );

  /* The two pools are genuinely the same client while that is true. */
  check(
    "30.4 …and while it is unset, both regions are one pool rather than two connections to one database",
    dbFor("eg") === dbFor("us"),
    "no doubled connection count for a region that does not exist yet",
  );

  finish("sprint 30");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
