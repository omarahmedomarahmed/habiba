"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { confirmHandleCode, requestHandleCode } from "@/lib/patient-auth/handle";
import { Button, Field, Input } from "@/components/ui";
import { Card } from "@/components/patient/kit";
import { useT } from "@/lib/i18n/client";

/**
 * Proving the handle before the claim screen says anything. 25.14, C121.
 *
 * ## 🔴 Why this replaced a sentence that was false
 *
 * The first version of the gate simply returned no suggestions, so the page
 * fell through to its empty state: *"Nobody has written you down under this
 * number or address."* That protects the secret and tells a lie, to somebody
 * whose therapist may well have written them down that morning.
 *
 * What is actually true is narrow and says nothing about anybody: we have not
 * checked, because this number has not been proved to be theirs. So the page
 * says that, and offers the thing that fixes it.
 */

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

function SendCode({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? t("common.sending") : label}
    </Button>
  );
}

export function ProveHandle({ handle }: { handle: string }) {
  const t = useT();
  const router = useRouter();
  /*
   * 🔴 B53: a form with the server action, not a button with an onClick. A
   * press before the page hydrated did nothing at all (thirty seconds of
   * "Send me a code" not responding on a phone); a form posts either way.
   */
  const [asked, ask] = useActionState(requestHandleCode, {});
  const [entered, confirm] = useActionState(confirmHandleCode, {});

  if (entered.verified) {
    router.refresh();
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold text-navy-700">{t("pclaim.handleTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">
          {t("pclaim.handleBody", { handle })}
        </p>
      </div>

      {/* 🔴 Board 276: it went to their email, and the page says so. */}
      {asked.sent && !asked.channelDown && asked.channel === "email" ? (
        <p role="status" className="rounded-xl bg-navy-50 px-3.5 py-3 text-sm leading-relaxed text-navy-600">
          {t("pclaim.sentByEmail")}
        </p>
      ) : null}

      {asked.channelDown ? (
        <p
          role="status"
          className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800"
        >
          ⚠️ {t("pclaim.channelDown")}
        </p>
      ) : null}

      {asked.sent ? (
        <form action={confirm} className="space-y-4">
          <Field label={t("pfield.sixDigitCode")} htmlFor="handleCode">
            <Input
              id="handleCode"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </Field>

          {entered.error ? (
            <p role="alert" aria-live="assertive" className="text-sm text-red-600">
              {entered.error}
            </p>
          ) : null}

          <Submit label={t("pfield.checkTheCode")} />
        </form>
      ) : (
        <>
          {asked.error ? (
            <p role="alert" className="text-sm text-red-600">
              {asked.error}
            </p>
          ) : null}
          <form action={ask}>
            <SendCode label={t("pprove.sendMeACode")} />
          </form>
        </>
      )}
    </Card>
  );
}
