import { NextResponse } from "next/server";

import { getClinicActor } from "@/lib/clinic-auth/session";
import { clinicWeek } from "@/lib/clinic-week";
import { exportBills, exportSchedule } from "@/lib/data/clinic-export";

export const dynamic = "force-dynamic";

/**
 * 🔴 63.17 / C334 — THE ONE ROUTE THAT TAKES DATA OUT OF THE BUILDING.
 *
 * A route handler rather than a server action, because a browser needs a response
 * with `Content-Disposition` on it to save a file, and an action returning a string
 * would mean a component assembling a blob and a download link out of it.
 *
 * ## 🔴 IT GUARDS ITSELF, AND `getClinicActor` RATHER THAN `requireClinic`
 *
 * `requireClinic` redirects, which is right for a page and wrong here: a fetch that
 * follows a redirect to a sign-in page saves the sign-in page as a CSV. A 401 with no
 * body is the honest answer to an unauthenticated request for a file.
 *
 * ## 🔴 AND NOTHING IN IT SELECTS ANYTHING
 *
 * The two functions it calls are the two the screens call. There is no query here to
 * quietly acquire an extra column, which is what "contains nothing the screen does
 * not already show" has to mean to be worth writing down.
 */
export async function GET(request: Request) {
  const actor = await getClinicActor();
  if (!actor) return new NextResponse(null, { status: 401 });

  const url = new URL(request.url);
  const what = url.searchParams.get("what");
  const week = clinicWeek(url.searchParams.get("week"), actor.zone.name);

  try {
    const result =
      what === "bills"
        ? await exportBills({
            actor,
            email: actor.email,
            clinicName: actor.clinicName,
          })
        : await exportSchedule({
            actor,
            email: actor.email,
            clinicName: actor.clinicName,
            /*
             * 🔴 W2-C06: THE WEEK ON THE SCREEN, through the function the screen
             * uses. It was a fixed 90 days back and 90 forward, against a screen
             * showing seven days and a watermark promising the file shows nothing
             * the screen does not. The query names a week, never a range: an
             * exporter who can name its own range can name a hundred years of it.
             */
            from: week.monday,
            to: week.next,
            /* 🔴 T8: the zone the rota on screen is read in, so the file agrees with it. */
            zone: actor.zone.name,
          });

    return new NextResponse(result.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${result.filename}"`,
        /* Nothing here is cacheable by anybody, least of all a shared proxy. */
        "cache-control": "no-store",
      },
    });
  } catch {
    /*
     * 🔴 403 WITH NO BODY. `exportSchedule` throws when the principal lacks the
     * capability, and `clinicSchedule` throws when it lacks the read. Saying which
     * would tell somebody probing this route exactly which permission to look for.
     */
    return new NextResponse(null, { status: 403 });
  }
}
