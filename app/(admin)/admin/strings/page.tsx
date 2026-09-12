import type { Metadata } from "next";

import { LanguagePanel, StringsTable } from "@/components/admin/strings-editor";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { editorRows } from "@/lib/i18n/authoring";
import { completeness, languages } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: "Strings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Every string, every language. PLAN.md 21.1–21.19.
 *
 * One page rather than two because the questions are one question: *is this
 * language ready, and what is missing*. Splitting the checklist from the
 * strings is how a language sits at 96% for a month with nobody able to see
 * which four strings.
 */
export default async function StringsPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  await requireRole("super_admin");

  const { locale = "ar" } = await searchParams;
  const all = await languages();

  const [rows, states] = await Promise.all([
    editorRows(locale),
    Promise.all(all.map((language) => completeness(language.code))),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strings and languages"
        subtitle="The shipped wording is the default. A row here overrides it; clearing one restores it."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {all.map((language, i) => (
          <LanguagePanel
            key={language.code}
            language={{
              ...language,
              percent: states[i]!.percent,
              missing: states[i]!.missingKeys.length,
              drafts: states[i]!.drafts,
              machineDrafts: states[i]!.machineDrafts,
            }}
          />
        ))}
      </div>

      <Card className="p-3">
        <p className="text-sm text-slate-600">
          Editing{" "}
          <strong>{all.find((l) => l.code === locale)?.name ?? locale}</strong>. Switch language:{" "}
          {all.map((language) => (
            <a
              key={language.code}
              href={`/admin/strings?locale=${language.code}`}
              className={
                language.code === locale
                  ? "me-2 font-semibold text-slate-900"
                  : "me-2 text-brand-600 underline"
              }
            >
              {language.code}
            </a>
          ))}
        </p>
      </Card>

      <StringsTable locale={locale} rows={rows} />
    </div>
  );
}
