/**
 * domains.ts — Centralized Domain Configuration (Therapist Portal)
 * Single source of truth for all cross-app URLs.
 */

export const DOMAINS = {
  web: process.env.NEXT_PUBLIC_WEB_URL || "https://24therapy.ai",
  api: process.env.NEXT_PUBLIC_API_URL || "https://api.24therapy.ai/api/v1",
  therapistApp: process.env.NEXT_PUBLIC_APP_URL || "https://app.24therapy.ai",
  patientApp: process.env.NEXT_PUBLIC_PATIENT_APP_URL || "https://my.24therapy.ai",
  adminApp: process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.24therapy.ai",
} as const;

export const EMAILS = {
  hello: "hello@24therapy.ai",
  support: "support@24therapy.ai",
  providers: "providers@24therapy.ai",
} as const;
