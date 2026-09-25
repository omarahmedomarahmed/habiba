"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Trash2 } from "lucide-react";

import {
  addNoteTemplate,
  removeNoteTemplate,
  saveNoteFormat,
} from "@/app/(app)/settings/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/clinician/kit";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/client";

type Choice = { key: string; label: string; labelKey?: MessageKey | null };

/**
 * 🔴 W2-F01 / D7: the format a clinician's notes are drafted in, and their own.
 *
 * A template is a name and its sections, one a line as "Heading: what goes in
 * it". The guide after the colon is what the draft follows, so a clinician's
 * own format is written from the transcript exactly as SOAP is.
 */
export function NoteFormatSettings({
  current,
  formats,
  templates,
}: {
  current: string;
  formats: Choice[];
  templates: { id: string; label: string }[];
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [format, setFormat] = useState(current);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState("");
  const [sections, setSections] = useState("");
  const [error, setError] = useState<string | null>(null);
  const name = (f: Choice) => (f.labelKey ? t(f.labelKey) : f.label);

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy-700">
            <FileText className="h-4 w-4 text-navy-400" aria-hidden />
            {t("tnf.format")}
          </span>
          <select
            value={format}
            onChange={(event) => {
              setFormat(event.target.value);
              setSaved(false);
            }}
            className="mt-1.5 h-10 w-full rounded-xl border border-navy-100 bg-white px-3 text-sm"
          >
            {formats.map((f) => (
              <option key={f.key} value={f.key}>
                {name(f)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={pending || format === current}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await saveNoteFormat(format);
              if (result.error) setError(result.error);
              else setSaved(true);
            })
          }
        >
          {saved ? <Check className="h-4 w-4" aria-hidden /> : null}
          {saved ? t("common.saved") : t("tnote.saveChanges")}
        </Button>
      </div>

      <div className="space-y-2.5 border-t border-navy-100/70 pt-4">
        <p className="text-sm font-semibold text-navy-700">{t("tnf.own")}</p>
        {templates.length > 0 ? (
          <ul className="space-y-1.5">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-navy-700">{template.label}</span>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`${t("tnf.remove")} ${template.label}`}
                  onClick={() =>
                    start(async () => {
                      await removeNoteTemplate(template.id);
                    })
                  }
                  className="tap-target flex h-9 w-9 items-center justify-center rounded-xl text-navy-400 hover:bg-navy-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Field label={t("tnf.name")} htmlFor="template-label">
          <Input
            id="template-label"
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <Field label={t("tnf.sections")} htmlFor="template-sections">
          <Textarea
            id="template-sections"
            rows={4}
            value={sections}
            onChange={(event) => setSections(event.target.value)}
          />
        </Field>
        <Button
          variant="secondary"
          disabled={pending || !label.trim() || !sections.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await addNoteTemplate(label, sections);
              if (result.error) setError(result.error);
              else {
                setLabel("");
                setSections("");
              }
            })
          }
        >
          {t("tnf.add")}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
