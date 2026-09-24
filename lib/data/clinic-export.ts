import "server-only";

import { audit } from "@/lib/audit";
import { csvCell } from "@/lib/csv";

import { clinicBills, clinicSchedule, type ClinicPrincipal } from "./clinic";

/**
 * 🔴 63.17 / C334 — AN EXPORT IS THE ONE ACTION THAT LEAVES THE BUILDING.
 *
 * > *A clinic export is an exfiltration surface. Every export is audited with the
 * > requesting user, watermarked with their name and the timestamp, and contains
 * > nothing the screen does not already show.*
 *
 * ## 🔴 "NOTHING THE SCREEN DOES NOT SHOW" IS A PROPERTY OF THE CODE, NOT A PROMISE
 *
 * This file has no queries in it. Every row it writes comes from `clinicSchedule` and
 * `clinicBills` — the same functions the screens call, with the same capability
 * checks, the same assignment scoping and the same shortened patient names. There is
 * no "export query" that could quietly select one more column, because there is no
 * export query at all.
 *
 * That is the whole design. An export built from its own SELECT is an export that
 * drifts from the screen it claims to mirror, and the drift is always in the
 * direction of more data.
 *
 * ## 🔴 THE WATERMARK IS IN THE FILE, NOT IN THE FILENAME
 *
 * A filename is discarded the moment somebody attaches the file to an email. The
 * first two lines of the CSV name the person who asked and the moment they asked, so
 * a spreadsheet found on a laptop still says where it came from.
 */

/* W1-19's formula escaping lives in `lib/csv.ts` now (W2-S10), and is re-exported. */
export { csvCell };

function rows(lines: (string | number | null)[][]): string {
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

/**
 * 🔴 THE WATERMARK, and it is two rows of the CSV rather than a comment.
 *
 * A `#` comment line is dropped by some spreadsheet importers and kept by others,
 * which makes it a watermark that is there when nobody is looking and gone when
 * somebody is. Ordinary rows survive every importer.
 */
function watermark(input: { email: string; clinicName: string; at: Date }): string[][] {
  return [
    ["Exported by", input.email, "at", input.at.toISOString()],
    ["From", input.clinicName, "", ""],
    [],
  ];
}

export type ClinicExport = { filename: string; csv: string };

/**
 * The schedule, as the person exporting it can already see it.
 *
 * 🔴 `clinicSchedule` audits its own read (63.12), and this audits the EXPORT
 * separately. They are different facts: one is somebody looking at a calendar and
 * the other is a copy of it leaving. A single row for both would make "what left the
 * building" unanswerable without guessing from context.
 */
export async function exportSchedule(input: {
  actor: ClinicPrincipal;
  email: string;
  clinicName: string;
  from: Date;
  to: Date;
}): Promise<ClinicExport> {
  /*
   * 🔴 63.17 — `export` IS A CAPABILITY OF ITS OWN, and holding `schedule.read` is
   * not enough. Reading a calendar on a screen and taking a copy of it away are
   * different acts with different risks, which is why C334 names the second one.
   */
  if (!input.actor.capabilities.includes("export")) {
    throw new Error("clinic principal lacks export");
  }

  const schedule = await clinicSchedule({
    actor: input.actor,
    from: input.from,
    to: input.to,
  });

  const at = new Date();

  await audit({
    actor: null,
    clinicManagerId: input.actor.clinicManagerId,
    /* 🔴 `phi_access`, for the same reason the read is: a calendar is a record. */
    category: "phi_access",
    action: "clinic.schedule.export",
    resourceType: "organization",
    resourceId: input.actor.clinicOrganizationId,
    reason: `${schedule.length} appointments left the building, ${input.from.toISOString().slice(0, 10)} to ${input.to.toISOString().slice(0, 10)}`,
  });

  const csv = rows([
    ...watermark({ email: input.email, clinicName: input.clinicName, at }),
    ["When", "Who", "Clinician", "State"],
    ...schedule.map((row) => [
      row.scheduledAt ? row.scheduledAt.toISOString() : "",
      /* 🔴 Already first name plus last initial. This file does no shortening of
         its own, because a second implementation is a second thing to get wrong. */
      row.patientName,
      row.therapistName,
      row.status,
    ]),
  ]);

  return { filename: `schedule-${at.toISOString().slice(0, 10)}.csv`, csv };
}

/** The bills, aggregated exactly as C263 aggregates them on the screen. */
export async function exportBills(input: {
  actor: ClinicPrincipal;
  email: string;
  clinicName: string;
}): Promise<ClinicExport> {
  if (!input.actor.capabilities.includes("export")) {
    throw new Error("clinic principal lacks export");
  }

  const bills = await clinicBills(input.actor);
  const at = new Date();

  await audit({
    actor: null,
    clinicManagerId: input.actor.clinicManagerId,
    category: "billing",
    action: "clinic.bills.export",
    resourceType: "organization",
    resourceId: input.actor.clinicOrganizationId,
    reason: `${bills.length} period(s)`,
  });

  const csv = rows([
    ...watermark({ email: input.email, clinicName: input.clinicName, at }),
    ["Period", "Sessions", "Platform fee", "AI fee", "Total"],
    ...bills.map((bill) => [
      bill.periodStart.toISOString().slice(0, 10),
      /*
       * 🔴 A SUPPRESSED COUNT STAYS SUPPRESSED IN THE EXPORT, and it is written as
       * a word rather than as an empty cell.
       *
       * C262 withholds a session count below the activity floor because a small
       * number is a statement about a patient. An export that wrote `0` there
       * would publish a figure the screen refuses AND publish a wrong one; an
       * empty cell reads as zero to anybody importing it.
       */
      bill.sessions === null ? "withheld" : bill.sessions,
      bill.platformFeeCents / 100,
      bill.aiFeeCents / 100,
      bill.totalCents / 100,
    ]),
  ]);

  return { filename: `bills-${at.toISOString().slice(0, 10)}.csv`, csv };
}
