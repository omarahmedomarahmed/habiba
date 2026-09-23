"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, Check, ClipboardList, History, Inbox, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { BrowserFrame } from "../_ds/frames";
import { Count, Press, spring } from "../_ds/motion";
import { H2, PortalPage, PortalShell, Stat } from "../_ds/portal";
import { Btn, Card, Chips, Toast } from "../_ds/ui";

type View = "stuck" | "transfer" | "audit";
type Kind = "transfer" | "licence" | "refund" | "payout";

type Case = { id: string; kind: Kind; title: string; who: string; startedMinutesAgo: number };

const CASES: Case[] = [
  { id: "T-2291", kind: "transfer", title: "Bank transfer to match", who: "Booking 8841, $34.20", startedMinutesAgo: 312 },
  { id: "L-0412", kind: "licence", title: "Licence to check", who: "Dr Rami Demo, Cairo", startedMinutesAgo: 188 },
  { id: "R-0077", kind: "refund", title: "Refund after a no-show", who: "Booking 8790, $34.20", startedMinutesAgo: 95 },
  { id: "P-1203", kind: "payout", title: "Payout returned by bank", who: "Mona Demo, $420.00", startedMinutesAgo: 51 },
  { id: "T-2294", kind: "transfer", title: "Bank transfer to match", who: "Booking 8852, $68.40", startedMinutesAgo: 22 },
  { id: "L-0415", kind: "licence", title: "Licence to check", who: "Yara Demo, Giza", startedMinutesAgo: 6 },
];

const LABEL: Record<Kind, string> = { transfer: "Transfers", licence: "Licences", refund: "Refunds", payout: "Payouts" };

type Entry = { at: string; who: string; what: string };

export function ConsolePortal() {
  return (
    <PortalPage
      eyebrow="Our console · operations"
      title="Everything that is stuck, oldest first."
      body="Nothing sits in the console without a clock on it. Match a bank transfer against the booking it pays for, confirm it once, reject with a reason, and see every action written down."
      tryThis={["Filter by kind", "Match the transfer", "Confirm twice", "Reject without a reason"]}
    >
      <ConsoleDemo />
    </PortalPage>
  );
}

/** The window alone, so the website can show the same flow inside its product demo. */
export function ConsoleDemo() {
  const [view, setView] = useState<View>("stuck");
  const [audit, setAudit] = useState<Entry[]>([
    { at: "18:02", who: "Omar (ops)", what: "Confirmed transfer T-2288 against booking 8830" },
    { at: "17:41", who: "Laila (ops)", what: "Approved licence L-0409 for Dr Hany Demo" },
    { at: "16:55", who: "System", what: "Refunded booking 8812 after the therapist did not join" },
  ]);
  const log = (what: string) => setAudit((a) => [{ at: "now", who: "You (ops)", what }, ...a]);
  return (
    <BrowserFrame url="24therapy.app/admin">
      <PortalShell
        product="Console"
        active={view}
        onNav={setView}
        user="You"
        role="Operations"
        nav={[
          { id: "stuck", label: "Stuck", icon: <Inbox className="h-[18px] w-[18px]" aria-hidden />, badge: String(CASES.length) },
          { id: "transfer", label: "Match a transfer", icon: <ArrowLeftRight className="h-[18px] w-[18px]" aria-hidden /> },
          { id: "audit", label: "Audit trail", icon: <History className="h-[18px] w-[18px]" aria-hidden /> },
        ]}
      >
        {view === "stuck" && <Stuck onOpen={() => setView("transfer")} />}
        {view === "transfer" && <Transfer log={log} />}
        {view === "audit" && <Audit entries={audit} />}
      </PortalShell>
    </BrowserFrame>
  );
}

/** Minutes that keep counting while the page is open. */
function useMinutes() {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setExtra((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return extra;
}

function age(minutes: number, seconds: number) {
  const total = minutes * 60 + seconds;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

function Stuck({ onOpen }: { onOpen: () => void }) {
  const [kind, setKind] = useState<"all" | Kind>("all");
  const seconds = useMinutes();
  const shown = CASES.filter((c) => kind === "all" || c.kind === kind).sort((a, b) => b.startedMinutesAgo - a.startedMinutesAgo);
  return (
    <div>
      <H2 sub="Past two hours is amber. Nothing here is hidden by a filter you forgot you set: the count is always the whole queue.">Stuck</H2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting">
          <Count value={CASES.length} />
        </Stat>
        <Stat label="Oldest" note="Transfer T-2291">
          {age(312, seconds)}
        </Stat>
        <Stat label="Cleared today" tone="dark">
          <Count value={14} />
        </Stat>
      </div>
      <Chips
        className="mt-6"
        value={kind}
        onChange={setKind}
        options={[
          { id: "all", label: `All ${CASES.length}` },
          ...(Object.keys(LABEL) as Kind[]).map((k) => ({ id: k, label: `${LABEL[k]} ${CASES.filter((c) => c.kind === k).length}` })),
        ]}
      />
      <motion.ul layout className="mt-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {shown.map((c, index) => {
            const late = c.startedMinutesAgo >= 120;
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ ...spring, delay: index * 0.03 }}
              >
                <Press
                  onClick={c.id === "T-2291" ? onOpen : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 sm:gap-4 sm:p-4 text-start ring-1 ring-navy-100",
                    c.id === "T-2291" && "ring-2 ring-brand-400",
                  )}
                >
                  <span className={cn("h-10 w-1.5 rounded-full", late ? "bg-amber-400" : "bg-navy-200")} />
                  <span className="hidden w-16 font-mono text-[13px] font-semibold text-navy-500 sm:inline">{c.id}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-navy-700">{c.title}</p>
                    <p className="truncate text-[13px] text-navy-500">{c.who}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 font-mono text-[13px] font-semibold tabular-nums", late ? "bg-amber-100 text-navy-700" : "bg-navy-50 text-navy-600")}>
                    {age(c.startedMinutesAgo, seconds)}
                  </span>
                </Press>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      <p className="mt-3 text-[13px] text-navy-500">The ringed row opens the transfer match.</p>
    </div>
  );
}

const LINES = [
  { id: "a", ref: "24T-8841", amount: 34.2, from: "L. DEMO", date: "22 Sep", matches: true },
  { id: "b", ref: "8841", amount: 34.0, from: "L DEMO", date: "22 Sep", matches: false },
  { id: "c", ref: "NO REFERENCE", amount: 68.4, from: "T. DEMO", date: "21 Sep", matches: false },
];

function Transfer({ log }: { log: (what: string) => void }) {
  const [pick, setPick] = useState<string | null>("a");
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(null);
  const [again, setAgain] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const line = LINES.find((l) => l.id === pick);

  const confirm = () => {
    if (done === "confirmed") {
      setAgain(true);
      setTimeout(() => setAgain(false), 2200);
      return;
    }
    setDone("confirmed");
    log(`Confirmed transfer T-2291 against booking 8841 (bank line ${line?.ref})`);
  };

  return (
    <div className="relative">
      <Toast show={again}>
        <ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden /> Already confirmed. Nothing was charged twice.
      </Toast>
      <H2 sub="Pick the bank line that pays this booking. Only an exact amount and reference counts as a match.">Match transfer T-2291</H2>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Card className="bg-navy-900 p-5 text-white ring-0">
          <p className="text-[13px] font-semibold text-white/65">What we expect</p>
          <p className="mt-2 text-[32px] font-bold tabular-nums">$34.20</p>
          <div className="mt-3 space-y-1.5 text-[14px] text-white/80">
            <p>Booking 8841 with Dr Sara Demo, 24 Sep 19:00</p>
            <p>Reference 24T-8841</p>
            <p>Patient sent it on 22 Sep and has been waiting 5h</p>
          </div>
          <AnimatePresence>
            {done ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold",
                  done === "confirmed"
                    ? "bg-brand-500 text-navy-700"
                    : "bg-white/10 text-white",
                )}
              >
                {done === "confirmed" ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                {done === "confirmed" ? "Confirmed. The booking is paid and the patient is told." : "Rejected. The patient is told why and how to fix it."}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Card>

        <div>
          <p className="mb-2 text-[14px] font-semibold text-navy-600">Bank lines on 21 and 22 Sep</p>
          <div className="space-y-2">
            {LINES.map((l) => {
              const on = pick === l.id;
              return (
                <Press
                  key={l.id}
                  onClick={() => !done && setPick(l.id)}
                  aria-pressed={on}
                  className={cn("relative flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-start ring-1", on ? "ring-2 ring-navy-600" : "ring-navy-100")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[14px] font-semibold text-navy-700">{l.ref}</p>
                    <p className="text-[13px] text-navy-500">
                      {l.from} · {l.date}
                    </p>
                  </div>
                  <span className="text-[16px] font-bold tabular-nums text-navy-700">${l.amount.toFixed(2)}</span>
                  <span
                    className={cn(
                      "w-28 rounded-full px-2.5 py-1 text-center text-[12px] font-bold",
                      l.matches ? "bg-brand-100 text-brand-900" : "bg-[repeating-linear-gradient(45deg,#fff7e6,#fff7e6_5px,#fff_5px,#fff_10px)] text-navy-700 ring-1 ring-amber-300",
                    )}
                  >
                    {l.matches ? "Exact match" : "Does not match"}
                  </span>
                </Press>
              );
            })}
          </div>
          {line && !line.matches && !done ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-navy-700 ring-1 ring-amber-200">
              This line is ${Math.abs(34.2 - line.amount).toFixed(2)} off or has no reference. Confirming it would mark the booking paid when it may not be.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Btn onClick={confirm} disabled={!line?.matches || done === "rejected"}>
              <Check className="h-4 w-4" aria-hidden /> {done === "confirmed" ? "Confirm again" : "Confirm"}
            </Btn>
            <Btn kind="ghost" onClick={() => setRejecting(true)} disabled={done !== null}>
              Reject
            </Btn>
          </div>
          <AnimatePresence>
            {rejecting && !done ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <label className="mt-4 block">
                  <span className="text-[14px] font-semibold text-navy-600">Why? The patient reads this.</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="We received $34.00, 20 cents short of the booking."
                    className="mt-1.5 w-full rounded-2xl bg-white p-3 text-[15px] text-navy-700 outline-none ring-1 ring-navy-100 placeholder:text-navy-400 focus:ring-2 focus:ring-brand-400"
                  />
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <Btn
                    kind="dark"
                    disabled={reason.trim().length < 8}
                    onClick={() => {
                      setDone("rejected");
                      log(`Rejected transfer T-2291: ${reason.trim()}`);
                    }}
                  >
                    Reject with this reason
                  </Btn>
                  <span className="text-[13px] text-navy-500">{reason.trim().length < 8 ? "A reason is needed" : "Ready"}</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Audit({ entries }: { entries: Entry[] }) {
  return (
    <div>
      <H2 sub="Every action in the console, who took it and when. It cannot be edited from here.">Audit trail</H2>
      <ol className="relative space-y-3 ps-7">
        <span className="absolute bottom-3 start-2.5 top-3 w-0.5 rounded-full bg-navy-100" />
        <AnimatePresence initial={false}>
          {entries.map((entry, index) => (
            <motion.li
              key={`${entry.what}-${index}`}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: index * 0.04 }}
              className="relative rounded-2xl bg-white p-4 ring-1 ring-navy-100"
            >
              <span className={cn("absolute -start-[26px] top-5 h-3 w-3 rounded-full ring-4 ring-navy-50", entry.at === "now" ? "bg-brand-500" : "bg-navy-300")} />
              <div className="flex items-center gap-2 text-[13px] text-navy-500">
                <ClipboardList className="h-4 w-4" aria-hidden />
                <span className="font-semibold">{entry.who}</span>
                <span className="ms-auto font-mono">{entry.at}</span>
              </div>
              <p className="mt-1 text-[15px] text-navy-700">{entry.what}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
