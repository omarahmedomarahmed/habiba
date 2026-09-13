import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { PARTNER_LAUNCH_TARGETS } from "@/lib/partner/launch";
import { PARTNER_APPLY } from "@/lib/routing";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "Five things you can do with the 24Therapy API, each one a flow with a screen at one end, and the four things there is no endpoint for.",
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
        {/* 🔴 55.4 / C255 / C265 — one identifier, one boolean, one timestamp. */}
        <UseCase
          title={t("devs.useCase1")}
          body={t("devs.useCase1Body")}
          exampleLabel={t("devs.example")}
          example={`POST /api/partner/v1/employment/verify
Authorization: Bearer 24t_sk_live_...

{ "identifier": "the one they typed in your enrolment form" }

200 { "active": true, "asOf": "2026-09-13T09:12:00.000Z" }`}
        />

        {/* 🔴 55.5 — a boolean and a source. Never a document, never a licence number. */}
        <UseCase
          title={t("devs.useCase2")}
          body={t("devs.useCase2Body")}
          exampleLabel={t("devs.example")}
          example={`POST /api/partner/v1/clinicians/verify

{ "email": "dr@example.com" }

200 { "verified": true, "source": "syndicate" }`}
        />

        {/* 🔴 55.6 / C277 — the key asks WHO MAY. It never reads. */}
        <UseCase
          title={t("devs.useCase3")}
          body={t("devs.useCase3Body")}
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
          exampleLabel={t("devs.example")}
          example={`note.approved -> { "event": "note.approved", "id": "...", "at": "..." }

GET /api/partner/v1/notes/<sessionId>

200 { "approvedAt": "...", "content": "..." }
404 while it is a draft, and while nobody has approved it`}
        />
      </div>

      {/* 🔴 42.5 — the widget, and the sentence about video. */}
      <h2 className="mt-12 text-lg font-bold tracking-tight text-slate-900">{t("devs.widget")}</h2>
      <p className="mt-2 leading-relaxed text-slate-600">{t("devs.widgetBody")}</p>

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

      <p className="mt-10">
        <Link
          href={PARTNER_APPLY}
          className="inline-flex h-12 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t("devs.getStarted")}
        </Link>
      </p>
    </main>
  );
}

function UseCase({
  title,
  body,
  exampleLabel,
  example,
}: {
  title: string;
  body: string;
  exampleLabel: string;
  example: string;
}) {
  return (
    <section className="border-s-2 border-slate-200 ps-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1.5 leading-relaxed text-slate-600">{body}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
    <li className="border-s-2 border-teal-300 ps-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}
