import Link from "next/link";
import { Bell } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 W2-P09: the way to what the app has told you, from every signed-in screen.
 *
 * `/patient/notices` was linked from nowhere and `undismissedCount` was called
 * by nothing, so a payment confirmation or a benefit notice was written to a
 * page nobody could find: P2 kept in the database and broken on the screen.
 * The count is a number and nothing else, because this sits where anybody
 * looking over a shoulder can read it.
 */
export async function NoticeBell({ count }: { count: number }) {
  const { t } = await getI18n();

  return (
    <Link
      href="/patient/notices"
      aria-label={count > 0 ? `${t("pnotice.title")} (${count})` : t("pnotice.title")}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -end-1 -top-1 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] leading-4 font-bold text-white"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
