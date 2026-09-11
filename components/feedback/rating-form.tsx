"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Mail, Star } from "lucide-react";

import { rateSession, reportSession } from "@/app/feedback/[token]/actions";
import { PatientBriefCard } from "@/components/clinical/patient-brief-card";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { RTL_LANGUAGE_CODES, SERVICE_TAGS, THERAPIST_TAGS } from "@/lib/feedback-options";
import { formatCalendarDate, resolveZone } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

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
  sessionDateIso,
  therapistTimezone,
  therapistFirstName,
  brief,
  briefSteps,
  briefNext,
  briefLanguage,
  notePending,
  emailed,
  alreadyDone,
  paid,
  ratedApp,
}: {
  token: string;
  /** The instant, not a rendering — 11R.1 formats it in the reader's own zone. */
  sessionDateIso: string;
  therapistTimezone: string | null;
  therapistFirstName: string;
  brief: string | null;
  briefSteps: string[];
  briefNext: string;
  briefLanguage: string;
  notePending: boolean;
  /** A copy actually reached their inbox — do not claim one otherwise. */
  emailed: boolean;
  alreadyDone: boolean;
  paid: boolean;
  /** They rated the app when the session began; do not ask a second time. */
  ratedApp: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [therapistStars, setTherapistStars] = useState(0);
  const [sessionStars, setSessionStars] = useState(0);
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

  /*
   * 11R.1 — the day this session happened, in the reader's own zone.
   *
   * The server used to render this string with `toLocaleDateString(undefined)`,
   * which on Vercel is UTC: a 01:00 Cairo session was headed with the previous
   * day, and the patient reading it could reasonably think the page was about
   * a different session.
   */
  /*
   * 12.3 / C84 — the reader's zone, but only after mount.
   *
   * This read `Intl.DateTimeFormat().resolvedOptions().timeZone` during render.
   * On the SSR pass that is the *server's* zone, so the HTML said one day and
   * the hydrated DOM said another — on the public feedback page, which is the
   * first thing a patient sees after a session.
   *
   * The therapist's zone is the fallback rather than UTC: the server knows it,
   * both passes agree on it, and it is a far better guess for this reader than
   * UTC — they were in a session with that clinician an hour ago.
   */
  const detected = useReaderZone();
  const sessionDate = formatCalendarDate(
    new Date(sessionDateIso),
    resolveZone(detected, therapistTimezone).name,
  );

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await rateSession({
        token,
        therapistStars,
        sessionStars,
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
    const rtl = RTL_LANGUAGE_CODES.has(briefLanguage);
    return (
      <div className="space-y-4">
        <Heading date={sessionDate} title={t("prating.yourSession")} />
        <Card className="p-5 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">{t("room.thanks")}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
            {sent || emailed
              ? t("prating.summaryOnWay")
              : notePending
                ? t("prating.stillWriting", { name: therapistFirstName })
                : t("prating.keepLink")}
          </p>
        </Card>

        {brief ? (
          <Card className="p-5">
            <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              {t("prating.yourSummary")}
            </p>
            {/* Same component the clinician approved this on, so what they
                saw and what you are reading cannot drift apart. */}
            <PatientBriefCard
              className="mt-2"
              brief={brief}
              steps={briefSteps}
              next={briefNext}
              rtl={rtl}
            />
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
              {t("prating.writtenForYou")}
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

  const ready =
    therapistStars > 0 && sessionStars > 0 && (ratedApp || serviceStars > 0) && email.includes("@");

  return (
    <div className="space-y-4">
      <Heading
        date={sessionDate}
        title={t("prating.oneMinute")}
        blurb="Rate the session and tell us where to send the summary. It is the only thing we ask, and it is what keeps the good therapists visible to the next person."
      />

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
          <p className="text-sm font-semibold text-slate-900">{t("prating.andSession")}</p>
          <p className="text-xs text-slate-500">
            Whether this half hour was any use to you, a different question from whether
            {" "}
            {therapistFirstName} was the right person.
          </p>
          <Stars value={sessionStars} onChange={setSessionStars} label="Rate the session" />
        </div>

        {/*
          The app question only if it was not already answered.
          -----------------------------------------------------
          It is asked when the session starts, because "how easy was it to find
          somebody" is about the part they have experienced and the therapy has
          not yet coloured. Asking again here would collect a different feeling
          under the same name.
        */}
        {!ratedApp ? (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-900">{t("prating.andApp")}</p>
            <p className="text-xs text-slate-500">{t("prating.andAppBody")}</p>
            <Stars value={serviceStars} onChange={setServiceStars} label="Rate the service" />
            <TagRow
              options={SERVICE_TAGS}
              selected={serviceTags}
              onToggle={(value) => toggle(serviceTags, setServiceTags, value)}
            />
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-4">
          <label
            htmlFor="feedback-comment"
            className="text-sm font-semibold text-slate-900"
          >
            {t("prating.anythingElse")}{" "}
            <span className="font-normal text-slate-400">{t("prating.optional")}</span>
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("prating.noName")}
          </p>
          <Textarea
            id="feedback-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2"
            placeholder={t("prating.commentPlaceholder")}
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label htmlFor="feedback-email" className="text-sm font-semibold text-slate-900">
            {t("prating.whereSummary")}
          </label>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("prating.summaryBody")}
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
            placeholder={t("room.emailPlaceholder")}
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
            {t("prating.ratingsAndEmail")}
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

function Heading({ date, title, blurb }: { date: string; title: string; blurb?: string }) {
  const t = useT();
  return (
    <div>
      <p className="text-xs font-bold tracking-wider text-teal-600 uppercase">{date}</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {blurb ? <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{blurb}</p> : null}
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
  const t = useT();
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
  const t = useT();
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
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  if (reported) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("prating.reported")}</p>
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
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("prating.neverJoined")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setReporting("abuse")}
          className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          {t("prating.reportSomething")}
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
          : "This has gone straight to 24Therapy, not to your therapist. Someone will read it today and will contact you if you left an address.",
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
          : "This goes to 24Therapy, not to your therapist. Nobody at their practice sees it. If it concerns what was said or done during the session, say so. We can look at the session record, including any period the recording was paused."}
      </p>

      {reporting === "abuse" ? (
        <Textarea
          rows={4}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={t("prating.reportPlaceholder")}
        />
      ) : null}

      <Input
        type="email"
        inputMode="email"
        autoCapitalize="none"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("prating.replyEmail")}
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
          {t("common.cancel")}
        </Button>
      </div>
    </Card>
  );
}
