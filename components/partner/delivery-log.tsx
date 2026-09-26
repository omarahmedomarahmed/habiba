"use client";

import { useId, useState } from "react";
import { Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { redeliverOne } from "@/app/(partner)/partner/webhooks/actions";
import { Badge, Card, EmptyState } from "@/components/clinician/kit";
import { TryButton } from "@/components/partner/try-button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The delivery log, as rows a developer scans, with the mockup's filter on top.
 *
 * Every field the page rendered before is on each row: the event, the state, the next
 * try, the last status, the attempts, the opaque subject id, the endpoint, the time and
 * the error, and Redeliver for an admin. The filter is a view over the same list; it
 * never fetches and never hides a delivery from the "All" view, which is the default.
 */

export type DeliveryRow = {
  id: string;
  event: string;
  state: "delivered" | "failed" | "pending";
  nextTry: string | null;
  lastStatus: number | null;
  attempts: number;
  subjectId: string | null;
  url: string;
  at: string;
  lastError: string | null;
  canRedeliver: boolean;
};

type Filter = "all" | "delivered" | "failed" | "pending";

export function DeliveryLog({ deliveries }: { deliveries: DeliveryRow[] }) {
  const t = useT();
  const pill = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const count = (state: DeliveryRow["state"]) => deliveries.filter((d) => d.state === state).length;
  const shown = deliveries.filter((d) => filter === "all" || d.state === filter);

  if (deliveries.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Send className="h-6 w-6" aria-hidden />} title={t("dev.deliveriesEmpty")} />
      </Card>
    );
  }

  const options: Array<{ id: Filter; label: string; n?: number }> = [
    { id: "all", label: t("portal.all") },
    { id: "delivered", label: t("dev.delivered"), n: count("delivered") },
    { id: "failed", label: t("dev.failed"), n: count("failed") },
    { id: "pending", label: t("dev.pending"), n: count("pending") },
  ];

  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {options.map((option) => {
          const on = option.id === filter;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(option.id)}
              className={cn(
                "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                on ? "text-white" : "bg-white text-navy-600 ring-1 ring-navy-100",
              )}
            >
              {on ? (
                <motion.span
                  layoutId={pill}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
                  className="absolute inset-0 rounded-full bg-navy-600"
                />
              ) : null}
              <span className="relative">{option.label}</span>
              {option.n !== undefined ? (
                <span
                  className={cn(
                    "relative rounded-full px-1.5 text-[12px] font-bold tabular-nums",
                    on ? "bg-white/15 text-white" : option.id === "failed" && option.n > 0 ? "bg-amber-100 text-navy-700" : "bg-navy-50 text-navy-500",
                  )}
                >
                  {option.n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <motion.ul layout className="mt-4 flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((delivery) => (
            <motion.li
              key={delivery.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <Card className={cn("p-4", delivery.state === "failed" && "border-amber-300")}>
                <div className="flex items-start gap-3">
                  {/*
                   * 🔴 W2-X03: THREE STATES, AND "PENDING" NO LONGER MEANS "GAVE UP".
                   * A delivery that used every try says Failed, and one still being
                   * tried says when the next try is. The status code is the tile.
                   */}
                  <span
                    className={cn(
                      "w-14 shrink-0 rounded-lg py-1 text-center font-mono text-[13px] font-bold",
                      delivery.state === "delivered"
                        ? "bg-brand-100 text-brand-900"
                        : delivery.state === "failed"
                          ? "bg-amber-100 text-navy-700"
                          : "bg-navy-50 text-navy-600",
                    )}
                  >
                    {delivery.lastStatus ?? "-"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <code className="font-mono text-[14px] font-semibold text-navy-700">{delivery.event}</code>
                      <Badge tone={delivery.state === "delivered" ? "green" : delivery.state === "failed" ? "red" : "amber"}>
                        {delivery.state === "delivered" ? t("dev.delivered") : delivery.state === "failed" ? t("dev.failed") : t("dev.pending")}
                      </Badge>
                      <span className="text-[13px] text-navy-400">{t("dev.attempts", { count: String(delivery.attempts) })}</span>
                    </div>
                    {delivery.nextTry ? (
                      <p className="mt-1 text-[13px] font-semibold text-amber-800">{t("dev.nextTry", { time: delivery.nextTry })}</p>
                    ) : null}

                    {/* 🔴 The opaque id, exactly as the body carries it. Never a name. */}
                    <p className="mt-1.5 break-all font-mono text-[12px] text-navy-500">{delivery.subjectId ?? "-"}</p>
                    <p className="mt-0.5 break-all font-mono text-[12px] text-navy-400">{delivery.url}</p>
                    <p className="mt-0.5 font-mono text-[12px] text-navy-400">{delivery.at}</p>

                    {delivery.lastError ? (
                      <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 font-mono text-[12px] break-all text-red-700">{delivery.lastError}</p>
                    ) : null}

                    {/* 🔴 W2-X03: one try now, by hand. An admin act: it sends a signed request. */}
                    {delivery.canRedeliver ? <TryButton action={redeliverOne} id={delivery.id} labelKey="dev.redeliver" /> : null}
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
