import type { Metadata } from "next";

import { TaxonomyEditor } from "@/components/admin/taxonomy-editor";
import { requireRole } from "@/lib/auth/guard";
import { taxonomy } from "@/lib/data/taxonomy";

export const metadata: Metadata = { title: "Radar lists", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What the radar offers.
 *
 * Three lists, all switchable, because "we do not operate in that country yet"
 * and "nobody speaks that here" are business decisions that should not need a
 * deploy. Switching something off stops it being offered and filterable; it
 * never hides a clinician who already chose it, which is the difference between
 * curating a menu and quietly taking someone off the board.
 */
export default async function TaxonomyPage() {
  await requireRole("super_admin");

  const [countries, languages, specialties] = await Promise.all([
    taxonomy("country"),
    taxonomy("language"),
    taxonomy("specialty"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Radar lists</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          What patients can filter by and what clinicians can pick. Switching something off removes
          it from both — it does not remove anyone who already chose it, and it does not take a
          working clinician off the map.
        </p>
      </div>

      <TaxonomyEditor
        kind="country"
        rows={countries}
        canAdd={false}
        emptyWarning="Every country is off. The radar's country filter will be empty."
      />
      <TaxonomyEditor
        kind="language"
        rows={languages}
        canAdd
        emptyWarning="Every language is off. Nobody can say what they speak."
      />
      <TaxonomyEditor
        kind="specialty"
        rows={specialties}
        canAdd
        emptyWarning="Every specialty is off. Clinicians will have nothing to say they work with."
      />

      <p className="text-xs leading-relaxed text-slate-400">
        A country needs a point on the globe to be drawn, so new ones are a code change rather than
        a text field — ask and it takes a minute. Languages and specialties can be added here.
      </p>
    </div>
  );
}
