"use client";

import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";

import { announceToAllTherapists } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

/**
 * Broadcast composer.
 *
 * The confirm step is not decoration: this is the one control in the product
 * that touches every customer at once, and there is no unsend. Typing the
 * recipient count is a deliberately annoying speed bump in front of an
 * irreversible action.
 */
export function AnnouncementComposer({ recipientCount }: { recipientCount: number }) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const armed = confirm.trim() === String(recipientCount) && recipientCount > 0;

  if (sent) {
    return (
      <Card className="p-5 text-center">
        <p className="text-base font-semibold text-slate-900">
          Sending to {recipientCount} clinician{recipientCount === 1 ? "" : "s"}
        </p>
        <p className="mt-1.5 text-sm text-slate-600">
          They go out one at a time in the background, so the provider does not rate-limit us and
          drop half the list. The send is recorded in the audit log.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => {
            setSent(false);
            setSubject("");
            setBody("");
            setConfirm("");
          }}
        >
          Write another
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Megaphone className="h-4 w-4 text-brand-600" aria-hidden />
        Compose
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        <Field label="Subject" htmlFor="announce-subject">
          <Input
            id="announce-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Crisis Radar is live"
          />
        </Field>

        <Field
          label="Message"
          htmlFor="announce-body"
          hint="Plain text. A blank line starts a new paragraph. Links are not rendered."
        >
          <Textarea
            id="announce-body"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"You can now go on call between appointments…\n\nSet your rate in Settings."}
          />
        </Field>

        <Field
          label={`Type ${recipientCount} to confirm`}
          htmlFor="announce-confirm"
          hint="There is no unsend."
        >
          <Input
            id="announce-confirm"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={String(recipientCount)}
          />
        </Field>

        <Button
          size="lg"
          disabled={pending || !armed}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await announceToAllTherapists(subject, body);
              if (result?.error) setError(result.error);
              else setSent(true);
            })
          }
        >
          <Megaphone className="h-4 w-4" aria-hidden />
          {pending
            ? "Queueing…"
            : `Send to ${recipientCount} clinician${recipientCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </Card>
  );
}
