"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  changeRole,
  inviteMember,
  sendPasswordLink,
  setActive,
  type TeamState,
} from "@/app/(admin)/admin/team/actions";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import type { TeamMember } from "@/lib/data/admin-team";
import { useT } from "@/lib/i18n/client";

const INITIAL: TeamState = {};

function Go({ label, tone }: { label: string; tone?: "quiet" }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="sm" variant={tone === "quiet" ? "secondary" : undefined} disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

function Said({ state, done }: { state: TeamState; done?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-xs text-rose-600">
        {state.error}
      </p>
    );
  }
  return state.ok && done ? <p className="text-xs text-brand-700">{done}</p> : null;
}

/**
 * 🔴 W2-A06: the back office team. Invite by link, change a role, take access
 * away and give it back, send a password link. The owner's row and your own
 * are shown and cannot be changed here.
 */
export function TeamManager({ members, actorUserId }: { members: TeamMember[]; actorUserId: string }) {
  const t = useT();
  const [state, action] = useActionState(inviteMember, INITIAL);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("ateam.title")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("ateam.body")}</p>
        <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label={t("ateam.first")} htmlFor="firstName">
            <Input id="firstName" name="firstName" required />
          </Field>
          <Field label={t("ateam.last")} htmlFor="lastName">
            <Input id="lastName" name="lastName" required />
          </Field>
          <Field label={t("ateam.email")} htmlFor="teamEmail">
            <Input id="teamEmail" name="email" type="email" required />
          </Field>
          <Field label={t("ateam.role")} htmlFor="teamRole">
            <RolePicker id="teamRole" value="staff" />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Said state={state} done={t("ateam.linkSent")} />
            <Go label={t("ateam.add")} />
          </div>
        </form>
      </Card>

      <Card className="divide-y divide-slate-100">
        {members.map((member) => (
          <MemberRow key={member.id} member={member} own={member.id === actorUserId} />
        ))}
      </Card>
    </div>
  );
}

function RolePicker({ id, value }: { id: string; value: string }) {
  const t = useT();
  return (
    <select
      id={id}
      name="role"
      defaultValue={value}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
    >
      <option value="staff">{t("ateam.roleStaff")}</option>
      <option value="manager">{t("ateam.roleManager")}</option>
    </select>
  );
}

function MemberRow({ member, own }: { member: TeamMember; own: boolean }) {
  const t = useT();
  const [roleState, roleAction] = useActionState(changeRole, INITIAL);
  const [activeState, activeAction] = useActionState(setActive, INITIAL);
  const [linkState, linkAction] = useActionState(sendPasswordLink, INITIAL);
  // A5 / W2-A05: taking access away is confirmed, because it signs them out at once.
  const [confirming, setConfirming] = useState(false);
  const fixed = own || member.role === "super_admin";

  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{member.name}</span>
        <span className="text-xs text-slate-500">{member.email}</span>
        <Badge>{member.role}</Badge>
        {!member.active ? <Badge tone="amber">{t("ateam.inactive")}</Badge> : null}
      </div>

      {fixed ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <form action={roleAction} className="flex items-end gap-2">
            <input type="hidden" name="userId" value={member.id} />
            <div className="w-56">
              <RolePicker id={`role-${member.id}`} value={member.role} />
            </div>
            <Go label={t("common.save")} tone="quiet" />
          </form>

          <form action={linkAction}>
            <input type="hidden" name="userId" value={member.id} />
            <Go label={t("ateam.sendLink")} tone="quiet" />
          </form>

          {member.active && !confirming ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              {t("ateam.deactivate")}
            </Button>
          ) : (
            <form action={activeAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={member.id} />
              <input type="hidden" name="active" value={member.active ? "false" : "true"} />
              {member.active ? <span className="text-xs text-slate-600">{t("ateam.confirmOff")}</span> : null}
              <Go label={member.active ? t("ateam.deactivate") : t("ateam.reactivate")} />
            </form>
          )}
        </div>
      )}

      <Said state={roleState} />
      <Said state={activeState} />
      <Said state={linkState} done={t("ateam.linkSent")} />
    </div>
  );
}
