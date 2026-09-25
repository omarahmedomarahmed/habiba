"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Field, Input, Textarea } from "@/components/ui";
import type { ContentBlock } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";

type Block = Extract<ContentBlock, { type: "competitors" }>;
type Rival = Block["items"][number];
type Row = Rival["rows"][number];

/**
 * 🔴 76.76 — THE COMPARISON TABLE IS EDITED HERE, AND IT HAD TO BE ITS OWN EDITOR.
 *
 * ## Why not the generic items editor
 *
 * `PageEditor` renders a title, a body and an icon picker for every item of
 * every block, which fits `features`, `showcase` and `faq` and fits nothing
 * about a competitor. A rival has a name, a logo, a line about who they are, a
 * published price, and a list of three-part rows. Pointed at one, the generic
 * editor would have drawn an empty "body" textarea bound to a field that does
 * not exist, and the first keystroke would have written a `body` key onto a
 * competitor. Not a crash: a silently malformed row, which is the kind of
 * corruption nobody notices until the page renders wrong.
 *
 * ## Why this is editable at all, and urgently
 *
 * A comparison table is the one thing on a marketing site that can get a
 * company a letter from a lawyer. When a rival reprices, or ships the feature
 * we said they lacked, or simply asks us to stop naming them, the correction
 * has to be possible in the hour rather than in the next deploy. That is the
 * whole argument for the block being content instead of code, and it is worth
 * nothing without a screen an operator can actually use.
 *
 * ## `concede` is a checkbox, and it is labelled as what it is
 *
 * Every rival should carry at least one row where the honest answer is that
 * they are better, and the renderer moves the tick to their column when the box
 * is ticked. An operator who does not know that will write a conceding sentence
 * and leave a green tick beside it, which is the defect this checkbox exists
 * because of.
 */
export function CompetitorEditor({
  block,
  onChange,
}: {
  block: Block;
  onChange: (next: Block) => void;
}) {
  const t = useT();
  const setItems = (items: Rival[]) => { onChange({ ...block, items }); };

  const patchRival = (i: number, patch: Partial<Rival>) => {
    setItems(block.items.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  };

  const patchRow = (i: number, r: number, patch: Partial<Row>) => {
    const rival = block.items[i];
    if (!rival) return;
    patchRival(i, { rows: rival.rows.map((row, k) => (k === r ? { ...row, ...patch } : row)) });
  };

  return (
    <div className="space-y-4">
      <Field label="Checked on" htmlFor="checked-on" hint="The day somebody last read every rival's site.">
        <Input
          id="checked-on"
          value={block.checkedOn ?? ""}
          placeholder="2026-09-19"
          onChange={(e) => { onChange({ ...block, checkedOn: e.target.value }); }}
        />
      </Field>

      {block.items.map((rival, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Rival {i + 1}
            </p>
            <button
              type="button"
              onClick={() => { setItems(block.items.filter((_, j) => j !== i)); }}
              className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove this rival
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name" htmlFor={`name-${String(i)}`}>
              <Input
                id={`name-${String(i)}`}
                value={rival.name}
                onChange={(e) => { patchRival(i, { name: e.target.value }); }}
              />
            </Field>
            {/* 🔴 AE61: a path on this site; a logo from another host is refused at the save. */}
            <Field label="Logo URL" htmlFor={`logo-${String(i)}`} hint={t("acontent.logoHint")}>
              <Input
                id={`logo-${String(i)}`}
                value={rival.logo ?? ""}
                onChange={(e) => { patchRival(i, { logo: e.target.value }); }}
              />
            </Field>
          </div>

          <Field label="Who they are" htmlFor={`who-${String(i)}`} hint="In their terms, one line.">
            <Textarea
              id={`who-${String(i)}`}
              rows={2}
              value={rival.who ?? ""}
              onChange={(e) => { patchRival(i, { who: e.target.value }); }}
            />
          </Field>

          <Field
            label="Their published price"
            htmlFor={`price-${String(i)}`}
            hint="Exactly as they publish it, with its unit. Never a figure worked out."
          >
            <Input
              id={`price-${String(i)}`}
              value={rival.price ?? ""}
              onChange={(e) => { patchRival(i, { price: e.target.value }); }}
            />
          </Field>

          <div className="space-y-2.5">
            {rival.rows.map((row, r) => (
              <div key={r} className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    aria-label={`Row ${r + 1} claim`}
                    placeholder="What this row is about"
                    value={row.claim}
                    onChange={(e) => { patchRow(i, r, { claim: e.target.value }); }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove row ${r + 1}`}
                    onClick={() => { patchRival(i, { rows: rival.rows.filter((_, k) => k !== r) }); }}
                    className="tap-target shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-slate-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <Textarea
                  aria-label={`Row ${r + 1}, what we do`}
                  rows={2}
                  placeholder="What we do"
                  value={row.ours}
                  onChange={(e) => { patchRow(i, r, { ours: e.target.value }); }}
                />
                <Textarea
                  aria-label={`Row ${r + 1}, what they do`}
                  rows={2}
                  placeholder="What they publish. Checkable, never an opinion."
                  value={row.theirs}
                  onChange={(e) => { patchRow(i, r, { theirs: e.target.value }); }}
                />
                <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <input
                    type="checkbox"
                    checked={row.concede ?? false}
                    onChange={(e) => { patchRow(i, r, { concede: e.target.checked }); }}
                    className="mt-0.5 h-4 w-4 accent-brand-700"
                  />
                  <span>
                    <b className="text-slate-900">They win this row.</b> Moves the tick to their
                    column. Every rival needs one, or nobody believes the other five.
                  </span>
                </label>
              </div>
            ))}

            <Button
              variant="secondary"
              onClick={() => {
                patchRival(i, { rows: [...rival.rows, { claim: "", ours: "", theirs: "" }] });
              }}
            >
              <Plus className="me-1.5 inline h-3.5 w-3.5" aria-hidden />
              Add a row
            </Button>
          </div>
        </div>
      ))}

      <Button
        variant="secondary"
        full
        onClick={() => {
          setItems([...block.items, { name: "", rows: [{ claim: "", ours: "", theirs: "" }] }]);
        }}
      >
        <Plus className="me-1.5 inline h-3.5 w-3.5" aria-hidden />
        Add a competitor
      </Button>
    </div>
  );
}
