"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  Code2,
  FileLock2,
  HeartHandshake,
  LifeBuoy,
  Mic,
  PenLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import { Count, LivePulse, Rise, spring } from "../_ds/motion";
import { Avatar, Btn, Glow } from "../_ds/ui";
import { CrisisStrip, Dark, Eyebrow, Lede, SiteFooter, SiteNav, Title } from "./_site/chrome";
import { Bento, Comparison, CtaBand, Faq, Marquee, Pricing, ProductDemo } from "./_site/sections";

const Earth = dynamic(() => import("./earth"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(46,196,182,0.18),transparent_62%)]" />,
});

export function Homepage() {
  return (
    <div className="bg-white">
      <SiteNav />
      <Hero />
      <Marquee
        items={[
          "Verified therapists, free now or later",
          "Arabic and English, right to left",
          "The price on the button is the price you pay",
          "Recording only with a yes",
          "Your record is yours",
          "Your employer never sees who went",
          "SOS on every screen",
        ]}
      />
      <Audiences />
      <ProductDemo />
      <HowItWorks />
      <Bento />
      <PriceTruth />
      <Pricing />
      <Comparison />
      <Promises />
      <Faq />
      <CtaBand
        title="Someone could be free for you right now."
        body="Open the radar and see who, in your language, at the price you will pay."
        primary="Find someone now"
        secondary="I am a therapist"
      />
      <CrisisStrip />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <Dark className="min-h-[100svh]">
      <section ref={ref} className="relative">
        <Glow className="-left-48 top-24 h-[560px] w-[560px] opacity-60" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-4 px-5 pb-16 pt-28 lg:min-h-[100svh] lg:grid-cols-[1fr_1.1fr] lg:pt-16">
          <motion.div style={{ opacity: fade }} className="relative z-10">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/12"
            >
              <LivePulse /> <Count value={7} /> therapists free right now
            </motion.p>
            <h1 className="mt-6 text-balance text-[42px] font-bold leading-[1.0] tracking-tight text-white sm:text-[72px]">
              {["Therapy", "that", "starts"].map((word, i) => (
                <motion.span key={word} className="me-[0.25em] inline-block" initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ ...spring, delay: 0.05 + i * 0.07 }}>
                  {word}
                </motion.span>
              ))}
              <br />
              <motion.span className="relative inline-block text-brand-400 sm:whitespace-nowrap" initial={{ opacity: 0, y: 30, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ ...spring, delay: 0.3 }}>
                when you need it<span className="text-white">.</span>
                <Underline />
              </motion.span>
            </h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-7 max-w-xl text-pretty text-[18px] leading-relaxed text-white/70">
              Verified therapists, in Arabic and English, free now or when it suits you. You see the price you pay before you press anything, and your record stays yours.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-9 flex flex-wrap gap-3">
              <Btn className="h-14 px-7 text-[16px]">
                See who is free now <ArrowRight className="h-4 w-4" aria-hidden />
              </Btn>
              <a href="#demo">
                <Btn kind="light" className="h-14 px-7 text-[16px]">
                  Try the product
                </Btn>
              </a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["Dr Sara Demo", "Dr Karim Demo", "Mona Demo", "Nour Demo"].map((n) => (
                  <Avatar key={n} name={n} size={38} ring />
                ))}
              </div>
              <p className="text-[14px] text-white/65">Verified therapists only, in Arabic and English.</p>
            </motion.div>
          </motion.div>

          <motion.div style={{ y, scale }} className="relative mx-auto aspect-square w-full max-w-[680px] lg:-me-24">
            <Earth className="absolute inset-0" />
            <FloatCard className="left-0 top-[14%]" delay={1.1}>
              <Avatar name="Dr Sara Demo" size={40} live />
              <div>
                <p className="text-[14px] font-bold text-navy-700">Dr Sara Demo</p>
                <p className="text-[13px] text-navy-500">Free now · Cairo · Arabic, English</p>
              </div>
            </FloatCard>
            <FloatCard className="bottom-[16%] right-2" delay={1.3}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-bold text-navy-700">You pay $34.20</p>
                <p className="text-[13px] text-navy-500">after your employer&apos;s 60%</p>
              </div>
            </FloatCard>
            <p className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white/40">Drag to turn the planet</p>
          </motion.div>
        </div>
      </section>
    </Dark>
  );
}

function Underline() {
  return (
    <motion.svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none" aria-hidden>
      <motion.path d="M2 14 C 80 4, 200 4, 298 12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.7, ease: [0.22, 1, 0.36, 1] }} />
    </motion.svg>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
      transition={{ opacity: { delay }, scale: { delay }, y: { delay: delay + 0.4, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
      className={`absolute z-10 hidden items-center gap-3 rounded-2xl bg-white/95 p-3 pe-5 shadow-2xl backdrop-blur sm:flex ${className}`}
    >
      {children}
    </motion.div>
  );
}

const AUDIENCE_CARDS = [
  { href: "/design/website/patients", icon: UserRound, label: "For you", line: "Talk to someone in minutes, or book for later.", tone: "dark" },
  { href: "/design/website/therapists", icon: Stethoscope, label: "Therapists", line: "Your note, drafted from the session. You sign it.", tone: "light" },
  { href: "/design/website/clinics", icon: Building2, label: "Clinics", line: "One bill for the practice, never a patient's name.", tone: "light" },
  { href: "/design/website/companies", icon: Users, label: "Companies", line: "Pay for your people's therapy without knowing who went.", tone: "light" },
  { href: "/design/website/partners", icon: Code2, label: "Partners", line: "Put sessions, notes and the radar inside your product.", tone: "dark" },
] as const;

function Audiences() {
  return (
    <section className="bg-navy-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Eyebrow>Who it is for</Eyebrow>
        <Title>One product. Five people, each with a page of their own.</Title>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {AUDIENCE_CARDS.map((card, i) => (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ ...spring, delay: i * 0.06 }}
              className={i < 2 ? "lg:col-span-3" : "lg:col-span-2"}
            >
              <Link
                href={card.href}
                className={`group relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-[28px] p-7 transition-transform duration-300 hover:-translate-y-1.5 ${
                  card.tone === "dark" ? "bg-navy-900 text-white" : "bg-white text-navy-700 ring-1 ring-navy-100"
                }`}
              >
                {card.tone === "dark" ? <Glow className="-right-20 -top-20 h-56 w-56 opacity-50 transition-opacity group-hover:opacity-90" /> : null}
                <card.icon className={`relative h-8 w-8 ${card.tone === "dark" ? "text-brand-400" : "text-brand-700"}`} aria-hidden />
                <p className="relative mt-auto pt-10 text-[14px] font-bold uppercase tracking-[0.16em] opacity-60">{card.label}</p>
                <p className="relative mt-2 text-[24px] font-bold leading-tight">{card.line}</p>
                <span className={`absolute end-6 top-6 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45 ${card.tone === "dark" ? "bg-white/10" : "bg-navy-50"}`}>
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const height = useTransform(fill, [0, 1], ["0%", "100%"]);
  const steps = [
    { icon: Sparkles, title: "See who is free now", body: "Verified therapists, their languages, and the price after any cover. Nobody is held until you press Start." },
    { icon: CalendarCheck2, title: "Start, or pick a time", body: "Pay by card and you are in within seconds. A transfer is checked by a person, and the screen says so first." },
    { icon: Mic, title: "Say yes or no to recording", body: "Yes, and a draft note is written from the session. No, and nothing is recorded. The session goes ahead either way." },
    { icon: FileLock2, title: "Keep what was said", body: "A summary in plain words, signed by your therapist, in your record. You decide who else may read it." },
  ];
  return (
    <section className="bg-white py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>How it works</Eyebrow>
          <Title>From opening the app to talking.</Title>
          <Lede>Four steps. The line fills as you read.</Lede>
        </div>
        <div ref={ref} className="relative ps-14">
          <div className="absolute bottom-2 start-[18px] top-2 w-1 rounded-full bg-navy-100">
            <motion.div className="w-full rounded-full bg-brand-500" style={{ height }} />
          </div>
          <div className="space-y-14">
            {steps.map((step, index) => (
              <Rise key={step.title} delay={index * 0.05}>
                <div className="relative">
                  <span className="absolute -start-14 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-brand-300 shadow">
                    <step.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-[13px] font-bold text-brand-700">Step {index + 1}</p>
                  <p className="mt-1 text-[24px] font-bold text-navy-700">{step.title}</p>
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

function PriceTruth() {
  const [cover, setCover] = useState(60);
  const price = 75;
  const covered = (price * cover) / 100;
  const share = price - covered;
  const vat = share * 0.14;
  const total = share + vat;
  const money = (n: number) => `$${n.toFixed(2)}`;
  return (
    <Dark className="py-24">
      <Glow className="-left-32 bottom-0 h-[420px] w-[420px] opacity-40" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <Rise>
          <Eyebrow dark>The price you pay</Eyebrow>
          <Title dark>The number on the button is the number you send.</Title>
          <Lede dark>Every price shows the session, what your employer covers, VAT on your share, and the one amount you pay. The same block, everywhere it appears.</Lede>
          <label className="mt-8 block">
            <span className="flex justify-between text-[15px] font-semibold text-white">
              Your employer covers <span className="tabular-nums">{cover}%</span>
            </span>
            <input type="range" min={0} max={100} step={10} value={cover} onChange={(e) => setCover(Number(e.target.value))} className="mt-3 h-2 w-full cursor-pointer accent-[var(--color-brand-500)]" aria-label="Employer cover" />
          </label>
        </Rise>
        <Rise delay={0.1}>
          <div className="rounded-[32px] bg-white p-7 text-navy-700 shadow-[0_40px_100px_-30px_rgba(46,196,182,0.45)]">
            {[
              ["One hour with Dr Sara Demo", money(price)],
              [`Your employer pays ${cover}%`, `-${money(covered)}`],
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
              <span className="text-[18px] font-bold">You pay</span>
              <motion.span key={total} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[44px] font-bold tabular-nums">
                {money(total)}
              </motion.span>
            </div>
            <Btn className="mt-5 w-full">Start and pay {money(total)}</Btn>
          </div>
        </Rise>
      </div>
    </Dark>
  );
}

function Promises() {
  const items = [
    { icon: FileLock2, title: "Show your record without asking you", body: "Every reader is somebody you said yes to, and you can take it back." },
    { icon: PenLine, title: "Send you anything unsigned", body: "A machine drafts, a named therapist reads and signs, then you see it." },
    { icon: HeartHandshake, title: "Tell your employer who went", body: "A company sees a total, published in steps. Never who, when or what." },
    { icon: LifeBuoy, title: "Put money in front of help", body: "SOS is on every screen and nothing covers it, including a payment." },
  ];
  return (
    <section className="bg-navy-50 py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Eyebrow>Promises</Eyebrow>
        <Title>Four things we will never do.</Title>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24, rotate: -1 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ ...spring, delay: i * 0.07 }}
              whileHover={{ y: -8 }}
              className="rounded-[28px] bg-white p-7 ring-1 ring-navy-100 shadow-[0_20px_50px_-40px_rgba(10,35,66,0.5)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-brand-300">
                <item.icon className="h-6 w-6" aria-hidden />
              </span>
              <p className="mt-6 text-[19px] font-bold text-navy-700">{item.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-navy-500">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
