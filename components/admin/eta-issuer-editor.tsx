"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveEgyptIssuer, type SettingsFormState } from "@/app/(admin)/admin/settings/actions";
import { Button, Field, Input } from "@/components/ui";

/**
 * 🔴 0147: who issues the Egyptian tax invoices. Every value is on our tax
 * card or our ETA profile; until they are here, each invoice waits.
 */
function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function EtaIssuerEditor({
  legalName,
  taxId,
  eta,
}: {
  legalName: string;
  taxId: string;
  eta: Partial<Record<"activityCode" | "branchId" | "governate" | "regionCity" | "street" | "buildingNumber" | "itemCode", string>>;
}) {
  const [state, action] = useActionState<SettingsFormState, FormData>(saveEgyptIssuer, {});
  const input = (name: keyof typeof eta, label: string) => (
    <Field label={label} htmlFor={`eta-${name}`}>
      <Input id={`eta-${name}`} name={name} defaultValue={eta[name] ?? ""} />
    </Field>
  );
  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Registered name" htmlFor="eta-legalName">
          <Input id="eta-legalName" name="legalName" defaultValue={legalName} />
        </Field>
        <Field label="Tax registration number" htmlFor="eta-taxId">
          <Input id="eta-taxId" name="taxId" defaultValue={taxId} inputMode="numeric" />
        </Field>
        {input("activityCode", "Activity code")}
        {input("itemCode", "EGS item code")}
        {input("branchId", "Branch")}
        {input("governate", "Governorate")}
        {input("regionCity", "City")}
        {input("street", "Street")}
        {input("buildingNumber", "Building")}
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-brand-700">{state.ok}</p> : null}
      <Save />
    </form>
  );
}
