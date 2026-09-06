"use client";

import { useState, useTransition } from "react";
import { ShieldQuestion } from "lucide-react";

import { sayName, saySeen } from "@/app/(patient)/patient/claim/challenge-actions";
import { Button, Card, Input } from "@/components/ui";
import type { Challenge } from "@/lib/data/challenge";

/**
 * Two questions, one record at a time. PLAN.md 13.6–13.7, §3b.
 *
 * ## What this screen deliberately does not say
 *
 * 🔴 The therapist's name and nothing else. No patient name, not even redacted;
 * no dates, no session count, no "we found a record matching your number". A
 * person holding a recycled phone must be able to answer both questions
 * honestly and learn nothing about whoever held it before.
 *
 * ## One at a time
 *
 * Two therapists may hold the same number (§3b step 8), which produces two of
 * these. They are answered separately and claiming one never claims the other,
 * so they are rendered as a queue rather than a list with a single submit —
 * a form that takes both answers at once invites answering both the same way.
 */
export function ClaimChallenge({ challenges }: { challenges: Challenge[] }) {
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"seen" | "name">(challenges[0]?.stage ?? "seen");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const current = challenges[index];

  const next = () => {
    setIndex((i) => i + 1);
    setStage(challenges[index + 1]?.stage ?? "seen");
    setName("");
    setError(null);
  };

  if (!current) {
    return done.length > 0 ? (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">That is everything</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {done.length === 1
            ? "Your record is yours now."
            : `${done.length} records are yours now.`}{" "}
          Next you will be asked what your therapist may still see.
        </p>
      </Card>
    ) : null;
  }

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldQuestion className="h-4 w-4 text-slate-400" aria-hidden />
        {challenges.length > 1 ? `Question ${index + 1} of ${challenges.length}` : "One question"}
      </p>

      {stage === "seen" ? (
        <>
          <p className="mt-2 text-base leading-relaxed text-slate-800">
            Have you seen{" "}
            <span className="font-semibold">{current.therapistName}</span> before?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Your number matched a record they keep. If you have never seen them, say no — nothing
            is shown to you either way.
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await saySeen(current.patientId, true);
                  if (result.ok) setStage("name");
                  else setError(result.error);
                })
              }
            >
              Yes
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  // A no is final. `answerSeen` writes `rejected`, so this
                  // record is never offered to this account again.
                  await saySeen(current.patientId, false);
                  next();
                })
              }
              className="tap-target h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
            >
              No, I have not
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-base leading-relaxed text-slate-800">
            What first name did you give {current.therapistName}?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Type it as you gave it to them. We will not show it to you.
          </p>

          <div className="mt-3 space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder="First name"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || !name.trim()}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await sayName(current.patientId, name);
                    if (result.ok) {
                      setDone((d) => [...d, current.patientId]);
                      next();
                    } else {
                      setError(result.error);
                      if (result.locked) next();
                    }
                  })
                }
              >
                {pending ? "Checking…" : "Confirm"}
              </Button>
              <button
                type="button"
                disabled={pending}
                onClick={next}
                className="tap-target h-11 rounded-xl px-3 text-sm font-medium text-slate-600"
              >
                Skip for now
              </button>
            </div>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" aria-live="assertive" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
