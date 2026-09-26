"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { commit, preview } from "@/app/(app)/patients/import/actions";
import { useCountryName } from "@/components/forms/phone-field";
import { Button, Card, Field } from "@/components/clinician/kit";
import { DIALLING_CODES } from "@/lib/phone/e164";
import { useT } from "@/lib/i18n/client";

/**
 * The importer, in two steps. PLAN.md 55.11, 42.8.
 *
 * ## 🔴 THE SENTENCE ABOUT NOTES IS ABOVE THE FILE PICKER
 *
 * Before the upload, not after it. A clinician exporting from another platform has a file with
 * a notes column in it and a reasonable expectation that notes are what they are moving. They
 * are not: clinical text in a record needs a clinician who approved that exact wording (§7),
 * and nobody approved a spreadsheet cell. Saying so after the import is telling somebody their
 * migration is half of what they thought once it is too late to choose differently.
 *
 * And the dropped columns are then listed BY NAME in the preview, from their own file, so the
 * promise is checkable rather than reassuring.
 *
 * ## 🔴 NOTHING IS CREATED UNTIL THE SECOND SUBMIT
 *
 * Two actions, two buttons. The first reads the file and shows what it found; the second
 * writes. A mis-shifted column is then a preview somebody rejects rather than thirty charts
 * with the wrong names on them.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function ImportPatients({ defaultCountry }: { defaultCountry: string }) {
  const t = useT();
  const countryName = useCountryName();
  const [state, previewAction] = useActionState(preview, {});
  const [done, commitAction] = useActionState(commit, {});

  if (done.created !== undefined) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-navy-700">
          {t("import.done", { count: String(done.created) })}
        </p>
        {done.skipped ? (
          <p className="mt-1 text-sm text-navy-400">
            {t("import.doneSkipped", { count: String(done.skipped) })}
          </p>
        ) : null}
        {done.failed && done.failed.length > 0 ? (
          <p className="mt-1 text-sm text-navy-400">
            {t("import.doneFailed", { count: String(done.failed.length) })}
          </p>
        ) : null}
      </Card>
    );
  }

  const found = state.preview;

  return (
    <div className="flex flex-col gap-4">
      {/* 🔴 Above the picker, on the first screen. */}
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm leading-relaxed text-amber-900/90">{t("import.notesNever")}</p>
      </Card>

      {found ? (
        <>
          <Card className="p-5">
            <p className="text-sm font-semibold text-navy-700">
              {t("import.found", { count: String(found.rows.length) })}
            </p>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy-400">
              {t("import.matched")}
            </p>
            <ul className="mt-1 space-y-0.5">
              {found.matched.map((pair) => (
                <li key={pair.field} className="font-mono text-xs text-navy-400">
                  {pair.column} {"->"} {pair.field}
                </li>
              ))}
            </ul>

            {/* 🔴 Named, from their own file. The promise above, made checkable. */}
            {found.ignoredColumns.length > 0 ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy-400">
                  {t("import.ignored")}
                </p>
                <p className="mt-1 font-mono text-xs text-navy-400">
                  {found.ignoredColumns.join(", ")}
                </p>
              </>
            ) : null}

            {state.duplicates && state.duplicates.length > 0 ? (
              <p className="mt-3 text-sm text-navy-400">
                {t("import.alreadyHere", { count: String(state.duplicates.length) })}
              </p>
            ) : null}

            {found.problems.length > 0 ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy-400">
                  {t("import.problems")}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {found.problems.map((problem) => (
                    <li key={problem.line} className="text-xs text-navy-400">
                      {t("import.line", { line: String(problem.line) })} {problem.reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <ul className="mt-4 divide-y divide-navy-100/70">
              {found.rows.map((row) => (
                <li key={row.phone} className="py-1.5 text-sm text-navy-600">
                  <span className="font-medium">
                    {row.firstName}
                    {row.lastName ? ` ${row.lastName}` : ""}
                  </span>
                  <span className="ms-2 font-mono text-xs text-navy-400">{row.phone}</span>
                </li>
              ))}
            </ul>
          </Card>

          <form action={commitAction}>
            {/* 🔴 Re-validated server-side on the way back in. A form is editable. */}
            <input type="hidden" name="rows" value={JSON.stringify(found.rows)} />
            {done.error ? (
              <p role="alert" className="mb-2 text-xs text-red-600">
                {done.error}
              </p>
            ) : null}
            <Submit label={t("import.confirm", { count: String(found.rows.length) })} />
          </form>
        </>
      ) : null}

      <Card className="p-5">
        <form action={previewAction} className="space-y-4">
          <Field label={t("import.file")} htmlFor="import-file">
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,text/csv,text/plain"
              required
              className="block w-full text-sm text-navy-600"
            />
          </Field>

          <Field label={t("import.country")} htmlFor="import-country">
            <select
              id="import-country"
              name="country"
              defaultValue={defaultCountry}
              className="h-11 w-full rounded-xl border border-navy-100 px-3 text-sm"
            >
              {Object.keys(DIALLING_CODES)
                .sort((a, b) => countryName(a).localeCompare(countryName(b)))
                .map((code) => (
                  <option key={code} value={code}>
                    {countryName(code)} +{DIALLING_CODES[code]}
                  </option>
                ))}
            </select>
          </Field>
          <p className="text-xs leading-relaxed text-navy-400">{t("import.countryNote")}</p>

          {state.error ? (
            <p role="alert" className="text-xs text-red-600">
              {state.error}
            </p>
          ) : null}

          <Submit label={found ? t("import.again") : t("import.preview")} />
        </form>
      </Card>
    </div>
  );
}
