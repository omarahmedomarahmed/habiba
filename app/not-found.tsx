import Link from "next/link";

import { Button } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 65.21 — 404 IN THE READER'S OWN LANGUAGE.
 *
 * Three English sentences on the one page in this product that any visitor can reach by
 * mistyping a URL, on a site whose Arabic half has its own hostname. Async because the
 * dictionary is resolved on the server; Next renders this file exactly like any other.
 */
export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {t("nf.title")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {t("nf.body")}
      </p>
      <Link href="/" className="mt-6">
        <Button>{t("nf.back")}</Button>
      </Link>
    </div>
  );
}
