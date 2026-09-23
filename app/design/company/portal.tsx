"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, LayoutDashboard, Percent, UserMinus, Users, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

import { BrowserFrame } from "../_ds/frames";
import { Count, Press, spring } from "../_ds/motion";
import { H2, PortalPage, PortalShell, Stat } from "../_ds/portal";
import { Btn, Card, Chips, Ring, SearchField, Sheet, Toast } from "../_ds/ui";

type View = "overview" | "cover" | "people" | "topup";

const SESSION = 75;
const TEAMS = ["Engineering", "Sales", "Operations", "Support"];
const MONTHS = ["Jun", "Jul", "Aug", "Sep"];
// Sessions a team used in a month. Below five is never shown: it could point at one person.
const USE = [
  [12, 14, 9, 17],
  [3, 6, 8, 7],
  [7, 2, 5, 9],
  [4, 4, 1, 6],
];

const PEOPLE = ["Ahmed Demo", "Dina Demo", "Farah Demo", "Hassan Demo", "Ibrahim Demo", "Jana Demo", "Khaled Demo", "Lina Demo", "Maged Demo", "Rana Demo"];

export function CompanyPortal() {
  const [view, setView] = useState<View>("overview");
  const [cover, setCover] = useState(60);
  const [pot, setPot] = useState(1840);
  return (
    <PortalPage
      eyebrow="Companies · the benefit portal"
      title="A budget you can see, and nothing you shouldn't."
      body="Set how much of each session the company covers, watch what it would cost before you save, top up the pot, and see use by team only where a team is big enough that nobody can be picked out."
      tryThis={["Drag the cover", "Touch a hidden cell", "Top up"]}
    >
      <BrowserFrame url="24therapy.app/sponsor">
        <PortalShell
          product="Benefit"
          active={view}
          onNav={setView}
          user="Acme Demo Ltd"
          role="HR admin"
          nav={[
            { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "cover", label: "Cover", icon: <Percent className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "people", label: "People", icon: <Users className="h-[18px] w-[18px]" aria-hidden /> },
            { id: "topup", label: "Top up", icon: <Wallet className="h-[18px] w-[18px]" aria-hidden /> },
          ]}
        >
          {view === "overview" && <Overview pot={pot} cover={cover} onTopUp={() => setView("topup")} />}
          {view === "cover" && <Cover cover={cover} onSave={setCover} />}
          {view === "people" && <People />}
          {view === "topup" && <TopUp pot={pot} cover={cover} onPaid={(n) => setPot((p) => p + n)} />}
        </PortalShell>
      </BrowserFrame>
    </PortalPage>
  );
}

function Overview({ pot, cover, onTopUp }: { pot: number; cover: number; onTopUp: () => void }) {
  const spent = 3160;
  const perSession = (SESSION * cover) / 100;
  return (
    <div>
      <H2 sub="Figures as published on 1 September. Use by person is never shown.">Acme Demo Ltd</H2>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <Ring value={pot / (pot + spent)} size={120} stroke={12}>
            <span className="text-[22px] font-bold tabular-nums text-navy-700">${pot.toLocaleString("en-US")}</span>
            <span className="text-[12px] font-semibold text-navy-500">left</span>
          </Ring>
          <div>
            <p className="text-[15px] font-bold text-navy-700">About {Math.floor(pot / perSession)} sessions</p>
            <p className="mt-1 text-[13px] text-navy-500">At {cover}% of a $75 session</p>
            <Btn kind="money" onClick={onTopUp} className="mt-3 h-10 px-4 text-[14px]">
              Top up
            </Btn>
          </div>
        </Card>
        <Stat label="Sessions covered so far">
          <Count value={Math.round(spent / 45)} />
        </Stat>
        <Stat label="Spent from the pot" tone="dark" note="Since the benefit began in June">
          <Count value={spent} format={(n) => `$${Math.round(n).toLocaleString("en-US")}`} />
        </Stat>
      </div>
      <Heatmap />
    </div>
  );
}

function Heatmap() {
  const [hover, setHover] = useState<string | null>(null);
  const max = 17;
  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[16px] font-bold text-navy-700">Sessions by team</p>
        <p className="text-[13px] text-navy-500">Fewer than 5 is hidden, so no one can be picked out</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-[13px] sm:border-spacing-1.5">
          <thead>
            <tr>
              <th />
              {MONTHS.map((m) => (
                <th key={m} className="font-semibold text-navy-500">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAMS.map((team, row) => (
              <tr key={team}>
                <th className="pe-1 text-start text-[12px] font-semibold text-navy-600 sm:pe-2 sm:text-[13px]">{team}</th>
                {USE[row]!.map((n, col) => {
                  const key = `${row}-${col}`;
                  const hidden = n < 5;
                  return (
                    <td key={key} className="p-0">
                      <motion.div
                        onHoverStart={() => setHover(key)}
                        onHoverEnd={() => setHover(null)}
                        onTap={() => setHover(hover === key ? null : key)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: hover === key ? 1.06 : 1 }}
                        transition={{ ...spring, delay: (row * 4 + col) * 0.025 }}
                        className={cn(
                          "flex h-11 min-w-9 items-center justify-center rounded-xl font-bold tabular-nums sm:h-12",
                          hidden ? "bg-[repeating-linear-gradient(45deg,#eef2f6,#eef2f6_6px,#f7f9fb_6px,#f7f9fb_12px)] text-navy-400" : "text-navy-700",
                        )}
                        style={hidden ? undefined : { background: `rgba(46,196,182,${0.15 + (n / max) * 0.75})` }}
                      >
                        {hidden ? (hover === key ? "<5" : "·") : n}
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Cover({ cover, onSave }: { cover: number; onSave: (n: number) => void }) {
  const [draft, setDraft] = useState(cover);
  const [saved, setSaved] = useState(false);
  const company = (SESSION * draft) / 100;
  const person = SESSION - company;
  return (
    <div className="relative">
      <Toast show={saved}>
        <Check className="h-4 w-4 text-brand-300" aria-hidden /> Saved. It applies to sessions booked from now.
      </Toast>
      <H2 sub="People see the new price on the next session they book. Sessions already booked keep theirs.">How much you cover</H2>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-6">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold text-navy-600">The company pays</p>
            <p className="text-[40px] font-bold tabular-nums text-navy-700">{draft}%</p>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            aria-label="Share the company covers"
            className="mt-3 w-full accent-[var(--color-brand-500)]"
          />
          <div className="mt-6 flex h-14 overflow-hidden rounded-2xl ring-1 ring-navy-100">
            <motion.div layout transition={spring} className="flex items-center justify-center bg-navy-700 text-[14px] font-bold text-white" style={{ width: `${draft}%` }}>
              {draft >= 18 ? `$${company.toFixed(2)}` : null}
            </motion.div>
            <motion.div layout transition={spring} className="flex flex-1 items-center justify-center bg-brand-100 text-[14px] font-bold text-navy-700">
              {draft <= 82 ? `$${person.toFixed(2)}` : null}
            </motion.div>
          </div>
          <div className="mt-2 flex justify-between text-[13px] font-semibold text-navy-500">
            <span>Company</span>
            <span>Your person, before VAT</span>
          </div>
          <Btn
            disabled={draft === cover}
            onClick={() => {
              onSave(draft);
              setSaved(true);
              setTimeout(() => setSaved(false), 2400);
            }}
            className="mt-6 w-full"
          >
            Save {draft}%
          </Btn>
        </Card>
        <Card className="bg-navy-900 p-6 text-white ring-0">
          <p className="text-[13px] font-semibold text-white/65">A $75 session, seen by your person</p>
          <div className="mt-4 space-y-2 text-[15px]">
            <Row label="Session" value="$75.00" />
            <Row label="Acme covers" value={`-$${company.toFixed(2)}`} />
            <Row label="VAT 14% on their part" value={`$${(person * 0.14).toFixed(2)}`} />
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
            <span className="text-[15px] font-semibold">They pay</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={draft}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={spring}
                className="text-[32px] font-bold tabular-nums text-brand-300"
              >
                ${(person * 1.14).toFixed(2)}
              </motion.span>
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between">
      <span className="text-white/75">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </p>
  );
}

function People() {
  const [query, setQuery] = useState("");
  const [list, setList] = useState(PEOPLE);
  const [ending, setEnding] = useState<string | null>(null);
  const shown = list.filter((p) => p.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="relative min-h-[560px]">
      <H2 sub="Who holds the benefit. Whether or when anyone used it is theirs alone.">People</H2>
      <div className="max-w-sm">
        <SearchField value={query} onChange={setQuery} placeholder="Find a person" />
      </div>
      <ul className="mt-4 divide-y divide-navy-100 overflow-hidden rounded-3xl bg-white ring-1 ring-navy-100">
        <AnimatePresence initial={false}>
          {shown.map((person) => (
            <motion.li
              key={person}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: 40, height: 0 }}
              transition={spring}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <span className="flex-1 text-[15px] font-semibold text-navy-700">{person}</span>
              <Press
                onClick={() => setEnding(person)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-navy-500 ring-1 ring-navy-100 hover:text-navy-700"
              >
                <UserMinus className="h-4 w-4" aria-hidden /> End their benefit
              </Press>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="mt-3 text-[13px] text-navy-500">{list.length} people hold the benefit</p>
      <Sheet open={ending !== null} onClose={() => setEnding(null)}>
        <p className="text-[18px] font-bold text-navy-700">End {ending}&apos;s benefit?</p>
        <p className="mt-2 text-[15px] leading-relaxed text-navy-500">
          Sessions they already booked stay covered. After that they can keep seeing their therapist at the full price, and we tell them before it changes.
        </p>
        <div className="mt-5 flex gap-3">
          <Btn kind="ghost" className="flex-1" onClick={() => setEnding(null)}>
            Keep it
          </Btn>
          <Btn
            kind="dark"
            className="flex-1"
            onClick={() => {
              setList((l) => l.filter((p) => p !== ending));
              setEnding(null);
            }}
          >
            End it
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

function TopUp({ pot, cover, onPaid }: { pot: number; cover: number; onPaid: (n: number) => void }) {
  const [amount, setAmount] = useState<"250" | "1000" | "2500" | "5000">("1000");
  const [paid, setPaid] = useState(false);
  const n = Number(amount);
  const perSession = (SESSION * cover) / 100;
  return (
    <div className="relative">
      <Toast show={paid}>
        <Check className="h-4 w-4 text-brand-300" aria-hidden /> ${n.toLocaleString("en-US")} added to the pot.
      </Toast>
      <H2 sub="The estimate uses a $75 session. Longer sessions or higher prices mean fewer.">Top up the pot</H2>
      <Card className="max-w-xl p-6">
        <Chips
          value={amount}
          onChange={setAmount}
          options={[
            { id: "250", label: "$250" },
            { id: "1000", label: "$1,000" },
            { id: "2500", label: "$2,500" },
            { id: "5000", label: "$5,000" },
          ]}
        />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-navy-50 p-4">
            <p className="text-[13px] font-semibold text-navy-500">Covers about</p>
            <AnimatePresence mode="popLayout">
              <motion.p key={amount} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={spring} className="text-[28px] font-bold tabular-nums text-navy-700">
                {Math.floor(n / perSession)} sessions
              </motion.p>
            </AnimatePresence>
            <p className="text-[12px] text-navy-500">${perSession.toFixed(2)} each at {cover}%</p>
          </div>
          <div className="rounded-2xl bg-navy-50 p-4">
            <p className="text-[13px] font-semibold text-navy-500">Pot after</p>
            <p className="text-[28px] font-bold tabular-nums text-navy-700">${(pot + n).toLocaleString("en-US")}</p>
            <p className="text-[12px] text-navy-500">Unused money is refundable</p>
          </div>
        </div>
        <Btn
          kind="money"
          disabled={paid}
          onClick={() => {
            onPaid(n);
            setPaid(true);
            setTimeout(() => setPaid(false), 2400);
          }}
          className="mt-6 w-full"
        >
          Pay ${n.toLocaleString("en-US")} by bank transfer
        </Btn>
      </Card>
    </div>
  );
}
