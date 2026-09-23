"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from "motion/react";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  FileLock2,
  HeartHandshake,
  LifeBuoy,
  Mic,
  PenLine,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { DesignNav } from "../_ds/frames";
import { Count, LivePulse, Rise } from "../_ds/motion";
import { Avatar, Btn, Chips, Glow } from "../_ds/ui";

const Globe = dynamic(() => import("./globe"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(46,196,182,0.25),transparent_65%)]" />,
});

type Audience = "you" | "therapists" | "clinics" | "companies";

const AUDIENCES: Record<Audience, { title: string; body: string; points: string[]; cta: string; icon: typeof UserRound }> = {
  you: {
    title: "Talk to a verified therapist in minutes, or book for later.",
    body: "See who is free right now, what it costs you after any cover, and go in. Your record is yours: you decide who reads it.",
    points: ["Three taps from opening the app to the room", "The price on the button is the price you pay", "SOS on every screen, one tap away"],
    cta: "Find someone now",
    icon: UserRound,
  },
  therapists: {
    title: "Your notes, drafted from the session. You sign them.",
    body: "A draft note is ready before you stand up. Nothing reaches a patient until you have read and signed it.",
    points: ["A draft note within seconds of ending", "Off the record means nothing in that minute is kept", "Your earnings, and what you owe, in one place"],
    cta: "Join as a therapist",
    icon: Stethoscope,
  },
  clinics: {
    title: "One bill for the practice. No patient names, ever.",
    body: "Add a clinician and they are on the radar the same hour. See earnings per clinician, never who they saw.",
    points: ["One bill, priced per seat", "A seat released mid-month lowers the next bill", "Earnings per clinician, patients never"],
    cta: "Set up your practice",
    icon: Building2,
  },
  companies: {
    title: "Pay for your people's therapy without ever knowing who went.",
    body: "Fund a budget, choose how much of each session you cover, and see the total. Never who, when, or what was said.",
    points: ["A balance published in steps, never live", "Coverage at 0% is not removal", "An empty budget never blocks anyone"],
    cta: "Offer it to your team",
    icon: Users,
  },
};

export function Homepage() {
  const [audience, setAudience] = useState<Audience>("you");
  const current = AUDIENCES[audience];

  return (
    <div className="bg-white">
      <DesignNav dark />

      {/* Hero: the radar, and the one thing somebody who is struggling came to do. */}
      <section className="relative overflow-hidden bg-navy-900">
        <Glow className="-left-48 top-10 h-[560px] w-[560px] opacity-70" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-5 pb-10 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-20">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/12"
            >
              <LivePulse /> <Count value={2} /> therapists free right now
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="mt-6 text-balance text-[44px] font-bold leading-[1.02] tracking-tight text-white sm:text-[64px]"
            >
              Therapy that starts <span className="relative whitespace-nowrap text-brand-400">when you need it<Underline /></span>.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="mt-6 max-w-xl text-pretty text-[18px] leading-relaxed text-white/75"
            >
              Verified therapists, in Arabic and English, free now or when it suits you. You see the price you pay before
              you press anything, and your record stays yours.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Btn className="h-14 px-7 text-[16px]">
                See who is free now <ArrowRight className="h-4 w-4" aria-hidden />
              </Btn>
              <Btn kind="light" className="h-14 px-7 text-[16px]">
                How it works
              </Btn>
            </motion.div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[560px]">
            <Globe className="absolute inset-0" />
            <FloatCard className="left-0 top-[12%]" delay={0.5}>
              <Avatar name="Dr Sara Demo" size={40} live />
              <div>
                <p className="text-[14px] font-bold text-navy-700">Dr Sara Demo</p>
                <p className="text-[13px] text-navy-500">Free now · Arabic, English</p>
              </div>
            </FloatCard>
            <FloatCard className="bottom-[14%] right-0" delay={0.7}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-bold text-navy-700">You pay $34.20</p>
                <p className="text-[13px] text-navy-500">after your employer&apos;s 60%</p>
              </div>
            </FloatCard>
          </div>
        </div>
      </section>

      {/* One page, four people: the switch changes the promise, not the page. */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Rise className="text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-700">Who it is for</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-balance text-[34px] font-bold leading-tight text-navy-700 sm:text-[42px]">
            The same product, the promise that matters to you.
          </h2>
        </Rise>
        <div className="mt-8 flex justify-center">
          <Chips
            value={audience}
            onChange={setAudience}
            options={[
              { id: "you", label: "For you", icon: <UserRound className="h-4 w-4" aria-hidden /> },
              { id: "therapists", label: "Therapists", icon: <Stethoscope className="h-4 w-4" aria-hidden /> },
              { id: "clinics", label: "Clinics", icon: <Building2 className="h-4 w-4" aria-hidden /> },
              { id: "companies", label: "Companies", icon: <Users className="h-4 w-4" aria-hidden /> },
            ]}
          />
        </div>
        <div className="relative mt-8 min-h-[330px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={audience}
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.35 }}
              className="grid items-center gap-8 rounded-[32px] bg-navy-50 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]"
            >
              <div>
                <current.icon className="h-8 w-8 text-brand-600" aria-hidden />
                <h3 className="mt-4 text-balance text-[28px] font-bold leading-tight text-navy-700">{current.title}</h3>
                <p className="mt-3 text-[17px] leading-relaxed text-navy-500">{current.body}</p>
                <Btn kind="dark" className="mt-6">
                  {current.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </Btn>
              </div>
              <ul className="space-y-3">
                {current.points.map((point, index) => (
                  <motion.li
                    key={point}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.08 }}
                    className="flex items-center gap-3 rounded-2xl bg-white p-4 text-[16px] font-semibold text-navy-700 shadow-sm ring-1 ring-navy-100"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-navy-700">
                      {index + 1}
                    </span>
                    {point}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <HowItWorks />
      <PriceTruth />

      {/* The four promises, each one a thing the product does rather than a claim. */}
      <section className="bg-navy-900 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Rise>
            <h2 className="max-w-2xl text-balance text-[34px] font-bold leading-tight text-white sm:text-[42px]">
              Four things we will never do.
            </h2>
          </Rise>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileLock2, title: "Show your record without asking you", body: "Every reader is somebody you said yes to, and you can take it back." },
              { icon: PenLine, title: "Send you anything unsigned", body: "A machine drafts, a named therapist reads and signs, then you see it." },
              { icon: HeartHandshake, title: "Tell your employer who went", body: "A company sees a total, published in steps. Never who, when or what." },
              { icon: LifeBuoy, title: "Put money in front of help", body: "SOS is on every screen and nothing covers it, including a payment." },
            ].map((promise, index) => (
              <Rise key={promise.title} delay={index * 0.06}>
                <motion.div whileHover={{ y: -6 }} className="h-full rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                  <promise.icon className="h-7 w-7 text-brand-400" aria-hidden />
                  <p className="mt-5 text-[18px] font-bold text-white">{promise.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">{promise.body}</p>
                </motion.div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-red-600">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-6 text-white">
          <Phone className="h-6 w-6" aria-hidden />
          <p className="flex-1 text-[17px] font-semibold">
            If you are in danger right now, do not wait for a session. In Egypt call <span className="font-bold">105</span>, press 1
            for Arabic, then 1. For an ambulance, <span className="font-bold">123</span>.
          </p>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-[14px] text-navy-500">
          <p className="text-[20px] font-black text-navy-700">
            24<span className="text-brand-600">T</span>
          </p>
          <p>Privacy · Terms · Security · العربية</p>
        </div>
      </footer>
    </div>
  );
}

function Underline() {
  return (
    <motion.svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none" aria-hidden>
      <motion.path
        d="M2 14 C 80 4, 200 4, 298 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
      transition={{ opacity: { delay }, scale: { delay }, y: { delay: delay + 0.4, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
      className={`absolute z-10 flex items-center gap-3 rounded-2xl bg-white/95 p-3 pe-5 shadow-2xl backdrop-blur ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Three steps with a line that fills as you scroll through them. */
function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const height = useTransform(fill, [0, 1], ["0%", "100%"]);
  const steps = [
    { icon: Sparkles, title: "See who is free now", body: "Verified therapists, their languages, and the price after any cover. Nobody is held until you press Start." },
    { icon: CalendarCheck2, title: "Start, or pick a time", body: "Pay by card and you are in within seconds. A transfer is checked by a person, and the screen says so first." },
    { icon: Mic, title: "Say yes or no to recording", body: "Yes, and a draft note is written from the session. No, and nothing is recorded. The session goes ahead either way." },
  ];
  return (
    <section className="bg-navy-50 py-20">
      <div className="mx-auto max-w-4xl px-5">
        <Rise>
          <h2 className="text-balance text-[34px] font-bold leading-tight text-navy-700 sm:text-[42px]">From opening the app to talking.</h2>
        </Rise>
        <div ref={ref} className="relative mt-12 ps-12">
          <div className="absolute bottom-2 start-[18px] top-2 w-1 rounded-full bg-navy-100">
            <motion.div className="w-full rounded-full bg-brand-500" style={{ height }} />
          </div>
          <div className="space-y-10">
            {steps.map((step, index) => (
              <Rise key={step.title} delay={index * 0.05}>
                <div className="relative">
                  <span className="absolute -start-12 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-700 shadow ring-1 ring-navy-100">
                    <step.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-[22px] font-bold text-navy-700">{step.title}</p>
                  <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-navy-500">{step.body}</p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Slide the employer's cover and watch every figure move to the truth. */
function PriceTruth() {
  const [cover, setCover] = useState(60);
  const price = 75;
  const covered = (price * cover) / 100;
  const share = price - covered;
  const vat = share * 0.14;
  const total = share + vat;
  const money = (n: number) => `$${n.toFixed(2)}`;
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Rise>
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-700">The price you pay</p>
          <h2 className="mt-3 text-balance text-[34px] font-bold leading-tight text-navy-700 sm:text-[42px]">
            The number on the button is the number you send.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-500">
            Every price shows the session, what your employer covers, VAT on your share, and the one amount you pay. The same
            block, everywhere it appears.
          </p>
          <label className="mt-8 block">
            <span className="flex justify-between text-[15px] font-semibold text-navy-700">
              Your employer covers <span className="tabular-nums">{cover}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={cover}
              onChange={(event) => setCover(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-[var(--color-brand-500)]"
              aria-label="Employer cover"
            />
          </label>
        </Rise>
        <Rise delay={0.1}>
          <div className="rounded-[32px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(10,35,66,0.35)] ring-1 ring-navy-100">
            {[
              ["One hour with Dr Sara Demo", money(price)],
              [`Your employer pays ${cover}%`, `−${money(covered)}`],
              ["VAT 14% on your share", money(vat)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-navy-100 py-3.5 text-[16px] text-navy-600">
                <span>{label}</span>
                <motion.span key={value} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
                  {value}
                </motion.span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-5">
              <span className="text-[18px] font-bold text-navy-700">You pay</span>
              <motion.span key={total} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[40px] font-bold tabular-nums text-navy-700">
                {money(total)}
              </motion.span>
            </div>
            <Btn className="mt-5 w-full">Start and pay {money(total)}</Btn>
          </div>
        </Rise>
      </div>
    </section>
  );
}
