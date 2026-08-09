import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/forms";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start documenting sessions in under a minute. Your first session is free.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
