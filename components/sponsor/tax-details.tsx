"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveTaxDetails, type TaxState } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, Card, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 0147: what the Egyptian Tax Authority needs to invoice this company as a
 * business. Until it is here, the invoice for a top-up waits and says so.
 */
function Save() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.saving") : t("common.save")}
    </Button>
  );
}

export function TaxDetails({
  legalName,
  rin,
  address,
}: {
  legalName: string;
  rin: string;
  address: { governate: string; regionCity: string; street: string; buildingNumber: string } | null;
}) {
  const t = useT();
  const [state, action] = useActionState<TaxState, FormData>(saveTaxDetails, {});
  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.tax.title")}</h2>
      <form action={action} className="mt-3 space-y-3">
        <Field label={t("sponsor.tax.legalName")} htmlFor="tax-name">
          <Input id="tax-name" name="legalName" defaultValue={legalName} required />
        </Field>
        <Field label={t("sponsor.tax.rin")} htmlFor="tax-rin">
          <Input id="tax-rin" name="rin" defaultValue={rin} inputMode="numeric" required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("sponsor.tax.governate")} htmlFor="tax-gov">
            <Input id="tax-gov" name="governate" defaultValue={address?.governate ?? ""} required />
          </Field>
          <Field label={t("sponsor.tax.city")} htmlFor="tax-city">
            <Input id="tax-city" name="city" defaultValue={address?.regionCity ?? ""} required />
          </Field>
          <Field label={t("sponsor.tax.street")} htmlFor="tax-street">
            <Input id="tax-street" name="street" defaultValue={address?.street ?? ""} required />
          </Field>
          <Field label={t("sponsor.tax.building")} htmlFor="tax-building">
            <Input id="tax-building" name="building" defaultValue={address?.buildingNumber ?? ""} required />
          </Field>
        </div>
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-brand-700">{t("common.saved")}</p> : null}
        <Save />
      </form>
    </Card>
  );
}
