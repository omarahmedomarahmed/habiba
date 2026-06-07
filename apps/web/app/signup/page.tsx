import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account | 24Therapy.ai",
  description: "Start your free 14-day trial. No credit card required. Join thousands of therapists using AI to save 8+ hours per week on documentation.",
  robots: { index: false, follow: false },
};

/**
 * /signup — Account creation page.
 *
 * The page shell is a Server Component (metadata export works correctly).
 * The interactive form (which uses useSearchParams) is extracted to
 * SignupForm.tsx and wrapped in <Suspense> there — satisfying Next.js 15's
 * requirement that useSearchParams must be inside a Suspense boundary
 * during static generation.
 */
export default function SignupPage() {
  return <SignupForm />;
}
