import type { Metadata } from "next";
import Link from "next/link";

import { DocsNav } from "@/components/public/docs-nav";
import { Card } from "@/components/ui";
import { StateDot } from "@/components/marketing/state-dot";
import {
  EHR_VENDORS,
  HR_VENDORS,
  INTEGRATIONS,
  STATE_LABEL,
  VENDOR_STATE_LABEL,
  type Vendor,
} from "@/lib/integrations/registry";

export const metadata: Metadata = {
  title: "What 24Therapy connects to",
  description:
    "The HR and record systems by name, what actually connects today, and the API that does it: authentication, methods, payloads.",
};

/**
 * 🔴 76.78 — THE INTEGRATIONS PAGE, AS A DOCUMENTATION PAGE.
 *
 * ## What was here
 *
 * Three lists of our own connectors under a one-line heading. Everything on it
 * was true and it answered none of the three questions a buyer arrives with:
 * *is my HR system on here*, *is my records system on here*, and *what does my
 * engineer have to build*.
 *
 * ## The shape
 *
 * A left nav and anchored sections, because that is the shape every technical
 * reader already knows how to use and because this page is now long enough to
 * need one. The nav is sticky on a desk and a scrolling strip on a phone.
 *
 * ## 🔴 Most of the named products say "not built", and that is the page working
 *
 * A grid where every logo looks equally connected is the single reason buyers
 * stop believing integration pages. What is built is the MECHANISM: an outbound
 * webhook an HR system calls, and SMART on FHIR for a records system. Those are
 * on their own rows with their real state. A named product stays `planned`
 * until somebody has run it against that product's own tenant, which for a
 * hospital is the hospital's decision and not ours to schedule.
 *
 * ## The API reference is not copied here
 *
 * `/developers` holds every endpoint with its payloads and it is generated from
 * the same constants the API uses. This page shows the shape of the work and
 * links there for the detail. Two copies of an endpoint list is C60 in a
 * developer's costume: one of them goes stale and there is no way to tell which.
 */

const SECTIONS = [
  { id: "today", label: "What connects today" },
  { id: "hr", label: "HR systems" },
  { id: "ehr", label: "Record systems" },
  { id: "start", label: "Get started" },
  { id: "auth", label: "Authentication" },
  { id: "methods", label: "Supported methods" },
  { id: "payloads", label: "Payload examples" },
  { id: "cases", label: "Use cases" },
];

/**
 * The calls an integrator actually makes, in the order they make them.
 *
 * Deliberately a SHORT list rather than the whole surface: this is the shape of
 * the work, and `/developers` is the reference. A reader who needs the tenth
 * endpoint needs the reference anyway.
 */
const METHODS: { method: string; path: string; what: string }[] = [
  { method: "POST", path: "/api/partner/v1/consent", what: "Ask a person, and record the answer. Nothing else works until this returns a yes." },
  { method: "POST", path: "/api/partner/v1/sessions", what: "Open a session against your own reference for the patient." },
  { method: "POST", path: "/api/partner/v1/sessions/<ref>/media", what: "Send the audio you recorded, in parts." },
  { method: "GET", path: "/api/partner/v1/sessions/<ref>/transcript", what: "Read the transcript back as it is built." },
  { method: "GET", path: "/api/partner/v1/sessions/<ref>/note", what: "Read the draft note. It is a draft until a clinician approves it." },
  { method: "POST", path: "/api/partner/v1/sessions/<ref>/note", what: "Approve it, as the clinician who is approving it." },
  { method: "GET", path: "/api/partner/v1/subjects/<ref>/readers", what: "Who may read this person's history, and until when." },
  { method: "POST", path: "/api/partner/v1/launch", what: "Open one of our screens inside yours, for one clinician, for one session." },
];

export default function IntegrationsPage() {
  const groups = ["live", "partial", "planned"] as const;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
        <DocsNav sections={SECTIONS} />

        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            What this connects to
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Your HR system and your record system by name, what each one can do today, and the
            calls your engineer would make. Most of the names below say <b>not built</b>, and
            they are on this page anyway: you finding out from us is better than you finding out
            after signing something.
          </p>

          {/* ─────────────────────────────────────────── what connects today ── */}
          <Section id="today" title="What connects today">
            {groups.map((state) => {
              const rows = INTEGRATIONS.filter((entry) => entry.state === state);
              if (rows.length === 0) return null;
              return (
                <div key={state} className="mt-6 first:mt-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StateDot state={state} />
                    {STATE_LABEL[state]}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {rows.map((entry) => (
                      <li key={entry.slug}>
                        <Link href={`/integrations/${entry.slug}`}>
                          <Card className="p-4 transition hover:border-slate-300">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <p className="font-semibold text-slate-900">{entry.name}</p>
                              <p className="text-xs text-slate-600">{entry.category}</p>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                              {entry.summary}
                            </p>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Section>

          {/* ──────────────────────────────────────────────────── HR systems ── */}
          <Section
            id="hr"
            title="HR systems"
            note="A sponsoring employer connects one of these so we can answer one question: is this person still one of yours. We never receive a name, a department, a salary or a leaver reason, and there is nowhere in our database to put one."
          >
            <VendorGrid vendors={HR_VENDORS} />
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              The mechanism is an outbound webhook your system calls with a key you mint and can
              revoke, so a seventh system that is not on this list connects the same way. The
              steps live in your sponsor console under Integrations.
            </p>
          </Section>

          {/* ──────────────────────────────────────────────── record systems ── */}
          <Section
            id="ehr"
            title="Record systems"
            note="A clinic opens us from a patient's chart and the note a clinician approves files back as a document on that chart. Your system stays the record and ours does not become one."
          >
            <VendorGrid vendors={EHR_VENDORS} />
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              SMART on FHIR R4 works end to end against a sandbox. <b>No hospital has registered
              us in its own tenant yet</b>, and each one has to before anything connects there,
              which is why every row above says built rather than working.
            </p>
          </Section>

          {/* ─────────────────────────────────────────────────── get started ── */}
          <Section id="start" title="Get started">
            <ol className="space-y-3">
              {[
                ["Ask us for a partner account", "We open it with you on a call. There is no self-serve key, because a key that can open sessions about real people is not a thing to hand out through a form."],
                ["Mint a key in your console", "Shown once. Revoking it stops every call the same second, and the console says when each key was last used."],
                ["Ask somebody for consent", "The first call is always the consent call. Everything else returns a refusal until it comes back yes."],
                ["Open a session and send audio", "Your own reference for the patient identifies them. We never learn who that is."],
                ["Read the draft, approve it as a clinician", "A note is a draft until a named clinician approves it, and the name goes on the record."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-500 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {/* ───────────────────────────────────────────────── authentication ── */}
          <Section
            id="auth"
            title="Authentication"
            note="One header. Keys are per partner, minted in your console, shown once, and revocable."
          >
            <Code>{`Authorization: Bearer sk_live_...
Content-Type: application/json`}</Code>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A revoked key fails closed on the next call, not at the end of a cache window.
              Nothing is signed with a shared secret and there is no key in a URL, because a key
              in a URL is a key in somebody&rsquo;s log file.
            </p>
          </Section>

          {/* ────────────────────────────────────────────── supported methods ── */}
          <Section
            id="methods"
            title="Supported methods"
            note="The calls in the order an integration makes them. The full reference, every field and every error, is on the developers page."
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[36rem] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {METHODS.map((row) => (
                    <tr key={`${row.method} ${row.path}`}>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={
                            row.method === "GET"
                              ? "rounded-md bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-700"
                              : "rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-700"
                          }
                        >
                          {row.method}
                        </span>
                      </td>
                      <td className="px-2 py-3 align-top font-mono text-[12px] text-slate-900">
                        {row.path}
                      </td>
                      <td className="px-4 py-3 align-top text-[13px] leading-relaxed text-slate-600">
                        {row.what}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              href="/developers"
              className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
            >
              The full reference, with every field and every error
            </Link>
          </Section>

          {/* ─────────────────────────────────────────────────────── payloads ── */}
          <Section id="payloads" title="Payload examples">
            <p className="text-sm font-semibold text-slate-900">Ask for consent</p>
            <Code>{`POST /api/partner/v1/consent
{
  "subjectRef": "your-own-id-for-this-person",
  "scope": "history",
  "askedBy": "dr-nour",
  "channel": "sms"
}

202 Accepted
{ "status": "asked", "askedAt": "2026-03-12T09:04:11Z" }`}</Code>

            <p className="mt-6 text-sm font-semibold text-slate-900">Open a session</p>
            <Code>{`POST /api/partner/v1/sessions
{
  "subjectRef": "your-own-id-for-this-person",
  "clinicianRef": "dr-nour",
  "modality": "in_person",
  "startedAt": "2026-03-12T09:05:00Z"
}

201 Created
{ "ref": "ses_7Kq2", "recording": "awaiting_consent" }`}</Code>

            <p className="mt-6 text-sm font-semibold text-slate-900">Read the draft note</p>
            <Code>{`GET /api/partner/v1/sessions/ses_7Kq2/note

200 OK
{
  "status": "draft",
  "approvedBy": null,
  "soap": { "subjective": "…", "objective": "…", "assessment": "…", "plan": "…" },
  "patientSummary": "…"
}`}</Code>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              <b>Refusals look like this, and they are the normal case.</b> A call about somebody
              who has not said yes returns <code className="font-mono text-[12px]">403</code> with{" "}
              <code className="font-mono text-[12px]">{`{ "error": "no_consent" }`}</code>, not an
              empty object. Nothing partial comes back.
            </p>
          </Section>

          {/* ────────────────────────────────────────────────────── use cases ── */}
          <Section id="cases" title="Use cases">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["A clinic keeps its own record system", "Open us from the chart, record and write the note here, file the approved note back as a document. Your system stays the record."],
                ["An employer funds therapy", "Your HR system answers one question about one person, on a webhook you can revoke. We never learn who booked anything."],
                ["A platform runs its own sessions", "Hold the session on your side, send us the audio, get the transcript and the draft note. The clinician who approves it is named."],
                ["A telehealth product wants the copilot", "Ask about a patient you already hold consent for, and every answer comes back with the sessions it was built from."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[15px] font-semibold text-slate-900">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    /* `scroll-mt` so an anchor does not land the heading under the sticky header. */
    <section id={id} className="mt-14 scroll-mt-24 border-t border-slate-200 pt-8 first:border-0">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      {note ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{note}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const VENDOR_TONE: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  planned: "bg-slate-100 text-slate-600",
};

function VendorGrid({ vendors }: { vendors: Vendor[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {vendors.map((vendor) => (
        <li
          key={vendor.name}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"
        >
          {/* A lettermark, not a logo. Somebody else's trademark on our page is
              a thing they can ask us to take down, and a grid of them is what
              makes an integrations page read as a claim rather than a table. */}
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
          >
            {vendor.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{vendor.name}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${VENDOR_TONE[vendor.state] ?? VENDOR_TONE.planned}`}
            >
              {VENDOR_STATE_LABEL[vendor.state]}
            </span>
            <p className="mt-1 font-mono text-[11px] leading-snug text-slate-600">{vendor.via}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-navy-600 px-4 py-3.5 font-mono text-[12px] leading-relaxed text-slate-100">
      {children}
    </pre>
  );
}
