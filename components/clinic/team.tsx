"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteRole,
  inviteStaff,
  saveAssignments,
  saveRole,
} from "@/app/(clinic)/clinic/team/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import type { ClinicCapability } from "@/lib/clinic-auth/capabilities";
import { useT } from "@/lib/i18n/client";
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
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
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
};

export function ClinicTeam({
  isAdmin,
  grantable,
  roles,
  staff,
  clinicians,
}: {
  isAdmin: boolean;
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("clinic.team.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("clinic.team.body")}</p>
      </div>

      {/* ------------------------------------------------------------ roles -- */}
      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("clinic.team.rolesTitle")}
        </p>

        {roles.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("clinic.team.rolesEmpty")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {roles.map((role) => (
              <li key={role.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-slate-900">{role.name}</span>
                  <span className="text-xs text-slate-500">
                    {role.capabilities.map((capability) => t(LABELS[capability])).join(" · ")}
                  </span>
                </div>
                {isAdmin ? (
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(role)}
                      className="tap-target h-9 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {t("clinic.team.editRole")}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteRole(role.id);
                          setError(result.error ?? null);
                        })
                      }
                      className="tap-target h-9 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {t("clinic.team.removeRole")}
                    </button>
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
          <form action={roleAction} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
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

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("clinic.team.canDo")}
              </legend>
              {grantable.map((capability) => (
                <label key={capability} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="capabilities"
                    value={capability}
                    defaultChecked={editing?.capabilities.includes(capability) ?? false}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-500"
                  />
                  {t(LABELS[capability])}
                </label>
              ))}
            </fieldset>

            {/* 🔴 63.7 — the two that stay with the admin, named rather than absent. */}
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {t("clinic.team.neverDelegable")}
            </p>

            {roleState.error ? (
              <p role="alert" className="text-xs text-red-600">
                {roleState.error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Submit label={editing ? t("clinic.team.saveRole") : t("clinic.team.addRole")} />
              {editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {t("clinic.team.cancel")}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ staff -- */}
      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("clinic.team.staffTitle")}
        </p>

        <ul className="mt-3 divide-y divide-slate-100">
          {staff.map((person) => (
            <li key={person.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-slate-900">
                  {person.name || person.email}
                </span>
                <span className="text-xs text-slate-500">
                  {person.isAdmin
                    ? t("clinic.team.isAdmin")
                    : (person.roleName ?? t("clinic.team.noRole"))}
                </span>
              </div>

              {/*
                🔴 63.4 / C325 — THE ASSIGNMENT LIST, and an admin has none.

                An admin is not scoped: `scopeToAssigned` returns null for them, so
                checkboxes here would be a restriction that is not there. The
                sentence says so rather than showing an empty list somebody reads
                as "assigned to nobody".
              */}
              {person.isAdmin ? (
                <p className="mt-1 text-xs text-slate-500">{t("clinic.team.adminSeesAll")}</p>
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
          <form action={staffAction} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <Field label={t("clinic.email")} htmlFor="staff-email">
              <Input id="staff-email" name="email" type="email" autoCapitalize="none" required />
            </Field>
            <Field label={t("clinic.team.staffName")} htmlFor="staff-name">
              <Input id="staff-name" name="name" />
            </Field>
            <Field label={t("clinic.password")} htmlFor="staff-password">
              <Input
                id="staff-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label={t("clinic.team.theirRole")} htmlFor="staff-role">
              <select
                id="staff-role"
                name="roleId"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>

            {staffState.error ? (
              <p role="alert" className="text-xs text-red-600">
                {staffState.error}
              </p>
            ) : null}

            <Submit label={t("clinic.team.addStaff")} />
          </form>
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
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
    <div className="mt-2 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {t("clinic.team.assignedTo")}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {clinicians.map((clinician) => (
          <label key={clinician.userId} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={picked.includes(clinician.userId)}
              onChange={(event) => {
                setSaved(false);
                setPicked((current) =>
                  event.target.checked
                    ? [...current, clinician.userId]
                    : current.filter((id) => id !== clinician.userId),
                );
              }}
              className="h-4 w-4 rounded border-slate-300 accent-brand-500"
            />
            {clinician.name}
          </label>
        ))}
      </div>

      {/* 🔴 The consequence of an empty list, said before somebody saves one. */}
      {picked.length === 0 ? (
        <p className="mt-2 text-xs text-amber-800">{t("clinic.team.noneAssigned")}</p>
      ) : null}

      {dirty ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveAssignments(managerId, picked);
              onError(result.error ?? null);
              setSaved(!result.error);
            })
          }
          className="tap-target mt-2 h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          {t("clinic.team.saveAssignments")}
        </button>
      ) : saved ? (
        <p className="mt-2 text-xs font-semibold text-teal-700">{t("clinic.team.saved")}</p>
      ) : null}
    </div>
  );
}
