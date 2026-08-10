"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Mail, Star } from "lucide-react";

import { rateSession, reportSession } from "@/app/feedback/[token]/actions";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { SERVICE_TAGS, THERAPIST_TAGS, RTL_LANGUAGES } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * The rating form a patient fills in to get their summary.
 *
 * Everything here is one screen and no account. Somebody who has just finished
 * a difficult half hour is not going to work through a wizard, and the whole
 * mechanism depends on them completing it — the summary is what they came back
 * for and this stands between them and it.
 *
 * Two ratings, side by side, because they are different questions. A patient
 * who says "she was wonderful, the video kept dropping" has told us the single
 * most useful thing anyone will tell us all week, and a combined score would
 * have thrown it away.
 */
export function RatingForm({
  token,
  therapistFirstName,
  brief,
  briefLanguage,
  notePending,
  alreadyDone,
  paid,
}: {
  token: string;
  therapistFirstName: string;
  brief: string | null;
  briefLanguage: string;
  notePending: boolean;
  alreadyDone: boolean;
  paid: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [therapistStars, setTherapistStars] = useState(0);
  const [serviceStars, setServiceStars] = useState(0);
  const [therapistTags, setTherapistTags] = useState<string[]>([]);
  const [serviceTags, setServiceTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyDone);
  const [sent, setSent] = useState(false);
  const [reporting, setReporting] = useState<null | "no_show" | "abuse">(null);
  const [reportDetail, setReportDetail] = useState("");
  const [reported, setReported] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await rateSession({
        token,
        therapistStars,
        serviceStars,
        therapistTags,
        serviceTags,
        comment,
        email,
      });
      if (result.error) setError(result.error);
      else {
        setDone(true);
        setSent(Boolean(result.sent));
      }
    });

  /* ------------------------------------------------------------- done -- */

  if (done) {
    const rtl = RTL_LANGUAGES.has(briefLanguage);
    return (
      <div className="space-y-4">
        <Card className="p-5 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">Thank you</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
            {sent
              ? "Your summary is on its way to your inbox. It is also below."
              : notePending
                ? `${therapistFirstName} is still writing up the session. Your summary will arrive by email as soon as it is signed — usually within the hour.`
                : "Your summary is below, and a copy is in your inbox."}
          </p>
        </Card>

        {brief ? (
          <Card className="p-5">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Your summary
            </p>
            <div
              dir={rtl ? "rtl" : "ltr"}
              className={cn(
                "mt-2 space-y-3 text-[15px] leading-relaxed text-slate-800",
                rtl && "text-right",
              )}
            >
              {brief
                .split("\n")
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
              This is written for you. Your therapist keeps a separate clinical note, which stays
              with them.
            </p>
          </Card>
        ) : null}

        <ReportBox
          token={token}
          paid={paid}
          reporting={reporting}
          setReporting={setReporting}
          detail={reportDetail}
          setDetail={setReportDetail}
          reported={reported}
          setReported={setReported}
        />
      </div>
    );
  }

  /* ------------------------------------------------------------- form -- */

  const ready = therapistStars > 0 && serviceStars > 0 && email.includes("@");

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            How was your session with {therapistFirstName}?
          </p>
          <Stars value={therapistStars} onChange={setTherapistStars} label="Rate your therapist" />
          <TagRow
            options={THERAPIST_TAGS}
            selected={therapistTags}
            onToggle={(value) => toggle(therapistTags, setTherapistTags, value)}
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-900">And how was 24Therapy itself?</p>
          <p className="text-xs text-slate-500">Finding someone, connecting, the app.</p>
          <Stars value={serviceStars} onChange={setServiceStars} label="Rate the service" />
          <TagRow
            options={SERVICE_TAGS}
            selected={serviceTags}
            onToggle={(value) => toggle(serviceTags, setServiceTags, value)}
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label
            htmlFor="feedback-comment"
            className="text-sm font-semibold text-slate-900"
          >
            Anything else? <span className="font-normal text-slate-400">Optional</span>
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Your therapist sees this without your name on it.
          </p>
          <Textarea
            id="feedback-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2"
            placeholder="What helped, what did not."
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label htmlFor="feedback-email" className="text-sm font-semibold text-slate-900">
            Where shall we send your summary?
          </label>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            A plain-language summary of what you talked about and what you agreed. We use this
            address for that and to reach you about this session — nothing else.
          </p>
          <Input
            id="feedback-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2"
            placeholder="you@example.com"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <Button full disabled={pending || !ready} onClick={submit}>
          <Mail className="h-4 w-4" aria-hidden />
          {pending ? "Sending…" : "Send me my summary"}
        </Button>
        {!ready ? (
          <p className="text-center text-xs text-slate-400">
            Both ratings and an email address, and it is yours.
          </p>
        ) : null}
      </Card>

      <ReportBox
        token={token}
        paid={paid}
        reporting={reporting}
        setReporting={setReporting}
        detail={reportDetail}
        setDetail={setReportDetail}
        reported={reported}
        setReported={setReported}
      />
    </div>
  );
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="mt-2 flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} out of 5`}
          onClick={() => onChange(star)}
          className="tap-target flex items-center justify-center"
        >
          <Star
            className={cn(
              "h-8 w-8 transition-colors",
              star <= value ? "fill-amber-400 text-amber-400" : "text-slate-200",
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

function TagRow({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={selected.includes(option)}
          onClick={() => onToggle(option)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            selected.includes(option)
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * The other kind of feedback.
 *
 * Kept below the stars and behind a click, because most sessions are fine and
 * leading with "did something go wrong?" sets a tone. But it is on the same
 * page, always, and it goes to us rather than to the clinician — a patient who
 * needs to report a therapist must never have to ask that therapist for the
 * address to report them to.
 */
function ReportBox({
  token,
  paid,
  reporting,
  setReporting,
  detail,
  setDetail,
  reported,
  setReported,
}: {
  token: string;
  paid: boolean;
  reporting: null | "no_show" | "abuse";
  setReporting: (v: null | "no_show" | "abuse") => void;
  detail: string;
  setDetail: (v: string) => void;
  reported: string | null;
  setReported: (v: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  if (reported) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Reported</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{reported}</p>
      </Card>
    );
  }

  if (!reporting) {
    return (
      <div className="space-y-2">
        {paid ? (
          <button
            type="button"
            onClick={() => setReporting("no_show")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            They never joined — I want my money back
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setReporting("abuse")}
          className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          Report something that happened in this session
        </button>
      </div>
    );
  }

  const send = () =>
    startTransition(async () => {
      setError(null);
      const result = await reportSession({ token, kind: reporting, detail, email });
      if (result.error) {
        setError(result.error);
        return;
      }
      setReported(
        reporting === "no_show"
          ? "Your payment has been refunded and this therapist is off the radar while we look into it. The refund reaches your card in a few days."
          : "This has gone straight to 24Therapy — not to your therapist. Someone will read it today and will contact you if you left an address.",
      );
      setReporting(null);
    });

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">
        {reporting === "no_show" ? "They did not join" : "Tell us what happened"}
      </p>
      <p className="text-xs leading-relaxed text-slate-500">
        {reporting === "no_show"
          ? "We refund you straight away and take them off the radar. No need to explain."
          : "This goes to 24Therapy, not to your therapist. Nobody at their practice sees it. If it concerns what was said or done during the session, say so — we can look at the session record, including any period the recording was paused."}
      </p>

      {reporting === "abuse" ? (
        <Textarea
          rows={4}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="What happened, and roughly when in the session."
        />
      ) : null}

      <Input
        type="email"
        inputMode="email"
        autoCapitalize="none"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Your email, so we can reply (optional)"
      />

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="danger" disabled={pending} onClick={send}>
          {pending ? "Sending…" : reporting === "no_show" ? "Refund me" : "Send to 24Therapy"}
        </Button>
        <Button variant="secondary" onClick={() => setReporting(null)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
