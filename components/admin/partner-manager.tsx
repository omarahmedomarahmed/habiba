"use client";

import { ConfirmWithReason } from "@/components/admin/confirm-with-reason";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  addUser,
  approveProduction,
  attachPractice,
  detachPractice,
  saveDocuments,
  setState,
  withdrawProduction,
} from "@/app/(admin)/admin/partners/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { PARTNER_STATES } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import { countKey } from "@/lib/i18n/count-form";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Managing integrators. PLAN.md 42.1, 55.2, 55.3, C265.
 *
 * ## 🔴 WHAT IS NOT ON THIS SCREEN
 *
 * No key. Not the raw one, not the prefix, and no button that makes one. Keys are minted in
 * the partner's own portal because the scope has to be chosen by the person who will build
 * against it, and because `mintKey` returning the raw key in exactly one response means a key
 * read down a phone line is that design defeated.
 *
 * A COUNT of their keys, so an operator can see whether an onboarding stalled. A count is what
 * that question needs; the prefixes are what somebody pastes into a support ticket.
 *
 * No subject list either, for the same reason the partner portal has no subjects tab: a list
 * of the people a partner has referred is the roster three enrolment designs were spent
 * removing.
 */

export type AdminPartnerRow = {
  id: string;
  name: string;
  state: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  intent: string | null;
  /** 🔴 68.21 — what the owner reads before approving a production key. */
  documentsUrl: string | null;
  approvedAt: string | null;
  keyCount: number;
  users: { id: string; email: string; role: string }[];
  /** Board 611: the practices on their bill, which their live key can reach. */
  practices: { id: string; name: string; slug: string }[];
};

export function PartnerManagerList({ partners }: { partners: AdminPartnerRow[] }) {
  const t = useT();

  if (partners.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-600">{t("apartner.none")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {partners.map((partner) => (
        <PartnerRow key={partner.id} partner={partner} />
      ))}
    </div>
  );
}

function PartnerRow({ partner }: { partner: AdminPartnerRow }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [userState, userAction] = useActionState(addUser, {});
  const [docsState, docsAction] = useActionState(saveDocuments, {});
  const [practiceState, practiceAction] = useActionState(attachPractice, {});

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-900">{partner.name}</span>
        <span
          className={
            partner.state === "active"
              ? "rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          }
        >
          {partner.state}
        </span>
        {/* 🔴 A COUNT, never the prefixes. */}
        <span className="text-xs text-slate-500">
          {t(countKey("apartner.keys", partner.keyCount), { count: partner.keyCount })}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="tap-target ms-auto h-9 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {open ? t("aclinic.close") : t("aclinic.open")}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">{t("apartner.contact")}</dt>
              <dd>{partner.contactName ?? "not given"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("dev.email")}</dt>
              <dd>{partner.contactEmail ?? "not given"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("dev.apply.phone")}</dt>
              <dd>{partner.contactPhone ?? "not given"}</dd>
            </div>
          </dl>

          {/*
           * 🔴 What they said they want to build, read before the call.
           *
           * This is how a key gets the right scope and only that scope. Without it the call
           * starts from "what do you need", and the honest answer is "everything, to be safe".
           */}
          {partner.intent ? (
            <div>
              <p className="text-xs font-semibold text-slate-700">{t("apartner.intent")}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                {partner.intent}
              </p>
            </div>
          ) : null}

          {/*
            🔴 68.21 / C264 — PRODUCTION APPROVAL, and it is a different decision
            from the commercial state beside it.

            A partner can be `active` and unapproved all day: they build against
            sandbox, which reaches nobody. This is the moment their keys can touch a
            real person's session, so the documents and the contact are on the screen
            where the button is rather than in a ticket somebody read last week.
          */}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              {partner.approvedAt
                ? `Approved for production ${partner.approvedAt.slice(0, 10)}`
                : "Not approved for production"}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              {partner.documentsUrl ? (
                <a href={partner.documentsUrl} className="underline" rel="noreferrer noopener">
                  Their documents
                </a>
              ) : (
                "No documents yet."
              )}
            </p>

            {/*
              🔴 K13: where the documents are, recorded by the owner who read them.
              Approval refuses without it, and nothing wrote it before.
            */}
            {partner.approvedAt ? null : (
              <form action={docsAction} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="partnerId" value={partner.id} />
                <div className="min-w-0 flex-1">
                  <Field label={t("apartner.documents")} htmlFor={`docs-${partner.id}`} hint={t("apartner.documentsHint")}>
                    <Input
                      id={`docs-${partner.id}`}
                      name="documentsUrl"
                      type="url"
                      required
                      defaultValue={partner.documentsUrl ?? ""}
                    />
                  </Field>
                </div>
                <Submit label={t("apartner.documentsSave")} />
              </form>
            )}
            {docsState.error ? (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {docsState.error}
              </p>
            ) : docsState.ok ? (
              <p className="mt-1 text-xs text-brand-700">{t("apartner.documentsSaved")}</p>
            ) : null}

            {partner.approvedAt ? (
              <div className="mt-2">
                {/* W2-A05: withdrawing is confirmed, with the reason on the record. */}
                <ConfirmWithReason
                  label="Withdraw approval"
                  onConfirm={(reason) => withdrawProduction(partner.id, reason)}
                />
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await approveProduction(partner.id);
                    setError(result.error ?? null);
                  })
                }
                className="tap-target mt-2 h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve for production
              </button>
            )}

            {/* 🔴 What withdrawing does NOT do, said beside the button that does it. */}
            {/* 🔴 A refusal is shown. `approveForProduction` refuses without documents. */}
            {error ? (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {error}
              </p>
            ) : null}

            {partner.approvedAt ? (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Withdrawing stops new keys and revokes none.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* W2-A05: a confirm and a reason, and a refusal is shown rather than voided. */}
            {PARTNER_STATES.filter((state) => state !== partner.state).map((state) => (
              <ConfirmWithReason
                key={state}
                label={state}
                disabled={pending}
                onConfirm={(reason) => setState(partner.id, state, reason)}
              />
            ))}
          </div>

          {/*
            Board 611: the practices on this partner's bill. Write-back, launch and
            notes reach only these, and only our staff can put one here.
          */}
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">{t("apartner.practices")}</p>
            {partner.practices.length === 0 ? (
              <p className="text-xs text-slate-500">{t("apartner.practicesNone")}</p>
            ) : (
              <ul className="space-y-1.5">
                {partner.practices.map((practice) => (
                  <li key={practice.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span className="font-medium">{practice.name}</span>
                    <span className="text-slate-500">{practice.slug}</span>
                    <span className="ms-auto">
                      <ConfirmWithReason
                        label={t("apartner.practiceDetach")}
                        variant="secondary"
                        onConfirm={(reason) => detachPractice(partner.id, practice.id, reason)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={practiceAction} className="space-y-2">
              <input type="hidden" name="partnerId" value={partner.id} />
              <Field label={t("apartner.practiceField")} htmlFor={`pp-${partner.id}`}>
                <Input id={`pp-${partner.id}`} name="practice" required />
              </Field>
              <Field label={t("aconfirm.why")} htmlFor={`pp-reason-${partner.id}`}>
                <Input id={`pp-reason-${partner.id}`} name="reason" required minLength={10} />
              </Field>
              {practiceState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {practiceState.error}
                </p>
              ) : practiceState.ok ? (
                <p className="text-xs text-brand-700">{t("apartner.practiceAttached")}</p>
              ) : null}
              <Submit label={t("apartner.practiceAttach")} />
            </form>
          </div>

          <div className="space-y-2">
            {partner.users.map((user) => (
              <p key={user.id} className="text-xs text-slate-600">
                {user.email} · {user.role}
              </p>
            ))}

            <form action={userAction} className="space-y-3 rounded-xl bg-slate-50 p-3">
              <input type="hidden" name="partnerId" value={partner.id} />
              <p className="text-xs font-semibold text-slate-700">{t("apartner.addUser")}</p>
              <Field label={t("dev.email")} htmlFor={`pu-email-${partner.id}`}>
                <Input id={`pu-email-${partner.id}`} name="email" type="email" required />
              </Field>
              <Field label={t("apartner.name")} htmlFor={`pu-name-${partner.id}`}>
                <Input id={`pu-name-${partner.id}`} name="name" />
              </Field>
              <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="developer" defaultChecked />{" "}
                  {t("apartner.developer")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="admin" /> {t("apartner.admin")}
                </label>
              </div>
              {userState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {userState.error}
                </p>
              ) : null}
              <Submit label={t("apartner.create")} />
            </form>
          </div>

          {/* 🔴 C265 — the thing this console does not offer, said on the console. */}
          <p className="text-xs leading-relaxed text-slate-500">{t("apartner.neverMints")}</p>
        </div>
      ) : null}
    </Card>
  );
}
