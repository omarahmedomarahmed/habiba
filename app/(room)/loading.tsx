import { RouteLogoLoader } from "@/components/brand/logo-loader";
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

  /*
    Founder, 26 September: the one branded loader, the 24T mark, in place of
    the grey blocks. The same mark the page change overlay shows, so a slow
    stream and a slow round trip look alike. See components/brand/logo-loader.tsx.
  */
  /* On the room's own navy ground, with the white mark, so nothing flashes white before the call. */
  return <RouteLogoLoader label={t("common.loading")} tone="dark" className="min-h-dvh" />;
}
