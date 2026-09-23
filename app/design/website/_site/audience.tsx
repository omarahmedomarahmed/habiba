"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { LivePulse, spring } from "../../_ds/motion";
import { Avatar, Btn, Glow, Ring } from "../../_ds/ui";
import { CrisisStrip, Dark, Eyebrow, Lede, SiteFooter, SiteNav, Title } from "./chrome";
import { FAQ } from "./data";
import { Comparison, CtaBand, Faq, Pricing, ProductDemo } from "./sections";

type Audience = (typeof FAQ)[number]["for"][number];
type DemoId = "patient" | "therapist" | "clinic" | "company" | "partner";

export type AudienceConfig = {
  audience: Exclude<Audience, "all">;
  demo: DemoId;
  eyebrow: string;
  title: ReactNode;
  body: string;
  primary: string;
  secondary: string;
  visual: ReactNode;
  proof: Array<{ big: string; small: string }>;
  features: Array<{ icon: ReactNode; title: string; body: string }>;
  story?: { eyebrow: string; title: string; body: string; visual: ReactNode };
  pricing?: boolean;
  rivals?: string[];
  cta: { title: string; body: string; primary: string };
};

/** One template, five pages: the same rhythm of dark and light, each filled with its own person's promise. */
export function AudiencePage({ c }: { c: AudienceConfig }) {
  return (
    <div className="bg-white">
      <SiteNav />
      <Dark className="min-h-[92svh]">
        <Glow className="-left-40 top-20 h-[520px] w-[520px] opacity-60" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-28 lg:grid-cols-[1fr_1fr] lg:pt-32">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Eyebrow dark>{c.eyebrow}</Eyebrow>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...spring, delay: 0.08 }}
              className="mt-4 text-balance text-[42px] font-bold leading-[1.02] tracking-tight sm:text-[64px]"
            >
              {c.title}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/70">
              {c.body}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap gap-3">
              <Btn className="h-14 px-7 text-[16px]">
                {c.primary} <ArrowRight className="h-4 w-4" aria-hidden />
              </Btn>
              <a href="#demo">
                <Btn kind="light" className="h-14 px-7 text-[16px]">
                  {c.secondary}
                </Btn>
              </a>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }} className="relative">
            {c.visual}
          </motion.div>
        </div>
        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 lg:grid-cols-4">
            {c.proof.map((p, i) => (
              <motion.div key={p.small} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="py-7 pe-4">
                <p className="text-[30px] font-bold tracking-tight text-white sm:text-[36px]">{p.big}</p>
                <p className="mt-1 text-[14px] text-white/60">{p.small}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Dark>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-5">
          <Eyebrow>What you get</Eyebrow>
          <Title>What it does for you.</Title>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ ...spring, delay: (i % 3) * 0.06 }}
                whileHover={{ y: -6 }}
                className="group rounded-[26px] bg-navy-50 p-6 ring-1 ring-navy-100 transition-colors hover:bg-navy-900"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-navy-100 transition-colors group-hover:bg-white/10 group-hover:text-brand-300 group-hover:ring-white/10">
                  {f.icon}
                </span>
                <p className="mt-5 text-[18px] font-bold text-navy-700 transition-colors group-hover:text-white">{f.title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-navy-500 transition-colors group-hover:text-white/70">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <ProductDemo start={c.demo} only={[c.demo]} />

      {c.story ? (
        <section className="bg-navy-50 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
            <div>
              <Eyebrow>{c.story.eyebrow}</Eyebrow>
              <Title>{c.story.title}</Title>
              <Lede>{c.story.body}</Lede>
            </div>
            <div>{c.story.visual}</div>
          </div>
        </section>
      ) : null}

      {c.pricing ? <Pricing /> : null}
      {c.rivals ? <Comparison only={c.rivals} /> : null}
      <Faq audience={c.audience} />
      <CtaBand title={c.cta.title} body={c.cta.body} primary={c.cta.primary} />
      <CrisisStrip />
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------- hero visuals */

/** A therapist's session as it happens: lines arrive, a hint cites what was said. */
export function SessionVisual() {
  const lines = [
    ["You", "How has the week been?"],
    ["Laila", "Better on the nights I kept the routine."],
    ["Laila", "I still wake around four."],
    ["You", "What happens at four?"],
    ["Laila", "I pick up my phone, and that is it."],
  ];
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x >= lines.length + 2 ? 1 : x + 1)), 1400);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <div className="relative mx-auto max-w-md">
      <div className="rounded-[28px] bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar name="Laila Demo" size={40} live />
          <div className="flex-1">
            <p className="text-[15px] font-bold">Laila Demo</p>
            <p className="flex items-center gap-2 text-[13px] text-white/60">
              <LivePulse /> Recording, with her yes · 18:24
            </p>
          </div>
        </div>
        <div className="mt-4 min-h-[210px] space-y-2">
          <AnimatePresence initial={false}>
            {lines.slice(0, Math.min(n, lines.length)).map(([who, text], i) => (
              <motion.p key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px]",
                  who === "You"
                    ? "ms-auto bg-brand-500 text-navy-700"
                    : "bg-white/10 text-white",
                )}
              >
                {text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {n > lines.length ? (
          <motion.div initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }} className="absolute -bottom-8 -end-2 max-w-[260px] rounded-2xl bg-white p-4 text-navy-700 shadow-2xl sm:-end-10">
            <p className="text-[12px] font-bold uppercase tracking-wider text-brand-700">Copilot</p>
            <p className="mt-1 text-[14px] font-semibold">Waking at 4am has come up in all three sessions.</p>
            <p className="mt-1 text-[12px] text-navy-500">18 Sep 0:24 · 11 Sep 0:31</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The clinic: seats fill, and the team sits around the ring. */
export function SeatsVisual() {
  const team = ["Dr Sara Demo", "Dr Karim Demo", "Mona Demo", "Youssef Demo", "Nour Demo", "Hana Demo"];
  return (
    <div className="relative mx-auto flex aspect-square max-w-md items-center justify-center">
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}>
        {team.map((name, i) => {
          const a = (i / team.length) * Math.PI * 2;
          return (
            <motion.div key={name} className="absolute" style={{ left: `${50 + 42 * Math.cos(a)}%`, top: `${50 + 42 * Math.sin(a)}%`, translate: "-50% -50%" }} animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}>
              <Avatar name={name} size={54} live={i % 3 === 0} ring />
            </motion.div>
          );
        })}
      </motion.div>
      <div className="rounded-full bg-white p-4 shadow-[0_0_80px_rgba(46,196,182,0.35)]">
        <Ring value={6 / 8} size={190} stroke={16}>
          <span className="text-[44px] font-bold tabular-nums text-navy-700">6/8</span>
          <span className="text-[13px] font-semibold text-navy-500">seats in use</span>
        </Ring>
      </div>
    </div>
  );
}

/** The company: a cover slider and the employee's price, and a list with no names on it. */
export function PotVisual() {
  const [cover, setCover] = useState(60);
  const theirs = (75 - (75 * cover) / 100) * 1.14;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-[28px] bg-white p-6 text-navy-700 shadow-2xl">
        <div className="flex items-center gap-5">
          <Ring value={0.37} size={110} stroke={12}>
            <span className="text-[20px] font-bold tabular-nums">$1,840</span>
            <span className="text-[11px] font-semibold text-navy-500">in the pot</span>
          </Ring>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-navy-500">You cover</p>
            <p className="text-[36px] font-bold tabular-nums">{cover}%</p>
          </div>
        </div>
        <input type="range" min={0} max={100} step={10} value={cover} onChange={(e) => setCover(Number(e.target.value))} aria-label="Cover" className="mt-4 w-full accent-[var(--color-brand-500)]" />
        <p className="mt-2 text-[14px] text-navy-500">
          Your people pay <b className="tabular-nums text-navy-700">${theirs.toFixed(2)}</b> for a $75 session.
        </p>
      </div>
      <div className="rounded-[28px] bg-white/[0.06] p-5 ring-1 ring-white/10">
        <p className="text-[13px] font-semibold text-white/60">Who went this month</p>
        <p className="mt-1 text-[20px] font-bold">Nobody will ever tell you.</p>
      </div>
    </div>
  );
}

/** The partner: the one call, typed out, and the webhook it produces. */
export function CodeVisual() {
  const code = `curl https://24therapy.app/api/partner/v1/sessions \\
  -H "Authorization: Bearer t24_test_…" \\
  -d '{"subject":"pt_8841","clinician":"sara@example.com",
       "started_at":"2026-09-23T18:00:00Z",
       "duration_minutes":50,"meeting_id":"mtg_42"}'`;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((n) => (n >= code.length + 40 ? 0 : n + 2)), 30);
    return () => clearInterval(id);
  }, [code.length]);
  const done = shown >= code.length;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="overflow-hidden rounded-[22px] bg-[#050d18] ring-1 ring-white/10">
        <div className="flex gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
        </div>
        <pre className="min-h-[130px] whitespace-pre-wrap p-5 font-mono text-[13px] leading-relaxed text-brand-200">
          {code.slice(0, shown)}
          <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block h-4 w-2 translate-y-0.5 bg-brand-400" />
        </pre>
      </div>
      <AnimatePresence>
        {done ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-navy-700 shadow-xl">
            <span className="rounded-lg bg-brand-100 px-2 py-1 font-mono text-[12px] font-bold text-brand-900">200</span>
            <span className="font-mono text-[13px] font-semibold">session recorded, note on its way</span>
            <Check className="ms-auto h-4 w-4 text-brand-700" aria-hidden />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
