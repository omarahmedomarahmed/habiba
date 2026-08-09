import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";

import { VerificationForm } from "@/components/onboarding/verification-form";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import {
  documentRequirements,
  ensureVerification,
  missingFrom,
} from "@/lib/data/verification";
import { COUNTRY_OPTIONS, RADAR_LANGUAGES, RADAR_SPECIALTIES } from "@/lib/geo";
import { uploadsConfigured } from "@/lib/uploads";

export const metadata: Metadata = { title: "Verify your practice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const actor = await requireUser();

  // An operator has no licence to upload and no queue to wait in.
  if (actor.role === "super_admin") redirect("/admin");

  const verification = await ensureVerification(actor);
  const missing = missingFrom(verification);
  const requirements = documentRequirements(verification.country);

  const urls: Record<string, string | null> = {
    idFront: verification.idFrontUrl,
    idBack: verification.idBackUrl,
    licenseDoc: verification.licenseDocUrl,
    headshot: verification.headshotUrl,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-10 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {verification.state === "approved" ? "You are verified" : "Verify your practice"}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {verification.state === "approved"
              ? "Everything is in order. You can run sessions, go on the Crisis Radar and take payments."
              : "One-off, before your first session. It takes about five minutes with your phone."}
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
            Why we ask
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            You will be treating vulnerable people, writing clinical records and taking payment
            through us. As a HIPAA business associate we have to know who is doing that, and so do
            our payment and insurance partners. It is also the only thing standing between a
            patient in crisis and someone who is not a therapist at all.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your ID and licence are seen only by our compliance team. They are never shown to
            patients, never shown to other clinicians and never used for anything else. Only your
            headshot, name, credentials, languages and specialties appear publicly.
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
          countryOptions={COUNTRY_OPTIONS}
          languageOptions={RADAR_LANGUAGES}
          specialtyOptions={RADAR_SPECIALTIES}
          uploadsEnabled={uploadsConfigured()}
        />
      </div>
    </div>
  );
}
