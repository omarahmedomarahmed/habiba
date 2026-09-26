"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  changeOwnPassword,
  changeRole,
  inviteColleague,
  removeColleague,
} from "@/app/(sponsor)/sponsor/team/actions";
import { Avatar, Badge, Button, Card, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

import { ConfirmAct } from "./confirm-act";

/**
 * 🔴 W2-S05: who can sign in to this company's portal, and the company's own
 * control of it. Everybody sees the list and changes their own password; an
 * admin invites, changes roles and removes. The server re-checks every one.
 */

export type TeamRow = {
  id: string;
  email: string;
  role: "admin" | "viewer";
  invited: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function Team({
  rows,
  me,
  canManage,
}: {
  rows: TeamRow[];
  me: string;
  canManage: boolean;
}) {
  const t = useT();
  const [invite, inviteAction] = useActionState(inviteColleague, {});
  const [password, passwordAction] = useActionState(changeOwnPassword, {});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <ul className="divide-y divide-navy-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 py-3">
              <Avatar name={row.email} size={32} />
              <span className="min-w-0 truncate text-sm font-semibold text-navy-700">{row.email}</span>
              <Badge tone={row.role === "admin" ? "teal" : "slate"}>
                {row.role === "admin" ? t("sponsor.roleAdmin") : t("sponsor.roleViewer")}
              </Badge>
              {row.invited ? <Badge tone="amber">{t("sponsor.invited")}</Badge> : null}
              {canManage && row.id !== me ? (
                <span className="ms-auto flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await changeRole(
                          row.id,
                          row.role === "admin" ? "viewer" : "admin",
                        );
                        setError(result.error ?? null);
                      })
                    }
                    className="tap-target h-9 rounded-xl px-2 text-xs font-semibold text-navy-400 hover:bg-navy-50 disabled:opacity-50"
                  >
                    {row.role === "admin" ? t("sponsor.makeViewer") : t("sponsor.makeAdmin")}
                  </button>
                  <ConfirmAct
                    label={t("sponsor.removeField")}
                    body={t("sponsor.removeLoginBody")}
                    done={t("sponsor.fieldRemoved")}
                    act={() => removeColleague(row.id)}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        ) : null}

        {canManage ? (
          <form action={inviteAction} className="mt-4 space-y-3 border-t border-navy-100 pt-4">
            <Field label={t("sponsor.email")} htmlFor="invite-email">
              <Input id="invite-email" name="email" type="email" autoCapitalize="none" required />
            </Field>
            <select
              name="role"
              defaultValue="viewer"
              aria-label={t("sponsor.role")}
              className="h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              <option value="viewer">{t("sponsor.roleViewer")}</option>
              <option value="admin">{t("sponsor.roleAdmin")}</option>
            </select>
            {invite.error ? (
              <p role="alert" className="text-xs text-red-600">
                {invite.error}
              </p>
            ) : null}
            {invite.ok ? (
              <p role="status" className="text-xs font-semibold text-brand-700">
                {t("sponsor.inviteSent")}
              </p>
            ) : null}
            <Submit label={t("sponsor.invite")} />
          </form>
        ) : null}
      </Card>

      <Card className="p-5">
        <form action={passwordAction} className="space-y-3">
          <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.changePassword")}</h2>
          <Field label={t("sponsor.password")} htmlFor="current-password">
            <Input
              id="current-password"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label={t("sponsor.newPassword")} htmlFor="next-password">
            <Input
              id="next-password"
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </Field>
          {password.error ? (
            <p role="alert" className="text-xs text-red-600">
              {password.error}
            </p>
          ) : null}
          {password.ok ? (
            <p role="status" className="text-xs font-semibold text-brand-700">
              {t("sponsor.passwordChanged")}
            </p>
          ) : null}
          <Submit label={t("sponsor.save")} />
        </form>
      </Card>
    </div>
  );
}
