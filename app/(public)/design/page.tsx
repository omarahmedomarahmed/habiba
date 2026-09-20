import type { Metadata } from "next";

import { ComponentShowcase } from "@/components/demo/component-showcase";
import { DeviceFrame } from "@/components/demo/device-frame";
import { ClinicDemo, CompanyDemo, TherapistSplitDemo } from "@/components/public/audience-demos";
import { getDemoContent } from "@/lib/content/demo";
import { CONTENT_DEMOS } from "@/lib/db/schema";

/**
 * 🔴 76.65 — THE UI REFERENCE. Every component, every audience, one page.
 *
 * The public site is being rebuilt so that every section shows the product
 * rather than describing it. That is a large change to apply blind, and the
 * first version of this page showed only the nine demos the CMS happened to
 * name, which hid the fact that a company, a clinic and a partner had no
 * demonstrable screen at all.
 *
 * So this is organised by WHO IS LOOKING, not by what the CMS can reference.
 * A gap in an audience's row is a gap in the product's ability to show itself to
 * that audience, and it is supposed to be visible here before anybody notices it
 * on a marketing page.
 *
 * ## It is `noindex`, and that is the only thing protecting it
 *
 * Nothing here is secret — every fixture is synthetic and most of these already
 * appear on a public page — but a design reference competing with `/features` in
 * search results would be self-inflicted. `robots` is set below rather than
 * inherited, because the public layout's default is to index.
 */
export const metadata: Metadata = {
  title: "UI reference",
  robots: { index: false, follow: false },
};

const THERAPIST = ["transcript", "note", "risk", "copilot", "profile"] as const;
/*
 * 🔴 76.81 — `summary` MOVED SIDES, and it was on the wrong one.
 *
 * The clinical summary is the patient's screen: it is what she hands to the
 * next therapist, it lives at `/patient/summary`, and it renders inside her app
 * with the bottom bar under it. It sat in the clinician's row because the
 * portability argument is usually made TO a clinician, which is a fact about
 * the pitch rather than about who opens the screen.
 */
const PATIENT = ["patient-app", "patient-sessions", "homework", "journal", "summary"] as const;

/** Anything in the vocabulary not placed in an audience row above. */
const PLACED = new Set<string>([...THERAPIST, ...PATIENT]);
const UNPLACED = CONTENT_DEMOS.filter((n) => n !== "none" && !PLACED.has(n));

export default async function UiReferencePage() {
  const content = await getDemoContent();

  return (
    <div className="bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Internal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            UI reference
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            Every component the product renders, by the person looking at it, in the frame it
            wears. Not linked from anywhere and not indexed. A blank in a row is a screen this
            product cannot yet show that audience.
          </p>
        </header>

        <Section
          n="01"
          title="The frames"
          note="A rendered component is not obviously a screen. Browser chrome for a desk, a full phone with the app's own bottom navigation for the room."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Labelled label="browser · a screen used at a desk">
              <DeviceFrame as="browser" path="/admin/actuals">
                <div className="grid h-64 place-items-center bg-white text-sm text-slate-600">
                  any desk screen
                </div>
              </DeviceFrame>
            </Labelled>
            <Labelled label="phone · a screen used in the room">
              <DeviceFrame as="phone">
                <div className="grid h-full place-items-center bg-white text-sm text-slate-600">
                  any phone screen
                </div>
              </DeviceFrame>
            </Labelled>
          </div>
        </Section>

        <Audience
          n="02"
          who="The therapist"
          note="What a clinician touches: the room, the note that comes out of it, the risk scan, the copilot, the rolling profile and the record a patient carries away."
        >
          <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
            {THERAPIST.map((name) => (
              <Labelled key={name} label={name}>
                <ComponentShowcase demo={name} content={content} />
              </Labelled>
            ))}
            <Labelled label="fee split · what she keeps">
              <TherapistSplitDemo />
            </Labelled>
          </div>
        </Audience>

        <Audience
          n="03"
          who="The patient"
          note="Her whole app is a phone. Every one of these is drawn in the real frame, with the five tabs and the lifted globe that is the radar."
        >
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {PATIENT.map((name) => (
              <Labelled key={name} label={name}>
                <ComponentShowcase demo={name} content={content} />
              </Labelled>
            ))}
          </div>
        </Audience>

        <Audience
          n="04"
          who="The company"
          note="A sponsor funds care and never learns who went. The pot as a meter, the spend as a curve, and the wall drawn as two columns rather than promised in a sentence."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Labelled label="sponsor console">
              <CompanyDemo />
            </Labelled>
          </div>
        </Audience>

        <Audience
          n="05"
          who="The clinic"
          note="Seats, and the same wall from the other side: a practice sees schedules and bills and never a word of clinical content."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <Labelled label="clinic console">
              <ClinicDemo />
            </Labelled>
          </div>
        </Audience>

        {UNPLACED.length > 0 ? (
          <Section n="06" title="Not placed in an audience" note="Named by the CMS but not yet shown to anybody in particular.">
            <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
              {UNPLACED.map((name) => (
                <Labelled key={name} label={name}>
                  <ComponentShowcase demo={name} content={content} />
                </Labelled>
              ))}
            </div>
          </Section>
        ) : null}

        <Section
          n="07"
          title="The grid, and the rule about counts"
          note="Four items are two by two. Six are two by three. Never a body paragraph under a component: the tile type has no field for one."
        >
          <div className="space-y-10">
            <Labelled label="four items · two by two">
              <div className="grid gap-5 sm:grid-cols-2">
                {THERAPIST.slice(0, 4).map((name) => (
                  <Tile key={name} title={name}>
                    <ComponentShowcase demo={name} content={content} />
                  </Tile>
                ))}
              </div>
            </Labelled>
            <Labelled label="six items · two by three">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {THERAPIST.slice(0, 6).map((name) => (
                  <Tile key={name} title={name}>
                    <ComponentShowcase demo={name} content={content} />
                  </Tile>
                ))}
              </div>
            </Labelled>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  note,
  children,
}: {
  n: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 border-t border-slate-200 pt-10">
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-semibold text-slate-600">{n}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** A section keyed to the person looking, so a gap in a row reads as a gap. */
function Audience({
  n,
  who,
  note,
  children,
}: {
  n: string;
  who: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 border-t border-slate-200 pt-10">
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-semibold text-slate-600">{n}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{who}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-wide text-slate-600">{label}</p>
      {children}
    </div>
  );
}

/**
 * A grid tile: a title and a component, and deliberately no room for a body.
 * The type has no `body` field, which is the point rather than an omission.
 */
function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
      {children}
    </div>
  );
}
