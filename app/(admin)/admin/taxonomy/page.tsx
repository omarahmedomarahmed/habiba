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
 * deploy.
 *
 * ## 🔴 50.1 — a country is not a language, and this page used to say it was
 *
 * The old copy here promised that switching anything off "does not take a
 * working clinician off the map". That was true of every list and is now true
 * of only two of them, and the page saying otherwise would be worse than the
 * original defect: an operator closing Egypt, reading a reassurance, and
 * believing clinicians there were still bookable.
 *
 *   - **A country is where we operate.** Closing one takes its clinicians off
 *     the radar and tells them why (50.3). Their patients, sessions, notes and
 *     money are untouched; only the shop window shuts.
 *   - **A language or a specialty is a menu.** Hiding one stops it being
 *     offered and filtered on. A clinician who had selected it keeps the row
 *     and simply stops being matched on it (50.4), because somebody online who
 *     can help should not vanish because an operator tidied a list.
 *
 * And a country has a **second** switch, on the settings screen, which is the
 * money one: `country_settings.enabled` decides whether we can take a payment
 * there. C219 first ruled that column should be deleted as dead. It is not
 * dead, it has two consumers on the payment path, and deleting it would have
 * left the rail open in a country we had just closed.
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
          What patients can filter by and what clinicians can pick. Closing a country takes its
          clinicians off the radar and tells them why; their patients, sessions and money are
          untouched. Hiding a language or a specialty only stops it being matched on, and nobody
          loses what they had already chosen.
        </p>
      </div>

      <TaxonomyEditor
        kind="country"
        rows={countries}
        canAdd={false}
        emptyWarning="Every country is closed. Nobody is on the radar anywhere."
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
        a text field, ask and it takes a minute. Languages and specialties can be added here.
      </p>
    </div>
  );
}
