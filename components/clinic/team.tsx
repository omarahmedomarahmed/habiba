"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  changeStaffRole,
  deleteRole,
  inviteStaff,
  reinviteStaff,
  removeStaff,
  saveAssignments,
  saveRole,
  signOutStaff,
} from "@/app/(clinic)/clinic/team/actions";
import { Check, CheckCircle2, KeyRound, Link2, Lock, LogOut, Pencil, Trash2, UserMinus, Users } from "lucide-react";

import { ClinicHead } from "@/components/clinic/ui";
import { Avatar, Badge, Button, Card, Field, IconTile, Input } from "@/components/clinician/kit";
import type { ClinicCapability } from "@/lib/clinic-auth/capabilities";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The practice's staff and the two roles it may name. PLAN.md 63.3 to 63.7.
 *
 * ## 🔴 WHAT THIS SCREEN CANNOT OFFER, AND WHY IT IS NOT AN OVERSIGHT
 *
 * There is no checkbox for buying seats and none for inviting a clinician. C326 says a
 * role's capabilities are a subset of its creator's, and 63.7 says money and
 * membership are never delegable at all, so `DELEGABLE` is what this draws and the two
 * missing entries are the ruling rather than a shorter list.
 *
 * A practice manager reading this screen should be able to see that those two are not
 * on offer. That is why the sentence under the checkboxes names them instead of
 * leaving somebody to notice an absence.
 */

/*
 * 🔴 A LABEL PER CAPABILITY, IN THE DICTIONARY, and the map is exhaustive by type.
 *
 * `Record<ClinicCapability, MessageKey>` means adding a capability to the vocabulary
 * without a label does not compile. A permission a practice cannot read the name of is
 * a permission they cannot decide about, and the failure mode without this is a
 * checkbox labelled `earnings.read`.
 */
const LABELS: Record<ClinicCapability, MessageKey> = {
  "schedule.read": "clinic.cap.schedule",
  "people.read": "clinic.cap.people",
  "bills.read": "clinic.cap.bills",
  "earnings.read": "clinic.cap.earnings",
  "reports.read": "clinic.cap.reports",
  "team.manage": "clinic.cap.team",
  "seats.manage": "clinic.cap.seats",
  "clinicians.manage": "clinic.cap.clinicians",
  export: "clinic.cap.export",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

export type RoleRow = {
  id: string;
  slot: number;
  name: string;
  capabilities: ClinicCapability[];
};

export type StaffRow = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  roleId: string | null;
  roleName: string | null;
  assigned: string[];
  /** 🔴 W2-C04: added, and has not chosen a password from their link yet. */
  invited: boolean;
};

export function ClinicTeam({
  isAdmin,
  selfId,
  grantable,
  roles,
  staff,
  clinicians,
}: {
  isAdmin: boolean;
  /** 🔴 T13: whose row is the reader's own, which only an admin may assign. */
  selfId: string;
  grantable: ClinicCapability[];
  roles: RoleRow[];
  staff: StaffRow[];
  clinicians: { userId: string; name: string }[];
}) {
  const t = useT();
  const [roleState, roleAction] = useActionState(saveRole, {});
  const [staffState, staffAction] = useActionState(inviteStaff, {});
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* 🔴 W2-C04: a fresh invitation link, shown once to the admin who asked for it. */
  const [link, setLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const run = (act: () => Promise<{ error?: string; link?: string }>) =>
    startTransition(async () => {
      const result = await act();
      setError(result.error ?? null);
      if (result.link) setLink(result.link);
    });

  return (
    <div>
      <ClinicHead title={t("clinic.team.title")} subtitle={t("clinic.team.body")} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ staff -- */}
        <Card className="p-5 lg:order-1">
          <div className="flex items-center gap-3">
            <IconTile tone="navy">
              <Users className="h-5 w-5" aria-hidden />
            </IconTile>
            <h2 className="text-[17px] font-bold text-navy-700">{t("clinic.team.staffTitle")}</h2>
          </div>

          <ul className="mt-4 space-y-3">
            {staff.map((person) => (
              <li key={person.id} className="rounded-2xl p-3 ring-1 ring-navy-100">
                <div className="flex items-center gap-3">
                  <Avatar name={person.name || person.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-navy-700">{person.name || person.email}</p>
                    <p className="truncate text-[13px] text-navy-400">
                      {person.isAdmin
                        ? t("clinic.team.isAdmin")
                        : (person.roleName ?? t("clinic.team.noRole"))}
                    </p>
                  </div>
                  {person.invited ? <Badge tone="amber">{t("clinic.team.invited")}</Badge> : null}
                </div>

                {/*
                  🔴 W2-C04: THE LIFECYCLE, for staff and never for the owner.
                  A role, a way to end their sessions, a new link while they have
                  not used theirs, and removal behind a second press. Each action
                  refuses the practice's admin on the server as well.
                */}
                {isAdmin && !person.isAdmin ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {roles.length > 0 ? (
                      <select
                        aria-label={t("clinic.team.theirRole")}
                        defaultValue={person.roleId ?? ""}
                        disabled={pending}
                        onChange={(event) =>
                          run(() => changeStaffRole(person.id, event.target.value))
                        }
                        className={cn(SELECT, "h-9 w-auto rounded-xl px-3 text-[13px]")}
                      >
                        {person.roleId ? null : <option value="">{t("clinic.team.noRole")}</option>}
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {person.invited ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => reinviteStaff(person.id))}
                      >
                        <Link2 className="h-4 w-4" aria-hidden />
                        {t("clinic.team.newLink")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => signOutStaff(person.id))}
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        {t("clinic.team.signOut")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={removing === person.id ? "danger" : "ghost"}
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        removing === person.id
                          ? run(async () => {
                              setRemoving(null);
                              return removeStaff(person.id);
                            })
                          : setRemoving(person.id)
                      }
                    >
                      {removing === person.id ? null : <UserMinus className="h-4 w-4" aria-hidden />}
                      {removing === person.id ? t("common.confirm") : t("clinic.team.removeRole")}
                    </Button>
                  </div>
                ) : null}

                {/*
                  🔴 63.4 / C325 — THE ASSIGNMENT LIST, and an admin has none.

                  An admin is not scoped: `scopeToAssigned` returns null for them, so
                  checkboxes here would be a restriction that is not there. The
                  sentence says so rather than showing an empty list somebody reads
                  as "assigned to nobody".
                */}
                {person.isAdmin ? (
                  <p className="mt-2 text-[13px] text-navy-400">{t("clinic.team.adminSeesAll")}</p>
                ) : person.id === selfId && !isAdmin ? (
                  /*
                    🔴 T13: NOT ON YOUR OWN ROW. Ticking every box here widened the
                    reader's own reach to the whole practice; `setAssignments` refuses
                    it, and this says so instead of drawing boxes that would fail.
                  */
                  <p className="mt-2 text-[13px] text-navy-400">{t("clinic.team.notYourOwn")}</p>
                ) : clinicians.length > 0 ? (
                  <AssignmentPicker
                    managerId={person.id}
                    assigned={person.assigned}
                    clinicians={clinicians}
                    onError={setError}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {isAdmin && roles.length > 0 ? (
            <form action={staffAction} className="mt-5 space-y-4 border-t border-navy-100 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("clinic.email")} htmlFor="staff-email">
                  <Input id="staff-email" name="email" type="email" autoCapitalize="none" required />
                </Field>
                <Field label={t("clinic.team.staffName")} htmlFor="staff-name">
                  <Input id="staff-name" name="name" />
                </Field>
              </div>
              <Field label={t("clinic.team.theirRole")} htmlFor="staff-role">
                <select id="staff-role" name="roleId" required className={cn(SELECT, "h-12 px-4 text-sm")}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </Field>

              {staffState.error ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {staffState.error}
                </p>
              ) : null}

              {staffState.link && staffState.link !== link ? (
                <InviteLink link={staffState.link} />
              ) : null}

              <Submit label={t("clinic.team.addStaff")} />
            </form>
          ) : null}
        </Card>

        {/* ------------------------------------------------------------ roles -- */}
        <Card className="p-5 lg:order-2">
          <div className="flex items-center gap-3">
            <IconTile tone="brand">
              <KeyRound className="h-5 w-5" aria-hidden />
            </IconTile>
            <h2 className="text-[17px] font-bold text-navy-700">{t("clinic.team.rolesTitle")}</h2>
          </div>

          {roles.length === 0 ? (
            <p className="mt-3 text-[14px] leading-relaxed text-navy-400">{t("clinic.team.rolesEmpty")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {roles.map((role) => (
                <li key={role.id} className="rounded-2xl bg-navy-50 p-3">
                  <p className="text-[15px] font-semibold text-navy-700">{role.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {role.capabilities.map((capability) => (
                      <Badge key={capability} tone="slate" className="bg-white">
                        {t(LABELS[capability])}
                      </Badge>
                    ))}
                  </div>
                  {isAdmin ? (
                    <div className="mt-2 flex gap-1 -ms-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(role)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {t("clinic.team.editRole")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteRole(role.id);
                            setError(result.error ?? null);
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {t("clinic.team.removeRole")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/*
            🔴 63.3 — two roles, and the form disappears at two rather than failing
            at two. `createRole` refuses a third anyway, because a form that is not
            drawn is not a rule.
          */}
          {isAdmin && (roles.length < 2 || editing) ? (
            <form action={roleAction} className="mt-5 space-y-4 border-t border-navy-100 pt-5">
              <input type="hidden" name="roleId" value={editing?.id ?? ""} />

              <Field label={t("clinic.team.roleName")} htmlFor="role-name">
                <Input
                  id="role-name"
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  key={editing?.id ?? "new"}
                  required
                />
              </Field>

              <fieldset className="space-y-1">
                <legend className="mb-1.5 text-sm font-semibold text-navy-600">{t("clinic.team.canDo")}</legend>
                {grantable.map((capability) => (
                  <label
                    key={capability}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-[14px] text-navy-600 hover:bg-navy-50"
                  >
                    <input
                      type="checkbox"
                      name="capabilities"
                      value={capability}
                      defaultChecked={editing?.capabilities.includes(capability) ?? false}
                      className="h-4 w-4 rounded border-navy-200 accent-brand-600"
                    />
                    {t(LABELS[capability])}
                  </label>
                ))}
              </fieldset>

              {/* 🔴 63.7 — the two that stay with the admin, named rather than absent. */}
              <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t("clinic.team.neverDelegable")}
              </p>

              {roleState.error ? (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {roleState.error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Submit label={editing ? t("clinic.team.saveRole") : t("clinic.team.addRole")} />
                {editing ? (
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    {t("clinic.team.cancel")}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </Card>
      </div>

      {link ? (
        <div className="mt-4">
          <InviteLink link={link} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* The kit's field, as a native select: the same border, radius and focus ring as `Input`. */
const SELECT =
  "w-full rounded-2xl border border-navy-100 bg-white text-navy-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:opacity-50";

/**
 * 🔴 W2-C04: the link, as the clinician invitation shows it. It lets its
 * holder choose their own password once; the admin passes it on and types
 * nothing.
 */
function InviteLink({ link }: { link: string }) {
  const t = useT();
  return (
    <div className="rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-100">
      <p className="text-[13px] text-brand-800">{t("clinic.inviteLink")}</p>
      <p className="mt-1 break-all font-mono text-xs text-navy-700" dir="ltr">
        {link}
      </p>
    </div>
  );
}

/**
 * 🔴 SAVE MEANS "THIS IS THE LIST NOW", which is why it posts the whole set.
 *
 * `setAssignments` replaces rather than adds, so a box somebody unticked is a row
 * that goes. An add-only control would need a remove beside it and a screen that got
 * the difference right, which is three ways to leave somebody assigned to a clinician
 * nobody intended.
 */
function AssignmentPicker({
  managerId,
  assigned,
  clinicians,
  onError,
}: {
  managerId: string;
  assigned: string[];
  clinicians: { userId: string; name: string }[];
  onError: (message: string | null) => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>(assigned);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty =
    picked.length !== assigned.length || picked.some((id) => !assigned.includes(id));

  return (
    <div className="mt-3 rounded-2xl bg-navy-50 p-3">
      <p className="text-[13px] font-semibold text-navy-600">{t("clinic.team.assignedTo")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {clinicians.map((clinician) => {
          const on = picked.includes(clinician.userId);
          return (
            <label
              key={clinician.userId}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-semibold ring-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
                on ? "bg-navy-600 text-white ring-navy-600" : "bg-white text-navy-600 ring-navy-100",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(event) => {
                  setSaved(false);
                  setPicked((current) =>
                    event.target.checked
                      ? [...current, clinician.userId]
                      : current.filter((id) => id !== clinician.userId),
                  );
                }}
                className="sr-only"
              />
              {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {clinician.name}
            </label>
          );
        })}
      </div>

      {/* 🔴 The consequence of an empty list, said before somebody saves one. */}
      {picked.length === 0 ? (
        <p className="mt-2 text-[13px] text-amber-800">{t("clinic.team.noneAssigned")}</p>
      ) : null}

      {dirty ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveAssignments(managerId, picked);
              onError(result.error ?? null);
              setSaved(!result.error);
            })
          }
          className="mt-3"
        >
          {t("clinic.team.saveAssignments")}
        </Button>
      ) : saved ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t("clinic.team.saved")}
        </p>
      ) : null}
    </div>
  );
}
