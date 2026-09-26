"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { closeMyAccount, type CloseState } from "@/app/(patient)/patient/account/actions";
import { Button, Field, Input } from "@/components/ui";
import { Card } from "@/components/patient/kit";
import { useT } from "@/lib/i18n/client";

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full variant="danger" disabled={pending}>
      {pending ? t("pclose.closing") : t("pclose.confirm")}
    </Button>
  );
}

/**
 * 🔴 K24: "Delete my account", with a word to type first.
 *
 * Folded shut until asked for, then two plain paragraphs: what goes, and what
 * stays with the clinicians. The second is the one people get wrong about
 * deleting an account in a clinical product, so it is said before the button,
 * never after. Typing the word is the confirm step: a tap on the wrong row of a
 * settings list must not be able to close somebody's account.
 */
export function CloseAccount() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, act] = useActionState<CloseState, FormData>(closeMyAccount, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-navy-100 bg-white px-4 py-3.5 text-start text-sm font-semibold text-red-700 active:bg-navy-50"
      >
        {t("pclose.title")}
      </button>
    );
  }

  return (
    <Card className="space-y-3 border-red-200 p-4">
      <p className="text-sm font-semibold text-navy-700">{t("pclose.title")}</p>
      <p className="text-xs leading-relaxed text-navy-400">{t("pclose.goes")}</p>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        {t("pclose.stays")}
      </p>
      <form action={act} className="space-y-3">
        <Field label={t("pclose.typeWord", { word: t("pclose.word") })} htmlFor="close-word">
          <Input id="close-word" name="word" autoComplete="off" autoCapitalize="characters" required />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
        <Submit />
        <Button type="button" full variant="ghost" onClick={() => setOpen(false)}>
          {t("pclose.keep")}
        </Button>
      </form>
    </Card>
  );
}
