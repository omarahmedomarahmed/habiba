"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveCopilot,
  saveCountry,
  savePayouts,
  savePricing,
  saveSession,
  type SettingsFormState,
} from "@/app/(admin)/admin/settings/actions";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";

const INITIAL: SettingsFormState = {};

/**
 * Every figure in the product, on one screen. PLAN.md 20.1–20.5, 20.7.
 *
 * ## Why each group is its own form
 *
 * A single Save for the whole page means a typo in the copilot allowance
 * refuses the pricing edit somebody made at the same time, and the two have
 * nothing to do with each other. One form per settings group also matches how
 * they are stored — a jsonb row each — so a save writes exactly one row.
 *
 * ## The figures are shown in the units a person thinks in
 *
 * Dollars, not cents; per cent, not basis points. The conversion happens in
 * the action, once, and the stored unit never leaks onto the screen — an
 * admin typing 1500 into a field labelled "%" is how a platform starts taking
 * fifteen times its cut.
 */

function Save({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Result({ state }: { state: SettingsFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-rose-600">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-teal-700">{state.ok}</p>;
  return null;
}

export function PricingEditor({
  tiers,
  creditExpiryMonths,
}: {
  tiers: { key: string; name: string; rateCents: number; minimumSessions: number }[];
  creditExpiryMonths: number;
}) {
  const [state, action] = useActionState(savePricing, INITIAL);
  const find = (key: string) => tiers.find((t) => t.key === key);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">What a clinician pays us</p>
      <p className="mt-1 text-xs text-slate-500">
        These are the figures on the pricing page, on the homepage and on every invoice. There is
        no second copy.
      </p>

      <form action={action} className="mt-3 space-y-3">
        {["payg", "starter", "growth"].map((key) => {
          const tier = find(key);
          return (
            <div key={key} className="grid gap-2 sm:grid-cols-3">
              <Field label={`${key}, name`} htmlFor={`${key}Name`}>
                <Input id={`${key}Name`} name={`${key}Name`} defaultValue={tier?.name ?? key} />
              </Field>
              <Field label="Rate ($ per session)" htmlFor={`${key}Rate`}>
                <Input
                  id={`${key}Rate`}
                  name={`${key}Rate`}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={((tier?.rateCents ?? 0) / 100).toFixed(2)}
                />
              </Field>
              <Field label="Minimum sessions" htmlFor={`${key}Min`}>
                <Input
                  id={`${key}Min`}
                  name={`${key}Min`}
                  type="number"
                  min="0"
                  defaultValue={tier?.minimumSessions ?? 0}
                />
              </Field>
            </div>
          );
        })}

        <Field
          label="Credits last (months)"
          htmlFor="creditExpiryMonths"
          hint="Bought sessions are always spent before anything new is billed."
        >
          <Input
            id="creditExpiryMonths"
            name="creditExpiryMonths"
            type="number"
            min="1"
            defaultValue={creditExpiryMonths}
          />
        </Field>

        <Result state={state} />
        <Save />
      </form>
    </Card>
  );
}

export function SessionEditor({
  platformFeeBps,
  minPriceCents,
  maxPriceCents,
}: {
  platformFeeBps: number;
  minPriceCents: number;
  maxPriceCents: number;
}) {
  const [state, action] = useActionState(saveSession, INITIAL);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">What we take from a patient payment</p>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Our cut (%)" htmlFor="platformFeePercent">
          <Input
            id="platformFeePercent"
            name="platformFeePercent"
            type="number"
            step="0.01"
            defaultValue={(platformFeeBps / 100).toFixed(2)}
          />
        </Field>
        <Field label="Lowest price ($)" htmlFor="minPrice">
          <Input
            id="minPrice"
            name="minPrice"
            type="number"
            step="0.01"
            defaultValue={(minPriceCents / 100).toFixed(2)}
          />
        </Field>
        <Field label="Highest price ($)" htmlFor="maxPrice">
          <Input
            id="maxPrice"
            name="maxPrice"
            type="number"
            step="0.01"
            defaultValue={(maxPriceCents / 100).toFixed(2)}
          />
        </Field>
        <div className="sm:col-span-3 space-y-2">
          <Result state={state} />
          <Save />
        </div>
      </form>
    </Card>
  );
}

export function CopilotEditor({
  messagesPerPatientPerSession,
  unclaimedPatientCredits,
  generalMessagesPerMonth,
}: {
  messagesPerPatientPerSession: number;
  unclaimedPatientCredits: number;
  generalMessagesPerMonth: number;
}) {
  const [state, action] = useActionState(saveCopilot, INITIAL);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Copilot allowances</p>
      <p className="mt-1 text-xs text-slate-500">
        Per patient per session, rolling over on that patient. The pricing page reads the first
        figure, so changing it changes what the cards promise.
      </p>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Per patient, per session" htmlFor="perSession">
          <Input
            id="perSession"
            name="perSession"
            type="number"
            min="0"
            defaultValue={messagesPerPatientPerSession}
          />
        </Field>
        <Field label="Unclaimed patient" htmlFor="unclaimed">
          <Input
            id="unclaimed"
            name="unclaimed"
            type="number"
            min="0"
            defaultValue={unclaimedPatientCredits}
          />
        </Field>
        <Field label="General chat, per month" htmlFor="general">
          <Input
            id="general"
            name="general"
            type="number"
            min="0"
            defaultValue={generalMessagesPerMonth}
          />
        </Field>
        <div className="sm:col-span-3 space-y-2">
          <Result state={state} />
          <Save />
        </div>
      </form>
    </Card>
  );
}

export function PayoutsEditor({
  egyptCollectionProvider,
  egyptPayoutMethods,
  twoPersonThresholdCents,
  alertAfterHours,
  netFeeFromHeldEarnings,
  egpSpreadBps,
}: {
  egyptCollectionProvider: string;
  egyptPayoutMethods: string[];
  twoPersonThresholdCents: number;
  alertAfterHours: number;
  netFeeFromHeldEarnings: boolean;
  egpSpreadBps: number;
}) {
  const [state, action] = useActionState(savePayouts, INITIAL);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">The manual rail</p>
      <p className="mt-1 text-xs text-slate-500">
        §3c: adding an Egyptian collection provider is configuration, not code. The two-person
        threshold cannot be switched off, setting it to 0 makes every payout need two people.
      </p>

      <form action={action} className="mt-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Collection provider" htmlFor="provider">
            <Input id="provider" name="provider" defaultValue={egyptCollectionProvider} />
          </Field>
          <Field label="Payout methods" htmlFor="methods" hint="Comma separated.">
            <Input id="methods" name="methods" defaultValue={egyptPayoutMethods.join(", ")} />
          </Field>
          <Field label="Two people above ($)" htmlFor="threshold">
            <Input
              id="threshold"
              name="threshold"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(twoPersonThresholdCents / 100).toFixed(2)}
            />
          </Field>
          <Field label="Alert after (hours)" htmlFor="alertHours">
            <Input
              id="alertHours"
              name="alertHours"
              type="number"
              min="1"
              defaultValue={alertAfterHours}
            />
          </Field>
          <Field label="EGP conversion charge (%)" htmlFor="spreadPercent">
            <Input
              id="spreadPercent"
              name="spreadPercent"
              type="number"
              step="0.01"
              min="0"
              max="10"
              defaultValue={(egpSpreadBps / 100).toFixed(2)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="netting"
            defaultChecked={netFeeFromHeldEarnings}
            className="mt-1"
          />
          <span>
            Take the session fee out of held earnings when we hold enough.
            <span className="block text-xs text-slate-500">
              Off, the pricing page stops saying it, a sentence describing a mechanic we do not
              have is forbidden.
            </span>
          </span>
        </label>

        <Result state={state} />
        <Save />
      </form>
    </Card>
  );
}

export function CountryEditor({
  country,
}: {
  country: {
    code: string;
    name: string;
    vatBps: number;
    currency: string;
    paymentMethods: string[];
    collectionProvider: string | null;
    payoutMethods: string[];
    entity: string;
    regulators: string[];
    idLabelFront: string | null;
    idLabelBack: string | null;
    licenceLabel: string | null;
    sampleImageUrl: string | null;
    enabled: boolean;
    noRail: boolean;
  };
}) {
  const [state, action] = useActionState(saveCountry, INITIAL);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {country.name} <span className="font-mono text-xs text-slate-400">{country.code}</span>
        </p>
        <Badge>{country.entity === "eg" ? "Egyptian entity" : "US entity"}</Badge>
        {!country.enabled ? <Badge tone="amber">off</Badge> : null}
        {country.noRail ? (
          <Badge tone="amber">no rail, nobody here can pay or be paid</Badge>
        ) : null}
      </div>

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="code" value={country.code} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Name" htmlFor={`name-${country.code}`}>
            <Input id={`name-${country.code}`} name="name" defaultValue={country.name} />
          </Field>
          <Field label="VAT (%)" htmlFor={`vat-${country.code}`}>
            <Input
              id={`vat-${country.code}`}
              name="vatPercent"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(country.vatBps / 100).toFixed(2)}
            />
          </Field>
          <Field label="Currency" htmlFor={`cur-${country.code}`}>
            <Input id={`cur-${country.code}`} name="currency" defaultValue={country.currency} />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Patients pay via" htmlFor={`prov-${country.code}`}>
            <Input
              id={`prov-${country.code}`}
              name="collectionProvider"
              placeholder="stripe, paymob…"
              defaultValue={country.collectionProvider ?? ""}
            />
          </Field>
          <Field label="Clinicians paid by" htmlFor={`pm-${country.code}`} hint="Comma separated.">
            <Input
              id={`pm-${country.code}`}
              name="payoutMethods"
              defaultValue={country.payoutMethods.join(", ")}
            />
          </Field>
          <Field label="Entity" htmlFor={`ent-${country.code}`}>
            <select
              id={`ent-${country.code}`}
              name="entity"
              defaultValue={country.entity}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="us">US entity</option>
              <option value="eg">Egyptian entity</option>
            </select>
          </Field>
        </div>

        <input type="hidden" name="paymentMethods" value={country.paymentMethods.join(",")} />

        <Field
          label="Regulators"
          htmlFor={`reg-${country.code}`}
          hint="One per line. Offered beside a free-text field, a list that omits somebody's regulator reads as 'you are not welcome here', so it never constrains."
        >
          <Textarea
            id={`reg-${country.code}`}
            name="regulators"
            rows={3}
            defaultValue={country.regulators.join("\n")}
          />
        </Field>

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="ID, front" htmlFor={`idf-${country.code}`}>
            <Input
              id={`idf-${country.code}`}
              name="idLabelFront"
              defaultValue={country.idLabelFront ?? ""}
            />
          </Field>
          <Field label="ID, back" htmlFor={`idb-${country.code}`}>
            <Input
              id={`idb-${country.code}`}
              name="idLabelBack"
              defaultValue={country.idLabelBack ?? ""}
            />
          </Field>
          <Field label="Licence document" htmlFor={`lic-${country.code}`}>
            <Input
              id={`lic-${country.code}`}
              name="licenceLabel"
              defaultValue={country.licenceLabel ?? ""}
            />
          </Field>
        </div>

        <Field
          label="Sample document image"
          htmlFor={`sample-${country.code}`}
          hint="An https:// URL, shown beside the upload. Never a real person's document."
        >
          <Input
            id={`sample-${country.code}`}
            name="sampleImageUrl"
            defaultValue={country.sampleImageUrl ?? ""}
          />
        </Field>

        {/*
          🔴 50.1 — this is the MONEY switch, and the screen has to say so.
          C218 reported it as written and read by nobody. It has two consumers
          on the payment path and both refuse a charge with a sentence when it
          is false, so turning it off closes the till and nothing else. The
          visibility switch lives on Radar lists and is a separate decision.
        */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="enabled" defaultChecked={country.enabled} />
          Accepting paid sessions here
        </label>
        <p className="text-xs leading-relaxed text-slate-500">
          Money only. Off, we refuse card payments from this country and say so; free sessions still
          work and the radar is unchanged. To take clinicians here off the radar, close the country
          on Radar lists.
        </p>

        <Result state={state} />
        <Save label={`Save ${country.code}`} />
      </form>
    </Card>
  );
}
