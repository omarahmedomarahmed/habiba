"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Eye, KeyRound, LayoutDashboard, RotateCw, Webhook } from "lucide-react";

import { cn } from "@/lib/utils";

import { BrowserFrame } from "../_ds/frames";
import { Count, LivePulse, Press, spring } from "../_ds/motion";
import { H2, PortalPage, PortalShell, Stat } from "../_ds/portal";
import { Btn, Card, Chips, Spark, Toast } from "../_ds/ui";

type View = "overview" | "keys" | "hooks";

// Obviously not a real key: the sample must never look like a leaked secret.
const DEMO_KEY = "t24_demo_EXAMPLE_ONLY_not_a_real_key";

export function PartnerPortal() {
  const [view, setView] = useState<View>("overview");
  return (
    <PortalPage
      eyebrow="Partners · the API portal"
      title="Build on 24Therapy, watch it work."
      body="A partner sees their calls, makes a key that is shown exactly once, and watches webhook deliveries land in real time, with a retry on anything that failed."
      tryThis={["Make a key", "Copy it", "Filter failed deliveries", "Retry one"]}
    >
      <BrowserFrame url="24therapy.app/partner">
        <PortalShell
          product="Partners"
          active={view}
          onNav={setView}
          user="Wellbeing Demo Inc"
          role="Developer"
          nav={[
            { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "keys", label: "Keys", icon: <KeyRound className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "hooks", label: "Webhooks", icon: <Webhook className="h-[18px] w-[18px]" aria-hidden />, badge: "1" },
          ]}
        >
          {view === "overview" && <Overview />}
          {view === "keys" && <Keys />}
          {view === "hooks" && <Hooks />}
        </PortalShell>
      </BrowserFrame>
    </PortalPage>
  );
}

const DAYS = [820, 940, 910, 1180, 1320, 1270, 1490, 1610, 1540, 1720, 1880, 1830, 2040, 2210];

function Overview() {
  const [range, setRange] = useState<"7" | "14">("14");
  const points = range === "7" ? DAYS.slice(-7) : DAYS;
  return (
    <div>
      <H2 sub="Live keys only. Test calls are counted apart and cost nothing.">Wellbeing Demo Inc</H2>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Calls today">
          <Count value={2210} />
        </Stat>
        <Stat label="Success rate" note="Last 24 hours">
          <Count value={99.6} format={(n) => `${n.toFixed(1)}%`} />
        </Stat>
        <Stat label="Median response" tone="dark" note="p95 212 ms">
          <Count value={84} format={(n) => `${Math.round(n)} ms`} />
        </Stat>
      </div>
      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[16px] font-bold text-navy-700">Calls a day</p>
          <Chips
            value={range}
            onChange={setRange}
            options={[
              { id: "7", label: "7 days" },
              { id: "14", label: "14 days" },
            ]}
          />
        </div>
        <div className="mt-4 overflow-hidden [&_svg]:h-auto [&_svg]:w-full">
          <AnimatePresence mode="wait">
            <motion.div key={range} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Spark points={points} width={720} height={160} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["POST /v1/bookings", "41%"],
            ["GET /v1/therapists", "38%"],
            ["GET /v1/sessions/:id", "21%"],
          ].map(([path, share]) => (
            <div key={path} className="rounded-2xl bg-navy-50 px-4 py-3">
              <p className="font-mono text-[13px] font-semibold text-navy-700">{path}</p>
              <p className="text-[13px] text-navy-500">{share} of calls</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Keys() {
  const [made, setMade] = useState(false);
  const [shown, setShown] = useState(true);
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <Toast show={copied}>
        <Check className="h-4 w-4 text-brand-300" aria-hidden /> Copied. Keep it somewhere safe.
      </Toast>
      <H2 sub="We keep only a fingerprint of a key. If it is lost, make a new one and revoke the old.">Keys</H2>
      <div className="space-y-3">
        <KeyRow name="Production" hint="t24_live_…k9Qa" used="2 minutes ago" />
        <KeyRow name="Staging" hint="t24_test_…M2xe" used="Yesterday" />
      </div>
      <AnimatePresence mode="wait">
        {!made ? (
          <motion.div key="make" exit={{ opacity: 0, y: -8 }} className="mt-5">
            <Btn onClick={() => setMade(true)}>
              <KeyRound className="h-4 w-4" aria-hidden /> Make a new key
            </Btn>
          </motion.div>
        ) : (
          <motion.div key="made" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className="mt-5">
            <Card className="relative overflow-hidden bg-navy-900 p-5 text-white ring-0">
              <p className="text-[15px] font-bold">{shown ? "Your new key. You will not see it again." : "The key is hidden for good."}</p>
              <AnimatePresence mode="wait">
                {shown ? (
                  <motion.div key="key" exit={{ opacity: 0, filter: "blur(8px)" }} className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-xl bg-white/10 px-3 py-2.5 font-mono text-[14px] text-brand-200">
                      {DEMO_KEY.split("").map((ch, i) => (
                        <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}>
                          {ch}
                        </motion.span>
                      ))}
                    </code>
                    <Btn
                      kind="light"
                      className="h-11"
                      onClick={() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      <Copy className="h-4 w-4" aria-hidden /> Copy
                    </Btn>
                    <Btn kind="light" className="h-11" onClick={() => setShown(false)}>
                      <Eye className="h-4 w-4" aria-hidden /> I saved it
                    </Btn>
                  </motion.div>
                ) : (
                  <motion.p key="gone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 font-mono text-[14px] text-white/65">
                    t24_demo_…_key · fingerprint only
                  </motion.p>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KeyRow({ name, hint, used }: { name: string; hint: string; used: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-navy-100">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
        <KeyRound className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-navy-700">{name}</p>
        <p className="font-mono text-[13px] text-navy-500">{hint}</p>
      </div>
      <span className="text-[13px] text-navy-500">Used {used}</span>
    </div>
  );
}

type Delivery = { id: number; event: string; status: number; ms: number; at: string };

const EVENTS = ["booking.created", "session.started", "session.ended", "booking.cancelled", "note.released"];

function Hooks() {
  const [items, setItems] = useState<Delivery[]>([
    { id: 3, event: "session.ended", status: 500, ms: 3012, at: "18:04:11" },
    { id: 2, event: "session.started", status: 200, ms: 74, at: "18:03:40" },
    { id: 1, event: "booking.created", status: 200, ms: 91, at: "18:01:02" },
  ]);
  const [filter, setFilter] = useState<"all" | "ok" | "failed">("all");
  const [retrying, setRetrying] = useState<number | null>(null);

  useEffect(() => {
    let n = 4;
    const id = setInterval(() => {
      const now = new Date();
      setItems((list) =>
        [
          {
            id: n,
            event: EVENTS[n % EVENTS.length]!,
            status: 200,
            ms: 50 + ((n * 37) % 90),
            at: now.toTimeString().slice(0, 8),
          },
          ...list,
        ].slice(0, 9),
      );
      n += 1;
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const shown = items.filter((d) => filter === "all" || (filter === "ok" ? d.status < 300 : d.status >= 300));
  const failed = items.filter((d) => d.status >= 300).length;

  return (
    <div>
      <H2 sub="https://api.example.com/24t/hooks · signed with your secret">Webhook deliveries</H2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-3 py-1.5 text-[13px] font-semibold text-white">
          <LivePulse /> Listening
        </span>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "ok", label: "Delivered" },
            { id: "failed", label: `Failed ${failed}` },
          ]}
        />
      </div>
      <motion.ul layout className="mt-4 space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((d) => {
            const ok = d.status < 300;
            return (
              <motion.li
                key={d.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring}
                className={cn("flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1", ok ? "ring-navy-100" : "ring-amber-300")}
              >
                <span className={cn("w-14 rounded-lg py-1 text-center font-mono text-[13px] font-bold", ok ? "bg-brand-100 text-brand-900" : "bg-amber-100 text-navy-700")}>{d.status}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold text-navy-700">{d.event}</span>
                <span className="hidden font-mono text-[13px] text-navy-500 sm:inline">{d.ms} ms</span>
                <span className="shrink-0 font-mono text-[12px] text-navy-500 sm:text-[13px]">{d.at}</span>
                {!ok ? (
                  <Press
                    onClick={() => {
                      setRetrying(d.id);
                      setTimeout(() => {
                        setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: 200, ms: 88 } : x)));
                        setRetrying(null);
                      }, 1200);
                    }}
                    aria-label="Retry"
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-navy-600 ring-1 ring-navy-200"
                  >
                    <motion.span animate={retrying === d.id ? { rotate: 360 } : { rotate: 0 }} transition={retrying === d.id ? { repeat: Infinity, duration: 0.8, ease: "linear" } : spring}>
                      <RotateCw className="h-4 w-4" aria-hidden />
                    </motion.span>
                    <span className="hidden sm:inline">Retry</span>
                  </Press>
                ) : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      {shown.length === 0 ? <p className="mt-6 text-center text-[15px] text-navy-500">Nothing has failed.</p> : null}
    </div>
  );
}
