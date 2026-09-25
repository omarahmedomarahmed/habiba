import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";

import { VerificationForm } from "@/components/onboarding/verification-form";
import { LicenceChangeForm } from "@/components/onboarding/licence-change-form";
import { licenceChangeView } from "@/lib/data/licence-change";
import { Card } from "@/components/ui";
import { SeesWhat } from "@/components/visual/primitives";
import { isBackOffice, landingFor } from "@/lib/admin/access";
import { requireUser } from "@/lib/auth/guard";
import {
  documentRequirements,
  requirementOverrides,
  ensureVerification,
  missingFrom,
} from "@/lib/data/verification";
import { activeTaxonomy } from "@/lib/data/taxonomy";
import { uploadsConfigured } from "@/lib/uploads";
import { IDENTITY_KINDS, identityDocumentPath } from "@/lib/documents/identity-access";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.verifyYourPractice"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { t } = await getI18n();
  const actor = await requireUser();

  /*
   * An operator has no licence to upload and no queue to wait in. W2-A01: any
   * back office role, to a page it can open; staff used to be sent to `/admin`
   * from here, or kept here, on a clinician's setup screen.
   */
  if (isBackOffice(actor.role)) redirect(landingFor(actor.role));

  const [verification, countryOptions, languageOptions, specialtyOptions] = await Promise.all([
    ensureVerification(actor),
    activeTaxonomy("country"),
    activeTaxonomy("language"),
    activeTaxonomy("specialty"),
  ]);
  const missing = missingFrom(verification);
  /* 🔴 W1-23: after approval, licence details change through review. */
  const change = verification.state === "approved" ? await licenceChangeView(actor) : null;
  /*
   * 20.4 / 20.5 — the labels and regulators an administrator has configured,
   * with the shipped constants underneath. Read on the server; the form needs
   * the whole map because it relabels the moment a country is picked.
   */
  const overrides = await requirementOverrides();
  const requirements = documentRequirements(verification.country, overrides);

  /*
   * 🔴 29.1 / H14 — the reference, never the stored URL.
   *
   * A clinician's own passport used to be rendered into this page as a blob
   * URL, which is a secret and therefore not access control: it works forever,
   * for anybody who ever saw it, with no audit trail and no way to revoke it.
   * The path below carries no secret and the route asks who is calling.
   *
   * Null where nothing has been uploaded, so the form still knows which
   * documents are missing rather than offering four broken images.
   */
  const stored: Record<string, string | null> = {
    idFront: verification.idFrontUrl,
    idBack: verification.idBackUrl,
    licenseDoc: verification.licenseDocUrl,
    headshot: verification.headshotUrl,
  };

  const urls: Record<string, string | null> = Object.fromEntries(
    IDENTITY_KINDS.map((kind) => [
      kind,
      stored[kind] ? identityDocumentPath(verification.id, kind) : null,
    ]),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {verification.state === "approved"
              ? t("portal.onboarding.verified")
              : t("portal.onboarding.verify")}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {verification.state === "approved"
              ? t("portal.onboarding.verifiedBody")
              : t("portal.onboarding.verifyBody")}
          </p>
        </div>
      </div>

      {/*
        Say why, once, plainly.
        -----------------------
        People hand over a passport photo far more willingly when the reason is
        stated in a sentence they can actually parse. Vagueness here reads as
        data harvesting, which is the opposite of what this is.
      */}
      {/*
        🔴 65.10 — WHY WE ASK, AND WHO SEES IT, AS TWO COLUMNS INSTEAD OF TWO PARAGRAPHS.

        94 words in a grey card above the upload form, at the exact moment somebody is
        deciding whether to photograph their passport. Vagueness here reads as data
        harvesting, and so does length: a clinician who skims a 56-word justification has
        been given a reason they did not read.

        The privacy half is the one that decides it, and it was the second paragraph.
        Both halves are now at the same size, and the CANNOT column is the promise:
        patients and other clinicians never see any of it.
      */}
      {verification.state !== "approved" ? (
        <div className="mt-5">
          <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lock className="h-4 w-4 text-slate-500" aria-hidden />
            {t("portal.onboarding.whyWeAsk")}
          </p>
          <SeesWhat
            who={t("portal.onboarding.whoSees")}
            can={[
              t("portal.onboarding.reasonRecords"),
              t("portal.onboarding.reasonPartners"),
              t("portal.onboarding.reasonCrisis"),
            ]}
            cannot={[
              t("portal.onboarding.notPatients"),
              t("portal.onboarding.notClinicians"),
              t("portal.onboarding.notElse"),
            ]}
          />
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
            {t("portal.onboarding.publicOnly")}
          </p>
        </div>
      ) : null}

      {change ? (
        <div className="mt-5">
          <LicenceChangeForm
            initial={change.initial}
            pending={change.pending}
            reviewNote={change.reviewNote}
          />
        </div>
      ) : null}

      <div className="mt-5">
        <VerificationForm
          state={verification.state}
          missing={missing}
          reviewNote={verification.reviewNote}
          initial={{
            country: verification.country ?? "",
            licenseBody: verification.licenseBody ?? "",
            licenseNumber: verification.licenseNumber ?? "",
            licenseExpiry: verification.licenseExpiry ?? "",
            specialties: verification.specialties,
            languages: verification.languages,
          }}
          documents={requirements.map((requirement) => ({
            ...requirement,
            url: urls[requirement.key] ?? null,
          }))}
          countryOptions={countryOptions.map((o) => ({ code: o.code, name: o.label, flag: o.flag }))}
          languageOptions={languageOptions.map((o) => ({ code: o.code, label: o.label }))}
          specialtyOptions={specialtyOptions.map((o) => ({ code: o.code, label: o.label }))}
          requirements={overrides}
          uploadsEnabled={uploadsConfigured()}
          renewing={verification.state === "submitted" && Boolean(verification.licenseExpiredAt)}
        />
      </div>
    </div>
  );
}
