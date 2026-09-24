"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { invite, remove } from "@/app/(partner)/partner/team/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 W2-X06: THE PEOPLE ON A PARTNER'S ACCOUNT, and an admin adds or removes them.
 *
 * Only an operator could create a partner user, so a team shared one login. An
 * admin now adds a colleague by address and role; the colleague chooses their own
 * password from the link they are sent. Remove asks first, and the server refuses
 * removing yourself or the last admin.
 */

export type TeamRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  invited: boolean;
  you: boolean;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  );
}

export function TeamList({ team, canEdit }: { team: TeamRow[]; canEdit: boolean }) {
  const t = useT();
  const [state, formAction] = useActionState(invite, {});
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {team.map((member) => (
          <li key={member.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">
                  {member.name ?? member.email}
                </span>
                <span className="break-all text-xs text-slate-500">{member.email}</span>
                <span className="text-xs font-semibold text-slate-500">
                  {member.role === "admin" ? t("dev.roleAdmin") : t("dev.roleDeveloper")}
                </span>
                {member.invited ? (
                  <span className="text-xs font-semibold text-amber-700">{t("dev.invited")}</span>
                ) : null}
              </div>

              {canEdit && !member.you && asking !== member.id ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAsking(member.id);
                  }}
                  className="tap-target mt-3 h-9 rounded-xl px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  {t("dev.remove")}
                </button>
              ) : null}

              {canEdit && asking === member.id ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-700">{t("dev.removeConfirm")}</p>
                  {error ? (
                    <p role="alert" className="text-xs text-red-600">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await remove(member.id);
                          if (result.error) setError(result.error);
                          else setAsking(null);
                        })
                      }
                      className="tap-target h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {t("dev.removeYes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsking(null)}
                      className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {t("dev.cancel")}
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <Card className="p-5">
          <form action={formAction} className="space-y-4">
            <Field label={t("dev.email")} htmlFor="team-email">
              <Input id="team-email" name="email" type="email" autoCapitalize="none" required />
            </Field>
            <Field label={t("dev.name")} htmlFor="team-name">
              <Input id="team-name" name="name" />
            </Field>
            <Field label={t("dev.role")} htmlFor="team-role">
              <select
                id="team-role"
                name="role"
                defaultValue="developer"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="developer">{t("dev.roleDeveloper")}</option>
                <option value="admin">{t("dev.roleAdmin")}</option>
              </select>
            </Field>
            {state.error ? (
              <p role="alert" className="text-xs text-red-600">
                {state.error}
              </p>
            ) : null}
            <Submit label={t("dev.invite")} />
          </form>
        </Card>
      ) : null}
    </div>
  );
}
