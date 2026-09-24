"use client";

import { ConfirmWithReason } from "@/components/admin/confirm-with-reason";
import { useT } from "@/lib/i18n/client";
import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";

import { addTaxonomy, removeTaxonomy, setTaxonomyState } from "@/app/(admin)/admin/actions";
import { Button, Card, Input } from "@/components/ui";
import type { TaxonomyKind } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type TaxonomyRow = {
  code: string;
  label: string;
  flag: string;
  enabled: boolean;
  custom: boolean;
};

/**
 * One list, switchable.
 *
 * Optimistic on purpose: an admin curating ninety countries is going to click
 * twenty times in a row, and a round trip between each one turns a two-minute
 * job into a five-minute one. A failed write puts the switch back and says so.
 */
export function TaxonomyEditor({
  kind,
  rows,
  canAdd,
  emptyWarning,
}: {
  kind: TaxonomyKind;
  rows: TaxonomyRow[];
  canAdd: boolean;
  emptyWarning: string;
}) {
  const [, startTransition] = useTransition();
  const t = useT();
  const [state, setState] = useState(rows);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state;
    return state.filter(
      (row) =>
        row.label.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle),
    );
  }, [state, query]);

  const on = state.filter((row) => row.enabled).length;

  /*
   * W2-A05: switching a country off takes its clinicians off the radar, and
   * deleting a language takes it off every filter, so a chip press only asks.
   * The act happens with a reason, and the chip changes when the server says so.
   */
  const [asking, setAsking] = useState<{ row: TaxonomyRow; act: "toggle" | "remove" } | null>(null);

  const toggle = async (row: TaxonomyRow, reason: string) => {
    const next = !row.enabled;
    const result = await setTaxonomyState(kind, row.code, next, reason);
    if (!result.error) setState((s) => s.map((r) => (r.code === row.code ? { ...r, enabled: next } : r)));
    return result;
  };

  const add = () =>
    startTransition(async () => {
      setError(null);
      const label = draft.trim();
      if (!label) return;
      const result = await addTaxonomy(kind, label);
      if (result.error) {
        setError(result.error);
        return;
      }
      setState((s) =>
        [...s, { code: label, label, flag: "", enabled: true, custom: true }].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      );
      setDraft("");
    });

  const remove = async (row: TaxonomyRow, reason: string) => {
    const result = await removeTaxonomy(kind, row.code, reason);
    if (!result.error) setState((s) => s.filter((r) => r.code !== row.code));
    return result;
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 capitalize">
          {kind === "specialty" ? "Specialties" : `${kind}s`}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            on === 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600",
          )}
        >
          {on} of {state.length} on
        </span>
        <span className="flex-1" />
        <label className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <Input
            aria-label={`Search ${kind}s`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="h-9 w-40 ps-8 text-xs"
          />
        </label>
      </div>

      {on === 0 ? (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {emptyWarning}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {asking ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-700">
          <span className="font-semibold">{asking.row.label}</span>
          <ConfirmWithReason
            key={`${asking.act}-${asking.row.code}`}
            startOpen
            variant={asking.act === "remove" || asking.row.enabled ? "danger" : "primary"}
            label={t(asking.act === "remove" ? "aconfirm.delete" : asking.row.enabled ? "aconfirm.off" : "aconfirm.on")}
            onConfirm={(reason) =>
              asking.act === "remove" ? remove(asking.row, reason) : toggle(asking.row, reason)
            }
            onCancel={() => setAsking(null)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 p-3">
        {visible.map((row) => (
          <span key={row.code} className="inline-flex">
            <button
              type="button"
              onClick={() => setAsking({ row, act: "toggle" })}
              aria-pressed={row.enabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                row.enabled
                  ? "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
                  : "border-slate-200 bg-white text-slate-500 line-through hover:bg-slate-50",
                row.custom && "rounded-e-none",
              )}
            >
              {row.flag ? <span aria-hidden>{row.flag}</span> : null}
              {row.label}
            </button>
            {row.custom ? (
              <button
                type="button"
                onClick={() => setAsking({ row, act: "remove" })}
                aria-label={`Delete ${row.label}`}
                className={cn(
                  "-ms-px inline-flex items-center rounded-e-full border px-2 text-slate-300 hover:text-red-600",
                  row.enabled ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white",
                )}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
          </span>
        ))}
        {visible.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-500">Nothing matches “{query}”.</p>
        ) : null}
      </div>

      {canAdd ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2.5">
          <Input
            aria-label={`Add a ${kind}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder={kind === "language" ? "Pashto" : "Perinatal loss"}
            className="h-9 text-xs"
          />
          <Button size="sm" disabled={!draft.trim()} onClick={add}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
