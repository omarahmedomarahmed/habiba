"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { suspendUser, verifyUser } from "@/app/(admin)/admin/actions";
import { ConfirmWithReason } from "@/components/admin/confirm-with-reason";
import { Badge } from "@/components/ui";

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
  const [status, setStatus] = useState(props.status);
  const [verification, setVerification] = useState(props.verificationStatus);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
      <Link href={`/admin/therapists/${props.id}`} className="group min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">
          {props.name || props.email}
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand-700"
            aria-hidden
          />
        </p>
        <p className="truncate text-xs text-slate-500">
          {props.email} · {props.organizationName} · {props.sessionCount} session
          {props.sessionCount === 1 ? "" : "s"}
        </p>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {props.role === "super_admin" ? <Badge tone="brand">Admin</Badge> : null}
        <Badge tone={props.plan !== "payg" ? "teal" : "slate"}>{props.plan}</Badge>
        <Badge
          tone={
            verification === "verified" ? "green" : verification === "rejected" ? "red" : "slate"
          }
        >
          {verification}
        </Badge>
        {status === "suspended" ? <Badge tone="red">Suspended</Badge> : null}
      </div>

      {/*
        W2-A05: both are two presses and a reason, and the row changes only
        when the server said yes. It used to flip whatever the call returned.
      */}
      <div className="flex shrink-0 flex-wrap gap-2">
        {verification !== "verified" ? (
          <ConfirmWithReason
            label="Verify"
            onConfirm={async (reason) => {
              const result = await verifyUser(props.id, "verified", reason);
              if (!result.error) setVerification("verified");
              return result;
            }}
          />
        ) : null}

        <ConfirmWithReason
          label={status === "suspended" ? "Reinstate" : "Suspend"}
          variant={status === "suspended" ? "secondary" : "danger"}
          disabled={props.role === "super_admin"}
          onConfirm={async (reason) => {
            const next = status !== "suspended";
            const result = await suspendUser(props.id, next, reason);
            if (!result.error) setStatus(next ? "suspended" : "active");
            return result;
          }}
        />
      </div>
    </div>
  );
}
