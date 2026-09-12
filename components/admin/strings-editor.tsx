"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Bot, Check, Eye, RotateCcw, ShieldAlert } from "lucide-react";

import {
  approve,
  clearOne,
  machineTranslate,
  publishOne,
  saveLocale,
  saveOne,
  type StringsState,
} from "@/app/(admin)/admin/strings/actions";
import { Badge, Button, Card, Field, Input } from "@/components/ui";

const INITIAL: StringsState = {};

/**
 * The translation workspace. PLAN.md 21.3, 21.10–21.19.
 *
 * ## What the screen is trying to make obvious
 *
 * Four states per string, and they are not the same thing: **shipped** (the
 * dictionary, no override), **published** (somebody decided this wording),
 * **machine draft** (a model wrote it and nobody has read it), and — new in
 * 45.5 — **your own unpublished draft**. The two drafts are styled as
 * unfinished work rather than as values, because the entire risk of 21.17 is
 * somebody skimming a list of drafts and thinking the language is done.
 *
 * 🔴 45.5 — why a human save is now a draft too. Until 45.3 an override
 * reached four marketing files. It now reaches every client component, so the
 * text in these boxes is the patient app's buttons and the session room's
 * controls. A typo that used to be a wrong word on a landing page can now be a
 * blank control in a live session, so nothing here is visible to a reader
 * until somebody publishes it on purpose.
 *
 * Safety strings carry a mark and cannot be bulk-approved (21.7/21.18).
 */

export type StringRow = {
  key: string;
  english: string;
  shipped: string | null;
  override: string | null;
  status: string | null;
  source: string | null;
  model: string | null;
  safety: boolean;
};

export type LanguageState = {
  code: string;
  name: string;
  nativeName: string;
  direction: string;
  authoringEnabled: boolean;
  publicEnabled: boolean;
  percent: number;
  missing: number;
  /** Everything saved and not yet published, human and machine alike. */
  drafts: number;
  /** 45.5 — of those, the ones a model wrote and nobody has read. */
  machineDrafts: number;
};

function Go({ label, quiet }: { label: string; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={quiet ? "secondary" : undefined}
      disabled={pending}
      className="h-8 px-2.5 text-xs"
    >
      {pending ? "…" : label}
    </Button>
  );
}

function Result({ state }: { state: StringsState }) {
  if (state.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-teal-700">{state.ok}</p>;
  return null;
}

export function LanguagePanel({ language }: { language: LanguageState }) {
  const [saveState, saveAction] = useActionState(saveLocale, INITIAL);
  const [aiState, aiAction] = useActionState(machineTranslate, INITIAL);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {language.name} <span className="text-slate-400">{language.nativeName}</span>
        </p>
        <Badge>{language.code}</Badge>
        <Badge>{language.direction.toUpperCase()}</Badge>
        {language.publicEnabled ? <Badge tone="teal">offered to readers</Badge> : null}
        {!language.publicEnabled && language.authoringEnabled ? (
          <Badge tone="amber">being written</Badge>
        ) : null}
      </div>

      {/* 🔴 21.11 — the checklist, with drafts counted as missing. */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-600">{language.percent}% ready</span>
          <span className="text-xs text-slate-500">
            {language.missing} missing
            {language.drafts > 0
              ? ` · ${language.drafts} unpublished${
                  language.machineDrafts > 0 ? `, ${language.machineDrafts} of them machine drafts` : ""
                }`
              : ""}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={language.percent === 100 ? "h-full bg-teal-500" : "h-full bg-amber-400"}
            style={{ width: `${language.percent}%` }}
          />
        </div>
      </div>

      <form action={saveAction} className="mt-3 space-y-2">
        <input type="hidden" name="code" value={language.code} />
        <input type="hidden" name="name" value={language.name} />
        <input type="hidden" name="nativeName" value={language.nativeName} />
        <input type="hidden" name="direction" value={language.direction} />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="authoring" defaultChecked={language.authoringEnabled} />
          Can be written in
        </label>

        {/*
          🔴 21.13 — the bigger switch, and it is deliberately the second one.
          Translating a language does not show it to anybody.
        */}
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="public"
            defaultChecked={language.publicEnabled}
            className="mt-1"
          />
          <span>
            Offered to readers
            <span className="block text-xs text-slate-500">
              Refused below 100%. Once live, a new string never takes it down again, it falls
              back and raises an alarm (21.12).
            </span>
          </span>
        </label>

        <Result state={saveState} />
        <Go label="Save language" quiet />
      </form>

      {language.missing > 0 ? (
        <form action={aiAction} className="mt-3 border-t border-slate-100 pt-3">
          <input type="hidden" name="locale" value={language.code} />
          <p className="mb-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
            <Bot className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Machine-translate what is missing. Everything it writes is a draft, attributed to the
            model, and counts as missing until a person approves it.
          </p>
          <Result state={aiState} />
          <Go label={`Draft ${language.missing} strings`} quiet />
        </form>
      ) : null}
    </Card>
  );
}

export function StringsTable({ locale, rows }: { locale: string; rows: StringRow[] }) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "drafts" | "missing" | "safety">("all");

  const filtered = rows.filter((row) => {
    if (query && !`${row.key} ${row.english} ${row.override ?? ""}`.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (only === "drafts") return row.status === "draft";
    if (only === "missing") return !row.override && !row.shipped;
    if (only === "safety") return row.safety;
    return true;
  });

  const draftKeys = filtered.filter((r) => r.status === "draft" && !r.safety).map((r) => r.key);

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a key or a phrase"
            className="h-9 flex-1 text-sm"
          />
          {(["all", "drafts", "missing", "safety"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setOnly(mode)}
              aria-pressed={only === mode}
              className={
                only === mode
                  ? "rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
                  : "rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
              }
            >
              {mode}
            </button>
          ))}
        </div>

        {draftKeys.length > 0 ? (
          <BulkApprove locale={locale} keys={draftKeys} />
        ) : null}
      </Card>

      <ul className="space-y-2">
        {filtered.slice(0, 300).map((row) => (
          <Row key={row.key} locale={locale} row={row} />
        ))}
      </ul>

      {filtered.length > 300 ? (
        <p className="text-xs text-slate-500">
          Showing the first 300 of {filtered.length}. Narrow the search.
        </p>
      ) : null}
    </div>
  );
}

function BulkApprove({ locale, keys }: { locale: string; keys: string[] }) {
  const [state, action] = useActionState(approve, INITIAL);
  return (
    <form action={action} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="keys" value={keys.join(",")} />
      <Go label={`Approve ${keys.length} drafts`} />
      <span className="text-xs text-slate-500">
        Crisis, consent and recording strings are never in this batch, those are approved one at a
        time.
      </span>
      <Result state={state} />
    </form>
  );
}

function Row({ locale, row }: { locale: string; row: StringRow }) {
  const [saveState, saveAction] = useActionState(saveOne, INITIAL);
  const [clearState, clearAction] = useActionState(clearOne, INITIAL);
  const [publishState, publishAction] = useActionState(publishOne, INITIAL);

  /*
   * 45.5 — a machine draft and a person's unpublished draft are both drafts
   * and are not the same problem. One needs reading before it is trusted; the
   * other was written by the person looking at the screen and needs only the
   * second click. Telling them apart is what stops "approve all" thinking.
   */
  const draft = row.status === "draft";
  const mine = draft && row.source === "human";

  return (
    <li>
      <Card className={row.status === "draft" ? "border-amber-200 bg-amber-50/40 p-3" : "p-3"}>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs text-slate-500">{row.key}</code>
          {row.safety ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              safety string, rewordable, never removable
            </span>
          ) : null}
          {draft && !mine ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              machine draft {row.model ? `· ${row.model}` : ""}. Nobody has read this
            </span>
          ) : null}
          {mine ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
              <Eye className="h-3 w-3" aria-hidden />
              saved, not published. No reader sees this yet
            </span>
          ) : null}
          {row.status === "published" && row.source === "human" ? (
            <span className="inline-flex items-center gap-1 text-xs text-teal-700">
              <Check className="h-3 w-3" aria-hidden />
              published
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-slate-500">{row.english}</p>

        <form action={saveAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="key" value={row.key} />
          <input type="hidden" name="locale" value={locale} />
          <Field label="" htmlFor={`v-${row.key}`}>
            <Input
              id={`v-${row.key}`}
              name="value"
              defaultValue={row.override ?? row.shipped ?? ""}
              placeholder={row.shipped ?? row.english}
              className="h-9 w-full min-w-64 text-sm"
            />
          </Field>
          <Go label="Save draft" />
        </form>

        {/*
          45.5 — the second, deliberate act. One row, one named person, no bulk
          equivalent: `approveDrafts` handles machine batches and refuses
          safety strings, and a "publish everything" button here would reopen
          exactly that hole.
        */}
        {draft ? (
          <form action={publishAction} className="mt-2">
            <input type="hidden" name="key" value={row.key} />
            <input type="hidden" name="locale" value={locale} />
            <Go label={row.safety ? "Publish this safety string" : "Publish"} />
            {row.safety ? (
              <span className="ms-2 text-xs text-rose-700">
                Read it once more. This is crisis, consent or recording wording.
              </span>
            ) : null}
          </form>
        ) : null}

        {row.override ? (
          <form action={clearAction} className="mt-1">
            <input type="hidden" name="key" value={row.key} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Clear the override and restore the shipped wording
            </button>
          </form>
        ) : null}

        <Result state={saveState} />
        <Result state={publishState} />
        <Result state={clearState} />
      </Card>
    </li>
  );
}
