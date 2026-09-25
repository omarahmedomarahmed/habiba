"use client";

import { useState } from "react";
import { Check, Minus } from "lucide-react";

import type { ContentBlock } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { safeLogoUrl } from "@/lib/content/url";
import { DarkBand, Glow, SiteTitle } from "@/components/public/site-ui";

type Block = Extract<ContentBlock, { type: "competitors" }>;

/**
 * 🔴 76.68 — US AGAINST ONE RIVAL AT A TIME.
 *
 * A five-column grid comparing everybody at once is unreadable on a phone and
 * is read by nobody on a desktop either. One tab per competitor, six rows
 * inside, is the shape a reader can actually hold: they came to compare
 * against the one product they already use.
 *
 * ## Both columns, always
 *
 * Each row states what we do AND what they do. A table with only our own
 * column is an advert wearing a table's clothes, and stating their position is
 * what lets a reader check us. It is also what forces whoever writes the row to
 * have looked at the rival's site rather than guessed.
 *
 * ## Rows where they win are not hidden
 *
 * Every competitor here has at least one row where the honest answer is that
 * they are better: a deeper billing workflow, a bigger network, a longer-lived
 * assistant. A comparison in which one side wins six times out of six is one
 * nobody believes, and the row that concedes is the row that makes the other
 * five worth reading.
 */
export function Comparison({ block }: { block: Block }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const current = block.items[active];

  if (!current) return null;

  return (
    <DarkBand className="px-5 py-16 sm:px-6 sm:py-24">
      <Glow className="-end-40 top-20 h-[480px] w-[480px] opacity-40" />
      <div className="mx-auto max-w-6xl">
        {block.heading ? <SiteTitle dark className="max-w-3xl">{block.heading}</SiteTitle> : null}

        {/* The tabs. Horizontally scrollable rather than wrapped, so a phone
            shows one row of names instead of three. */}
        <div
          role="tablist"
          aria-label={t("cmp.against")}
          className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1"
        >
          {block.items.map((item, i) => (
            <button
              key={item.name}
              role="tab"
              type="button"
              aria-selected={i === active}
              onClick={() => { setActive(i); }}
              className={cn(
                "tap-target inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors",
                i === active
                  ? "bg-brand-500 text-navy-700"
                  : "bg-white/[0.08] text-white/85 ring-1 ring-white/15 hover:text-white",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] bg-white/[0.04] ring-1 ring-white/10">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-6">
            <div className="flex min-w-0 items-center gap-3">
              {safeLogoUrl(current.logo) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={safeLogoUrl(current.logo)!} alt="" className="h-9 w-9 rounded-lg object-contain" />
              ) : (
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-[18px] font-bold text-white"
                >
                  {current.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[18px] font-bold text-white">{current.name}</p>
                {current.who ? (
                  <p className="mt-0.5 max-w-xl text-[14px] leading-relaxed text-white/70">
                    {current.who}
                  </p>
                ) : null}
              </div>
            </div>
            {current.price ? (
              <p className="text-[13px] text-white/70">
                <span className="font-semibold text-white/90">{t("cmp.theirPrice")}</span> ·{" "}
                {current.price}
              </p>
            ) : null}
          </div>

          {/* The header row is hidden on a phone, where each row stacks and
              carries its own labels instead. */}
          <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-6 border-b border-white/10 px-6 py-3 sm:grid">
            <p className="text-[12px] font-bold tracking-[0.14em] text-white/60 uppercase">&nbsp;</p>
            <p className="text-[12px] font-bold tracking-[0.14em] text-brand-300 uppercase">
              {t("cmp.us")}
            </p>
            <p className="text-[12px] font-bold tracking-[0.14em] text-white/60 uppercase">
              {current.name}
            </p>
          </div>

          <ul className="divide-y divide-white/5">
            {current.rows.map((row) => {
              /*
               * 🔴 THE MARK FOLLOWS THE SENTENCE, NOT THE COLUMN.
               *
               * On a conceded row the tick moves to their side and ours takes
               * the dash, because a green tick next to "our network is small"
               * is the page contradicting its own words in the one place a
               * sceptical reader is looking hardest.
               */
              const OursIcon = row.concede ? Minus : Check;
              const TheirsIcon = row.concede ? Check : Minus;
              return (
                <li
                  key={row.claim}
                  className={cn("grid gap-2 px-6 py-4 sm:grid-cols-[1fr_1.3fr_1.3fr] sm:gap-6", row.concede && "bg-white/[0.04]")}
                >
                  <p className="text-[14px] font-bold text-white/90">{row.claim}</p>

                  <div className="flex gap-2">
                    <OursIcon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        row.concede ? "text-white/60" : "text-brand-300",
                      )}
                      aria-hidden
                    />
                    <p
                      className={cn(
                        "text-[15px] leading-relaxed",
                        row.concede ? "text-white/70" : "text-white",
                      )}
                    >
                      <span className="font-semibold text-brand-300 sm:hidden">{t("cmp.us")}: </span>
                      {row.ours}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <TheirsIcon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        row.concede ? "text-brand-300" : "text-white/60",
                      )}
                      aria-hidden
                    />
                    <p
                      className={cn(
                        "text-[15px] leading-relaxed",
                        row.concede ? "text-white" : "text-white/70",
                      )}
                    >
                      <span className="font-semibold text-white/80 sm:hidden">
                        {current.name}:{" "}
                      </span>
                      {row.theirs}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/*
          The date comes off the block, so an operator correcting a price moves
          it in the same edit. No date, no claim: a footnote saying "checked"
          without saying when is the sentence a reader cannot use.
        */}
        {block.checkedOn ? (
          <p className="mt-4 text-[13px] leading-relaxed text-white/60">
            {t("cmp.checked", { date: block.checkedOn })}
          </p>
        ) : null}
      </div>
    </DarkBand>
  );
}

type VendorBlock = Extract<ContentBlock, { type: "vendors" }>;

const STATUS: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700",
  beta: "bg-amber-50 text-amber-700",
  planned: "bg-slate-100 text-slate-600",
};

/**
 * The systems we connect to, named.
 *
 * 🔴 Each carries its state, and `planned` is written as planned. A grid where
 * every logo looks equally live is the reason buyers stop believing
 * integration pages, and the one thing this page can offer that they cannot get
 * from a sales call is an answer they did not have to ask for.
 */
export function Vendors({ block }: { block: VendorBlock }) {
  return (
    <section className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {block.heading ? (
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{block.heading}</h2>
        ) : null}

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item) => (
            <li
              key={item.name}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              {safeLogoUrl(item.logo) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={safeLogoUrl(item.logo)!} alt="" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                >
                  {item.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.status ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                        STATUS[item.status] ?? STATUS.planned,
                      )}
                    >
                      {item.status}
                    </span>
                  ) : null}
                </div>
                {item.via ? (
                  <p className="mt-0.5 font-mono text-[11px] text-slate-600">{item.via}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
