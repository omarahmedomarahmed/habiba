"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { askPreviousTherapist } from "@/app/(patient)/patient/consent/actions";
import { Button, Card } from "@/components/ui";

/**
 * "Ask my previous therapist to add my history." PLAN.md 27.7, C108.
 *
 * ## 🔴 The word is ask
 *
 * Never "get", never "retrieve", never "import my history". We cannot promise
 * that an old clinician cooperates: they may have left the profession, may
 * want paying, may simply not want to. A button that says "get my history"
 * makes a promise the product has no way to keep, and the person who finds out
 * it was false is the one who needed it.
 *
 * What the product can promise, and does, is that they find out either way:
 * the clinician adds something, or declines with a reason the patient reads,
 * and the database refuses a decline with no reason at all.
 */
export function AskHistory({
  clinicians,
  asks,
}: {
  clinicians: { userId: string; name: string }[];
  asks: {
    id: string;
    therapistName: string;
    status: "pending" | "added" | "declined";
    declineReason: string | null;
  }[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (clinicians.length === 0 && asks.length === 0) return null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">
        Ask a therapist you saw before to add what they hold
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        They do not have to, and we cannot make them. What we can do is make sure you hear back:
        they either add it, or they say no and tell you why.
      </p>

      {asks.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {asks.map((ask) => (
            <li key={ask.id} className="rounded-xl bg-slate-50 px-3.5 py-3">
              <p className="text-sm font-medium text-slate-900">{ask.therapistName}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {ask.status === "pending"
                  ? "Waiting. They have been told, and they can see it on their own screen."
                  : ask.status === "added"
                    ? "They added what they hold. It is in your profile."
                    : `They said no. In their words: “${ask.declineReason}”`}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {clinicians.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            aria-label="Which therapist"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
          >
            <option value="">Choose a therapist you have seen</option>
            {clinicians.map((clinician) => (
              <option key={clinician.userId} value={clinician.userId}>
                {clinician.name}
              </option>
            ))}
          </select>

          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything you want to say to them (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed"
          />

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <Button
            variant="secondary"
            disabled={pending || !choice}
            onClick={() =>
              start(async () => {
                const result = await askPreviousTherapist(choice, note);
                setError(result.error ?? null);
                if (!result.error) {
                  setChoice("");
                  setNote("");
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Asking…" : "Ask them"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
