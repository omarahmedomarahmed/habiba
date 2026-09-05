import type { Metadata } from "next";
import Link from "next/link";

import { PatientAuthForm } from "@/components/patient/auth-form";

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
      <p className="text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/patient/signup" className="font-semibold text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
