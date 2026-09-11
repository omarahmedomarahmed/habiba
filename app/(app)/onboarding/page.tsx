import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";

import { VerificationForm } from "@/components/onboarding/verification-form";
import { Card } from "@/components/ui";
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

export const metadata: Metadata = { title: "Verify your practice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { t } = await getI18n();
  const actor = await requireUser();

  // An operator has no licence to upload and no queue to wait in.
  if (actor.role === "super_admin") redirect("/admin");

  const [verification, countryOptions, languageOptions, specialtyOptions] = await Promise.all([
    ensureVerification(actor),
    activeTaxonomy("country"),
    activeTaxonomy("language"),
    activeTaxonomy("specialty"),
  ]);
  const missing = missingFrom(verification);
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
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
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
      {verification.state !== "approved" ? (
        <Card className="mt-5 border-slate-200 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lock className="h-4 w-4 text-slate-500" aria-hidden />
            {t("portal.onboarding.whyWeAsk")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {t("portal.onboarding.why")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t("portal.onboarding.privacy")}
          </p>
        </Card>
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
          languageOptions={languageOptions.map((o) => o.label)}
          specialtyOptions={specialtyOptions.map((o) => o.label)}
          requirements={overrides}
          uploadsEnabled={uploadsConfigured()}
        />
      </div>
    </div>
  );
}
