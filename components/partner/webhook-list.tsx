"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Webhook } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { addWebhook, disable, sendTest } from "@/app/(partner)/partner/webhooks/actions";
import { Badge, Button, Card, EmptyState, Field, IconTile, Input } from "@/components/clinician/kit";
import { CheckChip, ConfirmBox, RowButton, SecretCard } from "@/components/partner/parts";
import { TryButton } from "@/components/partner/try-button";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

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

/** Board 620: each event said in plain words, one key per event so none is missed. */
const EVENT_WORDS: Record<WebhookEvent, MessageKey> = {
  "session.completed": "dev.event.sessionCompleted",
  "note.approved": "dev.event.noteApproved",
  "grant.revoked": "dev.event.grantRevoked",
  "record.claimed": "dev.event.recordClaimed",
  "subject.unlinked": "dev.event.subjectUnlinked",
};

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  disabled: boolean;
  /** W2-X03: its latest finished delivery failed, and nothing has reached it since. */
  failing: boolean;
};

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

export function WebhookList({ hooks, canEdit }: { hooks: WebhookRow[]; canEdit: boolean }) {
  const t = useT();
  const [state, formAction] = useActionState(addWebhook, {});
  const [open, setOpen] = useState(false);
  /* The endpoint whose Disable is being asked about, as a key's revoke is. */
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {state.secret ? (
          <motion.div
            key={state.secret}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <SecretCard secret={state.secret} note={t("dev.secretOnce")} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {hooks.length === 0 ? (
        <Card>
          <EmptyState icon={<Webhook className="h-6 w-6" aria-hidden />} title={t("dev.webhooksEmpty")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {hooks.map((hook) => (
            <li key={hook.id}>
              <Card className={hook.disabled ? "p-4 opacity-75" : "p-4"}>
                <div className="flex items-start gap-3.5">
                  <IconTile tone={hook.failing && !hook.disabled ? "amber" : "navy"}>
                    <Webhook className="h-5 w-5" aria-hidden />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 break-all font-mono text-[14px] font-semibold text-navy-700">{hook.url}</p>
                      {hook.disabled ? (
                        <Badge tone="slate">{t("dev.revoked")}</Badge>
                      ) : hook.failing ? (
                        <Badge tone="red">{t("dev.failing")}</Badge>
                      ) : null}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {hook.events.map((event) => (
                        <li key={event} className="rounded-lg bg-navy-50 px-2 py-0.5 font-mono text-[12px] text-navy-600">
                          {event}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {canEdit && !hook.disabled ? (
                  <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-navy-50 pt-1">
                    {/* 🔴 W2-X03: a signed `ping`, and what their endpoint answered. */}
                    <TryButton action={sendTest} id={hook.id} labelKey="dev.sendTest" />

                    {/*
                      🔴 DISABLE ASKS FIRST, as revoking a key does (W2-X04). It was one
                      tap that stopped every delivery to a production endpoint.
                    */}
                    {asking !== hook.id ? (
                      <RowButton danger className="mt-2" onClick={() => setAsking(hook.id)}>
                        {t("dev.disable")}
                      </RowButton>
                    ) : null}
                  </div>
                ) : null}

                {canEdit && !hook.disabled && asking === hook.id ? (
                  <ConfirmBox>
                    <form action={disable} className="space-y-3">
                      <input type="hidden" name="webhookId" value={hook.id} />
                      <p className="text-sm text-navy-600">{t("dev.disableConfirm")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="danger" size="sm">
                          {t("dev.disableYes")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(null)}>
                          {t("dev.cancel")}
                        </Button>
                      </div>
                    </form>
                  </ConfirmBox>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        open ? (
          <Card className="p-5 sm:p-6">
            <form action={formAction} className="space-y-5">
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
                <Input id="hook-url" name="url" type="url" dir="ltr" className="font-mono text-sm" required />
              </Field>

              <fieldset>
                <legend className="text-sm font-semibold text-navy-600">{t("dev.events")}</legend>
                {/*
                 * 🔴 Board 620: what each event tells them, in plain words. This
                 * said "Not live yet ... which is not built", which is our build
                 * status and no business of a customer's. Every event is about a
                 * patient who has linked their record to the partner, so that is
                 * what the line says; Send test checks an endpoint meanwhile.
                 */}
                <p className="mt-1.5 text-[13px] leading-relaxed text-navy-500">{t("dev.eventsIntro")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <CheckChip key={event} name="events" value={event}>
                      {event}
                    </CheckChip>
                  ))}
                </div>
                <dl className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-navy-500">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event}>
                      <dt className="inline font-mono font-semibold text-navy-600" dir="ltr">
                        {event}
                      </dt>{" "}
                      <dd className="inline">{t(EVENT_WORDS[event])}</dd>
                    </div>
                  ))}
                </dl>
              </fieldset>

              {state.error ? (
                <p role="alert" className="text-sm text-red-700">
                  {state.error}
                </p>
              ) : null}

              <Submit label={t("dev.add")} />
            </form>
          </Card>
        ) : (
          <div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("dev.newWebhook")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
