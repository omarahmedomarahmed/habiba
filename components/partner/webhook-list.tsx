"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { addWebhook, disable, sendTest } from "@/app/(partner)/partner/webhooks/actions";
import { TryButton } from "@/components/partner/try-button";
import { Button, Card, Field, Input } from "@/components/ui";
import { WEBHOOK_EVENTS } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";

/**
 * The endpoints, and the form that adds one. PLAN.md 42.4, 55.10.
 *
 * ## 🔴 FOUR EVENTS, AND EACH ONE IS A FACT WITH NO CONTENT IN IT
 *
 * A session completed. A note was approved. A grant was revoked. A record was claimed. Each
 * says that something happened and names the thing it happened to; none of them says what
 * was in it. The last two are the ones a partner most needs and would never build for
 * themselves: `grant.revoked` and `record.claimed` are C277 arriving as an event, so a
 * partner's product can stop showing a clinician a record the patient took back.
 *
 * ## 🔴 THE SECRET IS SHOWN ONCE AND THE SIGNING SCHEME IS PRINTED WITH IT
 *
 * `t=timestamp,v1=hmac` over the timestamp, a dot and the body. Printed here rather than
 * only on the docs page, because the moment somebody needs it is the moment they are
 * holding the secret they cannot see again.
 */

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  disabled: boolean;
  /** W2-X03: its latest finished delivery failed, and nothing has reached it since. */
  failing: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function WebhookList({ hooks, canEdit }: { hooks: WebhookRow[]; canEdit: boolean }) {
  const t = useT();
  const [state, formAction] = useActionState(addWebhook, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {state.secret ? (
        <Card className="border-brand-200 bg-brand-50 p-5">
          <code className="block break-all rounded-xl bg-white p-3 font-mono text-xs text-slate-900 ring-1 ring-brand-200">
            {state.secret}
          </code>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{t("dev.secretOnce")}</p>
        </Card>
      ) : null}

      {hooks.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">{t("dev.webhooksEmpty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {hooks.map((hook) => (
            <li key={hook.id}>
              <Card className="p-4">
                <p className="break-all font-mono text-xs text-slate-900">{hook.url}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{hook.events.join(", ")}</p>
                {hook.disabled ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">{t("dev.revoked")}</p>
                ) : hook.failing ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">{t("dev.failing")}</p>
                ) : null}

                {/* 🔴 W2-X03: a signed `ping`, and what their endpoint answered. */}
                {canEdit && !hook.disabled ? (
                  <TryButton action={sendTest} id={hook.id} labelKey="dev.sendTest" />
                ) : null}

                {canEdit && !hook.disabled ? (
                  <form action={disable} className="mt-3">
                    <input type="hidden" name="webhookId" value={hook.id} />
                    <button
                      type="submit"
                      className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      {t("dev.disable")}
                    </button>
                  </form>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        open ? (
          <Card className="p-5">
            <form action={formAction} className="space-y-4">
              <Field label={t("dev.url")} htmlFor="hook-url">
                {/*
                 * 🔴 NO PLACEHOLDER, and it was `https://` until the i18n ratchet caught it.
                 *
                 * `verify:sprint45` counts English literals in markup per surface and only ever
                 * lets the number fall; a hard-coded placeholder pushed `shared` from 60 to 61.
                 * Ratcheting the number up to accommodate my own string would be the gate
                 * working and somebody overruling it.
                 *
                 * And nothing is lost: the label says HTTPS endpoint, `type="url"` constrains the
                 * field, `registerWebhook` refuses anything that is not https with a sentence,
                 * and `partner_webhooks_https` refuses it again in the database.
                 */}
                <Input id="hook-url" name="url" type="url" required />
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-700">{t("dev.events")}</legend>
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="events"
                      value={event}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <code className="font-mono text-xs">{event}</code>
                  </label>
                ))}
              </fieldset>

              {state.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {state.error}
                </p>
              ) : null}

              <Submit label={t("dev.add")} />
            </form>
          </Card>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t("dev.newWebhook")}
          </Button>
        )
      ) : null}
    </div>
  );
}
