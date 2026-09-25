import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";
import { ConnectCodeForm } from "@/components/patient/connect-code-form";
import { Card } from "@/components/patient/kit";
import { getI18n } from "@/lib/i18n/server";
import { crisisCountryFor } from "@/lib/crisis/line";
import { SosOrbServer } from "@/components/patient/sos-orb-server";
import { resolveCode } from "@/lib/data/therapist-codes";
import { optionalPatient } from "@/lib/patient-auth/guard";

/** W3: the tab title in the reader's language. A join or pay link is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.join24"), robots: { index: false, follow: false } };
}
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
    <main className="mx-auto flex flex-col min-h-dvh w-full max-w-lg gap-5 px-5 pt-16 pb-10">
      {scanned.state === "live" ? (
        <>
          <Card className="border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
              {t("pcode.youAreJoining")}
            </p>
            <p className="mt-1 text-base font-bold tracking-tight text-navy-700">
              {scanned.therapistName}
              {scanned.credentials ? (
                <span className="ms-1.5 text-sm font-medium text-navy-400">
                  {scanned.credentials}
                </span>
              ) : null}
            </p>
            {scanned.practiceName ? (
              <p className="mt-0.5 text-sm text-navy-400">{scanned.practiceName}</p>
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
                <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">
                  {t("pcode.createAccount")}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("pauth.signUpBody")}</p>
              </div>

              <PatientAuthForm mode="signup" wallCode={code} />

              <p className="text-center text-sm text-navy-400">
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
          <h1 className="text-[26px] leading-tight font-bold tracking-tight text-balance text-navy-700">
            {scanned.state === "revoked" ? t("pcode.revoked") : t("pcode.unknown")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-400">
            {scanned.state === "revoked" ? t("pcode.revokedBody") : t("pcode.unknownBody")}
          </p>
          <Link
            href="/patient/signup"
            className="mt-4 inline-flex text-sm font-semibold text-brand-700"
          >
            {t("pcode.anyway")}
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
