/**
 * domains.ts — Centralized Domain Configuration (Admin Portal)
 * Single source of truth for all cross-app URLs.
 * Set env vars in Vercel project settings — never hardcode URLs here.
 */

export const DOMAINS = {
  web:
    process.env.NEXT_PUBLIC_WEB_URL ||
    "https://24-web.vercel.app",
  api:
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api-24therapy-production.up.railway.app/api/v1",
  therapistApp:
    process.env.NEXT_PUBLIC_THERAPIST_URL ||
    process.env.NEXT_PUBLIC_THERAPIST_APP_URL ||
    "https://24-therapist.vercel.app",
  patientApp:
    process.env.NEXT_PUBLIC_PATIENT_URL ||
    process.env.NEXT_PUBLIC_PATIENT_APP_URL ||
    "https://24-patient.vercel.app",
  adminApp:
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://24-admin.vercel.app",
} as const;

export const EMAILS = {
  hello: "hello@24therapy.ai",
  support: "support@24therapy.ai",
  legal: "legal@24therapy.ai",
} as const;

// Reviewed: 2026-06-13 — 24Therapy audit
