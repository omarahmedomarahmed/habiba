/**
 * Sprint 76 acceptance: the board a founder runs the company from.
 *
 *   npm run verify:board
 *
 * ## 🔴 WHAT IS ACTUALLY BEING GUARDED
 *
 * A dashboard is the easiest thing in a product to get wrong in a way nobody
 * notices, because a wrong number and a right number look identical. Four
 * properties matter and none of them is "it renders":
 *
 *   1. **Every section runs.** Nine queries over half the schema, and a board is
 *      only useful if all nine come back. One that throws takes the page with
 *      it, so they are run here against a real database rather than typechecked.
 *
 *   2. **Nothing on it writes.** It is read by the person with the most
 *      authority in the product, on the screen where they are least expecting
 *      consequences. A board with a write in it is a board that does something
 *      when somebody refreshes it.
 *
 *   3. **Due money is not counted as collected.** The single most tempting
 *      error on a founder's dashboard, and the one that describes a company with
 *      more money than it has.
 *
 *   4. **Every section has a door.** A number you can only look at becomes a
 *      number somebody screenshots into a document, and then there are two
 *      places that disagree.
 */
import { reporter, readSource, sawRows } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const board = readSource("lib/console/board.ts");
  const ui = readSource("components/admin/board.tsx");
  const actions = readSource("app/(admin)/admin/tv/board-actions.ts");

  /* ================================================================== */
  /*  1 · all nine run, against a real database                          */
  /* ================================================================== */

  const {
    moneyBoard,
    companiesBoard,
    clinicsBoard,
    therapistsBoard,
    sessionsBoard,
    aiBoard,
    paymentsBoard,
    patientsBoard,
    activityBoard,
    wholeBoard,
  } = await import("../lib/console/board");

  const SECTIONS = [
    ["money", moneyBoard],
    ["companies", companiesBoard],
    ["clinics", clinicsBoard],
    ["clinicians", therapistsBoard],
    ["sessions", sessionsBoard],
    ["model spend", aiBoard],
    ["the transfer queue", paymentsBoard],
    ["people", patientsBoard],
    ["activity", activityBoard],
  ] as const;

  const broken: string[] = [];
  for (const [name, fn] of SECTIONS) {
    try {
      await fn();
    } catch (error) {
      broken.push(`${name}: ${String(error).slice(0, 90)}`);
    }
  }

  check(
    "🔴 all nine sections run against a real database",
    broken.length === 0,
    broken.join(" · ") || SECTIONS.map(([n]) => n).join(" · "),
  );

  const whole = await wholeBoard();
  check(
    "🔴 …and the whole board comes back with every section on it",
    Object.keys(whole).length === SECTIONS.length,
    `${Object.keys(whole).length} sections: ${Object.keys(whole).join(", ")}`,
  );

  /* ================================================================== */
  /*  2 · nothing on it writes                                           */
  /* ================================================================== */

  /*
   * 🔴 An absence assertion, so it carries a planted offender below. The board
   * is read by the person with the most authority in the product, on a screen
   * where they are not expecting consequences.
   */
  const WRITES = /\.(insert|update|delete)\(|\bexecute\(sql`\s*(INSERT|UPDATE|DELETE)/i;
  check(
    "🔴 the board cannot write. It counts, and nothing else",
    !WRITES.test(board),
    "a refresh button that changes something is a button nobody can press twice",
  );

  check(
    "🔴 CONTROL the same scan catches a write",
    WRITES.test('await db.update(sponsors).set({ state: "active" });'),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  check(
    "🔴 …and every refresh action is behind the same guard as the page",
    // W2-A01: the page is the owner's (lib/admin/access.ts), so its actions are too.
    (actions.match(/await requireRole\("super_admin"\)/g) ?? []).length >= SECTIONS.length + 1,
    "an action reachable without the page is an action somebody calls directly",
  );

  /* ================================================================== */
  /*  3 · due is not collected                                           */
  /* ================================================================== */

  /*
   * 🔴 THE MOST TEMPTING ERROR ON A FOUNDER'S DASHBOARD.
   *
   * Invoiced revenue is not cash. A board that adds what people owe us to what
   * people have paid us describes a company with more money than it has, and it
   * is the number an investor would be shown.
   */
  check(
    "🔴 collected money is filtered to PAID invoices, and due is counted separately",
    /inWeekCents[\s\S]{0,40}weekCents/.test(board) &&
      /FILTER \(WHERE \$\{invoices\.issuedAt\} >= \$\{week\} AND \$\{invoices\.status\} = 'paid'\)/.test(
        board,
      ) &&
      /dueCents:/.test(board),
    "invoiced revenue is a forecast of a company that runs out of money",
  );

  /*
   * ⚠️ The first version of this asserted the COMMENT "Due is NOT revenue" in
   * the data layer. `readSource` strips comments (C205), so it could only ever
   * have failed. Worse, a comment is not the property: the property is that the
   * two live in separate fields and the screen names the difference out loud.
   */
  check(
    "🔴 …and the screen names it as owed rather than folding it into a total",
    /* Board 424: the label is the counted key now, "Owed to us, 1 invoice". */
    /admin\.board\.owed/.test(ui) &&
      /inMonthCents/.test(ui) &&
      !/inMonthCents \+ b\.money\.dueCents/.test(ui),
    "a number that needs explaining is explained where it is read",
  );

  check(
    "🔴 CONTROL the same scan catches a board that added the two together",
    /inMonthCents \+ b\.money\.dueCents/.test(
      "<Stat value={usd(b.money.inMonthCents + b.money.dueCents)} />",
    ),
    "watched finding the exact line that would describe a richer company",
  );

  /*
   * 🔴 A POT BALANCE IS A LIABILITY. It is a customer's money sitting in our
   * account for their staff to spend. A board that reads it as income is
   * insolvent and cheerful.
   */
  check(
    "🔴 a company's pot is shown as somebody else's money, not as ours",
    /liability, not revenue/.test(ui),
    "it is cash we hold and have not earned",
  );

  /* ================================================================== */
  /*  4 · every section has a door                                       */
  /* ================================================================== */

  const doors = [...board.matchAll(/manageHref:\s*"([^"]+)"/g)].map((m) => m[1]!);
  check(
    "🔴 every section ends somewhere a founder can act",
    doors.length === SECTIONS.length,
    doors.join(" · "),
  );

  /*
   * 🔴 AND EVERY DOOR IS A PAGE THAT EXISTS. A dashboard linking to a 404 is
   * worse than one that links nowhere: it looks like the feature is there.
   */
  const { existsSync } = await import("node:fs");
  const missing = doors.filter(
    (href) => !existsSync(`app/(admin)${href.replace("/admin", "/admin")}/page.tsx`),
  );
  check(
    "🔴 …and every one of those pages exists",
    missing.length === 0,
    missing.join(", ") || `${doors.length} doors, all real`,
  );

  /* ================================================================== */
  /*  5 · the things that make it readable                               */
  /* ================================================================== */

  check(
    "🔴 every section is collapsible and refreshes on its own",
    /aria-expanded=\{open\}/.test(ui) &&
      (ui.match(/onRefresh=\{async \(\) => \{/g) ?? []).length === SECTIONS.length,
    "the queue changes by the minute and the clinic roster changes twice a month",
  );

  check(
    "🔴 …and there is one button that refreshes everything",
    /refreshAll/.test(ui) && /Refresh everything/.test(ui),
    "nine buttons and no tenth is a board somebody gives up on",
  );

  /*
   * 🔴 C84 — NO `Intl` IN THE CLIENT COMPONENT. These are money figures a
   * founder reads off a screen and quotes in a meeting, and `toLocaleString`
   * renders one string on the server pass and another in the browser.
   */
  check(
    "🔴 C84 the board formats money without Intl, because it is a client component",
    !/toLocaleString|Intl\.(NumberFormat|DateTimeFormat)/.test(ui),
    "a hydration mismatch on the one number somebody is about to quote",
  );

  check(
    "🔴 CONTROL the same scan catches the construct it bans",
    /toLocaleString|Intl\.(NumberFormat|DateTimeFormat)/.test(
      "const s = (n / 100).toLocaleString('en-US');",
    ),
    "watched finding the thing it forbids",
  );

  /*
   * 🔴 THE SPLIT THAT NO OTHER SCREEN SHOWS. A month where subscribers fall and
   * metered rises is a month the plan is not worth buying, and it looks
   * identical to a good month in every revenue total.
   */
  check(
    "🔴 the board says how many clinicians are on a plan and how many are metered",
    /onPlan/.test(board) && /metered/.test(board) && /Pay as you go/.test(ui),
    "the one count that says whether the plan is working",
  );

  /* ================================================================== */
  /*  5 · each subquery counts the row it sits on                        */
  /* ================================================================== */

  /*
   * 🔴 W2-Q01: the clinics and people sections select from one table, and in a
   * single-table select Drizzle rendered the outer `${organizations.id}` as a
   * bare "id", which the subquery bound to its own row: every clinic showed 0
   * clinicians, 0 live seats and 0 due, and every patient counted as claimed
   * once any account existed. Each figure is asked again here in hand-written
   * SQL and must agree.
   */
  const { controlDb } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const clinics = (await clinicsBoard()).rows;
  const truth = new Map(
    (
      await controlDb.execute<{ id: string; clinicians: number; seats: number; due: number }>(sql`
        SELECT o.id,
          (SELECT count(*)::int FROM users u WHERE u.organization_id = o.id AND u.role = 'therapist' AND u.deleted_at IS NULL) AS clinicians,
          (SELECT count(*)::int FROM clinic_seats cs WHERE cs.organization_id = o.id AND cs.released_at IS NULL) AS seats,
          (SELECT COALESCE(SUM(i.amount_cents - i.discount_cents), 0)::int FROM invoices i WHERE i.organization_id = o.id AND i.status = 'due') AS due
        FROM organizations o WHERE o.kind = 'clinic'`)
    ).rows.map((r) => [r.id, r]),
  );
  const clinicsOff = clinics.filter((c) => {
    const t = truth.get(c.id);
    return !t || t.clinicians !== c.clinicians || t.seats !== c.liveSeats || t.due !== c.dueCents;
  });
  check(
    "🔴 W2-Q01 each clinic's clinicians, live seats and due money are its own",
    clinicsOff.length === 0,
    clinicsOff.length === 0
      ? `${clinics.length} clinics, ${clinics.reduce((n, c) => n + c.clinicians, 0)} clinicians`
      : clinicsOff.map((c) => `${c.name}: ${c.clinicians}/${c.liveSeats}/${c.dueCents} vs ${JSON.stringify(truth.get(c.id))}`).join("; "),
  );

  const peopleNow = await patientsBoard();
  const [peopleTruth] = (
    await controlDb.execute<{ sponsored: number; claimed: number }>(sql`
      SELECT
        count(*) FILTER (WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM enrolments e WHERE e.person_id = p.person_id AND e.state = 'active'))::int AS sponsored,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM patient_accounts pa WHERE pa.person_id = p.person_id))::int AS claimed
      FROM patients p`)
  ).rows;
  check(
    "🔴 W2-Q01 a patient counts as sponsored or claimed by their own person only",
    peopleNow.sponsored === peopleTruth.sponsored && peopleNow.claimed === peopleTruth.claimed,
    `board ${peopleNow.sponsored} sponsored, ${peopleNow.claimed} claimed; asked directly ${peopleTruth.sponsored}, ${peopleTruth.claimed}, of ${peopleNow.total}`,
  );

  /*
   * 🔴 76.18 — AND SAY WHAT IT WAS COUNTING, because sixteen passes over an
   * empty database is a green light that proved the board runs and nothing at
   * all about whether it counts. Read off the sections themselves rather than
   * off a fresh query, so the figures printed are the ones the checks used.
   */
  const [money, sessionsSection, payments, people] = await Promise.all([
    moneyBoard(),
    sessionsBoard(),
    paymentsBoard(),
    patientsBoard(),
  ]);

  console.log(
    `\n  ${sawRows({
      "cents collected": money.inTotalCents ?? 0,
      sessions: sessionsSection.total ?? 0,
      "transfers decided or waiting":
        (payments.waiting ?? 0) + (payments.confirmedWeek ?? 0) + (payments.rejectedWeek ?? 0),
      people: people.total ?? 0,
    })}`,
  );

  finish("sprint 76 board");
}

main();
