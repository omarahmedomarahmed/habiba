"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, LayoutDashboard, Receipt, UserPlus, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import { BrowserFrame } from "../_ds/frames";
import { Count, LivePulse, Press, spring } from "../_ds/motion";
import { H2, PortalPage, PortalShell, Stat } from "../_ds/portal";
import { Avatar, Btn, Card, Chips, Ring, SearchField, Spark, Toast } from "../_ds/ui";

type View = "overview" | "team" | "add" | "bill";

type Status = "live" | "free" | "away";
const TEAM: Array<{ name: string; role: string; status: Status; sessions: number; earned: number; trend: number[] }> = [
  { name: "Dr Sara Demo", role: "Clinical psychologist", status: "live", sessions: 22, earned: 1240, trend: [4, 6, 5, 7, 6, 8, 9] },
  { name: "Dr Karim Demo", role: "Psychiatrist", status: "free", sessions: 18, earned: 1580, trend: [5, 5, 6, 4, 7, 6, 7] },
  { name: "Mona Demo", role: "Counsellor", status: "free", sessions: 26, earned: 980, trend: [3, 5, 6, 6, 8, 7, 9] },
  { name: "Youssef Demo", role: "Family therapist", status: "away", sessions: 11, earned: 640, trend: [2, 3, 2, 4, 3, 3, 4] },
  { name: "Nour Demo", role: "Child psychologist", status: "live", sessions: 15, earned: 890, trend: [3, 2, 4, 5, 4, 6, 5] },
  { name: "Hana Demo", role: "Counsellor", status: "away", sessions: 9, earned: 410, trend: [1, 2, 2, 3, 2, 3, 3] },
];

const SEAT_PRICE = 29;

export function ClinicPortal() {
  const [view, setView] = useState<View>("overview");
  const [seats, setSeats] = useState(6);
  return (
    <PortalPage
      eyebrow="Clinics · the owner's portal"
      title="Your team, your seats, one bill."
      body="See who is in a session right now, what each clinician earned, and add a colleague with the price of the seat shown before you commit. No patient names reach the clinic owner, ever."
      tryThis={["Filter the team", "Add a clinician", "Open the bill"]}
    >
      <BrowserFrame url="24therapy.app/clinic">
        <PortalShell
          product="Clinic"
          active={view}
          onNav={setView}
          user="Nile Minds Clinic"
          role="Owner"
          nav={[
            { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "team", label: "Team", icon: <Users className="h-[18px] w-[18px]" aria-hidden />, badge: String(seats) },
            { id: "add", label: "Add a clinician", icon: <UserPlus className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "bill", label: "Bill", icon: <Receipt className="h-[18px] w-[18px]" aria-hidden /> },
          ]}
        >
          {view === "overview" && <Overview seats={seats} onTeam={() => setView("team")} onAdd={() => setView("add")} />}
          {view === "team" && <Team />}
          {view === "add" && (
            <Add
              seats={seats}
              onAdded={() => {
                setSeats((n) => n + 1);
              }}
              onBill={() => setView("bill")}
            />
          )}
          {view === "bill" && <Bill seats={seats} />}
        </PortalShell>
      </BrowserFrame>
    </PortalPage>
  );
}

function Overview({ seats, onTeam, onAdd }: { seats: number; onTeam: () => void; onAdd: () => void }) {
  const live = TEAM.filter((m) => m.status === "live").length;
  return (
    <div>
      <H2 sub="This month, to 23 September">Nile Minds Clinic</H2>
      <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <Ring value={seats / 8} size={112} stroke={12}>
            <span className="text-[28px] font-bold tabular-nums text-navy-700">
              {seats}/8
            </span>
            <span className="text-[12px] font-semibold text-navy-500">seats</span>
          </Ring>
          <div>
            <p className="text-[15px] font-bold text-navy-700">{8 - seats} free on your plan</p>
            <p className="mt-1 text-[13px] text-navy-500">${SEAT_PRICE} a seat a month</p>
            <Btn kind="ghost" onClick={onAdd} className="mt-3 h-10 px-4 text-[14px]">
              <UserPlus className="h-4 w-4" aria-hidden /> Add
            </Btn>
          </div>
        </Card>
        <Stat label="Sessions this month" note="Across the whole team">
          <Count value={101} />
        </Stat>
        <Stat label="Paid to your clinicians" note="Each is paid directly, you see totals" tone="dark">
          <span className="flex items-end justify-between gap-3">
            <Count value={5740} format={(n) => `$${Math.round(n).toLocaleString("en-US")}`} />
            <Spark points={[900, 1100, 1300, 1250, 1500, 1640, 1740]} width={110} height={44} />
          </span>
        </Stat>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[16px] font-bold text-navy-700">
          <LivePulse /> {live} in a session now
        </p>
        <button type="button" onClick={onTeam} className="text-[14px] font-semibold text-navy-500 hover:text-navy-700">
          Whole team
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEAM.slice(0, 3).map((member, index) => (
          <MemberCard key={member.name} member={member} index={index} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, index }: { member: (typeof TEAM)[number]; index: number }) {
  const max = Math.max(...TEAM.map((m) => m.earned));
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ ...spring, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-white p-4 ring-1 ring-navy-100 shadow-[0_8px_24px_-16px_rgba(10,35,66,0.25)]"
    >
      <div className="flex items-center gap-3">
        <Avatar name={member.name} size={44} live={member.status === "live"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-navy-700">{member.name}</p>
          <p className="truncate text-[13px] text-navy-500">{member.role}</p>
        </div>
        <StatusChip status={member.status} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[12px] font-semibold text-navy-500">{member.sessions} sessions</p>
          <p className="text-[20px] font-bold tabular-nums text-navy-700">${member.earned.toLocaleString("en-US")}</p>
        </div>
        <Spark points={member.trend} width={90} height={36} fill={false} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy-50">
        <motion.div
          className="h-full rounded-full bg-brand-500"
          initial={{ width: 0 }}
          animate={{ width: `${(member.earned / max) * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 + index * 0.05 }}
        />
      </div>
    </motion.div>
  );
}

function StatusChip({ status }: { status: Status }) {
  if (status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-2.5 py-1 text-[12px] font-bold text-white">
        <LivePulse className="scale-75" /> In session
      </span>
    );
  if (status === "free") return <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-800 ring-1 ring-brand-200">Free</span>;
  return <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[12px] font-bold text-navy-500">Away</span>;
}

function Team() {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const shown = TEAM.filter((m) => (filter === "all" || m.status === filter) && m.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <H2 sub="Earnings are totals. What was said in a session stays between the clinician and the patient.">Team</H2>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="md:w-72">
          <SearchField value={query} onChange={setQuery} placeholder="Find a clinician" />
        </div>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: `All ${TEAM.length}` },
            { id: "live", label: "In session" },
            { id: "free", label: "Free" },
            { id: "away", label: "Away" },
          ]}
        />
      </div>
      <motion.div layout className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((member, index) => (
            <MemberCard key={member.name} member={member} index={index} />
          ))}
        </AnimatePresence>
      </motion.div>
      {shown.length === 0 ? <p className="mt-8 text-center text-[15px] text-navy-500">Nobody matches that.</p> : null}
    </div>
  );
}

function Add({ seats, onAdded, onBill }: { seats: number; onAdded: () => void; onBill: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"psych" | "counsel" | "psychiatry">("psych");
  const [sent, setSent] = useState(false);
  const valid = /.+@.+\..+/.test(email);
  const next = seats + 1;
  return (
    <div className="relative">
      <Toast show={sent}>
        <Check className="h-4 w-4 text-brand-300" aria-hidden /> Invite sent. The seat starts when they accept.
      </Toast>
      <H2 sub="They get an email, set their own password, and prove their licence before they see a patient.">Add a clinician</H2>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-4 p-5">
          <label className="block">
            <span className="text-[14px] font-semibold text-navy-600">Their work email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="mt-1.5 h-12 w-full rounded-2xl bg-navy-50 px-4 text-[15px] text-navy-700 outline-none ring-1 ring-navy-100 placeholder:text-navy-400 focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <div>
            <span className="text-[14px] font-semibold text-navy-600">What they do</span>
            <Chips
              className="mt-1.5"
              value={role}
              onChange={setRole}
              options={[
                { id: "psych", label: "Psychologist" },
                { id: "counsel", label: "Counsellor" },
                { id: "psychiatry", label: "Psychiatrist" },
              ]}
            />
          </div>
          <Btn
            disabled={!valid || sent}
            onClick={() => {
              setSent(true);
              onAdded();
              setTimeout(() => setSent(false), 2600);
            }}
            className="w-full"
          >
            {sent ? (
              <>
                <Check className="h-4 w-4" aria-hidden /> Sent
              </>
            ) : (
              "Send the invite"
            )}
          </Btn>
        </Card>
        <Card className="relative overflow-hidden bg-navy-900 p-5 text-white ring-0">
          <p className="text-[13px] font-semibold text-white/65">What changes on your bill</p>
          <div className="mt-3 flex items-baseline gap-2">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={next}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={spring}
                className="text-[40px] font-bold tabular-nums"
              >
                ${(next * SEAT_PRICE).toLocaleString("en-US")}
              </motion.span>
            </AnimatePresence>
            <span className="text-[14px] text-white/65">a month</span>
          </div>
          <p className="mt-1 text-[14px] text-white/75">
            {next} seats at ${SEAT_PRICE}. Charged from the day they accept, part months pro rata.
          </p>
          <div className="mt-5 flex gap-1.5">
            {Array.from({ length: 8 }, (_, i) => (
              <motion.span
                key={i}
                layout
                className={cn("h-8 flex-1 rounded-lg", i < seats ? "bg-brand-500" : i === seats ? "bg-brand-300" : "bg-white/10")}
                animate={i === seats ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                transition={i === seats ? { duration: 1.6, repeat: Infinity } : spring}
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/60">Pale seat: the one this invite would fill</p>
          <button type="button" onClick={onBill} className="mt-4 text-[14px] font-semibold text-brand-300 hover:text-brand-200">
            See the bill
          </button>
        </Card>
      </div>
    </div>
  );
}

function Bill({ seats }: { seats: number }) {
  const [open, setOpen] = useState<string | null>("Sept");
  const months = [
    { id: "Sept", label: "September 2026", status: "Due 1 Oct", amount: seats * SEAT_PRICE },
    { id: "Aug", label: "August 2026", status: "Paid", amount: 5 * SEAT_PRICE },
    { id: "Jul", label: "July 2026", status: "Paid", amount: 5 * SEAT_PRICE },
  ];
  return (
    <div>
      <H2 sub="One bill for the clinic. Clinicians are paid for their sessions directly; that money never passes through you.">Bill</H2>
      <div className="space-y-3">
        {months.map((month) => {
          const on = open === month.id;
          return (
            <motion.div layout key={month.id} className="overflow-hidden rounded-3xl bg-white ring-1 ring-navy-100">
              <Press onClick={() => setOpen(on ? null : month.id)} className="flex w-full items-center gap-4 p-5 text-start" aria-expanded={on}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-navy-700">{month.label}</p>
                  <p className="text-[13px] text-navy-500">{month.status}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[15px] font-bold tabular-nums",
                    month.status === "Paid" ? "text-navy-600" : "bg-amber-100 text-navy-700",
                  )}
                >
                  ${month.amount}
                </span>
              </Press>
              <AnimatePresence initial={false}>
                {on ? (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={spring}>
                    <div className="border-t border-navy-100 px-5 py-4 text-[14px] text-navy-600">
                      <Line label={`${month.amount / SEAT_PRICE} seats × $${SEAT_PRICE}`} value={`$${month.amount}`} />
                      <Line label="Session fees" value="$0, paid by patients" />
                      <Line label="VAT" value="Included" />
                      {month.status !== "Paid" ? (
                        <Btn kind="money" className="mt-4 h-11">
                          Pay ${month.amount}
                        </Btn>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between py-1.5">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-navy-700">{value}</span>
    </p>
  );
}
