"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { askToChangeNumber, type AccountState } from "@/app/(patient)/patient/account/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

const INITIAL: AccountState = {};

/**
 * Changing your number. PLAN.md 20.13–20.16.
 *
 * The screen says what will happen, in order, before asking for anything: a
 * person checks, and then a code goes to the **new** number. Somebody whose
 * phone has been stolen needs to know this takes a day, and somebody trying to
 * take an account needs to know it will not work.
 */
function Ask() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? "Sending…" : "Ask to change it"}
    </Button>
  );
}

export function ChangeNumber({
  current,
  countries,
  lockedUntilLabel,
}: {
  current: string | null;
  countries: { code: string; name: string }[];
  /** Null when it can be changed today. 20.14's ninety days. */
  lockedUntilLabel: string | null;
}) {
  const [state, action] = useActionState(askToChangeNumber, INITIAL);

  if (state.ok) {
    return (
      <Card className="border-teal-200 bg-teal-50 p-4">
        <p className="text-sm font-semibold text-teal-900">We have your request</p>
        <p className="mt-1 text-sm leading-relaxed text-teal-900/90">
          Somebody will contact the new number to check it is you, then send it a code. Enter that
          code here and your account moves. Nothing changes until then.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Your number</p>
      <p className="mt-1 font-mono text-sm text-slate-700">{current ?? "—"}</p>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        This is how we know it is you, so changing it takes a person and a day. We call or message
        the new number first, then send it a code. Nobody here can move your account without that
        code.
      </p>

      {lockedUntilLabel ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Your number was confirmed recently, so it is locked until {lockedUntilLabel}. If you
          cannot wait, write to us and a person will look at it.
        </p>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <Field label="New number">
            <div className="flex gap-2">
              <select
                name="country"
                aria-label="Country"
                defaultValue=""
                className="h-12 w-32 rounded-xl border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">Country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <Input name="newPhone" type="tel" required className="flex-1" />
            </div>
          </Field>

          <Field label="Why are you changing it?" hint="A person reads this.">
            <Textarea name="reason" rows={3} required minLength={10} />
          </Field>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="consent" className="mt-1" required />
            You may call or message the new number to check it is me.
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-rose-600">
              {state.error}
            </p>
          ) : null}
          <Ask />
        </form>
      )}
    </Card>
  );
}
