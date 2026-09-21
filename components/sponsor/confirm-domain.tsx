"use client";

import { useState, useTransition } from "react";

import { confirmDomainMailbox } from "@/app/(sponsor)/sponsor/domains/actions";
import { Button, Card } from "@/components/ui";

/**
 * 🔴 C318's mailbox half, confirmed by the person who received the mail.
 *
 * A button rather than a confirmation on page load, deliberately. Mail clients
 * and security scanners fetch every link in a message, so a proof that happens
 * on `GET` is a proof performed by a robot at the recipient's employer rather
 * than by a person who read the sentence above it.
 */
export function ConfirmDomain({ domainId, token }: { domainId: string; token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | boolean>(null);

  if (done === true) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-brand-700">Thank you. That half is done.</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          We still need the DNS record published before joining codes work. Whoever set this up
          can see both on their own domains page.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm leading-relaxed text-slate-600">
        Somebody at your organisation asked us to set up mental health cover for your people.
        Clicking below confirms that this mailbox is real and that a person here saw the
        request. It commits you to nothing and it is not a signature.
      </p>

      {done === false ? (
        <p className="mt-3 text-sm font-semibold text-red-700">
          That link is not valid, or this domain has already been confirmed. Ask whoever set it
          up to send a fresh one.
        </p>
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
        {pending ? "Confirming…" : "Yes, this mailbox is ours"}
      </Button>
    </Card>
  );
}
