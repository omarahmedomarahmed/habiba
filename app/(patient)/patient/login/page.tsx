import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";
import { CodeSignInForm } from "@/components/patient/code-signin-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function PatientLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your sessions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to see your notes, your homework and who can read your record.
        </p>
      </div>
      <PatientAuthForm mode="signin" />

      {/*
        🔴 25.11 / C119 — the other way in, offered to everybody.
        
        A guest who joined a session on a phone number has no password and
        never chose one, and a page that offered the code route only to those
        accounts would be answering, to anybody holding a number, whether it
        belongs to a guest.
      */}
      <CodeSignInForm />

      {/*
        🔴 21R.5 / C94 — every door carries the way back in.

        A reset that exists and is not linked is a reset nobody has, which is
        how this one went eight sprints without being noticed at all.
      */}
      <p className="text-center text-sm text-slate-500">
        <Link href="/patient/forgot-password" className="hover:text-slate-800">
          Forgot your password?
        </Link>
      </p>

      <p className="text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/patient/signup" className="font-semibold text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      {/* 21R.2 — somebody at the wrong door is told where their own one is. */}
      <p className="text-center text-sm text-slate-500">
        Are you a therapist?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in to your practice
        </Link>
      </p>
    </main>
  );
}
