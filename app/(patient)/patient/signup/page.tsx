import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function PatientSignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your record becomes yours: it travels with you, and you decide who reads it.
        </p>
      </div>
      <PatientAuthForm mode="signup" />
      <p className="text-center text-sm text-slate-500">
        Already have one?{" "}
        <Link href="/patient/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
