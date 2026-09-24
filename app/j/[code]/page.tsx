import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";
import { ConnectCodeForm } from "@/components/patient/connect-code-form";
import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { crisisCountryFor } from "@/lib/crisis/line";
import { SosOrbServer } from "@/components/patient/sos-orb-server";
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
 * It does not pre-fill a phone number and it does not name a patient. The code
 * is public by construction, so everything it can be trusted with is on the
 * screen: the clinician's name and the practice, so somebody standing in a
 * waiting room knows they scanned the right poster.
 *
 * 🔴 W2-P13: it DOES connect the person who acts on it to that clinician, once
 * they have an account (signup carries the code; a signed-in reader presses
 * one button). That is what "You are joining" says, and until now nothing did
 * it. The connection is a file with the name they gave, and nothing more.
 *
 * Matching a record still runs afterwards through the ordinary door: a proven
 * phone or a proven email, then the full name challenge (25.14, 25.15, C114).
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
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-4 py-8">
      {scanned.state === "live" ? (
        <>
          <Card className="border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
              {t("pcode.youAreJoining")}
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

          {/*
            🔴 W2-P13: signed in, one button; signed out, signup carrying the
            code. Either way the account is connected to this clinician, which
            is what "You are joining" said and nothing did.
          */}
          {reader ? (
            /* 🔴 P15: a press that connected nothing now says so here. */
            <ConnectCodeForm code={code} />
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {t("pcode.createAccount")}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("pauth.signUpBody")}</p>
              </div>

              <PatientAuthForm mode="signup" wallCode={code} />

              <p className="text-center text-sm text-slate-500">
                {t("nav.haveAccount")}{" "}
                <Link
                  href={`/patient/login?next=${encodeURIComponent(`/j/${code}`)}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {t("pcode.signIn")}
                </Link>
              </p>
            </>
          )}
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
            className="mt-4 inline-flex text-sm font-semibold text-brand-700"
          >
            Create an account anyway
          </Link>
        </Card>
      )}

      {/* 🔴 25.5 / C125 — a stranger on a waiting-room floor gets the orb too. */}
      <SosOrbServer
        phone={reader?.phone ?? null}
        country={crisisCountryFor({ locale: (await getI18n()).locale })}
      />
    </main>
  );
}
