/*
 * 🔴 76.53 — the COMPANY'S OWN PAYROLL. super_admin only, and never clinical.
 */
import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { controlDb as db } from "@/lib/db";
import { employeeSalaries, employees } from "@/lib/db/schema";

/**
 * Who is on the payroll, what they cost, and what that made each month cost.
 *
 * ## 🔴 WHY THIS IS NOT IN `lib/finance/`
 *
 * `verify:finance` asserts that nothing in `lib/finance/` can import anything
 * that writes money, which is what keeps a forecast input from becoming a price.
 * This module writes. It writes salaries rather than prices, so it could not
 * change what a patient is charged, but the rule earns its keep by being
 * unconditional: a reader should not have to check which kind of writing a file
 * in the pure directory does.
 *
 * So the forecast stays pure, and the measured half lives here, next to every
 * other admin read in `lib/data/`.
 *
 * ## 🔴 WHAT A MONTH COSTS, and why it is not `headcount * salary`
 *
 * Three things make that wrong and all three happen inside six months:
 *
 *   - somebody starts in month 3, so months 1 and 2 did not pay them;
 *   - somebody leaves in month 5, and month 5 still paid them;
 *   - somebody gets a raise in month 4, and months 1 to 3 cost the old number.
 *
 * `payrollByMonth` walks the salary rows in force for each month instead. The
 * alternative — current salary times current headcount, times six — is the
 * number a spreadsheet produces and it is wrong in every one of those cases,
 * always in the direction that flatters the last month.
 */

export type EmployeeRow = {
  id: string;
  name: string;
  title: string;
  queue: string | null;
  startedOn: string;
  endedOn: string | null;
  /** The salary in force today, or the most recent one if they have left. */
  currentCents: number | null;
  /** Every salary they have been on, newest first. */
  history: { monthlyCents: number; effectiveFrom: string; note: string | null }[];
};

export type PayrollMonth = {
  /** `YYYY-MM`. */
  month: string;
  headcount: number;
  totalCents: number;
  /** What each queue cost that month. A founder with no queue lands in `none`. */
  byQueue: Record<string, number>;
};

/**
 * 🔴 THE SECOND LOCK, AND IT IS NOT THE SAME LOCK AS THE PAGE'S.
 *
 * `/admin/payroll` calls `requireRole("super_admin")`, which redirects. That is
 * the right behaviour for a person who followed a link they should not have.
 * It is the wrong behaviour for a caller that is not a page: a redirect thrown
 * inside a server action or a script reads as a routing accident rather than as
 * a refusal, and a future caller that is neither could reach this with a staff
 * actor and never find out.
 *
 * The 24/7 team works queues. What each of them is paid is not a queue.
 */
function mustBeFounder(actor: Actor): void {
  if (actor.role !== "super_admin") {
    throw new Error("payroll: what people are paid is super_admin only");
  }
}

/* -------------------------------------------------------------------- reads */

export async function listEmployees(actor: Actor): Promise<EmployeeRow[]> {
  mustBeFounder(actor);

  const [people, salaries] = await Promise.all([
    db.select().from(employees).orderBy(asc(employees.startedOn), asc(employees.name)),
    db
      .select()
      .from(employeeSalaries)
      .orderBy(desc(employeeSalaries.effectiveFrom), desc(employeeSalaries.createdAt)),
  ]);

  /*
   * 🔴 TWO QUERIES AND A GROUPING, NOT A JOIN.
   *
   * A join here returns one row per salary per person, and every count taken off
   * it afterwards is multiplied by however many raises somebody has had. That is
   * the defect `/admin/usage/sessions` was rebuilt to avoid, in a smaller table
   * where it would be easier to miss.
   */
  const byPerson = new Map<string, EmployeeRow["history"]>();
  for (const row of salaries) {
    const list = byPerson.get(row.employeeId) ?? [];
    list.push({
      monthlyCents: row.monthlyCents,
      effectiveFrom: String(row.effectiveFrom),
      note: row.note,
    });
    byPerson.set(row.employeeId, list);
  }

  return people.map((person) => {
    const history = byPerson.get(person.id) ?? [];
    return {
      id: person.id,
      name: person.name,
      title: person.title,
      queue: person.queue,
      startedOn: String(person.startedOn),
      endedOn: person.endedOn ? String(person.endedOn) : null,
      currentCents: history[0]?.monthlyCents ?? null,
      history,
    };
  });
}

/**
 * What each of `months` cost in wages.
 *
 * `months` are `YYYY-MM`, and the caller decides which ones exist, because the
 * question "which months does this business have" is answered by the money that
 * moved and not by the payroll. A month with an employee and no trading is still
 * a month that cost their salary, and it has to appear as one.
 */
export async function payrollByMonth(months: string[]): Promise<Map<string, PayrollMonth>> {
  const out = new Map<string, PayrollMonth>();
  for (const month of months) {
    out.set(month, { month, headcount: 0, totalCents: 0, byQueue: {} });
  }
  if (months.length === 0) return out;

  const [people, salaries] = await Promise.all([
    db.select().from(employees),
    db.select().from(employeeSalaries).orderBy(asc(employeeSalaries.effectiveFrom)),
  ]);

  for (const month of months) {
    const row = out.get(month)!;

    for (const person of people) {
      const started = String(person.startedOn).slice(0, 7);
      const ended = person.endedOn ? String(person.endedOn).slice(0, 7) : null;

      /*
       * 🔴 THE MONTH SOMEBODY LEAVES IS A MONTH THEY WERE PAID.
       *
       * `ended < month` and not `ended <= month`. Off by one here is a whole
       * salary, once per departure, and it reads as a saving the company did not
       * make in the month it most wants to believe it did.
       */
      if (started > month) continue;
      if (ended !== null && ended < month) continue;

      const inForce = salaries
        .filter((s) => s.employeeId === person.id && String(s.effectiveFrom).slice(0, 7) <= month)
        .at(-1);

      /*
       * Somebody on the payroll with no salary row yet counts in the headcount
       * and adds nothing to the bill. Dropping them from both would hide a
       * half-finished record; counting them at zero shows it, and the screen
       * says "no salary set" next to their name.
       */
      row.headcount += 1;
      if (!inForce) continue;

      row.totalCents += inForce.monthlyCents;
      const key = person.queue ?? "none";
      row.byQueue[key] = (row.byQueue[key] ?? 0) + inForce.monthlyCents;
    }
  }

  return out;
}

/* ------------------------------------------------------------------- writes */

export async function addEmployee(
  actor: Actor,
  input: { name: string; title: string; queue: string | null; startedOn: string; monthlyCents: number },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  mustBeFounder(actor);

  const name = input.name.trim();
  const title = input.title.trim();
  if (!name) return { ok: false, error: "A name is needed." };
  if (!title) return { ok: false, error: "A job title is needed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startedOn)) {
    return { ok: false, error: "The start date has to be a date." };
  }
  if (!Number.isInteger(input.monthlyCents) || input.monthlyCents < 0) {
    return { ok: false, error: "A salary cannot be negative." };
  }

  const [person] = await db
    .insert(employees)
    .values({
      name,
      title,
      queue: input.queue?.trim() || null,
      startedOn: input.startedOn,
    })
    .returning({ id: employees.id });

  await db.insert(employeeSalaries).values({
    employeeId: person!.id,
    monthlyCents: input.monthlyCents,
    /* Their first salary starts the month they do. */
    effectiveFrom: input.startedOn,
    createdBy: actor.userId,
    note: "starting salary",
  });

  await audit({
    actor,
    category: "admin",
    action: "employee.added",
    resourceType: "employee",
    resourceId: person!.id,
    reason: `${title}${input.queue ? `, ${input.queue} queue` : ""}, ${input.monthlyCents} cents a month`,
  });

  return { ok: true, id: person!.id };
}

/**
 * 🔴 A RAISE IS A NEW ROW, NOT AN UPDATE, which is the whole reason this table
 * is shaped the way it is. An UPDATE here would rewrite every earlier month of
 * the actuals table at the same time, and nothing on the screen would say so.
 */
export async function setSalary(
  actor: Actor,
  input: { employeeId: string; monthlyCents: number; effectiveFrom: string; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  mustBeFounder(actor);

  if (!Number.isInteger(input.monthlyCents) || input.monthlyCents < 0) {
    return { ok: false, error: "A salary cannot be negative." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    return { ok: false, error: "The date it starts from has to be a date." };
  }

  const [person] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.id, input.employeeId))
    .limit(1);

  if (!person) return { ok: false, error: "Nobody by that id is on the payroll." };

  /*
   * The unique index refuses a second salary starting the same month. That is
   * the right refusal for a duplicated submit and the wrong one for somebody
   * correcting a number they just typed, so a same-month write replaces rather
   * than failing, and the audit log records both amounts.
   */
  const [existing] = await db
    .select({ id: employeeSalaries.id, monthlyCents: employeeSalaries.monthlyCents })
    .from(employeeSalaries)
    .where(
      and(
        eq(employeeSalaries.employeeId, input.employeeId),
        eq(employeeSalaries.effectiveFrom, input.effectiveFrom),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(employeeSalaries)
      .set({ monthlyCents: input.monthlyCents, createdBy: actor.userId, note: input.note ?? null })
      .where(eq(employeeSalaries.id, existing.id));
  } else {
    await db.insert(employeeSalaries).values({
      employeeId: input.employeeId,
      monthlyCents: input.monthlyCents,
      effectiveFrom: input.effectiveFrom,
      createdBy: actor.userId,
      note: input.note ?? null,
    });
  }

  await audit({
    actor,
    category: "admin",
    action: existing ? "employee.salary_corrected" : "employee.salary_set",
    resourceType: "employee",
    resourceId: input.employeeId,
    /*
     * 🔴 BOTH AMOUNTS, in the one field this log has for prose. A raise
     * recorded as its new number alone cannot be read back as a raise.
     */
    reason:
      `${person.name}: ${input.monthlyCents} cents a month from ${input.effectiveFrom}` +
      (existing ? `, correcting ${existing.monthlyCents}` : "") +
      (input.note ? `. ${input.note}` : ""),
  });

  return { ok: true };
}

export async function endEmployment(
  actor: Actor,
  input: { employeeId: string; endedOn: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  mustBeFounder(actor);

  if (input.endedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.endedOn)) {
    return { ok: false, error: "The leaving date has to be a date." };
  }

  await db
    .update(employees)
    .set({ endedOn: input.endedOn, updatedAt: new Date() })
    .where(eq(employees.id, input.employeeId));

  await audit({
    actor,
    category: "admin",
    action: input.endedOn ? "employee.left" : "employee.returned",
    resourceType: "employee",
    resourceId: input.employeeId,
    reason: input.endedOn ? `last paid month ${input.endedOn.slice(0, 7)}` : "put back on the payroll",
  });

  return { ok: true };
}

