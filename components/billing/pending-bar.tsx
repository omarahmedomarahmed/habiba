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
  /**
   * 🔴 76.37 — WHAT THE SHEET REMEMBERS ITSELF UNDER, so this bar can OPEN it.
   *
   * The bar was a link to the page the sheet lives on. For a clinician that is
   * the billing screen, which carries a ledger, a plan card and an invoice
   * list, so somebody who tapped a bar about money they owe landed on a page
   * and had to go and find the thing again. A bar that follows you around the
   * product exists to be one tap from the thing, not one tap from its
   * neighbourhood.
   *
   * `PaymentPopup` opens itself when `pay:<storageKey>` is set and reads that on
   * mount. So this writes the key and then navigates, and the sheet is already
   * open when the page paints. One mechanism, already there, used from one more
   * place.
   */
  storageKey,
}: {
  what: string;
  amount: string;
  href: string;
  stage: "open" | "submitted" | "confirmed";
  paymentId: string;
  storageKey: string;
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

  /*
   * 🔴 FIRE AND FORGET, and a failure costs the convenience rather than the
   * payment. Blocked site data means they land on the page with the sheet
   * closed, which is exactly where this bar used to leave everybody.
   */
  const openSheet = () => {
    try {
      window.localStorage.setItem(`pay:${storageKey}`, "open");
    } catch {
      /* They arrive at the page and tap once more. */
    }
  };

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
         * 🔴 76.37 — AMBER FOR BOTH UNFINISHED STATES, AND RED FOR NOTHING.
         *
         * The open stage used to be red. Red in this product means one thing
         * and it is not money: it is the crisis surface, the SOS orb, the risk
         * banner, the sentence a patient reads when somebody is in danger.
         * Spending it on "you have a payment you have not finished" is spending
         * the loudest colour available on a bill, and a person who learns that
         * red means a bill has learned to glance past red.
         *
         * So both unfinished states are warning-coloured and the darker one is
         * the one waiting on the payer. Green still means done, because that is
         * a receipt and nothing else in the product claims it.
         *
         * 🔴 AND THE GREEN IS 700, BECAUSE 600 COULD NOT CARRY THE WORDS ON IT.
         *
         * A crawler that reads computed pixels on every signed-in screen found
         * this bar at 3.65:1 — white on `emerald-600` #009966, under the 4.5
         * body text needs, on all four of its own labels. It had been read as
         * a palette question ("is this green the right green?") and was never
         * measured, which is how a contrast failure survives being looked at.
         *
         * `emerald-700` is 5.36:1 and still unmistakably the receipt colour.
         * The two amber states carry `amber-950` rather than white and were
         * never in question; they measure 11.4 and 14.2.
         */
        stage === "confirmed"
          ? "flex items-center gap-3 bg-emerald-700 px-4 py-2 text-white print:hidden"
          : stage === "open"
            ? "flex items-center gap-3 bg-amber-500 px-4 py-2 text-amber-950 print:hidden"
            : "flex items-center gap-3 bg-amber-300 px-4 py-2 text-amber-950 print:hidden"
      }
    >
      <Link href={href} onClick={openSheet} className="min-w-0 flex-1">
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
          onClick={openSheet}
          className="shrink-0 rounded-lg bg-white/25 px-2 py-1 text-xs font-semibold"
        >
          {t("bar.reopen")}
        </Link>
      )}
    </div>
  );
}
