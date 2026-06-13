import { redirect } from "next/navigation";

// Therapist profiles redirect to find-therapist until public profiles are built
export default function TherapistProfilePage() {
  redirect("/find-therapist");
}

// Reviewed: 2026-06-13 — 24Therapy audit
