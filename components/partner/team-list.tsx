"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";

import { invite, remove } from "@/app/(partner)/partner/team/actions";
import { Avatar, Badge, Button, Card, Field, Input } from "@/components/clinician/kit";
import { ConfirmBox, RowButton, SELECT } from "@/components/partner/parts";
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
      <UserPlus className="h-4 w-4" aria-hidden />
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
    <div className="flex flex-col gap-5">
      <Card className="divide-y divide-navy-50 overflow-hidden">
        {team.map((member) => (
          <div key={member.id} className="p-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={member.name ?? member.email} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-[15px] font-bold text-navy-700">{member.name ?? member.email}</span>
                  <Badge tone={member.role === "admin" ? "brand" : "slate"}>
                    {member.role === "admin" ? t("dev.roleAdmin") : t("dev.roleDeveloper")}
                  </Badge>
                  {member.invited ? <Badge tone="amber">{t("dev.invited")}</Badge> : null}
                </div>
                <p className="mt-0.5 break-all text-[13px] text-navy-400">{member.email}</p>
              </div>

              {canEdit && !member.you && asking !== member.id ? (
                <RowButton
                  danger
                  onClick={() => {
                    setError(null);
                    setAsking(member.id);
                  }}
                >
                  {t("dev.remove")}
                </RowButton>
              ) : null}
            </div>

            {canEdit && asking === member.id ? (
              <ConfirmBox>
                <p className="text-sm text-navy-600">{t("dev.removeConfirm")}</p>
                {error ? (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await remove(member.id);
                        if (result.error) setError(result.error);
                        else setAsking(null);
                      })
                    }
                  >
                    {t("dev.removeYes")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(null)}>
                    {t("dev.cancel")}
                  </Button>
                </div>
              </ConfirmBox>
            ) : null}
          </div>
        ))}
      </Card>

      {canEdit ? (
        <Card className="p-5 sm:p-6">
          <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("dev.email")} htmlFor="team-email">
                <Input id="team-email" name="email" type="email" autoCapitalize="none" required />
              </Field>
              <Field label={t("dev.name")} htmlFor="team-name">
                <Input id="team-name" name="name" />
              </Field>
            </div>
            <Field label={t("dev.role")} htmlFor="team-role">
              <select id="team-role" name="role" defaultValue="developer" className={SELECT}>
                <option value="developer">{t("dev.roleDeveloper")}</option>
                <option value="admin">{t("dev.roleAdmin")}</option>
              </select>
            </Field>
            {state.error ? (
              <p role="alert" className="text-sm text-red-700">
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
