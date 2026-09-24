import type { Metadata } from "next";

import { RosterList } from "@/components/sponsor/roster-list";
import { roster } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Who is on your list", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The roster. PLAN.md 53.17b, 53.19b, 53.22, C227, C234.
 *
 * 🔴 There is no approval queue and there is no roster to approve (C227). What
 * this page shows is who has ALREADY activated the benefit by crossing a gate
 * automatically. The sponsor never approved any of them, never saw a rejection
 * and cannot see when anybody joined.
 *
 * 🔴 `requireSponsor` reads the page; `requireSponsorAdmin` inside the action ends
 * a benefit. A viewer sees the list and the removal control is not rendered for
 * them — and the action re-checks, because a control that is merely hidden is a
 * control somebody reaches with a form post.
 */
export default async function SponsorPeoplePage() {
  const actor = await requireSponsor();
  const { t } = await getI18n();
  /* 🔴 37L.9 — "last verified" is a date a person reads, not an identifier. */
  const settings = await getSettings();

  const people = await roster(actor.sponsorId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sponsor.roster")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("sponsor.rosterBody")}</p>
        <p className="mt-1 text-xs text-slate-500">
          {t("sponsor.rosterCount", { count: people.length })}
        </p>
      </div>

      <RosterList
        canRemove={actor.role === "admin"}
        people={people.map((person) => ({
          enrolmentId: person.enrolmentId,
          name: person.name,
          /* W2-S11: the company's OWN pause, which is theirs to see and undo. */
          held: person.heldByYou,
          /*
           * 🔴 E2 — no per-person date and no per-person pause, on purpose.
           *
           * This rendered `last_verified_at` under a comment saying it was the
           * SPONSOR'S cycle date, the same for everybody. It is not: it is
           * stamped when each person re-proves their employment
           * (`confirmEnrolmentCode`) or is unpaused, and after a cycle pauses
           * everybody at once, people re-prove when they next want to use the
           * benefit. So the date, and the "Paused" badge beside it, told the
           * company which named employee came back to therapy and when. The
           * name stays (the founder's decision: "End their benefit" needs it);
           * nothing about any one person's use of it does.
           */
        }))}
      />

      {/* 🔴 53.19b / C247 — the cycle, and that a pause touches nothing else. */}
      <p className="text-xs leading-relaxed text-slate-500">
        {t("sponsor.verifyCycle", { months: settings.sponsor.verifyCycleMonths })}
      </p>
    </div>
  );
}
