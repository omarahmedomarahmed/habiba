"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guard";
import { addCapital, removeCapital, setOtherCost } from "@/lib/data/capital";
import { addEmployee, endEmployment, setSalary } from "@/lib/data/payroll";

/**
 * Everything a founder can do to the payroll, and nothing else.
 *
 * ## 🔴 Three actions, and none of them deletes anybody
 *
 * A delete would remove the salary history with the person, and the salary
 * history is what every earlier month of `/admin/actuals` is computed from. So
 * somebody leaving is a date, the months up to it keep costing what they cost,
 * and the row stays on the screen greyed out with the date on it.
 *
 * That is the same ruling the rest of this product makes about a clinician who
 * leaves a practice: the record of what happened does not leave with them.
 *
 * ## 🔴 Money arrives as dollars and is stored as cents, once, here
 *
 * The form takes dollars because that is what a person types. The conversion is
 * `Math.round(dollars * 100)` on the server, and it is the only place it
 * happens: a browser that computed cents is a browser that could disagree with
 * the server by a cent on a number somebody is paid.
 */
export type PayrollActionState = { error?: string; ok?: string };

function centsFromDollars(raw: string): number | null {
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export async function addEmployeeAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const cents = centsFromDollars(String(form.get("salary") ?? ""));
  if (cents === null) return { error: "A salary is a number of dollars a month, never negative." };

  const result = await addEmployee(actor, {
    name: String(form.get("name") ?? ""),
    title: String(form.get("title") ?? ""),
    queue: String(form.get("queue") ?? "") || null,
    startedOn: String(form.get("startedOn") ?? ""),
    monthlyCents: cents,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  return { ok: "On the payroll." };
}

export async function setSalaryAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const cents = centsFromDollars(String(form.get("salary") ?? ""));
  if (cents === null) return { error: "A salary is a number of dollars a month, never negative." };

  const result = await setSalary(actor, {
    employeeId: String(form.get("employeeId") ?? ""),
    monthlyCents: cents,
    effectiveFrom: String(form.get("effectiveFrom") ?? ""),
    note: String(form.get("note") ?? "") || undefined,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  /*
   * 🔴 The confirmation says which months changed, because the surprising thing
   * about this action is which months did NOT. Somebody who expects a raise to
   * restate the year needs to be told once that it does not.
   */
  return {
    ok: `Saved, from ${String(form.get("effectiveFrom")).slice(0, 7)}. Earlier months unchanged.`,
  };
}

export async function endEmploymentAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const raw = String(form.get("endedOn") ?? "");
  const result = await endEmployment(actor, {
    employeeId: String(form.get("employeeId") ?? ""),
    endedOn: raw || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  return { ok: raw ? "Recorded. That month is still paid." : "Back on the payroll." };
}

/* ------------------------------------------------------------- the bank -- */

/**
 * 🔴 76.56 — MONEY IN THAT IS NOT REVENUE, AND COSTS NOTHING IN THE PRODUCT BUYS.
 *
 * Same three rules as the payroll above: dollars in the form, cents on the
 * server, one conversion. What is different is that capital can be REMOVED,
 * where an employee cannot, and the reason is that the two rows mean different
 * things. A salary row is what a month cost and deleting it rewrites history. A
 * contribution typed with a zero too many is a typo about a bank statement, and
 * the correction for a typo is to take it out, with the audit log carrying what
 * was removed.
 */
export async function addCapitalAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const cents = centsFromDollars(String(form.get("amount") ?? ""));
  if (cents === null || cents === 0) {
    return { error: "An amount that is not a positive number of dollars is not money in." };
  }

  const result = await addCapital(actor, {
    amountCents: cents,
    receivedOn: String(form.get("receivedOn") ?? ""),
    source: String(form.get("source") ?? ""),
    note: String(form.get("note") ?? "") || undefined,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  return { ok: "In the bank. Every month from that one is higher by it." };
}

export async function removeCapitalAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const result = await removeCapital(actor, { id: String(form.get("id") ?? "") });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  return { ok: "Taken out, and the audit log says what it was." };
}

export async function setOtherCostAction(
  _prev: PayrollActionState,
  form: FormData,
): Promise<PayrollActionState> {
  const actor = await requireRole("super_admin");

  const cents = centsFromDollars(String(form.get("amount") ?? ""));
  if (cents === null) return { error: "A cost is a number of dollars, never negative." };

  const result = await setOtherCost(actor, {
    kind: String(form.get("kind") ?? ""),
    month: String(form.get("month") ?? ""),
    amountCents: cents,
    note: String(form.get("note") ?? "") || undefined,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/actuals");
  return {
    ok: cents === 0 ? "Removed from that month." : `Saved against ${String(form.get("month"))}.`,
  };
}
