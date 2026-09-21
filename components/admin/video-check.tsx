import { Video } from "lucide-react";

import { Card } from "@/components/ui";
import { videoHealth } from "@/lib/video";

/**
 * 🔴 79.1 — CAN THIS DEPLOYMENT PUT TWO PEOPLE IN A ROOM, ANSWERED ON A SCREEN.
 *
 * ## Why it exists
 *
 * It could not be answered anywhere. `DAILY_API_KEY` is a **sensitive**
 * variable on Vercel, so nobody, not the dashboard and not the person who typed
 * it, can read it back. The only way to find out whether video worked was to
 * book a session and watch what happened, which is exactly how it was found:
 * two people sat in a session that had no room, because the key had never been
 * set and nothing anywhere said so.
 *
 * ## Why it creates a real room
 *
 * `Boolean(env.dailyApiKey)`, which is what `features.video` returns, answers a
 * different and weaker question: whether a string is present. A revoked key, a
 * key with a typo and a key for the wrong account are all present. The only
 * question worth putting on a screen is the one the clinician is about to ask,
 * so this makes a room, confirms it, and deletes it again.
 *
 * It is a server component, so the probe runs during the render of a page that
 * is already behind `requireRole("super_admin")` and is not reachable by
 * anybody else.
 */
export async function VideoCheck() {
  const health = await videoHealth();

  return (
    <Card className="p-5">
      <div className="flex items-start gap-2.5">
        <Video className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">Video rooms</h2>
          <p
            className={`mt-1 text-sm leading-relaxed ${
              health.ok ? "text-teal-800" : "text-rose-700"
            }`}
            role={health.ok ? undefined : "alert"}
          >
            <span className="font-semibold">{health.ok ? "Working." : "Not working."}</span>{" "}
            {health.detail}
          </p>
          {health.ok ? null : (
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              No video session can start until this is fixed, and nobody will be invited
              to one. In person still works.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
