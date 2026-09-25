import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 0165: WHAT THE ROOM SHOWS WHILE IT IS BUILT.
 *
 * The room page reads the session, builds the video room if it is missing and
 * mints a meeting token before it renders, which is seconds rather than
 * milliseconds. A dark frame the shape of the call, on the room's own ground so
 * nothing flashes white, and one word for a screen reader.
 */
export default async function RoomLoading() {
  const { t } = await getI18n();

  return (
    <div role="status" aria-busy="true" className="flex min-h-dvh flex-col gap-4 p-4 sm:p-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="flex flex-1 animate-pulse flex-col gap-4">
        <div className="flex-1 rounded-2xl bg-white/10" />
        <div className="mx-auto h-12 w-64 max-w-full rounded-full bg-white/10" />
      </div>
    </div>
  );
}
