"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { agreeToCrossBorder, withdrawCrossBorder } from "@/app/(patient)/patient/residency/actions";
import { Button, Card } from "@/components/ui";

/**
 * Where your record is kept, and whether you agreed to it. PLAN.md 30.3.
 *
 * ## 🔴 It shows the fact before it asks for anything
 *
 * The country is named first, in a sentence, and the button is underneath. A
 * consent screen that leads with the button and buries the country in a link
 * is a consent screen designed to be pressed rather than read, and the entire
 * legal value of this row is that somebody read it.
 *
 * There is no "remind me later" and no dismissal. Not agreeing is a supported
 * state: the product keeps working, and this stays on the screen. A person who
 * has not agreed to their record leaving the country has said something, and
 * making that state invisible would be treating silence as assent.
 */
export function ResidencyNotice({
  crosses,
  agreedAt,
  wording,
  homeLabel,
  servingLabel,
}: {
  crosses: boolean;
  agreedAt: string | null;
  wording: string | null;
  homeLabel: string;
  servingLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!crosses) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">Where your record is kept</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          In {homeLabel}, which is where it belongs. Nothing crosses a border, so there is nothing
          for you to agree to here.
        </p>
      </Card>
    );
  }

  return (
    <Card className={agreedAt ? "p-5" : "border-amber-200 bg-amber-50 p-5"}>
      <p className="text-sm font-semibold text-slate-900">
        Your record is kept in {servingLabel}, not {homeLabel}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{wording}</p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {agreedAt ? (
        <div className="mt-4">
          <p className="text-sm text-slate-600">You agreed to this on {agreedAt}.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await withdrawCrossBorder();
                router.refresh();
              })
            }
            className="mt-2 text-sm font-semibold text-slate-500"
          >
            Withdraw that
          </button>
        </div>
      ) : (
        <Button
          className="mt-4"
          full
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await agreeToCrossBorder();
              setError(result.error ?? null);
              if (!result.error) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "I understand, and I agree"}
        </Button>
      )}
    </Card>
  );
}
