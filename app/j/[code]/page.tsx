import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";
import { Card } from "@/components/ui";
import { SosOrb } from "@/components/patient/sos-orb";
import { resolveCode } from "@/lib/data/therapist-codes";
import { optionalPatient } from "@/lib/patient-auth/guard";

export const metadata: Metadata = {
  title: "Join 24Therapy",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * What a scanned wall code opens. PLAN.md 25.17, C120.
 *
 * ## 🔴 What this page is careful not to do
 *
 * It does not pre-fill a phone number, it does not name a patient, and it does
 * not attach anybody to anybody. The code is public by construction, so
 * everything it can be trusted with is on the screen: the clinician's name and
 * the practice, so somebody standing in a waiting room knows they scanned the
 * right poster.
 *
 * Matching a record still runs afterwards through the ordinary door: a proven
 * phone or a proven email, then the full name challenge (25.14, 25.15, C114).
 * The code buys a person nothing except not having to type a URL.
 *
 * A revoked code gets a sentence rather than a 404. Somebody is reading this
 * in front of the poster, and "this code is no longer in use, ask at the desk"
 * is help, while "not found" is an accusation about their typing.
 */
export default async function ScanPage({ params }: { params: Promise<{ code: string }> }) {
  /* 🔴 C184 — the orb needs the reader's number to know whose crisis line to
     print. A stranger on a waiting-room floor has none, and gets the sentence
     that is true everywhere rather than another country's number. */
  const reader = await optionalPatient();
  const { code } = await params;
  const scanned = await resolveCode(code);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-4 py-8">
      {scanned.state === "live" ? (
        <>
          <Card className="border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
              You are joining
            </p>
            <p className="mt-1 text-base font-bold tracking-tight text-slate-900">
              {scanned.therapistName}
              {scanned.credentials ? (
                <span className="ms-1.5 text-sm font-medium text-slate-500">
                  {scanned.credentials}
                </span>
              ) : null}
            </p>
            {scanned.practiceName ? (
              <p className="mt-0.5 text-sm text-slate-600">{scanned.practiceName}</p>
            ) : null}
          </Card>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Your record becomes yours: it travels with you, and you decide who reads it. If this
              therapist already keeps notes about you, you can take ownership of them once your
              number is confirmed.
            </p>
          </div>

          <PatientAuthForm mode="signup" />

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/patient/login" className="font-semibold text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <Card className="p-5">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {scanned.state === "revoked" ? "This code is no longer in use" : "We do not know that code"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {scanned.state === "revoked"
              ? "The poster it came from is out of date. Ask at the desk for a current one, or create an account here and find your therapist afterwards."
              : "Check the eight characters on the poster. It has no letter O and no number 0."}
          </p>
          <Link
            href="/patient/signup"
            className="mt-4 inline-flex text-sm font-semibold text-brand-600"
          >
            Create an account anyway
          </Link>
        </Card>
      )}

      {/* 🔴 25.5 / C125 — a stranger on a waiting-room floor gets the orb too. */}
      <SosOrb phone={reader?.phone ?? null} />
    </main>
  );
}
