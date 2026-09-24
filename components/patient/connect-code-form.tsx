"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { connectToTherapist, type ConnectState } from "@/app/j/[code]/actions";
import { useT } from "@/lib/i18n/client";

const INITIAL: ConnectState = {};

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-2xl bg-brand-500 text-sm font-semibold text-navy-600 hover:bg-brand-400 disabled:opacity-60"
    >
      {pending ? t("common.working") : t("pcode.connect")}
    </button>
  );
}

/**
 * 🔴 P15: the wall code's one button, with somewhere for "that did not work"
 * to appear. The page is a server component and a bare `<form action>` has no
 * state to show, which is how a throttled or failed press came to look
 * exactly like a successful one.
 */
export function ConnectCodeForm({ code }: { code: string }) {
  const t = useT();
  const [state, action] = useActionState(connectToTherapist, INITIAL);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <Submit />
      {state.error ? (
        <p role="alert" className="text-sm text-rose-600">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
