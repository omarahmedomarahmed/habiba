"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Code2,
  FileLock2,
  Languages,
  LifeBuoy,
  Mic,
  MicOff,
  Minus,
  PenLine,
  Plus,
  Smartphone,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { spring } from "../../_ds/motion";
import { PhoneFrame } from "../../_ds/frames";
import { Avatar, Btn, Chips, Glow, Toggle } from "../../_ds/ui";
import { ClinicDemo } from "../../clinic/portal";
import { CompanyDemo } from "../../company/portal";
import { PartnerDemo } from "../../partner/portal";
import { PatientApp } from "../../patient/app";
import { TherapistDemo } from "../../therapist/workspace";
import { Dark, Eyebrow, Lede, Title } from "./chrome";
import { FAQ, PAYG_PER_SESSION, PLANS, PRACTICE_MONTHLY, RIVALS, RIVALS_CHECKED } from "./data";

/* ------------------------------------------------------------------ phone */

/** The real phone sample at its true 390 x 844, scaled to whatever width it is given. */
export function ScaledPhone({ lang = "en", max = 414 }: { lang?: "en" | "ar"; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.getBoundingClientRect().width / 414));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="mx-auto w-full" style={{ maxWidth: max, height: 868 * scale }}>
      <div style={{ width: 414, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <PhoneFrame dark embedded>
          <PatientApp key={lang} lang={lang} />
        </PhoneFrame>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- product demo */

type DemoId = "patient" | "therapist" | "clinic" | "company" | "partner";

const DEMOS: Record<DemoId, { label: string; icon: ReactNode; title: string; body: string; points: string[] }> = {
  patient: {
    label: "Patient app",
    icon: <Smartphone className="h-4 w-4" aria-hidden />,
    title: "Find someone, see the price, go in.",
    body: "Search and filter verified therapists, book now or later, say yes or no to recording, and keep your own record.",
    points: ["Tap a therapist, then Book", "Hold to agree to recording", "SOS is always one tap away"],
  },
  therapist: {
    label: "Therapist",
    icon: <Stethoscope className="h-4 w-4" aria-hidden />,
    title: "The session, and the note, in one place.",
    body: "Go in to the waiting session, watch the transcript and the copilot beside you, go off the record, then sign a drafted note.",
    points: ["Press Go in", "Try Off the record", "End, then sign"],
  },
  clinic: {
    label: "Clinic",
    icon: <Building2 className="h-4 w-4" aria-hidden />,
    title: "Your team and one bill, never a patient's name.",
    body: "See who is in a session now, earnings per clinician, and add a colleague with the seat price shown first.",
    points: ["Filter the team", "Add a clinician", "Open the bill"],
  },
  company: {
    label: "Company",
    icon: <Users className="h-4 w-4" aria-hidden />,
    title: "Fund therapy without knowing who went.",
    body: "Set how much of each session you cover, watch the employee's price move, top up the pot.",
    points: ["Drag the cover", "Touch a hidden cell", "Top up"],
  },
  partner: {
    label: "Partners",
    icon: <Code2 className="h-4 w-4" aria-hidden />,
    title: "Build on the same rails.",
    body: "Keys shown once, usage by day, and webhook deliveries landing live with a retry on failures.",
    points: ["Make a key", "Filter failed", "Retry one"],
  },
};

export function ProductDemo({ start = "patient", only }: { start?: DemoId; only?: DemoId[] }) {
  const [id, setId] = useState<DemoId>(start);
  const ids = (only ?? (Object.keys(DEMOS) as DemoId[]));
  const demo = DEMOS[id];
  return (
    <Dark id="demo" className="py-24">
      <Glow className="left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <Eyebrow dark>Try the product</Eyebrow>
          <Title dark>Not screenshots. Press anything.</Title>
          <Lede dark className="mx-auto">
            Every screen below is live. Tap, drag and type your way through the same flows your patients, clinicians and finance team will use.
          </Lede>
        </div>
        {ids.length > 1 ? (
          <div className="mt-8 flex justify-center">
            <Chips dark value={id} onChange={setId} options={ids.map((key) => ({ id: key, label: DEMOS[key].label, icon: DEMOS[key].icon }))} />
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
            className="mt-10"
          >
            {id === "patient" ? (
              <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
                <DemoCopy demo={demo} />
                <div className="mx-auto w-full max-w-[414px]">
                  <ScaledPhone />
                </div>
                <div className="hidden space-y-3 lg:block">
                  {["Search, filters and chips", "Rails you swipe left and right", "Arabic, right to left, one tap away"].map((line, i) => (
                    <motion.div
                      key={line}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="rounded-2xl bg-white/5 p-4 text-[15px] font-semibold text-white/85 ring-1 ring-white/10"
                    >
                      {line}
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="mx-auto max-w-3xl text-center">
                  <p className="text-[24px] font-bold">{demo.title}</p>
                  <p className="mt-2 text-[16px] text-white/70">{demo.body}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {demo.points.map((p) => (
                      <span key={p} className="rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-white/12">
                        Try: {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-navy-700">
                  {id === "therapist" && <TherapistDemo />}
                  {id === "clinic" && <ClinicDemo />}
                  {id === "company" && <CompanyDemo />}
                  {id === "partner" && <PartnerDemo />}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Dark>
  );
}

function DemoCopy({ demo }: { demo: (typeof DEMOS)[DemoId] }) {
  return (
    <div>
      <p className="text-[28px] font-bold leading-tight">{demo.title}</p>
      <p className="mt-3 text-[16px] leading-relaxed text-white/70">{demo.body}</p>
      <ul className="mt-6 space-y-2">
        {demo.points.map((p, i) => (
          <motion.li
            key={p}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="flex items-center gap-3 text-[15px] font-semibold text-white/90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[13px] text-navy-700">{i + 1}</span>
            {p}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- pricing */

export function Pricing({ dark = false }: { dark?: boolean }) {
  const [sessions, setSessions] = useState(24);
  const [seats, setSeats] = useState(3);
  const payg = sessions * PAYG_PER_SESSION;
  const cheaper = payg < PRACTICE_MONTHLY ? "payg" : "practice";
  const Wrap = dark ? Dark : LightSection;
  return (
    <Wrap id="pricing" className="py-24">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <Eyebrow dark={dark}>Pricing</Eyebrow>
          <Title dark={dark}>Three prices, all of them published.</Title>
          <Lede dark={dark} className="mx-auto">
            What a therapist or a clinic pays us, read from the same settings the invoice reads.
          </Lede>
        </div>

        <div className={cn("mx-auto mt-10 max-w-xl rounded-3xl p-5", dark ? "bg-white/5 ring-1 ring-white/10" : "bg-white ring-1 ring-navy-100")}>
          <label className="block">
            <span className={cn("flex items-baseline justify-between text-[15px] font-semibold", dark ? "text-white" : "text-navy-700")}>
              Sessions you run a month
              <span className="text-[28px] font-bold tabular-nums">{sessions}</span>
            </span>
            <input
              type="range"
              min={0}
              max={60}
              value={sessions}
              onChange={(e) => setSessions(Number(e.target.value))}
              aria-label="Sessions a month"
              className="mt-2 w-full accent-[var(--color-brand-500)]"
            />
          </label>
          <p className={cn("mt-2 text-[14px]", dark ? "text-white/65" : "text-navy-500")}>
            Pay as you go would cost <b className="tabular-nums">${payg}</b>. Practice costs <b>${PRACTICE_MONTHLY}</b>.{" "}
            {cheaper === "payg" ? "Stay on pay as you go." : "Practice is cheaper for you."}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan, index) => {
            const best = plan.key === cheaper;
            const featured = plan.featured;
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ ...spring, delay: index * 0.08 }}
                whileHover={{ y: -8 }}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[28px] p-7",
                  featured
                    ? "bg-navy-900 text-white shadow-[0_40px_100px_-30px_rgba(46,196,182,0.55)] ring-2 ring-brand-500"
                    : dark
                      ? "bg-white/5 text-white ring-1 ring-white/10"
                      : "bg-white text-navy-700 ring-1 ring-navy-100 shadow-[0_20px_60px_-40px_rgba(10,35,66,0.4)]",
                )}
              >
                {featured ? <Glow className="-right-24 -top-24 h-64 w-64 opacity-60" /> : null}
                <div className="relative flex items-center justify-between">
                  <p className="text-[17px] font-bold">{plan.name}</p>
                  <AnimatePresence>
                    {best && plan.key !== "clinic" ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={spring}
                        className="rounded-full bg-brand-500 px-3 py-1 text-[12px] font-bold text-navy-700"
                      >
                        Cheapest for you
                      </motion.span>
                    ) : featured ? (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold text-white/80">Unlimited</span>
                    ) : null}
                  </AnimatePresence>
                </div>
                <div className="relative mt-5 flex items-baseline gap-2">
                  <span className="text-[52px] font-bold leading-none tracking-tight tabular-nums">
                    {plan.key === "clinic" ? `$${72 * seats}` : plan.price}
                  </span>
                  <span className={cn("text-[15px]", featured || dark ? "text-white/60" : "text-navy-500")}>
                    {plan.key === "clinic" ? `a month for ${seats}` : plan.per}
                  </span>
                </div>
                {plan.key === "clinic" ? (
                  <div className="relative mt-3 flex items-center gap-3">
                    <Stepper value={seats} min={2} max={30} onChange={setSeats} dark={featured || dark} />
                    <span className={cn("text-[13px]", dark ? "text-white/60" : "text-navy-500")}>clinicians at $72</span>
                  </div>
                ) : null}
                <p className={cn("relative mt-4 text-[15px] leading-relaxed", featured || dark ? "text-white/70" : "text-navy-500")}>{plan.blurb}</p>
                <ul className="relative mt-6 flex-1 space-y-3">
                  {plan.points.map((point) => (
                    <li key={point} className="flex gap-3 text-[15px]">
                      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", featured ? "bg-brand-500 text-navy-700" : "bg-brand-100 text-brand-800")}>
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <Btn kind={featured ? "primary" : dark ? "light" : "dark"} className="relative mt-8 w-full">
                  {plan.cta}
                </Btn>
              </motion.div>
            );
          })}
        </div>
        <p className={cn("mt-6 text-center text-[14px]", dark ? "text-white/55" : "text-navy-500")}>
          Companies fund a pot that pays for sessions as they happen. Partners pay $3 a session. Prices in USD, with EGP shown at checkout.
        </p>
      </div>
    </Wrap>
  );
}

function LightSection({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("relative bg-navy-50", className)}>
      {children}
    </section>
  );
}

function Stepper({ value, min, max, onChange, dark }: { value: number; min: number; max: number; onChange: (n: number) => void; dark?: boolean }) {
  const btn = cn("flex h-9 w-9 items-center justify-center rounded-full", dark ? "bg-white/10 text-white" : "bg-navy-50 text-navy-700 ring-1 ring-navy-100");
  return (
    <div className="flex items-center gap-2">
      <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label="Fewer" className={btn} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="h-4 w-4" aria-hidden />
      </motion.button>
      <span className="w-6 text-center text-[16px] font-bold tabular-nums">{value}</span>
      <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label="More" className={btn} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="h-4 w-4" aria-hidden />
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------- comparison */

export function Comparison({ only }: { only?: string[] }) {
  const rivals = only ? RIVALS.filter((r) => only.includes(r.name)) : RIVALS;
  const [name, setName] = useState(rivals[0]!.name);
  const rival = rivals.find((r) => r.name === name)!;
  return (
    <Dark className="py-24">
      <Glow className="-right-40 top-20 h-[480px] w-[480px] opacity-40" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Eyebrow dark>How we compare</Eyebrow>
        <Title dark>Us against one rival at a time, including where they win.</Title>
        <Lede dark>
          Each row says what we do and what they do. Every rival has a row where the honest answer is that they are better, and it stays on the page.
        </Lede>
        <Chips dark className="mt-8" value={name} onChange={setName} options={rivals.map((r) => ({ id: r.name, label: r.name }))} />
        <AnimatePresence mode="wait">
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-6 overflow-hidden rounded-[28px] bg-white/[0.04] ring-1 ring-white/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[18px] font-bold">{rival.name[0]}</span>
                <div>
                  <p className="text-[18px] font-bold">{rival.name}</p>
                  <p className="text-[14px] text-white/60">{rival.who}</p>
                </div>
              </div>
              <p className="text-[13px] text-white/60">
                Their price: <span className="font-semibold text-white/85">{rival.price}</span>
              </p>
            </div>
            <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-6 border-b border-white/10 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white/45 md:grid">
              <span />
              <span className="text-brand-300">24Therapy</span>
              <span>{rival.name}</span>
            </div>
            <ul>
              {rival.rows.map((row, i) => (
                <motion.li
                  key={row.claim}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn("grid gap-2 border-b border-white/5 px-6 py-4 md:grid-cols-[1fr_1.3fr_1.3fr] md:gap-6", row.concede && "bg-white/[0.04]")}
                >
                  <p className="text-[14px] font-bold text-white/85">
                    {row.claim}
                    {row.concede ? <span className="ms-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/75">They lead</span> : null}
                  </p>
                  <p className="flex gap-2 text-[15px] text-white/90">
                    <span className="md:hidden text-[12px] font-bold uppercase text-brand-300">Us</span>
                    {row.ours}
                  </p>
                  <p className="flex gap-2 text-[15px] text-white/60">
                    <span className="md:hidden text-[12px] font-bold uppercase text-white/45">Them</span>
                    {row.theirs}
                  </p>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        <p className="mt-4 text-[13px] text-white/45">Checked against each rival&apos;s own site on {RIVALS_CHECKED}.</p>
      </div>
    </Dark>
  );
}

/* ------------------------------------------------------------- the bento */

export function Bento() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Eyebrow>What it does</Eyebrow>
        <Title>Small things, done so you never think about them.</Title>
        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Tile className="md:col-span-4" icon={<PenLine className="h-5 w-5" aria-hidden />} title="A draft note, before you stand up" body="From what was said, in the language it was said in. You read it and sign it.">
            <DraftingNote />
          </Tile>
          <Tile className="md:col-span-2" dark icon={<Languages className="h-5 w-5" aria-hidden />} title="Arabic, all the way" body="Right to left, including the note.">
            <LangFlip />
          </Tile>
          <Tile className="md:col-span-2" icon={<Mic className="h-5 w-5" aria-hidden />} title="Recording is a yes" body="No means nothing is captured.">
            <ConsentDemo />
          </Tile>
          <Tile className="md:col-span-2" icon={<FileLock2 className="h-5 w-5" aria-hidden />} title="The record is the patient's" body="Every reader is someone they said yes to.">
            <AccessDemo />
          </Tile>
          <Tile className="md:col-span-2" dark icon={<LifeBuoy className="h-5 w-5" aria-hidden />} title="Help before payment" body="SOS is on every screen, and nothing covers it.">
            <div className="mt-5 flex justify-center">
              <motion.a
                href="tel:105"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-[18px] font-black text-white shadow-[0_0_0_10px_rgba(220,38,38,0.15)]"
              >
                SOS
              </motion.a>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

function Tile({ children, className, icon, title, body, dark = false }: { children?: ReactNode; className?: string; icon: ReactNode; title: string; body: string; dark?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={spring}
      className={cn("relative overflow-hidden rounded-[28px] p-6", dark ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700 ring-1 ring-navy-100", className)}
    >
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", dark ? "bg-white/10 text-brand-300" : "bg-white text-brand-700 ring-1 ring-navy-100")}>{icon}</span>
      <p className="mt-4 text-[19px] font-bold">{title}</p>
      <p className={cn("mt-1 text-[15px]", dark ? "text-white/65" : "text-navy-500")}>{body}</p>
      {children}
    </motion.div>
  );
}

const NOTE = [
  ["S", "Sleep better on four of seven nights; still wakes near 4am."],
  ["O", "Calm, engaged, linked bad nights to phone use in bed."],
  ["A", "Early waking persists; routine is helping when kept."],
  ["P", "Phone sleeps outside the room this week. Review Thursday."],
];

export function DraftingNote() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: false, margin: "-80px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    setN(0);
    const id = setInterval(() => setN((x) => (x >= NOTE.length ? x : x + 1)), 700);
    return () => clearInterval(id);
  }, [seen]);
  return (
    <div ref={ref} className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-navy-100">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-500">
        <Sparkles className="h-4 w-4 text-brand-600" aria-hidden /> Draft from Tuesday&apos;s session
        <span className="ms-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-navy-700">Not signed</span>
      </div>
      <div className="mt-3 space-y-2">
        {NOTE.map(([k, v], i) => (
          <motion.div key={k} initial={false} animate={{ opacity: i < n ? 1 : 0.15, x: i < n ? 0 : -6 }} transition={spring} className="flex gap-3 text-[14px]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[12px] font-bold text-white">{k}</span>
            <span className="text-navy-600">{i < n ? v : " "}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function LangFlip() {
  const [ar, setAr] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setAr((x) => !x), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <button type="button" onClick={() => setAr((x) => !x)} className="mt-5 block w-full rounded-2xl bg-white/5 p-4 text-start ring-1 ring-white/10">
      <AnimatePresence mode="wait">
        <motion.p
          key={String(ar)}
          dir={ar ? "rtl" : "ltr"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="text-[20px] font-bold"
        >
          {ar ? "ابدأ الجلسة الآن" : "Start the session now"}
        </motion.p>
      </AnimatePresence>
      <p className="mt-1 text-[12px] text-white/50">Tap to switch</p>
    </button>
  );
}

export function ConsentDemo() {
  const [yes, setYes] = useState(true);
  return (
    <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-navy-100">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-navy-700">
          {yes ? <Mic className="h-4 w-4 text-brand-700" aria-hidden /> : <MicOff className="h-4 w-4 text-navy-400" aria-hidden />}
          {yes ? "Recording, with your yes" : "Not recorded"}
        </span>
        <Toggle on={yes} onChange={setYes} label="Recording" />
      </div>
      <div className="mt-3 flex h-8 items-end gap-1">
        {Array.from({ length: 24 }, (_, i) => (
          <motion.span
            key={i}
            className="w-1.5 flex-1 rounded-full bg-brand-500"
            animate={yes ? { height: [6, 8 + ((i * 37) % 22), 6] } : { height: 3, opacity: 0.25 }}
            transition={yes ? { duration: 0.9 + (i % 5) * 0.12, repeat: Infinity } : { duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

export function AccessDemo() {
  const [readers, setReaders] = useState(["Dr Sara Demo", "Dr Karim Demo"]);
  return (
    <ul className="mt-5 space-y-2">
      <AnimatePresence initial={false}>
        {readers.map((r) => (
          <motion.li key={r} layout exit={{ opacity: 0, x: 30 }} className="flex items-center gap-2 rounded-2xl bg-white p-2.5 ring-1 ring-navy-100">
            <Avatar name={r} size={30} />
            <span className="flex-1 text-[14px] font-semibold text-navy-700">{r}</span>
            <button type="button" onClick={() => setReaders((x) => x.filter((y) => y !== r))} className="rounded-full px-2.5 py-1 text-[12px] font-bold text-navy-600 ring-1 ring-navy-200">
              Take back
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
      {readers.length === 0 ? (
        <button type="button" onClick={() => setReaders(["Dr Sara Demo", "Dr Karim Demo"])} className="text-[13px] font-semibold text-navy-500">
          Nobody can read it now. Undo
        </button>
      ) : null}
    </ul>
  );
}

/* -------------------------------------------------------------------- faq */

export function Faq({ audience = "all" }: { audience?: (typeof FAQ)[number]["for"][number] }) {
  const items = FAQ.filter((f) => f.for.includes(audience));
  const [open, setOpen] = useState<string | null>(items[0]?.q ?? null);
  return (
    <section className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <Title>Asked before anyone signs up.</Title>
        </div>
        <ul className="space-y-3">
          {items.map((item) => {
            const on = open === item.q;
            return (
              <motion.li layout key={item.q} className={cn("overflow-hidden rounded-2xl ring-1", on ? "bg-navy-900 text-white ring-navy-900" : "bg-navy-50 text-navy-700 ring-navy-100")}>
                <button type="button" onClick={() => setOpen(on ? null : item.q)} aria-expanded={on} className="flex w-full items-center gap-3 p-5 text-start text-[17px] font-bold">
                  <span className="flex-1">{item.q}</span>
                  <motion.span animate={{ rotate: on ? 180 : 0 }} transition={spring}>
                    <ChevronDown className="h-5 w-5" aria-hidden />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {on ? (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-5 pb-5 text-[16px] leading-relaxed text-white/75">
                      {item.a}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- cta */

export function CtaBand({ title, body, primary, secondary }: { title: string; body: string; primary: string; secondary?: string }) {
  return (
    <Dark className="py-24">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(46,196,182,0.0), rgba(46,196,182,0.35), rgba(46,196,182,0.0) 40%)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <Title dark>{title}</Title>
        <Lede dark className="mx-auto">
          {body}
        </Lede>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Btn className="h-14 px-7 text-[16px]">
            {primary} <ArrowRight className="h-4 w-4" aria-hidden />
          </Btn>
          {secondary ? (
            <Btn kind="light" className="h-14 px-7 text-[16px]">
              {secondary}
            </Btn>
          ) : null}
        </div>
      </div>
    </Dark>
  );
}

/* ----------------------------------------------------------------- marquee */

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-navy-900 py-5 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <motion.div className="flex w-max gap-10" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-3 whitespace-nowrap text-[15px] font-semibold text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
