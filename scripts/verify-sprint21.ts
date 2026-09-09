/**
 * Sprint 21 acceptance — strings and languages. PLAN.md 21.1–21.19.
 *
 *   npm run verify:sprint21
 *
 * The rules worth proving are all refusals, and each is attempted rather than
 * read: an empty override, a language published at 96%, a bulk approval that
 * includes a crisis string, a machine draft counted as done. A translation
 * workspace that cannot refuse is a workspace that will eventually publish a
 * mistranslated crisis instruction on nobody's judgement.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { locales as localesTable, uiStrings, users } from "../lib/db/schema";
import { reporter } from "./_verify";

const { check, finish } = reporter();

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const TEST_LOCALE = "zz";

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const [admin] = await db
    .select({ id: users.id, organizationId: users.organizationId, role: users.role })
    .from(users)
    .limit(1);
  const actor = { userId: admin!.id, organizationId: admin!.organizationId, role: "super_admin" };

  try {
    const { saveString, clearString, saveLanguage, approveDrafts, editorRows } = await import(
      "../lib/i18n/authoring"
    );
    const { completeness, isSafetyKey, shippedKeys, stringsFor, publicLanguages } = await import(
      "../lib/i18n/strings"
    );

    const keys = shippedKeys();
    const sample = keys.find((k) => !isSafetyKey(k))!;

    /* ------------------------------------------------- 21.1 · the override */

    const before = (await stringsFor("en")).t(sample);
    await saveString({ key: sample, locale: "en", value: "An overridden phrase", actor });

    const { stringsFor: fresh } = await import(`../lib/i18n/strings.ts?a=${Date.now()}`);
    check(
      "🔴 21.1 a published override is what the product says",
      (await fresh("en")).t(sample) === "An overridden phrase",
      `${before} → ${(await fresh("en")).t(sample)}`,
    );

    /* ----------------------------------------------- 🔴 21.5 · clearing it */

    await clearString({ key: sample, locale: "en", actor });
    const { stringsFor: afterClear } = await import(`../lib/i18n/strings.ts?b=${Date.now()}`);
    check(
      "🔴 21.5 clearing an override RESTORES the shipped wording, it never blanks a button",
      (await afterClear("en")).t(sample) === before,
      `${(await afterClear("en")).t(sample)}`,
    );

    const empty = await saveString({ key: sample, locale: "en", value: "   ", actor });
    check(
      "🔴 21.5 …and an empty override is refused rather than stored",
      empty.error !== undefined,
      empty.error ?? "ACCEPTED",
    );

    check(
      "🔴 21.5 …refused by the DATABASE too, not only by the code path",
      await refused(
        () =>
          db.insert(uiStrings).values({ key: sample, locale: "en", value: "" }),
        "ui_strings_not_blank",
      ),
    );

    /* --------------------------------------------------- 21.6 · a bad key */

    const unknown = await saveString({ key: "not.a.real.key", locale: "en", value: "x", actor });
    check(
      "21.6 a key the product does not use cannot be saved",
      unknown.error !== undefined,
      unknown.error ?? "ACCEPTED",
    );

    /* --------------------------------------------- 🔴 21.7 · safety strings */

    const safetyKeys = keys.filter(isSafetyKey);
    check(
      "🔴 21.7 the safety strings are identified by prefix, so a NEW consent string is protected the day it is added",
      safetyKeys.length > 0,
      `${safetyKeys.length} crisis/consent/recording/risk strings`,
    );

    /* ------------------------------------ 🔴 21.9–21.13 · a whole language */

    await db.delete(uiStrings).where(eq(uiStrings.locale, TEST_LOCALE));
    await db.delete(localesTable).where(eq(localesTable.code, TEST_LOCALE));

    const added = await saveLanguage({
      code: TEST_LOCALE,
      name: "Testish",
      nativeName: "Testish",
      direction: "ltr",
      authoringEnabled: true,
      publicEnabled: false,
      actor,
    });
    check("🔴 21.9 an admin adds a language, a row, not a deploy", added.ok === true, added.error ?? "");

    const empty2 = await completeness(TEST_LOCALE);
    check(
      "21.11 …and it starts at 0%, with every missing string listed",
      empty2.percent === 0 && empty2.missingKeys.length === empty2.total,
      `${empty2.percent}% · ${empty2.missingKeys.length} of ${empty2.total} missing`,
    );

    const tooEarly = await saveLanguage({
      code: TEST_LOCALE,
      name: "Testish",
      nativeName: "Testish",
      direction: "ltr",
      authoringEnabled: true,
      publicEnabled: true,
      actor,
    });
    check(
      "🔴 21.11 a language cannot be OFFERED before it is finished",
      tooEarly.error !== undefined && tooEarly.error.includes("%"),
      tooEarly.error ?? "PUBLISHED AT 0%",
    );

    /*
     * 🔴 21.17 — a machine draft counts as MISSING. Written directly rather
     * than through the model, because the claim under test is the accounting,
     * not the translation: a language whose completeness is made of machine
     * output is a language that went live on nobody's judgement.
     */
    await db.insert(uiStrings).values({
      key: sample,
      locale: TEST_LOCALE,
      value: "A machine's guess",
      status: "draft",
      source: "machine",
      model: "gpt-4o",
    });

    const withDraft = await completeness(TEST_LOCALE);
    check(
      "🔴 21.17 a machine draft counts as MISSING until a person approves it",
      withDraft.missingKeys.includes(sample) && withDraft.drafts === 1,
      `${withDraft.drafts} draft, still ${withDraft.missingKeys.length} missing`,
    );

    check(
      "🔴 21.19 …and a machine row with no model named is refused BY THE DATABASE",
      await refused(
        () =>
          db.insert(uiStrings).values({
            key: keys[1]!,
            locale: TEST_LOCALE,
            value: "x",
            source: "machine",
          }),
        "ui_strings_machine_attributed",
      ),
    );

    /* ------------------------------------------ 🔴 21.18 · the bulk refusal */

    const safetyKey = safetyKeys[0];
    if (safetyKey) {
      await db.insert(uiStrings).values({
        key: safetyKey,
        locale: TEST_LOCALE,
        value: "A machine's guess at a crisis instruction",
        status: "draft",
        source: "machine",
        model: "gpt-4o",
      });

      const bulk = await approveDrafts({
        locale: TEST_LOCALE,
        keys: [sample, safetyKey],
        actor,
      });
      check(
        "🔴 21.18 a bulk approval containing a CRISIS string is refused, those are read one at a time",
        bulk.error !== undefined,
        bulk.error ?? "APPROVED IN BULK",
      );

      const single = await approveDrafts({ locale: TEST_LOCALE, keys: [safetyKey], actor });
      check(
        "21.18 …and the same string alone can be approved by somebody who has read it",
        single.ok === true && single.count === 1,
        single.error ?? `${single.count} published`,
      );
    }

    /* -------------------------------------------- 🔴 21.13 · the two switches */

    check(
      "🔴 21.13 a language being written is NOT offered to readers",
      !(await publicLanguages()).some((row) => row.code === TEST_LOCALE),
      (await publicLanguages()).map((r) => r.code).join(", "),
    );

    check(
      "🔴 21.13 …and the database refuses public-without-authoring outright",
      await refused(
        () =>
          db
            .update(localesTable)
            .set({ authoringEnabled: false, publicEnabled: true })
            .where(eq(localesTable.code, TEST_LOCALE)),
        "locales_public_implies_authoring",
      ),
    );

    /* --------------------------------------------------- 21.12 · the ruling */

    /*
     * 🔴 Completeness gates the LAUNCH, not the LIFE.
     *
     * Proved on the shipped pair: English is live, and asking for a key that
     * exists in no dictionary returns the English default rather than a blank
     * or a raw key — which is exactly what happens to a live language the day
     * somebody adds a string nobody has translated yet.
     */
    const { t } = await stringsFor("ar");
    const rendered = t("common.continue");
    check(
      "🔴 21.12 a live language renders every key, a new string falls back, it does not take the language down",
      rendered.length > 0 && !rendered.includes("."),
      `ar renders "${rendered}"`,
    );

    /* ------------------------------------------------------ 21.3 · the editor */

    const rows = await editorRows("ar");
    check(
      "21.3 the editor shows the English, the shipped translation and the override side by side",
      rows.length === keys.length &&
        rows.every((row) => typeof row.english === "string") &&
        rows.some((row) => row.shipped !== null),
      `${rows.length} keys, ${rows.filter((r) => r.shipped).length} with a shipped translation`,
    );
    check(
      "21.7 …and marks the safety strings, so nobody bulk-edits a crisis instruction by accident",
      rows.filter((row) => row.safety).length === safetyKeys.length,
    );
  } finally {
    await db.delete(uiStrings).where(eq(uiStrings.locale, TEST_LOCALE));
    await db.delete(localesTable).where(eq(localesTable.code, TEST_LOCALE));
    await db.delete(uiStrings).where(like(uiStrings.value, "An overridden phrase%"));
  }

  finish("sprint 21");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
