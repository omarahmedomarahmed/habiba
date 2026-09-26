"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Plus, RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { createKey, revoke, rotate } from "@/app/(partner)/partner/actions";
import { Badge, Button, Card, EmptyState, Field, IconTile, Input } from "@/components/clinician/kit";
import { CheckChip, ConfirmBox, RowButton, SecretCard, SELECT } from "@/components/partner/parts";
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
 * rather than leaving a developer to discover it by reloading. Every row after that shows
 * the prefix alone.
 *
 * ## 🔴 NO EMPLOYMENT SENTENCE, because no partner key can hold that scope
 *
 * `employment:verify` moved to the sponsor's own portal in sprint 66, and with it the
 * rule that a burst suspends the key (C265). A partner's key is throttled with a 429 and
 * `Retry-After` instead (W2-X01), which `devs.rateNote` says on the docs page. The two
 * orphan strings that described the old form were deleted with this comment.
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
  /** Stopped working: revoked, or rolled and past its overlap. */
  revoked: boolean;
  /** W2-X04: a rolled key inside its overlap, and when it stops. */
  stopsAt: string | null;
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

export function KeyList({
  keys,
  canMint,
}: {
  keys: KeyRow[];
  canMint: boolean;
}) {
  const t = useT();
  const [state, formAction] = useActionState(createKey, {});
  const [rolled, rotateAction] = useActionState(rotate, {});
  const [open, setOpen] = useState(false);
  /* W2-X04: the one row showing a confirm step, and which one. */
  const [asking, setAsking] = useState<{ id: string; act: "revoke" | "rotate" } | null>(null);
  const revealed = rolled.raw ? rolled : state;
  /* A roll that worked closes its step; the new key is in the card above. */
  useEffect(() => {
    if (rolled.raw) setAsking(null);
  }, [rolled.raw]);

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {revealed.raw ? (
          <motion.div
            key={revealed.raw}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <SecretCard secret={revealed.raw} title={revealed.prefix} note={t("dev.keyOnce")} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {keys.length === 0 ? (
        <Card>
          <EmptyState icon={<KeyRound className="h-6 w-6" aria-hidden />} title={t("dev.keysEmpty")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {keys.map((key) => (
            <li key={key.id}>
              <Card className={key.revoked ? "p-4 opacity-75" : "p-4"}>
                <div className="flex items-start gap-3.5">
                  <IconTile tone={key.suspended ? "red" : key.revoked ? "navy" : key.environment === "live" ? "dark" : "navy"}>
                    <KeyRound className="h-5 w-5" aria-hidden />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[15px] font-bold text-navy-700">{key.label}</span>
                      <Badge tone={key.environment === "live" ? "brand" : "slate"}>
                        {key.environment === "live" ? t("dev.live") : t("dev.sandbox")}
                      </Badge>
                      {key.revoked ? <Badge tone="slate">{t("dev.revoked")}</Badge> : null}
                      {key.suspended ? <Badge tone="red">{t("dev.suspended")}</Badge> : null}
                    </div>
                    <p className="mt-0.5 font-mono text-[13px] text-navy-500">{key.prefix}</p>

                    {key.scopes.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {key.scopes.map((scope) => (
                          <li key={scope} className="rounded-lg bg-navy-50 px-2 py-0.5 font-mono text-[12px] text-navy-600">
                            {scope}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {/* 🔴 C265 — which organisation this key may ask about, named on the row. */}
                    {key.sponsorName ? <p className="mt-2 text-[13px] text-navy-500">{key.sponsorName}</p> : null}

                    <p className="mt-2 text-[13px] text-navy-400">
                      {key.lastUsed ? t("dev.lastUsed", { date: key.lastUsed }) : t("dev.neverUsed")}
                    </p>

                    {key.suspendedReason ? <p className="mt-1 text-[13px] text-red-700">{key.suspendedReason}</p> : null}

                    {key.stopsAt ? (
                      <p className="mt-1 text-[13px] font-semibold text-amber-800">{t("dev.stopsAt", { date: key.stopsAt })}</p>
                    ) : null}
                  </div>
                </div>

                {/*
                 * 🔴 W2-X04: REVOKE ASKS FIRST, AND ROLL SAYS HOW LONG THE OLD KEY LIVES.
                 * Revoke was one tap that stopped a production integration with no
                 * question asked. Both acts now open a step on this row with a Cancel.
                 */}
                {canMint && !key.revoked && asking?.id !== key.id ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-50 pt-3">
                    {key.stopsAt ? null : (
                      <RowButton onClick={() => setAsking({ id: key.id, act: "rotate" })}>
                        <RotateCw className="h-3.5 w-3.5" aria-hidden />
                        {t("dev.rotate")}
                      </RowButton>
                    )}
                    <RowButton danger onClick={() => setAsking({ id: key.id, act: "revoke" })}>
                      {t("dev.revoke")}
                    </RowButton>
                  </div>
                ) : null}

                {canMint && asking?.id === key.id && asking.act === "revoke" ? (
                  <ConfirmBox>
                    <form action={revoke} className="space-y-3">
                      <input type="hidden" name="keyId" value={key.id} />
                      <p className="text-sm text-navy-600">{t("dev.revokeConfirm")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="danger" size="sm">
                          {t("dev.revokeYes")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(null)}>
                          {t("dev.cancel")}
                        </Button>
                      </div>
                    </form>
                  </ConfirmBox>
                ) : null}

                {canMint && asking?.id === key.id && asking.act === "rotate" ? (
                  <ConfirmBox>
                    <form action={rotateAction} className="space-y-3">
                      <input type="hidden" name="keyId" value={key.id} />
                      <Field label={t("dev.overlap")} htmlFor={`overlap-${key.id}`}>
                        <select id={`overlap-${key.id}`} name="overlapHours" defaultValue={String(24 * 7)} className={SELECT}>
                          <option value={String(24 * 7)}>{t("dev.overlapWeek")}</option>
                          <option value="24">{t("dev.overlapDay")}</option>
                          <option value="0">{t("dev.overlapNow")}</option>
                        </select>
                      </Field>
                      {rolled.error ? (
                        <p role="alert" className="text-sm text-red-700">
                          {rolled.error}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Submit label={t("dev.rotate")} />
                        <Button type="button" variant="ghost" onClick={() => setAsking(null)}>
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

      {canMint ? (
        open ? (
          <Card className="p-5 sm:p-6">
            <form action={formAction} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("dev.keyLabel")} htmlFor="key-label">
                  <Input id="key-label" name="label" required />
                </Field>

                <Field label={t("dev.environment")} htmlFor="key-environment">
                  <select id="key-environment" name="environment" defaultValue="sandbox" className={SELECT}>
                    <option value="sandbox">{t("dev.sandbox")}</option>
                    <option value="live">{t("dev.live")}</option>
                  </select>
                </Field>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-navy-600">{t("dev.scopes")}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {API_SCOPES.map((scope) => (
                    <CheckChip key={scope} name="scopes" value={scope}>
                      {scope}
                    </CheckChip>
                  ))}
                </div>
              </fieldset>

              {/* 🔴 C265, on the form, beside the checkbox it is about. */}

              {state.error ? (
                <p role="alert" className="text-sm text-red-700">
                  {state.error}
                </p>
              ) : null}

              <Submit label={t("dev.create")} />
            </form>
          </Card>
        ) : (
          <div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("dev.newKey")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
