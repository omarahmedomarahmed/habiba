"use client";

import { useState, useTransition } from "react";
import { Lock, Send } from "lucide-react";

import { askForAccess } from "@/app/(app)/patients/actions";
import { Card } from "@/components/ui";
import type { AccessState } from "@/lib/access/state";

/**
 * What the therapist is told about their own access. PLAN.md 7.7 / §3.
 *
 * ## Two audiences, one sentence
 *
 * §3: "Say that plainly to the therapist; do not alarm the patient with it."
 * So this banner is blunt about what is missing and says nothing about the
 * patient's motives. It never says *revoked* — a clinician reading "this
 * patient revoked your access" hears an accusation, and the same fact stated
 * as "has not granted" is both true and not an incident.
 *
 * ## Why the request is a note and not a button
 *
 * A one-tap "request access" is a thing you can send forty of. Typing a reason
 * is friction on purpose, and the reason is what the patient reads before
 * deciding — a request with no note is a request they have to guess at.
 */
export function AccessBanner({
  patientId,
  state,
  message,
  canRequest,
  pendingSince,
}: {
  patientId: string;
  state: AccessState;
  message: string;
  canRequest: boolean;
  /** Set when a request is already waiting, so we do not offer to send another. */
  pendingSince: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError(null);
      const result = await askForAccess(patientId, note);
      if (result.error) setError(result.error);
      else {
        setSent(true);
        setOpen(false);
      }
    });

  const tone =
    state === "revoked"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Card className={`border ${tone}`}>
      <div className="flex items-start gap-2.5 px-4 py-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed">{message}</p>

          {sent || pendingSince ? (
            <p className="mt-2 text-xs opacity-80">
              You have asked for access. They will see your note next time they sign in — we do not
              chase them for you.
            </p>
          ) : canRequest && !open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tap-target mt-2 h-9 rounded-lg bg-white px-3 text-sm font-semibold shadow-sm ring-1 ring-amber-200 hover:bg-amber-100/50"
            >
              Ask for access
            </button>
          ) : canRequest && open ? (
            <div className="mt-2 space-y-2">
              <label htmlFor="access-note" className="block text-xs font-medium">
                Why are you asking? They read this.
              </label>
              <textarea
                id="access-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="I am preparing for our session on Thursday and would like to see your history."
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !note.trim()}
                  onClick={send}
                  className="tap-target flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {pending ? "Sending…" : "Send request"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="tap-target h-9 rounded-lg px-3 text-sm font-medium hover:bg-amber-100/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
