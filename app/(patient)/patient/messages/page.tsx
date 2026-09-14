import type { Metadata } from "next";

import { PatientBack } from "@/components/patient/back";
import { CheckinSwitch } from "@/components/patient/checkin-switch";
import { SeesWhat } from "@/components/visual/primitives";
import { isMuted } from "@/lib/data/checkins";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages asking how you are", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 44.1 / 44.2 — the patient's own control over the unprompted channel.
 *
 * ## 🔴 IT SAYS WHAT HAPPENS TO A WORRYING REPLY, BEFORE THEY EVER REPLY
 *
 * 44.2 is that a check-in never interprets and a worrying reply goes to the crisis path. A patient
 * has no way to know either of those unless we say so, and the moment to say it is before they
 * write something rather than after. So `checkin.crisisNote` is on this screen: if you write
 * something that sounds like danger we will show you where to get help and tell your therapist, and
 * nothing else about your reply is read by anybody or given to a computer to interpret.
 *
 * That sentence is only sayable because `lib/checkins/` imports nothing from `lib/ai/`.
 */
export default async function PatientMessagesPage() {
  const actor = await requirePatient();
  const { t, locale } = await getI18n();

  const { muted, mutedAt } = await isMuted(actor.personId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      {/*
        🔴 C185 — a way back, on every patient screen that is not a tab.

        This page shipped in sprint 44 without one and `verify:sprint37r` caught it in sprint 52's
        sweep. Check-ins is reached from the account screen and is not one of the five tabs, so
        without this the only way out is the browser's own back button, which on a phone in a
        saved-to-home-screen app is not there at all.
      */}
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("checkin.settingsTitle")}
        </h1>
      </div>

      {/*
        🔴 65.5 / 44.2 — WHO READS A CHECK-IN REPLY, AS TWO COLUMNS.

        This screen was 98 words in three grey paragraphs around one switch: what a
        check-in is, what happens if a reply sounds like danger, and how to stop them.
        The middle one is the only thing on the page a person needs before they answer,
        and it was the last thing on it.

        🔴 SAID BEFORE THEY REPLY RATHER THAN AFTER, which is 44.2, and that argument is
        an argument about position. Above the switch, in the same size as everything
        else, is where it has to be for the ruling to be true.
      */}
      <SeesWhat
        who={t("checkin.whoReply")}
        can={[t("checkin.canDanger"), t("checkin.canTellTherapist")]}
        cannot={[t("checkin.cannotRead"), t("checkin.cannotMachine")]}
      />

      <CheckinSwitch
        on={!muted}
        mutedOn={mutedAt ? formatDate(mutedAt, "UTC", locale) : null}
      />

      <p className="text-sm leading-relaxed text-slate-600">{t("checkin.howToStop")}</p>
    </div>
  );
}
