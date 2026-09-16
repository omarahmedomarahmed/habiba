"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 76.4 — THE PAYMENT THEY MINIMISED, FOLLOWING THEM AROUND THE PRODUCT.
 *
 * ## What it is for
 *
 * The rail has a middle state that lasts hours: the payer has sent money and
 * an operator has not yet looked at it. That state is durable on the server and
 * was invisible everywhere except the one screen they paid on. So somebody who
 * paid, closed the popup and went to look at their calendar had no way back to
 * it, and no way to tell whether anything was happening.
 *
 * A patient in that position books again. A company in that position emails. A
 * clinician in that position assumes the subscription failed. All three are the
 * same defect, which is why this is one bar in every layout rather than three.
 *
 * ## Why it is a link and not a toast
 *
 * A toast expires, and this state outlives any session. The bar is rendered
 * from the server on every page load for as long as the payment is live, so
 * there is nothing to keep alive in the browser and nothing to lose by
 * navigating.
 *
 * ## The one thing the browser remembers
 *
 * Which SUCCESS notices this person has already dismissed. A confirmed payment
 * stops being urgent the moment they have seen it, but it stays true, and the
 * server has no business storing "has read a banner". A pending one cannot be
 * dismissed at all: it is not finished, and hiding it is how somebody pays
 * twice.
 */
export function PendingBar({
  /** "Session with Dr Mona" / "Your March bill" / "Pot top-up". */
  what,
  /** "1,140 EGP", formatted on the server (C84). Empty while they choose. */
  amount,
  /** Where the popup lives. */
  href,
  /** 🔴 76.13 — which of the three stages this payment is in. */
  stage,
  /** Stable per payment, so dismissing one does not hide the next. */
  paymentId,
}: {
  what: string;
  amount: string;
  href: string;
  stage: "open" | "submitted" | "confirmed";
  paymentId: string;
}) {
  const done = stage === "confirmed";
  const t = useT();
  const [hidden, setHidden] = useState(false);

  /*
   * Read in an effect, never during render: `localStorage` during render is a
   * hydration mismatch and throws outright with site data blocked. The bar
   * showing once more than necessary is a far better failure than the bar never
   * showing at all.
   */
  useEffect(() => {
    if (!done) return;
    try {
      if (window.localStorage.getItem(`paid:${paymentId}`) === "seen") setHidden(true);
    } catch {
      /* Nothing remembered. It shows again, which is harmless for a success. */
    }
  }, [done, paymentId]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(`paid:${paymentId}`, "seen");
    } catch {
      /* It will show once more. */
    }
  };

  return (
    <div
      role="status"
      className={
        /*
         * 🔴 RED for the one that needs them, amber for the one that needs us.
         * An open payment is unfinished business and reads as an instruction;
         * a submitted one is a receipt.
         */
        stage === "confirmed"
          ? "flex items-center gap-3 bg-emerald-600 px-4 py-2 text-white"
          : stage === "open"
            ? "flex items-center gap-3 bg-red-600 px-4 py-2 text-white"
            : "flex items-center gap-3 bg-amber-500 px-4 py-2 text-amber-950"
      }
    >
      <Link href={href} className="min-w-0 flex-1">
        {/*
          🔴 76.23 — THE AMOUNT IS NEVER THE PART THAT GETS CUT OFF.

          This was one sentence in one `truncate` paragraph: "{what} · {amount}
          unfinished". At 390 pixels, which is the width this is read at, a
          session named after a clinician fills the line and the browser
          truncates from the end, so the frame read

              Session with Dr Mona Demo · EGP 1,1…

          and the amount, the one fact a payer needs in order to act, was the
          half that disappeared. Nothing about the props or the copy was wrong.
          It was only wrong on screen, which is why it took a photograph.

          So they are two elements now: the subject may truncate, because a
          clinician's name can be recovered by tapping, and the figure is
          `shrink-0` and cannot.
        */}
        <p className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="min-w-0 truncate">{what}</span>
          <span className="shrink-0 tabular-nums">{amount}</span>
        </p>
        {/*
          🔴 AND THE STATE MOVES TO THE SECOND LINE, where it has room.

          Three things are true and the colour already says which: red is
          unfinished business waiting on the payer, amber is waiting on us,
          green is done. The words underneath say what to DO about it, which is
          the part a colour cannot carry.

          "How long" matters most of all: waiting with no horizon is
          indistinguishable from broken, and a payer who decides it is broken
          transfers again.
        */}
        <p className="truncate text-xs opacity-80">
          {stage === "confirmed"
            ? t("bar.stateDone")
            : stage === "open"
              ? t("bar.openHint")
              : t("bar.eta")}
        </p>
      </Link>

      {done ? (
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold"
        >
          {t("bar.dismiss")}
        </button>
      ) : (
        <Link
          href={href}
          className="shrink-0 rounded-lg bg-white/25 px-2 py-1 text-xs font-semibold"
        >
          {t("bar.reopen")}
        </Link>
      )}
    </div>
  );
}
