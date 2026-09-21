import type { Metadata } from "next";
import Link from "next/link";

import { ActualsTable } from "@/components/admin/actuals-table";
import { BankEditor } from "@/components/admin/bank-editor";
import { PayrollEditor } from "@/components/admin/payroll-editor";
import { PositionCard } from "@/components/admin/position-card";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { NOT_MEASURED_HERE, monthlyActuals } from "@/lib/data/actuals";
import { OTHER_COST_LABELS, listCapital, listOtherCosts } from "@/lib/data/capital";
import { listEmployees, payrollByMonth } from "@/lib/data/payroll";
import { OTHER_COST_KINDS } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Actuals", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What the company actually earned and actually spent, month by month.
 *
 * ## 🔴 `requireRole("super_admin")`, the same ruling as the forecast
 *
 * This is the company's own result and its own payroll. The 24/7 team works
 * queues and has no business here, and `/admin/actuals` is a board pack rather
 * than an operating console. Same guard, same reason, and `lib/data/payroll.ts`
 * asserts the role again for anything that is not a page.
 *
 * ## 🔴 WHY THIS IS NOT A SECOND TABLE ON `/admin/financial-model`
 *
 * The obvious arrangement is one screen with the forecast on top and the
 * actuals below, and it is the wrong one. That page's first card exists to say
 * which of its inputs were measured, because a forecast read as a fact is the
 * oldest way a company lies to itself. Putting real rows on the same screen in
 * the same shape makes every figure on it look equally solid, and the badge
 * system that keeps the forecast honest would be quietly doing the opposite.
 *
 * So: two screens, the same columns, and a link each way. Reading them side by
 * side is the point; reading them as one table is the failure.
 *
 * ## 🔴 THE PAYROLL IS ON THIS SCREEN AND NOT ITS OWN
 *
 * Salaries are the only column in the table above that comes from a person
 * typing rather than from the product. Somebody reading a month and wondering
 * why the salaries figure is what it is has to be one scroll away from the
 * answer, not one navigation. It also means the wage bill cannot be edited
 * without the result of editing it being on the same screen.
 */
export default async function ActualsPage() {
  const actor = await requireRole("super_admin");

  const [actuals, people, capital, costs] = await Promise.all([
    monthlyActuals(),
    listEmployees(actor),
    listCapital(actor),
    listOtherCosts(actor),
  ]);

  /*
   * 🔴 THE DEFAULT DATE COMES FROM THE SERVER.
   *
   * A `<input type="date">` with a browser-computed default is a date in the
   * reader's timezone, which is not the timezone the months above were grouped
   * in. Somebody in Cairo adding an employee at half past midnight would file
   * them under yesterday's month. C84's cousin.
   */
  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const payrollNow = await payrollByMonth([thisMonth.slice(0, 7)]);
  const monthlyTotalCents = payrollNow.get(thisMonth.slice(0, 7))?.totalCents ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Actuals"
        subtitle="Earned against spent."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Against the forecast
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {actuals.from
                ? `${String(actuals.months.length)} ${actuals.months.length === 1 ? "month" : "months"} from ${actuals.from}.`
                : "No trading yet."}{" "}
              {actuals.brokeEvenIn
                ? `In the black from ${actuals.brokeEvenIn}.`
                : "No month in the black yet."}
            </p>
          </div>
          <Link
            href="/admin/financial-model"
            className="text-sm text-brand-700 underline underline-offset-2"
          >
            The forecast
          </Link>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Sums over rows here. The forecast next door is arithmetic over assumptions.
        </p>
      </Card>

      {/*
        🔴 THE POSITION SITS ABOVE THE TABLE, AND THAT IS THE ARGUMENT.

        A founder opening this page is asking two questions, and the second one
        is the urgent one: what have we got, and how long does it last. The
        month by month table answers neither — it says what each month did, and
        the balance it carried was what TRADING did to the bank, from zero,
        which is not the balance at all. Six months of correct rows summing to a
        number that was wrong by the entire amount the founders had put in.
      */}
      <PositionCard position={actuals.position} months={actuals.months.length} />

      <ActualsTable
        months={actuals.months}
        totals={actuals.totals}
        notMeasured={NOT_MEASURED_HERE}
      />

      <PayrollEditor people={people} thisMonth={thisMonth} monthlyTotalCents={monthlyTotalCents} />

      <BankEditor
        capital={capital}
        costs={costs}
        kinds={OTHER_COST_KINDS.map((value) => ({ value, ...OTHER_COST_LABELS[value] }))}
        months={
          /*
           * 🔴 THE MONTHS COME FROM THE TABLE, not from a range the form invents.
           * A dropdown offering a month the business did not have is a dropdown
           * that accepts a cost filed outside every total on the page.
           */
          actuals.months.length > 0
            ? actuals.months.map((row) => row.month)
            : [thisMonth.slice(0, 7)]
        }
        thisMonth={thisMonth}
      />
    </div>
  );
}
