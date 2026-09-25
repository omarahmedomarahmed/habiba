/**
 * Sprint 69 acceptance: the decisions a person makes, and the money they make them about.
 *
 *   npm run verify:sprint69
 *
 * ## The four things this sprint changed, and the one thing they have in common
 *
 * | | |
 * |---|---|
 * | **C349** | The vault reported income two ways on one screen and neither said it was partial |
 * | **C350** | Egypt has a crisis number now, and a number that answers with a menu needs the menu |
 * | **C351** | A second rejection cost nothing, so it was not a decision |
 * | **C352** | A clinician joining a practice left their verification behind at the old one |
 *
 * All four are the same shape: **something that looked finished because the case
 * that exposes it had not happened yet.** The vault was right until Connect fees
 * mattered. The crisis table was right until Egypt had a line. The resubmission
 * loop was fine until somebody used it twice. The verification row's practice
 * name was cosmetic until a rejected clinician was invited by a practice.
 *
 * So the checks below prefer running the thing to reading the thing. C351's
 * behaviour is proved by rejecting a real fixture twice and looking at what
 * happened to its documents, because a regex over `decideVerification` proves
 * the code says what it says and nothing about what it does.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { connect } from "./db";
import { setRulesForThisCheck, TWO_PEOPLE_EVERYWHERE } from "./_rules";

const { check, finish } = reporter();

const fixture = `verify69-${Date.now().toString(36)}`;

async function main() {
  writesTo();

  /* ================================================================== */
  /*  C350 · the crisis line for the first market                        */
  /* ================================================================== */

  const { CRISIS_LINES, crisisLine, lineForNumber, countriesMissingACrisisLine } = await import(
    "../lib/crisis/line"
  );

  check(
    "🔴 C350 Egypt has a verified crisis line, in the market this product opened in",
    CRISIS_LINES.EG?.tel === "105",
    "for eight sprints the first market's answer was 'call your local emergency number'",
  );

  check(
    "🔴 C350 …and it carries the menu choices, because 105 answers with a menu",
    Boolean(CRISIS_LINES.EG?.steps?.en) && Boolean(CRISIS_LINES.EG?.steps?.ar),
    "a correct number with no route through it fails the same way a wrong one does",
  );

  check(
    "🔴 C350 …in Arabic too, since the first choice on that menu IS the language",
    /[؀-ۿ]/.test(CRISIS_LINES.EG?.steps?.ar ?? ""),
    "the reader who needs the Arabic branch is the least likely to read English",
  );

  check(
    "🔴 C350 CONTROL, a line that answers directly carries no invented menu",
    CRISIS_LINES.US?.steps === undefined,
    "inventing a menu is the same failure as inventing a number",
  );

  check(
    "🔴 C350 CONTROL, a country nobody has verified is still offered nothing",
    lineForNumber("+447700900000") === null && crisisLine("GB") === null,
    "a table that answers for everybody would pass every check above and fail the product",
  );

  check(
    "🔴 C350 …and a line an operator configured brings no menu it was never given",
    crisisLine("EG", { label: "16000", tel: "16000" })?.steps === undefined,
    "country_settings has a number and a label and no third column",
  );

  check(
    "🔴 C350 Egypt has left the list of enabled countries with nobody's number",
    countriesMissingACrisisLine([
      { code: "EG", name: "Egypt", enabled: true, crisisLineTel: null },
    ]).length === 0,
    "that list is the admin screen's own account of this gap",
  );

  const orb = readSource("components/patient/sos-orb.tsx");
  check(
    "🔴 C350 the orb prints the menu on the button, before the call",
    /line\.steps/.test(orb) && /locale === "ar"/.test(orb),
    "after the number is dialled the reader is on a phone and this screen is behind it",
  );

  const banner = readSource("components/clinical/risk-banner.tsx");
  check(
    "🔴 C350 …and both crisis surfaces render it, not only the one somebody remembered",
    (banner.match(/<CrisisSteps/g) ?? []).length >= 2,
    "the patient notice and the clinician banner print the same number",
  );

  /* ================================================================== */
  /*  C349 · one screen, one definition of income                        */
  /* ================================================================== */

  const vaultData = readSource("lib/data/vault.ts");
  /*
   * The function's own body, not the file. Scanning the file would find
   * `ledgerSummary`'s fee arithmetic and report that the monthly one has it,
   * which is precisely the defect: two functions, one question, and a check
   * that cannot tell them apart is no better than the screen was.
   */
  const monthly = vaultData.slice(
    vaultData.indexOf("export async function monthlyLedger"),
    vaultData.indexOf("export async function therapistEconomics"),
  );

  check(
    "🔴 C349 the monthly ledger counts session fees, as the summary above it always did",
    monthly.length > 0 && /platformFeeCents\} - /.test(monthly),
    "invoices alone made the chart disagree with the card on the same page",
  );

  check(
    "🔴 C349 …netting off the invoice a fee settled, exactly as the summary nets it",
    /settledInvoiceCents/.test(monthly),
    "a therapist's own bill can ride inside a fee, and it is already on the other line",
  );

  check(
    "🔴 C349 …and the split is returned rather than folded into one number",
    /invoiceCents:/.test(monthly) && /sessionFeeCents:/.test(monthly),
    "a month carried by subscriptions and one carried by sessions are different businesses",
  );

  check(
    "🔴 C349 CONTROL, the slice really is the monthly function and not the whole file",
    !/heldForTherapistsCents/.test(monthly) && monthly.includes("date_trunc('month'"),
    "a slice that silently came back empty would pass the absence half of every check",
  );

  const vaultPage = readSource("app/(admin)/admin/vault/page.tsx");
  /*
   * ⚠️ 76.7 — THIS CHECK HELD THE FORMATTER'S NAME AND WENT RED WHEN IT CHANGED.
   *
   * It asserted the literal `formatUsd(month.collected)`. C349 is not about a
   * function, it is about a reader: the figure is PRINTED under the bar rather
   * than hidden behind a hover, because a `title=` attribute shows nothing on a
   * touchscreen.
   *
   * Sprint 76 wrapped every dollar figure in `<Money>`, which prints exactly the
   * same text and adds the pounds on demand ON TOP of it. The property held and
   * the check failed, which is the §6 family landing on a sprint verifier: it
   * was written against the implementation instead of against the rule.
   *
   * Restated as the rule. The month's figures are rendered as TEXT, by either
   * spelling, and the two ways of actually hiding them are banned by name.
   */
  const printsMonth = (field: string) =>
    new RegExp(`(formatUsd\\(month\\.${field}\\)|<UsdMoney cents=\\{month\\.${field}\\}|<Money cents=\\{month\\.${field}\\})`).test(
      vaultPage,
    );

  check(
    "🔴 C349 the figures are printed under the bars, not hidden in a hover",
    printsMonth("collected") &&
      printsMonth("spent") &&
      /* The two ways to hide one: an attribute, or a tooltip with nothing behind it. */
      !/title=\{[^}]*month\.(collected|spent)/.test(vaultPage),
    "a title= attribute shows nothing on a touchscreen and is an afterthought to a reader",
  );

  check(
    "🔴 C349 CONTROL the ban on an attribute-only figure catches the shape it names",
    /title=\{[^}]*month\.(collected|spent)/.test('<div title={formatUsd(month.collected)} />'),
    "watched catching the exact shape C349 was written about",
  );

  check(
    "🔴 C349 …and the chart no longer hides a number behind title=",
    !/title=\{`(Collected|Spend)/.test(vaultPage),
    "sprint 65: a disclosure a reader has to uncover is one most readers never see",
  );

  check(
    "🔴 C349 CONTROL, the same scan catches the attribute that was there",
    /title=\{`(Collected|Spend)/.test("<div title={`Collected ${formatUsd(month.collected)}`} />"),
    "a scan that finds nothing proves nothing until it is watched finding something",
  );

  /* ================================================================== */
  /*  C351 · the second rejection, run rather than read                  */
  /* ================================================================== */

  const { pool, db } = connect();

  try {
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'therapist_verifications'
         AND column_name IN ('rejection_count', 'documents_cleared_at')`);
    check(
      "🔴 C351 H1, the two columns are in the catalogue, not only in the schema file",
      cols.rows.length === 2,
      "db:migrate prints success either way; this reads what the database has",
    );

    const org = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO organizations (name, slug) VALUES (${fixture}, ${fixture})
          RETURNING id`)
      ).rows[0],
      "fixture organization",
    );

    const user = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO users (organization_id, email, password_hash, role, first_name, last_name)
          VALUES (${org.id}, ${`${fixture}@example.com`}, 'x', 'therapist', 'Fixture', 'Example')
          RETURNING id`)
      ).rows[0],
      "fixture user",
    );

    const admin = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO users (organization_id, email, password_hash, role, first_name, last_name)
          VALUES (${org.id}, ${`${fixture}-op@example.com`}, 'x', 'super_admin', 'Operator', 'Example')
          RETURNING id`)
      ).rows[0],
      "fixture operator",
    );
    const admin2 = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO users (organization_id, email, password_hash, role, first_name, last_name)
          VALUES (${org.id}, ${`${fixture}-op2@example.com`}, 'x', 'super_admin', 'Second', 'Example')
          RETURNING id`)
      ).rows[0],
      "second fixture operator",
    );
    /* 🔴 0154: one reviewer proposes, a second one who agrees decides. */
    const decideTwice = async (o: Parameters<typeof decideVerification>[0]) => {
      const proposal = await decideVerification({ ...o, adminUserId: admin.id });
      if (!proposal?.proposed) throw new Error("a single reviewer decided alone");
      return decideVerification({ ...o, adminUserId: admin2.id });
    };

    /*
     * The documents are recorded as paths rather than blob URLs so that
     * `deleteDocument` has nothing real to delete. What is being proved here is
     * that the columns are emptied on the second no and not on the first, and a
     * verifier is not a reason to put bytes in storage.
     */
    const DOCS = sql`id_front_url = 'fixture://front', license_doc_url = 'fixture://licence', headshot_url = 'fixture://headshot'`;

    const submit = async () => {
      await db.execute(sql`
        INSERT INTO therapist_verifications (user_id, organization_id, state, country,
          license_body, license_number, specialties, languages, submitted_at)
        VALUES (${user.id}, ${org.id}, 'submitted', 'EG', 'Fixture board', 'X1',
          '["anxiety"]'::jsonb, '["en"]'::jsonb, now())
        ON CONFLICT (user_id) DO UPDATE SET state = 'submitted', submitted_at = now()`);
      await db.execute(sql`UPDATE therapist_verifications SET ${DOCS} WHERE user_id = ${user.id}`);
      return required(
        (
          await db.execute<{ id: string }>(
            sql`SELECT id FROM therapist_verifications WHERE user_id = ${user.id}`,
          )
        ).rows[0],
        "fixture verification",
      );
    };

    const state = async () =>
      required(
        (
          await db.execute<{
            rejection_count: number;
            documents_cleared_at: string | null;
            license_doc_url: string | null;
          }>(sql`
            SELECT rejection_count, documents_cleared_at, license_doc_url
              FROM therapist_verifications WHERE user_id = ${user.id}`)
        ).rows[0],
        "fixture verification state",
      );

    const { decideVerification, REJECTIONS_BEFORE_REAPPLYING, missingFrom } = await import(
      "../lib/data/verification"
    );

    const first = await submit();
    await decideTwice({
      verificationId: first.id,
      approve: false,
      note: "The licence photograph is cut off.",
      adminUserId: admin.id,
    });
    const afterOne = await state();

    check(
      "🔴 C351 the first rejection counts, and is a correction rather than a decision",
      Number(afterOne.rejection_count) === 1 && afterOne.documents_cleared_at === null,
      "send it again is the right answer to a photograph that was cut off",
    );

    check(
      "🔴 C351 CONTROL …and it leaves the documents exactly where they were",
      afterOne.license_doc_url === "fixture://licence",
      "a rule that cleared on every no would pass the check below and be wrong",
    );

    const second = await submit();
    const decided = await decideTwice({
      verificationId: second.id,
      approve: false,
      note: "The name on the licence is not the name on the account.",
      adminUserId: admin.id,
    });
    const afterTwo = await state();

    check(
      "🔴 C351 the second rejection takes the documents with it",
      Number(afterTwo.rejection_count) === REJECTIONS_BEFORE_REAPPLYING &&
        afterTwo.license_doc_url === null &&
        afterTwo.documents_cleared_at !== null,
      "resubmitting the identical unreadable licence was free, and cost the operator a minute each time",
    );

    check(
      "🔴 C351 …and the caller is told, so the email and the audit line can say so",
      decided?.documentsCleared === true && decided.rejectionCount === 2,
      "discovering it by signing in to empty slots reads as a product that lost the files",
    );

    check(
      "🔴 C351 …so the existing 'what is still missing' check refuses the resubmission",
      missingFrom({
        country: "EG",
        licenseBody: "Fixture board",
        licenseNumber: "X1",
        specialties: ["anxiety"],
        languages: ["en"],
        idFrontUrl: null,
        licenseDocUrl: null,
        headshotUrl: null,
      }).length === 3,
      "no new branch and no second rule to keep in step with the first",
    );

    /* The approval half, on a fresh row: an approval clears nothing, ever. */
    await db.execute(sql`DELETE FROM therapist_verifications WHERE user_id = ${user.id}`);
    const third = await submit();
    await decideTwice({
      verificationId: third.id,
      approve: true,
      note: "",
      adminUserId: admin.id,
    });
    const afterYes = await state();

    check(
      "🔴 C351 CONTROL, an approval clears nothing and counts nothing",
      afterYes.license_doc_url === "fixture://licence" &&
        Number(afterYes.rejection_count) === 0 &&
        afterYes.documents_cleared_at === null,
      "the documents are the evidence for the decision and outlive it",
    );

    const verification = readSource("lib/data/verification.ts");
    check(
      "🔴 C351 the count moves in SQL, never as a number this process loaded a moment ago",
      /rejectionCount\} \+ 1/.test(verification),
      "two operators clearing the queue at once is the ordinary case, not the exotic one",
    );

    const review = readSource("components/admin/verification-review.tsx");
    check(
      "🔴 C351 the reviewer is told which number of no this one is, before they give it",
      /rejectionCount >= props\.finalAt - 1/.test(review) && /Reject and clear/.test(review),
      "an operator who learns what their no did afterwards has already done it",
    );

    const adminActions = readSource("app/(admin)/admin/actions.ts");
    /* Ruling 8: the words are the dictionary's now, in the clinician's language. */
    const { en: words, ar: arabic } = await import("../lib/i18n/messages");
    check(
      "🔴 C351 …and the email that carries the reason carries the consequence",
      /documentsCleared[\s\S]{0,400}"tmsg\.unverified\.cleared"/.test(adminActions) &&
        /upload them fresh/i.test(words["tmsg.unverified.cleared"]) &&
        /\{note\}/.test(arabic["tmsg.unverified.cleared"]),
      "the reason exists so they do not have to ask us; so does this",
    );

    check(
      "🔴 C351 …and deleting somebody's identity documents appears in the audit line",
      /documents cleared/.test(adminActions),
      "'verification.reject' alone does not record that an act took place",
    );

    /* ============================================================== */
    /*  C352 · the verification follows the clinician                  */
    /* ============================================================== */

    const clinicAdmin = readSource("lib/data/clinic-admin.ts");
    check(
      "🔴 C352 joining a practice moves the verification row, not only the user row",
      /update\(therapistVerifications\)[\s\S]{0,200}organizationId: invitation\.organizationId/.test(
        clinicAdmin,
      ),
      "a rejected clinician invited by a practice resubmits under the practice they left",
    );

    check(
      "🔴 C352 CONTROL …and it moves nothing else: no state, no count, no documents",
      !/update\(therapistVerifications\)[\s\S]{0,200}state: "(draft|submitted)"/.test(clinicAdmin),
      "C267: a practice's invitation is not evidence of a licence, and not a way to start again",
    );
  } finally {
    await db.execute(
      sql`DELETE FROM therapist_verifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${`%${fixture}%`})`,
    );
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("sprint 69");
}

/* 🔴 0161: these checks were written for two people on every queue, so they say so. */
setRulesForThisCheck(TWO_PEOPLE_EVERYWHERE);

main();
