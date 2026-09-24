"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { addGate, dropGate } from "@/app/(sponsor)/sponsor/settings/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import Link from "next/link";

import type { IdentifierKind } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";

import { ConfirmAct } from "./confirm-act";
import type { MessageKey } from "@/lib/i18n/messages";
import { matchesGate } from "@/lib/sponsor/gate";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * What the sponsor asks for, and whether they are listed. PLAN.md 53.7, 53.8,
 * 53.19, 53.19c, C236, C238, C246, C248.
 *
 * ## 🔴 C238 — TWO CHOICES, AND A NATIONAL IDENTIFIER IS NOT ONE OF THEM
 *
 * The radio group has two options because `IDENTIFIER_KINDS` has two members and
 * the database has a CHECK on them. There is no "other", no free text field and no
 * way to type a third. *Never a national identifier, never health information,
 * never free text* is not a policy anybody has to remember here: there is no
 * control that would express one.
 *
 * ## 🔴 C246 / 53.19 — THE SPONSOR IS TOLD WHICH GATE IS WEAK, IN PLAIN WORDS
 *
 * An email on their domain is verified by a code, so it is proof. A staff number is
 * checked against a shape, so it is guessable, and the sentence saying so and
 * saying the risk is theirs sits above the choice rather than in a contract. A
 * sponsor who picks the weak gate should have read why it is weak before picking
 * it.
 *
 * ## 🔴 C248 — the shape, and the form says so where it collects it
 *
 * The hint is a DESCRIPTION. The database refuses one containing a run of four
 * digits or an `@`, because "for example, 20215544" printed on a poster is a
 * working template for anybody who walks past it. The error message says what to do
 * instead of naming a constraint.
 */

const KIND_KEYS: Record<string, MessageKey> = {
  domain_email: "sponsor.kind.domain_email",
  id_number: "sponsor.kind.id_number",
};

export type GateField = {
  id: string;
  kind: string;
  domain: string | null;
  shapeHint: string | null;
  /** Their own gate's pattern, so the test box runs what enrolment runs. */
  pattern: string | null;
  /**
   * 🔴 W2-S06: a domain gate whose domain is not proved refuses everybody
   * (`enrol` requires a proved domain), and nothing used to say so.
   */
  unproved: boolean;
};

export function GateSettings({
  fields,
  atCap,
}: {
  fields: GateField[];
  /** 53.7 — two at most, decided on the server and told to the user here. */
  atCap: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(addGate, {});
  const [kind, setKind] = useState("domain_email");
  const [preset, setPreset] = useState<string>("digits");
  const [trial, setTrial] = useState("");

  /*
   * 🔴 W2-S06: THE TEST BOX RUNS THE REAL GATE, the same `matchesGate`
   * enrolment runs, over the fields already saved. An unproved domain admits
   * nobody at enrolment, so it admits nobody here either.
   */
  const admitted = fields.some(
    (field) =>
      !field.unproved &&
      matchesGate(
        {
          kind: field.kind as IdentifierKind,
          domain: field.domain,
          pattern: field.pattern,
        },
        trial,
      ),
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("sponsor.identifierTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("sponsor.identifierBody")}
        </p>

        {/* 🔴 C246 — above the choice, not after it. */}
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          {t("sponsor.preferProof")}
        </p>

        {fields.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {fields.map((field) => (
              <li
                key={field.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"
              >
                <span className="text-sm text-slate-800">
                  {t(KIND_KEYS[field.kind] ?? "sponsor.kind.id_number")}
                </span>
                {field.domain ? (
                  <span className="font-mono text-xs text-slate-500">{field.domain}</span>
                ) : null}
                {field.unproved ? (
                  <Link
                    href="/sponsor/domains"
                    className="w-full rounded-xl bg-amber-50 p-2 text-xs leading-relaxed text-amber-900 underline"
                  >
                    {t("sponsor.gateUnproved")}
                  </Link>
                ) : null}
                {/* W2-S04: the last field gone leaves a code nobody can pass, so ask. */}
                <ConfirmAct
                  className="ms-auto"
                  label={t("sponsor.removeField")}
                  body={t("sponsor.removeFieldBody")}
                  done={t("sponsor.fieldRemoved")}
                  act={() => dropGate(field.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {fields.length > 0 ? (
          <div className="mt-4">
            <Field label={t("sponsor.gateTry")} htmlFor="gate-try">
              <Input
                id="gate-try"
                autoCapitalize="none"
                value={trial}
                onChange={(event) => setTrial(event.target.value)}
              />
            </Field>
            {trial.trim() ? (
              <p
                role="status"
                className={
                  admitted ? "mt-1 text-xs text-brand-700" : "mt-1 text-xs text-slate-600"
                }
              >
                {admitted ? t("sponsor.gateTryYes") : t("sponsor.gateTryNo")}
              </p>
            ) : null}
          </div>
        ) : null}

        {atCap ? (
          <p className="mt-4 text-xs text-slate-500">{t("sponsor.fieldCap")}</p>
        ) : (
          <form action={formAction} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <fieldset>
              <div className="flex flex-col gap-2">
                {Object.entries(KIND_KEYS).map(([value, key]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="kind"
                      value={value}
                      checked={kind === value}
                      onChange={() => setKind(value)}
                    />
                    {t(key)}
                  </label>
                ))}
              </div>
            </fieldset>

            {kind === "domain_email" ? (
              <Field label={t("sponsor.domain")} htmlFor="gate-domain">
                <Input id="gate-domain" name="domain" autoCapitalize="none" placeholder="" />
              </Field>
            ) : (
              /*
                🔴 W2-S06: a shape and a length, never a typed pattern. This box
                shared its label with the hint below and was compiled as a
                regular expression, so a description matched nobody.
              */
              <>
                <Field label={t("sponsor.presetLabel")} htmlFor="gate-preset">
                  <select
                    id="gate-preset"
                    name="preset"
                    value={preset}
                    onChange={(event) => setPreset(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="digits">{t("sponsor.presetDigits")}</option>
                    <option value="prefixed">{t("sponsor.presetPrefixed")}</option>
                  </select>
                </Field>
                {preset === "prefixed" ? (
                  <Field label={t("sponsor.presetPrefix")} htmlFor="gate-prefix">
                    <Input id="gate-prefix" name="prefix" autoCapitalize="characters" />
                  </Field>
                ) : null}
                <Field label={t("sponsor.presetLength")} htmlFor="gate-length">
                  <Input id="gate-length" name="length" type="number" min={1} max={20} />
                </Field>
              </>
            )}

            <Field label={t("sponsor.shapeHint")} htmlFor="gate-hint">
              <Input id="gate-hint" name="shapeHint" />
            </Field>
            {/* 🔴 C248 — said on the form that collects it. */}
            <p className="text-xs leading-relaxed text-slate-500">{t("sponsor.shapeHintBody")}</p>

            {state.error ? (
              <p role="alert" className="text-xs text-red-600">
                {state.error}
              </p>
            ) : null}

            <Submit label={t("sponsor.addField")} />
          </form>
        )}
      </Card>

      {/*
        FIX-PLAN D5: the public listing switch is gone. No public surface ever
        read `listed_publicly`, so "turning it on tells anybody searching" was a
        sentence about a search that does not exist. The column stays unlisted.
      */}
    </div>
  );
}
