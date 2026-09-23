"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Check,
  ClipboardPen,
  LayoutDashboard,
  Mic,
  MicOff,
  PhoneOff,
  Radar,
  Send,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { BrowserFrame } from "../_ds/frames";
import { Count, LivePulse, Press, spring } from "../_ds/motion";
import { H2, PortalPage, PortalShell, Stat } from "../_ds/portal";
import { Avatar, Btn, Card, Glow, Spark, Toast, Toggle } from "../_ds/ui";

type View = "today" | "session" | "note";

const LINES: Array<{ who: "Laila" | "You"; text: string }> = [
  { who: "You", text: "How has the week been since we last spoke?" },
  { who: "Laila", text: "Better on the nights I kept the routine. I still wake around four." },
  { who: "You", text: "How many nights did you manage the wind-down?" },
  { who: "Laila", text: "Four. The breathing helped on Tuesday, I fell back asleep." },
  { who: "Laila", text: "On the other nights I picked up my phone and that was it." },
  { who: "You", text: "So the phone is where the nights go wrong." },
  { who: "Laila", text: "Yes. If it's out of the room I think I'd manage." },
];

const COPILOT = [
  { at: 2, text: "Waking at 4am has come up in all three sessions.", cite: "18 Sept 0:24 · 11 Sept 0:31" },
  { at: 5, text: "She links bad nights to the phone. Worth a plan for where it sleeps.", cite: "This session, 0:52" },
];

export function TherapistWorkspace() {
  const [view, setView] = useState<View>("today");
  return (
    <PortalPage
      eyebrow="Therapists · the workspace"
      title="Your day, your session, your note."
      body="Go in to the waiting session, watch the transcript and the copilot work beside you, go off the record and back, end it, and sign the note that was drafted from what was actually said."
      tryThis={["Go in", "Off the record", "End session", "Sign the note"]}
    >
      <BrowserFrame url="24therapy.app/dashboard">
        <PortalShell
          product="Practice"
          active={view}
          onNav={setView}
          user="Dr Omar Abdelgawad"
          role="Psychotherapist"
          nav={[
            { id: "today", label: "Today", icon: <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "session", label: "Live session", icon: <Mic className="h-[18px] w-[18px]" aria-hidden />, badge: "1" },
            { id: "note", label: "Notes", icon: <ClipboardPen className="h-[18px] w-[18px]" aria-hidden />, badge: "1" },
          ]}
        >
          {view === "today" && <Today onGoIn={() => setView("session")} />}
          {view === "session" && <Session onEnd={() => setView("note")} />}
          {view === "note" && <Note />}
        </PortalShell>
      </BrowserFrame>
    </PortalPage>
  );
}

function Today({ onGoIn }: { onGoIn: () => void }) {
  const [onRadar, setOnRadar] = useState(true);
  return (
    <div>
      <H2 sub="Tuesday 23 September">Good evening, Omar</H2>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Sessions today" note="1 waiting now">
          <Count value={4} />
        </Stat>
        <Stat label="Notes to sign" note="Drafted, not yet sent to anyone">
          <Count value={1} />
        </Stat>
        <Stat label="Earned this week" note="After your 15% and your bills" tone="dark">
          <span className="flex items-end justify-between gap-3">
            <Count value={540} format={(n) => `$${Math.round(n)}`} />
            <Spark points={[80, 120, 90, 160, 140, 210, 180]} width={110} height={44} />
          </span>
        </Stat>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <p className="text-[16px] font-bold text-navy-700">Today</p>
          <ol className="relative mt-4 space-y-3 ps-6">
            <span className="absolute bottom-2 start-2 top-2 w-0.5 rounded-full bg-navy-100" />
            {[
              { time: "Now", who: "Laila Demo", what: "Waiting in the room · said yes to recording", live: true },
              { time: "19:30", who: "Tarek Demo", what: "Video · 60 min" },
              { time: "21:00", who: "Omar Ahmad", what: "In person · 60 min" },
            ].map((row, index) => (
              <motion.li
                key={row.who}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: index * 0.08 }}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl p-3",
                  row.live ? "bg-navy-900 text-white shadow-[0_20px_40px_-20px_rgba(46,196,182,0.7)]" : "bg-navy-50",
                )}
              >
                <span className={cn("absolute -start-[22px] h-3 w-3 rounded-full ring-4 ring-white", row.live ? "bg-brand-500" : "bg-navy-200")} />
                <span className={cn("w-12 text-[13px] font-bold", row.live ? "text-brand-300" : "text-navy-500")}>{row.time}</span>
                <Avatar name={row.who} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{row.who}</p>
                  <p className={cn("truncate text-[13px]", row.live ? "text-white/70" : "text-navy-500")}>{row.what}</p>
                </div>
                {row.live ? (
                  <Btn onClick={onGoIn} className="h-10 px-4 text-[14px]">
                    <LivePulse /> Go in
                  </Btn>
                ) : null}
              </motion.li>
            ))}
          </ol>
        </Card>

        <div className="space-y-5">
          <Card className="relative overflow-hidden p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-brand-700" aria-hidden />
                <p className="text-[16px] font-bold text-navy-700">On the radar</p>
              </div>
              <Toggle on={onRadar} onChange={setOnRadar} label="On the radar" />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={String(onRadar)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 text-[14px] leading-relaxed text-navy-500"
              >
                {onRadar
                  ? "Patients who need someone now can find you. Your alarm will ring when one books."
                  : "You are off the radar. Booked sessions still happen."}
              </motion.p>
            </AnimatePresence>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-navy-600" aria-hidden />
              <p className="text-[16px] font-bold text-navy-700">Caseload</p>
            </div>
            <div className="mt-3 flex -space-x-2">
              {["Laila Demo", "Tarek Demo", "Omar Ahmad", "Nadia Demo", "Mariam Demo"].map((n) => (
                <motion.span key={n} whileHover={{ y: -4, zIndex: 10 }} className="relative">
                  <Avatar name={n} size={40} ring />
                </motion.span>
              ))}
            </div>
            <p className="mt-3 text-[14px] text-navy-500">12 people. 3 with a session this week.</p>
          </Card>
          <Card className="flex items-center gap-3 p-5">
            <Wallet className="h-5 w-5 text-navy-600" aria-hidden />
            <p className="flex-1 text-[14px] text-navy-600">Held for you <span className="font-bold text-navy-700">$446.25</span>, bills cleared from it first.</p>
            <CalendarDays className="h-5 w-5 text-navy-400" aria-hidden />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Session({ onEnd }: { onEnd: () => void }) {
  const [shown, setShown] = useState(1);
  const [offRecord, setOffRecord] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (offRecord || shown >= LINES.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 2200);
    return () => clearTimeout(id);
  }, [shown, offRecord]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [shown]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-[28px] bg-navy-900 text-white">
          <Glow className="h-80 w-80 opacity-50" />
          <Avatar name="Laila Demo" size={96} />
          <p className="relative mt-3 text-[17px] font-bold">Laila Demo</p>
          <p className="relative text-[13px] text-white/65">Said yes to recording at 19:02</p>
          <div className="absolute start-4 top-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
            <span className={cn("h-2.5 w-2.5 rounded-full", offRecord ? "bg-amber-400" : "bg-red-500")} />
            {offRecord ? "Off the record" : "Recording"}
          </div>
          <span className="absolute end-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold tabular-nums">
            {mm}:{ss} / 50:00
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Press
            onClick={() => setOffRecord((v) => !v)}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              offRecord ? "bg-amber-400 text-navy-700" : "bg-white text-navy-700 ring-1 ring-navy-100",
            )}
          >
            {offRecord ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5" aria-hidden />}
            {offRecord ? "Back on the record" : "Off the record"}
          </Press>
          <Press onClick={onEnd} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-navy-700 text-[15px] font-bold text-white">
            <PhoneOff className="h-5 w-5" aria-hidden /> End session
          </Press>
        </div>
        <AnimatePresence>
          {offRecord ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl bg-amber-100 px-4 py-3 text-[14px] text-navy-700"
            >
              Nothing said now is kept, and the note will not mention it. Laila&apos;s screen shows it too.
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] xl:grid-cols-1">
        <Card className="flex h-[360px] flex-col p-0">
          <p className="flex items-center gap-2 border-b border-navy-100 px-5 py-3 text-[14px] font-bold text-navy-700">
            {offRecord ? <MicOff className="h-4 w-4 text-amber-500" aria-hidden /> : <LivePulse />} Transcript
          </p>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
            <AnimatePresence initial={false}>
              {LINES.slice(0, shown).map((line, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", line.who === "You" && "flex-row-reverse text-end")}
                >
                  <span className={cn("mt-0.5 shrink-0 text-[12px] font-bold", line.who === "You" ? "text-navy-400" : "text-brand-700")}>
                    {line.who}
                  </span>
                  <p className={cn("rounded-2xl px-3 py-2 text-[14px] leading-relaxed", line.who === "You" ? "bg-navy-50 text-navy-600" : "bg-brand-50 text-navy-700")}>
                    {line.text}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
            {shown < LINES.length && !offRecord ? (
              <div className="flex gap-1 ps-12" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-navy-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </div>
            ) : null}
          </div>
        </Card>
        <Card className="relative overflow-hidden bg-navy-900 p-5 text-white ring-0">
          <Glow className="-right-20 -top-20 h-56 w-56 opacity-60" />
          <p className="relative flex items-center gap-2 text-[14px] font-bold">
            <Sparkles className="h-4 w-4 text-brand-400" aria-hidden /> Copilot
          </p>
          <div className="relative mt-3 space-y-3">
            <AnimatePresence>
              {COPILOT.filter((hint) => shown > hint.at).map((hint) => (
                <motion.div
                  key={hint.text}
                  initial={{ opacity: 0, x: 20, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={spring}
                  className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/12"
                >
                  <p className="text-[14px] leading-relaxed">{hint.text}</p>
                  <p className="mt-1.5 inline-flex rounded-full bg-brand-500/20 px-2 py-0.5 text-[12px] font-semibold text-brand-200">{hint.cite}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {shown <= COPILOT[0]!.at ? <p className="text-[14px] text-white/60">Listening. Suggestions cite the sentence they come from.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Note() {
  const [ready, setReady] = useState(false);
  const [signed, setSigned] = useState(false);
  const [released, setReleased] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(id);
  }, []);
  const sections = [
    ["Subjective", "Laila reports waking around 4am on most nights. She kept the wind-down routine on four nights; on those nights sleep was better. The breathing exercise helped her return to sleep on Tuesday."],
    ["Objective", "Engaged and reflective. Linked bad nights to phone use after waking."],
    ["Assessment", "Middle insomnia improving with the routine; the phone is the main barrier on the remaining nights."],
    ["Plan", "Phone out of the bedroom for the coming week. Continue the routine. Review at the next session."],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <Toast show={signed && !released}>
        <Check className="h-4 w-4 text-brand-300" aria-hidden /> Signed. Laila&apos;s plain-language copy is ready to release.
      </Toast>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <H2 sub="Laila Demo · today, 50 min · recorded with her yes">Session note</H2>
        <span className={cn("rounded-full px-3 py-1 text-[13px] font-bold", signed ? "bg-navy-700 text-white" : "bg-amber-100 text-navy-700")}>
          {signed ? "Signed" : "Draft"}
        </span>
      </div>
      <Card className="p-6">
        <AnimatePresence mode="wait">
          {!ready ? (
            <motion.div key="drafting" exit={{ opacity: 0 }} className="space-y-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-navy-600">
                <Sparkles className="h-4 w-4 text-brand-600" aria-hidden /> Drafting from the transcript…
              </p>
              {[90, 76, 84, 60].map((w) => (
                <motion.div key={w} className="h-3.5 rounded-full bg-navy-100" style={{ width: `${w}%` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.3, repeat: Infinity }} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="ready" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }} className="space-y-5">
              {sections.map(([title, body]) => (
                <motion.div key={title} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
                  <p className="text-[13px] font-bold uppercase tracking-wide text-brand-700">{title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-navy-700">{body}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      <div className="mt-5 flex flex-wrap gap-3">
        <Btn onClick={() => setSigned(true)} disabled={!ready || signed} className="min-w-44">
          <AnimatePresence mode="wait">
            {signed ? (
              <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-2">
                <motion.svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                </motion.svg>
                Signed
              </motion.span>
            ) : (
              <motion.span key="sign">Read and sign</motion.span>
            )}
          </AnimatePresence>
        </Btn>
        <Btn kind="ghost" disabled={!signed || released} onClick={() => setReleased(true)}>
          <Send className="h-4 w-4" aria-hidden /> {released ? "Released to Laila" : "Release Laila's copy"}
        </Btn>
      </div>
      <p className="mt-3 text-[14px] text-navy-500">The clinical note stays in the chart. Laila only ever receives her plain-language copy, and only once you release it.</p>
    </div>
  );
}
