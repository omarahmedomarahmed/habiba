"use client";

import { useActionState } from "react";

import { resumeCheckins, saveCheckins, type CheckinsState } from "@/app/(admin)/admin/checkins/actions";
import { ConfirmWithReason } from "@/components/admin/confirm-with-reason";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: CheckinsState = {};

/** 🔴 W2-A08: the numbers the page says are the operator's, and the way back from a halt. */
export function CheckinsEditor(props: {
  enabled: boolean;
  everyHours: number;
  quietFromHour: number;
  quietToHour: number;
  haltPercent: number;
  halted: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState(saveCheckins, INITIAL);

  return (
    <Card className="space-y-3 p-5">
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" name="enabled" defaultChecked={props.enabled} />
          {t("acheckin.enabled")}
        </label>
        <Field label={t("acheckin.every")} htmlFor="everyHours">
          <Input id="everyHours" name="everyHours" type="number" min={6} defaultValue={props.everyHours} />
        </Field>
        <Field label={t("acheckin.halt")} htmlFor="haltPercent">
          <Input id="haltPercent" name="haltPercent" type="number" min={1} max={100} defaultValue={props.haltPercent} />
        </Field>
        <Field label={t("acheckin.quietFrom")} htmlFor="quietFromHour">
          <Input id="quietFromHour" name="quietFromHour" type="number" min={0} max={23} defaultValue={props.quietFromHour} />
        </Field>
        <Field label={t("acheckin.quietTo")} htmlFor="quietToHour">
          <Input id="quietToHour" name="quietToHour" type="number" min={0} max={23} defaultValue={props.quietToHour} />
        </Field>
        <div className="sm:col-span-2">
          {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-brand-700">{t("common.saved")}</p> : null}
          <Button type="submit" size="sm">
            {t("common.save")}
          </Button>
        </div>
      </form>

      {props.halted ? (
        <ConfirmWithReason label={t("acheckin.resume")} variant="primary" onConfirm={(reason) => resumeCheckins(reason)} />
      ) : null}
    </Card>
  );
}
