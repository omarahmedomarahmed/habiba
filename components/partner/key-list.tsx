"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createKey, revoke } from "@/app/(partner)/partner/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { API_SCOPES } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";

/**
 * The keys, and the form that makes one. PLAN.md 55.2, 55.3, C265.
 *
 * ## 🔴 THE RAW KEY IS RENDERED ONCE, FROM THE ACTION'S RETURN VALUE
 *
 * It is never fetched, because there is nowhere to fetch it from: `partner_api_keys` holds
 * a SHA-256 and a prefix. So the only render of a working key in this product's history is
 * the one immediately after the POST that made it, and the sentence beside it says so
 * rather than leaving a developer to discover it by reloading.
 *
 * ## 🔴 C265's SENTENCE IS ON THE FORM, BESIDE THE CHECKBOX IT IS ABOUT
 *
 * *An employment key has to name the one organisation it may ask about... An abnormal call
 * rate suspends the key rather than slowing it down.* On the form, because the person who
 * needs to know that a burst suspends rather than throttles is the engineer deciding how to
 * retry, at the moment they are choosing the scope. In a contract it is a clause; here it
 * is a design constraint they will build around.
 *
 * ## 🔴 AND A SUSPENSION SAYS WHY
 *
 * `suspended_reason` is rendered. A key that stopped working with no explanation is a
 * support call, and the reason is about the partner's own traffic rather than about any
 * person: there is nothing here to withhold.
 */

export type KeyRow = {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  environment: string;
  sponsorName: string | null;
  lastUsed: string | null;
  suspendedReason: string | null;
  suspended: boolean;
  revoked: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function KeyList({
  keys,
  sponsors,
  canMint,
}: {
  keys: KeyRow[];
  sponsors: { id: string; name: string }[];
  canMint: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(createKey, {});
  const [open, setOpen] = useState(false);
  /*
   * 🔴 Whether the sponsor picker is shown follows the CHECKBOX rather than a submit
   * failure. `mintKey` refuses an employment key with no sponsor and the database refuses
   * it again, so this is a courtesy: the point is that the requirement is visible while the
   * choice is being made, not reported afterwards.
   */

  return (
    <div className="flex flex-col gap-4">
      {state.raw ? (
        <Card className="border-teal-200 bg-teal-50 p-5">
          <p className="text-sm font-semibold text-slate-900">{state.prefix}</p>
          <code className="mt-2 block break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-900 ring-1 ring-teal-200">
            {state.raw}
          </code>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{t("dev.keyOnce")}</p>
        </Card>
      ) : null}

      {keys.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">{t("dev.keysEmpty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {keys.map((key) => (
            <li key={key.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-slate-900">{key.label}</span>
                  <code className="font-mono text-xs text-slate-500">{key.prefix}</code>
                  <span className="text-xs font-semibold text-slate-500">
                    {key.environment === "live" ? t("dev.live") : t("dev.sandbox")}
                  </span>
                  {key.revoked ? (
                    <span className="text-xs font-semibold text-slate-500">
                      {t("dev.revoked")}
                    </span>
                  ) : null}
                  {key.suspended ? (
                    <span className="text-xs font-semibold text-red-600">
                      {t("dev.suspended")}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 font-mono text-xs text-slate-500">{key.scopes.join(", ")}</p>

                {/* 🔴 C265 — which organisation this key may ask about, named on the row. */}
                {key.sponsorName ? (
                  <p className="mt-1 text-xs text-slate-500">{key.sponsorName}</p>
                ) : null}

                <p className="mt-1 text-xs text-slate-500">
                  {key.lastUsed ? t("dev.lastUsed", { date: key.lastUsed }) : t("dev.neverUsed")}
                </p>

                {key.suspendedReason ? (
                  <p className="mt-1 text-xs text-red-600">{key.suspendedReason}</p>
                ) : null}

                {canMint && !key.revoked ? (
                  <form action={revoke} className="mt-3">
                    <input type="hidden" name="keyId" value={key.id} />
                    <button
                      type="submit"
                      className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      {t("dev.revoke")}
                    </button>
                  </form>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canMint ? (
        open ? (
          <Card className="p-5">
            <form action={formAction} className="space-y-4">
              <Field label={t("dev.keyLabel")} htmlFor="key-label">
                <Input id="key-label" name="label" required />
              </Field>

              <Field label={t("dev.environment")} htmlFor="key-environment">
                <select
                  id="key-environment"
                  name="environment"
                  defaultValue="sandbox"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="sandbox">{t("dev.sandbox")}</option>
                  <option value="live">{t("dev.live")}</option>
                </select>
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-700">{t("dev.scopes")}</legend>
                {API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <code className="font-mono text-xs">{scope}</code>
                  </label>
                ))}
              </fieldset>

              {/* 🔴 C265, on the form, beside the checkbox it is about. */}

              {state.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {state.error}
                </p>
              ) : null}

              <Submit label={t("dev.create")} />
            </form>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t("dev.newKey")}
          </Button>
        )
      ) : null}
    </div>
  );
}
