import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { PARTNER_LAUNCH_TARGETS } from "@/lib/partner/launch";
import { PARTNER_APPLY, PARTNER_SIGN_IN } from "@/lib/routing";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "What you can do with the 24Therapy API, each one a flow with a screen at one end, and what there is no endpoint for.",
};

/**
 * The developer page. PLAN.md 55.12, 28.5, C149, C255, C265, C277, 42.4.
 *
 * ## 🔴 55.12 — AN API WITH NO NAMED USE CASE IS A SET OF ENDPOINTS NOBODY CAN SELL
 *
 * Until this sprint this page said, correctly, that there was no public API, and listed the
 * four things one would have to promise before there was. Both halves of that are now
 * different: the API exists, and the four promises are kept by named mechanisms. So the page
 * changes from a refusal to a product, and the four promises stay on it RESTATED AS KEPT
 * rather than deleted, because a page that quietly drops the conditions it set on itself is
 * the one edit nobody could justify.
 *
 * ## 🔴 FIVE USE CASES, EACH WITH AN EXAMPLE, AND EVERY EXAMPLE IS A REAL ROUTE
 *
 * Each snippet is the shape of the handler that exists in `app/api/partner/v1/`, not an
 * aspiration. A docs page that documents a route somebody intends to write is the failure
 * C149 was about, and `verify:sprint55` asserts that every path printed here resolves to a
 * route file on disk.
 *
 * ## 🔴 AND A SECTION SAYING WHAT THERE IS NO ENDPOINT FOR
 *
 * The absences, named. An integrator's first question after reading five use cases is "can I
 * also get a list", and the answer needs to be on the same page as the five, in the same
 * voice, rather than discovered as a 404 three weeks in. *If what you want is not here, it is
 * not because we have not got round to it.*
 *
 * ## 🔴 PUBLIC, and that is 55.12's other half
 *
 * `lib/routing.ts` deliberately keeps `/developers` out of `PARTNER_PREFIXES`: a docs page
 * behind a sign-in is a docs page nobody evaluating us can read.
 */
export default async function DevelopersPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("devs.title")}</h1>
      <p className="mt-3 leading-relaxed text-slate-600">{t("devs.body")}</p>

      <div className="mt-10 space-y-8">
        {/*
          🔴 TWO USE CASES REMOVED HERE, 2026-09-14, and 55.12 is what caught them.
          ----------------------------------------------------------------------
          `employment/verify` and `clinicians/verify` were deleted from the API
          and this page still printed both, with request bodies and example
          responses, on a page whose whole purpose is to be read by somebody
          deciding whether to integrate. 55.12 exists to resolve every path
          printed here against a route file on disk, and it failed on exactly
          those two, which is the check doing its job rather than a tidy-up.

          Where they went: an HR connection is the SPONSOR's, on their own
          integrations page, because the organisation an identity question is
          about should be the portal somebody is signed into rather than a field
          on a form. EHR and FHIR are the CLINIC's setting, on the clinic plan,
          through `lib/ehr/`. Neither is a key a third party holds.
        */}
        {/* 🔴 55.6 / C277 — the key asks WHO MAY. It never reads. */}
        <UseCase
          title={t("devs.useCase3")}
          body={t("devs.useCase3Body")}
          needsLink={t("devs.needsLink")}
          exampleLabel={t("devs.example")}
          example={`GET /api/partner/v1/subjects/YOUR-REF/readers

200 { "readers": [ { "clinicianId": "...", "grantedAt": "..." } ] }

POST /api/partner/v1/launch
{ "clinician": "dr@example.com", "target": "patients" }

200 { "url": "https://.../api/partner/launch?token=..." }
open it in a new window: single use, two minutes,
then a one-hour session for that clinician
targets: ${PARTNER_LAUNCH_TARGETS.join(", ")}`}
        />

        {/* 🔴 55.7 — it happened, when, with whom. No note, no transcript, no price. */}
        <UseCase
          title={t("devs.useCase4")}
          body={t("devs.useCase4Body")}
          needsLink={t("devs.needsLink")}
          exampleLabel={t("devs.example")}
          example={`POST /api/partner/v1/sessions

{ "subjectRef": "YOUR-REF",
  "clinicianEmail": "dr@example.com",
  "startedAt": "2026-09-12T14:00:00Z",
  "durationMinutes": 50,
  "externalMeetingId": "M-8814" }

201 { "sessionId": "..." }
same externalMeetingId again -> the same sessionId`}
        />

        {/* 🔴 55.8 — approved, or 404. There is no draft in this response. */}
        <UseCase
          title={t("devs.useCase5")}
          body={t("devs.useCase5Body")}
          needsLink={t("devs.needsLink")}
          exampleLabel={t("devs.example")}
          example={`note.approved -> { "event": "note.approved", "id": "<sessionId>",
                   "ref": null, "at": "..." }

GET /api/partner/v1/notes/<sessionId>

200 { "approvedAt": "...", "content": "..." }
404 while it is a draft, and while nobody has approved it`}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════ sprint 68 ══ */}

      {/*
        🔴 68.23 — THE WHOLE INTEGRATION, AS A SEQUENCE, BEFORE THE ENDPOINT LIST.
        --------------------------------------------------------------------------
        An integrator reading a list of nine endpoints has to work out the order for
        themselves, and the order is the product: consent, then audio, then the note
        their clinician approves, then the summary their patient reads. Getting it
        wrong is not a 400 they can debug, it is a summary reaching a patient before
        anybody read it, which every other part of this system then refuses.

        So the steps come first, numbered, because this one genuinely is a sequence
        and a numbered marker here encodes something true rather than decorating.
      */}
      <h2 className="mt-14 text-lg font-bold tracking-tight text-slate-900">
        {t("devs.flow.title")}
      </h2>
      <p className="mt-2 leading-relaxed text-slate-600">{t("devs.flow.body")}</p>

      <ol className="mt-6 space-y-4">
        {(
          [
            ["devs.flow.s1", "devs.flow.s1Body", "POST /api/partner/v1/consent"],
            ["devs.flow.s2", "devs.flow.s2Body", "POST /api/partner/v1/sessions/<ref>/media"],
            [
              "devs.flow.s3",
              "devs.flow.s3Body",
              "GET /api/partner/v1/sessions/<ref>/transcript",
            ],
            ["devs.flow.s4", "devs.flow.s4Body", "GET /api/partner/v1/sessions/<ref>/note"],
            ["devs.flow.s5", "devs.flow.s5Body", "POST /api/partner/v1/sessions/<ref>/note"],
            [
              "devs.flow.s6",
              "devs.flow.s6Body",
              "POST /api/partner/v1/sessions/<ref>/summary",
            ],
          ] as const
        ).map(([title, body, route], i) => (
          <li key={route} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t(title)}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t(body)}</p>
              <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-slate-600">
                {route}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/*
        🔴 68.1 / 68.2 — THE ONE THING AN INTEGRATOR MUST GET RIGHT, IN ITS OWN BOX.

        Mid-session consent is the case every integration gets wrong, because the
        obvious build is a boolean. The offset is the whole difference and it is
        explained here rather than as a field description in a table.
      */}
      <Card className="mt-8 border-slate-200 p-5">
        <p className="font-semibold text-slate-900">{t("devs.midConsent")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t("devs.midConsentBody")}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`POST /api/partner/v1/consent
{ "session": "S-1024", "subject": "P-77",
  "state": "given", "answered_at": "2026-09-14T10:40:00Z",
  "offset_seconds": 600 }

200 { "recording_from_seconds": 600,
      "coverage": "Recording started 10 minutes into this
                   session. Nothing before that was recorded,
                   and nothing here was written from it.",
      "stopped_reason": null }`}
        </pre>
      </Card>

      {/*
        🔴 68.7 / 68.8 / 68.12 — THE COPILOT AND THE MEMORY, WHICH ARE NOT IN THE
        SEQUENCE BECAUSE THEY ARE NOT PART OF A SINGLE SESSION.

        A therapist asks about a patient between sessions and before them. Putting
        them in the numbered list above would say they belong at a step, and the
        thing an integrator would then build is a copilot that appears once.

        🔴 W2-X02: the end call leads the example, because both read only sessions
        their platform has said are over, and without it they read nothing.
      */}
      <Card className="mt-6 border-slate-200 p-5">
        <p className="font-semibold text-slate-900">{t("devs.copilot")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t("devs.copilotBody")}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`POST /api/partner/v1/sessions/<ref>/end
200 { "session": "S-1024", "ended_at": "..." }

PUT /api/partner/v1/copilot
{ "clinician": "C-9", "enabled": true }

POST /api/partner/v1/copilot
{ "subject": "P-77", "clinician": "C-9",
  "question": "What did we agree in March?" }

200 { "answer": "...[S-1024]...", "citations": ["S-1024"] }

GET /api/partner/v1/subjects/<ref>/memory
200 { "sessions": [ { "session": "S-1024", "note": "..." } ] }`}
        </pre>
      </Card>

      {/*
        🔴 68.15 / 68.17 / 68.18 — THE LIMIT, AND WHAT HAPPENS AT IT.

        Every metered API an integrator has used bills overage at the ceiling, so
        they will assume this one does. It does not, and the difference has to be on
        the docs page rather than discovered in a month where their therapists lost
        the copilot.
      */}
      <Card className="mt-6 border-amber-200 bg-amber-50 p-5">
        <p className="font-semibold text-amber-900">{t("devs.limit")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-900">{t("devs.limitBody")}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-amber-900/90 p-4 text-xs leading-relaxed text-amber-50">
{`409 { "error": "This account has reached the monthly
                 session limit it set (500). Your session is
                 unaffected and is held on your own platform.
                 Raise the limit to turn the AI back on." }`}
        </pre>
      </Card>

      {/*
        🔴 C17: WHAT A WEBHOOK CARRIES, AND WHAT EACH ID IS FOR.

        The subject events named the subject by OUR `partner_subjects` id, which
        no endpoint returns, so a partner had nothing to match it against. They
        carry the partner's own reference now, as `ref`. The session events carry
        our session id, which the notes route takes as it is. Four fields, never
        content (42.4): `lib/partner/webhooks.ts` builds the body as a literal.
      */}
      <Card className="mt-6 border-slate-200 p-5">
        <p className="font-semibold text-slate-900">{t("devs.hooks")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t("devs.hooksBody")}</p>
        <NeedsLink text={t("devs.needsLink")} />
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`POST <your endpoint>
x-24t-signature: t=<unix time>,v1=<hex HMAC-SHA256 of "t.body">
x-24t-delivery: <the same on every retry>

{ "event": "record.claimed", "id": "...",
  "ref": "P-77", "at": "2026-09-14T10:40:00Z" }

session.completed, note.approved
  id  = <sessionId> for GET /api/partner/v1/notes/<sessionId>
  ref = null
grant.revoked, record.claimed, subject.unlinked
  id  = our id for the patient, returned by no endpoint
  ref = the subject reference you sent us, e.g. P-77`}
        </pre>
      </Card>

      {/* 🔴 42.5 — the widget, and the sentence about video. */}
      <h2 className="mt-12 text-lg font-bold tracking-tight text-slate-900">{t("devs.widget")}</h2>
      <p className="mt-2 leading-relaxed text-slate-600">{t("devs.widgetBody")}</p>
      <NeedsLink text={t("devs.needsLink")} />

      {/* 🔴 The absences, on the same page as the five use cases. */}
      <Card className="mt-10 border-slate-200 p-5">
        <p className="font-semibold text-slate-900">{t("devs.limits")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t("devs.limitsBody")}</p>
      </Card>

      <h2 className="mt-12 text-lg font-bold tracking-tight text-slate-900">
        {t("devs.promises")}
      </h2>
      <p className="mt-2 leading-relaxed text-slate-600">{t("devs.promisesBody")}</p>
      <ul className="mt-4 space-y-4">
        <Kept title={t("devs.promise1")} body={t("devs.promise1Body")} />
        <Kept title={t("devs.promise2")} body={t("devs.promise2Body")} />
        <Kept title={t("devs.promise3")} body={t("devs.promise3Body")} />
        <Kept title={t("devs.promise4")} body={t("devs.promise4Body")} />
      </ul>

      <Card className="mt-10 border-amber-200 bg-amber-50 p-5">
        <p className="text-sm leading-relaxed text-amber-900/90">{t("devs.keysNote")}</p>
        {/* 🔴 C265 — said to an integrator before they design their retry loop. */}
        <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{t("devs.rateNote")}</p>
      </Card>

      <p className="mt-10 flex flex-wrap items-center gap-4">
        <Link
          href={PARTNER_APPLY}
          className="inline-flex h-12 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t("devs.getStarted")}
        </Link>
        {/* 🔴 W2-X06: the portal's own door, which nothing on the site linked to. */}
        <Link
          href={PARTNER_SIGN_IN}
          className="tap-target text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          {t("dev.signIn")}
        </Link>
      </p>
    </main>
  );
}

/**
 * 🔴 W3 / D6: THE RECORD LAYER IS DOCUMENTED AS NOT LIVE.
 *
 * Readers, launch, write-back, note delivery, the widget and every webhook need
 * `partner_subjects.person_id`, and nothing links a patient to a partner yet. The
 * routes exist and `verify:sprint55` still resolves every path printed here, so
 * the docs keep them and say plainly that they cannot be used today.
 */
function NeedsLink({ text }: { text: string }) {
  return <p className="mt-2 text-sm font-semibold text-amber-800">{text}</p>;
}

function UseCase({
  title,
  body,
  needsLink,
  exampleLabel,
  example,
}: {
  title: string;
  body: string;
  needsLink?: string;
  exampleLabel: string;
  example: string;
}) {
  return (
    <section className="border-s-2 border-slate-200 ps-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1.5 leading-relaxed text-slate-600">{body}</p>
      {needsLink ? <NeedsLink text={needsLink} /> : null}
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {exampleLabel}
      </p>
      {/*
       * 🔴 `overflow-x-auto` on the block rather than wrapping, because a wrapped request
       * line is a request line somebody copies wrong. The page body still never scrolls.
       */}
      <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
        <code>{example}</code>
      </pre>
    </section>
  );
}

function Kept({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-s-2 border-brand-300 ps-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}
