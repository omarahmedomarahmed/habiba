"use client";

import { useState, useTransition } from "react";

import { suspendUser, verifyUser } from "@/app/(admin)/admin/actions";
import { Badge, Button } from "@/components/ui";

export function ClinicianRow(props: {
  id: string;
  name: string;
  email: string;
  organizationName: string;
  role: string;
  status: string;
  verificationStatus: string;
  plan: string;
  sessionCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(props.status);
  const [verification, setVerification] = useState(props.verificationStatus);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {props.name || props.email}
        </p>
        <p className="truncate text-xs text-slate-500">
          {props.email} · {props.organizationName} · {props.sessionCount} session
          {props.sessionCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {props.role === "super_admin" ? <Badge tone="brand">Admin</Badge> : null}
        <Badge tone={props.plan === "unlimited" ? "teal" : "slate"}>
          {props.plan === "unlimited" ? "Unlimited" : "Pay as you go"}
        </Badge>
        <Badge
          tone={
            verification === "verified" ? "green" : verification === "rejected" ? "red" : "slate"
          }
        >
          {verification}
        </Badge>
        {status === "suspended" ? <Badge tone="red">Suspended</Badge> : null}
      </div>

      <div className="flex shrink-0 gap-2">
        {verification !== "verified" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await verifyUser(props.id, "verified");
                setVerification("verified");
              })
            }
          >
            Verify
          </Button>
        ) : null}

        <Button
          size="sm"
          variant={status === "suspended" ? "secondary" : "danger"}
          disabled={pending || props.role === "super_admin"}
          onClick={() =>
            startTransition(async () => {
              const next = status !== "suspended";
              await suspendUser(props.id, next);
              setStatus(next ? "suspended" : "active");
            })
          }
        >
          {status === "suspended" ? "Reinstate" : "Suspend"}
        </Button>
      </div>
    </div>
  );
}
