"use client";

import Link from "next/link";
import { Video } from "lucide-react";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 76.17 — YOUR SESSION HAS STARTED. GO IN.
 *
 * ## Why a strip at the top and not another orb
 *
 * There are already two round things that can be on a patient's screen and each
 * one means something: the SOS orb is the crisis path, and the payment orb is
 * money they owe. A third circle would make the set unreadable, and the moment
 * it mattered most is the moment somebody has the least attention to spend
 * telling three circles apart.
 *
 * This is also not the same message as those two. They are things waiting for
 * the patient whenever they get to them. This one is somebody in a room right
 * now, so it takes the top of the screen, states the fact, and is entirely a
 * link: there is exactly one thing to do and the whole strip does it.
 *
 * ## 🔴 IT DOES NOT COVER THE SOS ORB, and it cannot
 *
 * C235: a patient's crisis path never depends on money and never depends on
 * anything else either. The orb is fixed to the bottom corner at `z-[70]`; this
 * is in the page flow at the top. They cannot overlap, which is stronger than
 * agreeing about a z-index.
 *
 * ## It does not render inside the room
 *
 * The caller decides, and the patient shell already knows which page it is on.
 * A banner saying "go in" on the page you are in is a product that has not
 * noticed you did what it asked.
 */
export function SessionStarted({
  href,
  therapistName,
}: {
  href: string;
  therapistName: string;
}) {
  const t = useT();

  return (
    <Link
      href={href}
      className="mx-auto mb-2 flex max-w-md items-center gap-3 rounded-2xl bg-red-600 px-4 py-3 text-white shadow-lg shadow-red-600/20 active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20"
      >
        <Video className="h-4 w-4" />
        {/*
          A quiet pulse rather than a blinking one. It has to read as live from
          the corner of an eye without becoming the reason somebody puts the
          phone down.
        */}
        <span className="absolute inset-0 animate-ping rounded-full bg-white/30 motion-reduce:animate-none" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold tracking-tight">{t("plive.started")}</span>
        <span className="block truncate text-xs text-white/80">
          {therapistName ? t("plive.waiting", { name: therapistName }) : t("plive.waitingAnon")}
        </span>
      </span>

      <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-600">
        {t("plive.goIn")}
      </span>
    </Link>
  );
}
