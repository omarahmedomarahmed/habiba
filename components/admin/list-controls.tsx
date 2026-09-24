import Link from "next/link";

import { hrefWith } from "@/lib/admin/paging";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 W2-A09: a search box and newer/older links for a console list. A GET
 * form, so a search is a URL an operator can paste to a colleague, and the
 * other filters on the page ride along in hidden fields.
 */
export async function ListControls({
  base,
  params,
  q,
  page,
  hasMore,
}: {
  base: string;
  /** Every other filter on the page, kept when searching or paging. */
  params: Record<string, string | undefined>;
  q: string | null;
  page: number;
  hasMore: boolean;
}) {
  const { t } = await getI18n();
  const link = "tap-target inline-flex items-center rounded-lg px-3 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form method="get" action={base} className="flex flex-1 items-center gap-2">
        {Object.entries(params).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("apage.search")}
          aria-label={t("apage.search")}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        />
      </form>
      {page > 1 ? (
        <Link href={hrefWith(base, { ...params, q, page: page - 1 })} className={link}>
          {t("apage.newer")}
        </Link>
      ) : null}
      {hasMore ? (
        <Link href={hrefWith(base, { ...params, q, page: page + 1 })} className={link}>
          {t("apage.older")}
        </Link>
      ) : null}
    </div>
  );
}
