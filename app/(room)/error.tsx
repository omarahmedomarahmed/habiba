"use client";

import { useEffect } from "react";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 0165: THE LIVE ROOM'S OWN BOUNDARY.
 *
 * A throw in the room reached `app/global-error.tsx`, which replaces the root
 * layout: the room, the language corner and every way back into the call went
 * with it. The call itself is on the video provider and usually still running,
 * so the one useful thing is "try again", which re-renders this segment and
 * puts the clinician back in the room.
 *
 * On the room's own dark ground, so light text. No stack and no message: an
 * error in a session can carry a line of the transcript, and only the digest
 * goes to the console, which is what ties it to a server log line.
 */
export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (error.digest) console.error("room route error", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-base font-semibold text-white">{t("error.title")}</p>
      <p className="max-w-sm text-sm leading-relaxed text-white/70">{t("error.roomBody")}</p>
      <button
        type="button"
        onClick={reset}
        className="tap-target rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy-600"
      >
        {t("error.retry")}
      </button>
    </div>
  );
}
