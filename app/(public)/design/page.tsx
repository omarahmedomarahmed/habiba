import type { Metadata } from "next";
import Link from "next/link";

/**
 * Task 174. The design, redrawn from nothing, as samples the founder approves
 * from (docs/TAKEOVER.md s10). This page is the index: the rules every surface
 * is drawn by, and the surfaces in the founder's order.
 *
 * `noindex`, because a design reference competing with the real pages in
 * search results would be self-inflicted.
 */
export const metadata: Metadata = {
  title: "Design",
  robots: { index: false, follow: false },
};

type Surface = {
  name: string;
  what: string;
  href?: string;
  status: "drawn" | "next" | "later";
  previous?: string;
};

const SURFACES: Surface[] = [
  {
    name: "The patient app",
    what: "Home, starting a session now, money, the record and who reads it, help now, the employer benefit, the inbox, the journal.",
    href: "/design/patient",
    status: "drawn",
  },
  {
    name: "The company portal",
    what: "Funding the benefit, the people list, what the company may and may never see.",
    status: "next",
    previous: "/design/company",
  },
  {
    name: "The clinic portal",
    what: "Seats, the practice's clinicians, one bill, and no patient names.",
    status: "later",
    previous: "/design/clinic",
  },
  { name: "The clinician's workspace", what: "Caseload, a patient's profile, the calendar, the copilot.", status: "later" },
  { name: "The session room", what: "One room with two sides: consent, recording, off record, the note after.", status: "later" },
  { name: "The public site", what: "The homepage and the four audience pages.", status: "later" },
  { name: "The console", what: "Everybody who is stuck and for how long; money in and out.", status: "later" },
  { name: "The partner portal", what: "Last, as the brief says.", status: "later" },
];

const INK = [
  { name: "navy-600", hex: "#091e39", job: "Headings, the ink you read" },
  { name: "navy-500", hex: "#0a2342", job: "Body text, the ground of dark cards" },
  { name: "navy-400", hex: "#4a5d72", job: "The lightest text allowed" },
  { name: "brand-500", hex: "#2ec4b6", job: "What you press, with navy ink on it" },
  { name: "amber-400", hex: "#fbbf24", job: "Money owed, and only that" },
  { name: "red-600", hex: "#dc2626", job: "SOS, and only that" },
];

export default function DesignIndex() {
  return (
    <main className="min-h-screen bg-white pb-24 text-navy-500">
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <h1 className="text-[36px] font-bold leading-tight text-navy-600">24Therapy, redrawn</h1>
        <p className="mt-3 text-[17px] leading-relaxed">
          A new design for every app and portal, drawn as flows of real screens so each one can be approved
          or sent back before it is built. The patient app comes first, as you asked; the rest follow in
          the order below.
        </p>

        <h2 className="mt-10 text-[22px] font-bold text-navy-600">The surfaces</h2>
        <ol className="mt-4 divide-y divide-navy-100 rounded-2xl border border-navy-100">
          {SURFACES.map((surface, index) => (
            <li key={surface.name} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4">
              <span className="w-6 text-[16px] font-bold text-navy-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                {surface.href ? (
                  <Link href={surface.href} className="text-[17px] font-bold text-navy-600 underline underline-offset-4">
                    {surface.name}
                  </Link>
                ) : (
                  <p className="text-[17px] font-bold text-navy-600">{surface.name}</p>
                )}
                <p className="mt-1 text-[15px] leading-relaxed">{surface.what}</p>
                {surface.previous ? (
                  <Link href={surface.previous} className="mt-1 inline-block text-[14px] text-navy-400 underline">
                    Previous draft, to be replaced
                  </Link>
                ) : null}
              </div>
              <span
                className={
                  surface.status === "drawn"
                    ? "rounded-full bg-navy-600 px-3 py-1 text-[13px] font-semibold text-white"
                    : "rounded-full bg-navy-100 px-3 py-1 text-[13px] font-semibold text-navy-600"
                }
              >
                {surface.status === "drawn" ? "Ready for you" : surface.status === "next" ? "Next" : "To come"}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-[22px] font-bold text-navy-600">The rules every screen is drawn by</h2>
        <ul className="mt-4 space-y-3 text-[16px] leading-relaxed">
          <li>
            <strong className="text-navy-600">Every screen keeps a promise.</strong> Each sample names the value
            statement it serves (P1 to A5). A screen that serves none is argued for or deleted.
          </li>
          <li>
            <strong className="text-navy-600">390px and Arabic are the first pass, not a later one.</strong>{" "}
            Every sample is drawn at a phone&apos;s width and switches to Arabic, right to left.
          </li>
          <li>
            <strong className="text-navy-600">Readable.</strong> Nothing smaller than 14px and nothing lighter
            than navy-400, because grey, thin text everywhere was the first complaint.
          </li>
          <li>
            <strong className="text-navy-600">Honest.</strong> A price is always the one you will pay; a
            status never contradicts another screen; nothing promises what the product does not do.
          </li>
        </ul>

        <h2 className="mt-12 text-[22px] font-bold text-navy-600">Colour, and what each one is for</h2>
        <p className="mt-2 text-[15px] leading-relaxed">
          Navy is the ground and the ink. Brand teal is what you press. Amber means money owed. Red means
          help now. Nothing else gets a colour, so a colour always means something.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {INK.map((ink) => (
            <li key={ink.name} className="flex items-center gap-3 rounded-xl border border-navy-100 p-3">
              <span className="h-10 w-10 shrink-0 rounded-lg border border-navy-100" style={{ background: ink.hex }} />
              <span>
                <span className="block text-[15px] font-semibold text-navy-600">{ink.name}</span>
                <span className="block text-[14px]">{ink.job}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
