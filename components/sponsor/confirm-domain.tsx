"use client";

import { useState, useTransition } from "react";

import { confirmDomainMailbox } from "@/app/(sponsor)/sponsor/domains/actions";
import { Button, Card } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 C318's mailbox half, confirmed by the person who received the mail.
 *
 * A button rather than a confirmation on page load, deliberately. Mail clients
 * and security scanners fetch every link in a message, so a proof that happens
 * on `GET` is a proof performed by a robot at the recipient's employer rather
 * than by a person who read the sentence above it.
 */
export function ConfirmDomain({ domainId, token }: { domainId: string; token: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | boolean>(null);

  if (done === true) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-brand-700">{t("sponsor.confirm.done")}</p>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("sponsor.confirm.doneBody")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm leading-relaxed text-navy-400">{t("sponsor.confirm.body")}</p>

      {done === false ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{t("sponsor.confirm.invalid")}</p>
      ) : null}

      <Button
        type="button"
        className="mt-4"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await confirmDomainMailbox(domainId, token);
            setDone(result.ok);
          });
        }}
      >
        {pending ? t("sponsor.confirm.confirming") : t("sponsor.confirm.yes")}
      </Button>
    </Card>
  );
}
