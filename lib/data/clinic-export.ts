import "server-only";

import { audit } from "@/lib/audit";
import { csvCell } from "@/lib/csv";
import { egpMinorFor } from "@/lib/money/convert";
import { dayKey, formatTime } from "@/lib/scheduling/tz";
import { getSettings } from "@/lib/settings";

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

/**
 * 🔴 T12: minor units as the bills screen formats them, two decimal places, always.
 *
 * Integer arithmetic rather than `(cents / 100).toFixed(2)`, which rounds a
 * binary fraction and can land a cent off. The result is text so `12.50` does
 * not arrive as `12.5`; `csvCell` leaves a plain decimal alone, sign and all.
 * Exported for the verifier.
 */
export function amount(minor: number): string {
  const whole = Math.trunc(Math.abs(minor));
  const sign = minor < 0 ? "-" : "";
  return `${sign}${Math.floor(whole / 100)}.${String(whole % 100).padStart(2, "0")}`;
}

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
  /**
   * 🔴 T8: the zone the "When" column is written in, the one the screen shows.
   * Required: the first version wrote `toISOString()`, so a 13:00 Cairo session
   * reached the spreadsheet as 10:00 with a `Z` nobody reads.
   */
  zone: string;
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
    /*
     * 🔴 T8: local wall-clock time plus a column naming the zone.
     *
     * `2026-09-24 13:00` sorts as text and a spreadsheet parses it as a date, and
     * the zone beside it says what it means. An offset in the cell would be correct
     * and would change under DST while the city does not, which is `zoneLabel`'s
     * argument made again for a file.
     */
    ["When", "Time zone", "Who", "Clinician", "State"],
    ...schedule.map((row) => [
      row.scheduledAt
        ? `${dayKey(row.scheduledAt, input.zone)} ${formatTime(row.scheduledAt, input.zone)}`
        : "",
      input.zone,
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

  const [bills, settings] = await Promise.all([clinicBills(input.actor), getSettings()]);
  const at = new Date();

  /*
   * 🔴 T12: THE RATE THE SCREEN CONVERTS AT, read the way the screen reads it.
   *
   * The bills screen leads with pounds: `<Money>` turns the stored dollars into
   * EGP with `egpMinorFor` at `payouts.egpRateMicro`, the operator's rate the
   * root layout hands it, and reveals the dollars on hover. So the file carries
   * both, from the same function and the same setting, and names the rate. With
   * no rate the screen shows dollars alone, and the file says "no rate" rather
   * than an empty cell a spreadsheet reads as zero.
   */
  const rateMicro = settings.payouts.egpRateMicro;
  const egp = (cents: number) => (rateMicro > 0 ? amount(egpMinorFor(cents, rateMicro)) : "no rate");
  const perDollar = rateMicro > 0 ? amount(Math.round(rateMicro / 10_000)) : "no rate";

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
    /*
     * 🔴 T12: THE CURRENCY IS A COLUMN, and the figures are the screen's figures.
     *
     * This wrote `platformFeeCents / 100` with no currency anywhere in the file, so
     * `12.5` could be read as pounds by a practice in Cairo, which is the reading
     * most of them would reach for, while the screen beside it showed pounds that
     * were fifty times larger. `bill.currency` is what the stored cents are in.
     */
    [
      "Period",
      "Sessions",
      "Currency",
      "Platform fee",
      "AI fee",
      "Total",
      "EGP per USD",
      "Platform fee (EGP)",
      "AI fee (EGP)",
      "Total (EGP)",
    ],
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
      bill.currency,
      amount(bill.platformFeeCents),
      amount(bill.aiFeeCents),
      amount(bill.totalCents),
      perDollar,
      egp(bill.platformFeeCents),
      egp(bill.aiFeeCents),
      egp(bill.totalCents),
    ]),
  ]);

  return { filename: `bills-${at.toISOString().slice(0, 10)}.csv`, csv };
}
