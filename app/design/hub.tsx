"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowUpRight, Building2, Globe2, HeartPulse, KeyRound, LayoutDashboard, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";

import { DesignNav } from "./_ds/frames";
import { Count, LivePulse, Rise } from "./_ds/motion";
import { Glow, Ring, Spark } from "./_ds/ui";

type Sample = {
  href: string;
  who: string;
  title: string;
  body: string;
  icon: ReactNode;
  preview: ReactNode;
};

const SAMPLES: Sample[] = [
  {
    href: "/design/website",
    who: "Everyone",
    title: "The homepage",
    body: "A live radar of therapists free now, one promise per audience, and the price you actually pay.",
    icon: <Globe2 className="h-5 w-5" aria-hidden />,
    preview: <RadarMini />,
  },
  {
    href: "/design/patient",
    who: "Patients",
    title: "The app",
    body: "Search, filter, find someone free now, book at your real share, say yes or no to recording, go in.",
    icon: <Smartphone className="h-5 w-5" aria-hidden />,
    preview: <PhoneMini />,
  },
  {
    href: "/design/therapist",
    who: "Therapists",
    title: "The workspace",
    body: "Today at a glance, a live session with transcript and copilot, a draft note to sign.",
    icon: <Stethoscope className="h-5 w-5" aria-hidden />,
    preview: <TranscriptMini />,
  },
  {
    href: "/design/clinic",
    who: "Clinics",
    title: "The practice",
    body: "Seats and clinicians on one bill, and never a patient's name.",
    icon: <Building2 className="h-5 w-5" aria-hidden />,
    preview: (
      <div className="flex items-center gap-4">
        <Ring value={0.75} size={84} stroke={9}>
          <span className="text-[18px] font-bold text-navy-700">6/8</span>
        </Ring>
        <div className="space-y-1.5">
          {["w-24", "w-16", "w-20"].map((w) => (
            <div key={w} className={`h-2.5 rounded-full bg-navy-100 ${w}`} />
          ))}
        </div>
      </div>
    ),
  },
  {
    href: "/design/company",
    who: "Employers",
    title: "The benefit",
    body: "Fund it, set the cover, see the total. Never who, when or what.",
    icon: <HeartPulse className="h-5 w-5" aria-hidden />,
    preview: <Spark points={[3, 5, 4, 7, 6, 9, 8, 11]} width={180} height={70} />,
  },
  {
    href: "/design/console",
    who: "Our team",
    title: "The console",
    body: "Everybody who is stuck, oldest first, and money confirmed exactly once.",
    icon: <LayoutDashboard className="h-5 w-5" aria-hidden />,
    preview: (
      <div className="w-full space-y-2">
        {[92, 64, 38].map((w, i) => (
          <div key={w} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-amber-400" : "bg-navy-200"}`} />
            <div className="h-2.5 rounded-full bg-navy-100" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    href: "/design/partner",
    who: "Partners",
    title: "The platform",
    body: "Keys, usage and delivery logs for platforms that build on 24Therapy.",
    icon: <KeyRound className="h-5 w-5" aria-hidden />,
    preview: (
      <div className="w-full rounded-xl bg-navy-900 p-3 font-mono text-[11px] leading-5 text-brand-300">
        <p>POST /v1/sessions</p>
        <p className="text-white/60">201 Created · 142ms</p>
      </div>
    ),
  },
];

export function Hub() {
  return (
    <div className="min-h-screen bg-navy-900">
      <DesignNav dark />
      <header className="relative overflow-hidden">
        <Glow className="-left-40 -top-40 h-[520px] w-[520px]" />
        <Glow className="-right-32 top-20 h-[420px] w-[420px] opacity-60" />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-16 text-center sm:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-white/12"
          >
            <LivePulse /> A redesign you can touch
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mx-auto mt-6 max-w-4xl text-balance text-[40px] font-bold leading-[1.02] tracking-tight text-white sm:text-[68px]"
          >
            One product. Seven people. <span className="text-brand-400">One way it feels.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-[18px] leading-relaxed text-white/70"
          >
            The website, the patient app and every portal, redrawn from the ground up in the brand&apos;s navy and
            teal, with one motion language across all of them. Every sample is a working flow: press things.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3 text-left"
          >
            {[
              { n: 7, label: "flows, one per person" },
              { n: 44, label: "px, the smallest target" },
              { n: 1, label: "accent colour" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <Count value={stat.n} className="block text-[30px] font-bold text-white" />
                <span className="text-[13px] text-white/65">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((sample, index) => (
            <Rise key={sample.href} delay={index * 0.04}>
              <TiltCard sample={sample} />
            </Rise>
          ))}
          <Rise delay={0.3}>
            <div className="flex h-full flex-col justify-between rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <ShieldCheck className="h-6 w-6 text-brand-400" aria-hidden />
              <div>
                <p className="mt-6 text-[20px] font-bold text-white">What did not change</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/70">
                  SOS is on every app screen and nothing covers it. Every price is the one you pay. A clinic never
                  sees a patient; an employer never sees who went.
                </p>
              </div>
            </div>
          </Rise>
        </div>

        <Rise className="mt-16">
          <h2 className="text-[26px] font-bold text-white">The language every surface speaks</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { swatch: "bg-navy-600", name: "Navy", job: "Ground and ink. Calm, serious, ours." },
              { swatch: "bg-brand-500", name: "Teal", job: "What you press, and what is live now." },
              { swatch: "bg-amber-400", name: "Amber", job: "Money owed. Nothing else." },
              { swatch: "bg-red-600", name: "Red", job: "SOS. Nothing else, ever." },
            ].map((ink) => (
              <div key={ink.name} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <motion.span whileHover={{ scale: 1.08, rotate: -4 }} className={`block h-14 w-14 rounded-2xl ${ink.swatch}`} />
                <p className="mt-3 text-[16px] font-bold text-white">{ink.name}</p>
                <p className="text-[14px] text-white/65">{ink.job}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ["Rise", "Things arrive by rising 14px and fading in, one after another."],
              ["Spring", "Everything you press squeezes and springs back."],
              ["Slide", "A selection is a pill that slides to its new place."],
            ].map(([name, body]) => (
              <motion.div
                key={name}
                whileHover={{ y: -4 }}
                className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
              >
                <p className="text-[16px] font-bold text-white">{name}</p>
                <p className="mt-1 text-[14px] text-white/65">{body}</p>
              </motion.div>
            ))}
          </div>
        </Rise>
      </main>
    </div>
  );
}

function TiltCard({ sample }: { sample: Sample }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });
  return (
    <Link href={sample.href} className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-brand-400" style={{ perspective: 900 }}>
      <motion.div
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          x.set((event.clientX - rect.left) / rect.width - 0.5);
          y.set((event.clientY - rect.top) / rect.height - 0.5);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
        style={{ rotateX: rx, rotateY: ry }}
        whileHover={{ y: -6 }}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-[0_30px_80px_-40px_rgba(46,196,182,0.6)]"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-[13px] font-semibold text-navy-600">
            {sample.icon}
            {sample.who}
          </span>
          <ArrowUpRight className="h-5 w-5 text-navy-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </div>
        <div className="my-6 flex h-28 items-center justify-center rounded-2xl bg-navy-50/80 px-4">{sample.preview}</div>
        <p className="text-[21px] font-bold text-navy-700">{sample.title}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-navy-500">{sample.body}</p>
      </motion.div>
    </Link>
  );
}

function RadarMini() {
  return (
    <div className="relative h-24 w-24">
      {[0, 1, 2].map((ring) => (
        <span key={ring} className="absolute rounded-full border border-navy-200" style={{ inset: ring * 14 }} />
      ))}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(46,196,182,0.45), rgba(46,196,182,0) 30%)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      {[
        [22, 30],
        [64, 56],
        [48, 18],
      ].map(([left, top]) => (
        <span key={`${left}-${top}`} className="absolute" style={{ left, top }}>
          <LivePulse />
        </span>
      ))}
    </div>
  );
}

function PhoneMini() {
  return (
    <div className="flex h-24 w-14 flex-col gap-1.5 rounded-xl bg-navy-700 p-1.5">
      <div className="h-7 rounded-md bg-brand-500" />
      <div className="flex gap-1">
        <div className="h-2 flex-1 rounded-full bg-white/25" />
        <div className="h-2 flex-1 rounded-full bg-white/25" />
      </div>
      <div className="flex-1 rounded-md bg-white/15" />
      <div className="h-2 rounded-full bg-red-500" />
    </div>
  );
}

function TranscriptMini() {
  return (
    <div className="w-full space-y-1.5">
      {[70, 90, 55].map((w, i) => (
        <motion.div
          key={w}
          className={`h-2.5 rounded-full ${i === 1 ? "bg-brand-400" : "bg-navy-200"}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${w}%` }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: i * 0.25 }}
        />
      ))}
    </div>
  );
}
