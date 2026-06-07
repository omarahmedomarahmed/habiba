/**
 * domains.ts — Centralized Domain Configuration
 *
 * Single source of truth for ALL URLs across the marketing website.
 * Never hardcode domain URLs — always import from this file.
 *
 * Environment variables override defaults (set in Vercel project settings):
 *   NEXT_PUBLIC_SITE_URL          → marketing site
 *   NEXT_PUBLIC_API_URL           → backend API
 *   NEXT_PUBLIC_THERAPIST_APP_URL → therapist portal
 *   NEXT_PUBLIC_PATIENT_APP_URL   → patient portal
 *   NEXT_PUBLIC_ADMIN_APP_URL     → admin portal
 *
 * Temporary Vercel preview URLs (set until custom domains go live):
 *   NEXT_PUBLIC_SITE_URL=https://24-web.vercel.app
 *   NEXT_PUBLIC_THERAPIST_APP_URL=https://24-therapist.vercel.app
 *   NEXT_PUBLIC_PATIENT_APP_URL=https://24-patient.vercel.app
 *   NEXT_PUBLIC_ADMIN_APP_URL=https://24-admin.vercel.app
 */

// ─── Core Domains ─────────────────────────────────────────────────────────────

export const DOMAINS = {
  /** Marketing website — 24therapy.ai */
  web: process.env.NEXT_PUBLIC_SITE_URL || "https://24therapy.ai",

  /** Backend API — api.24therapy.ai */
  api: process.env.NEXT_PUBLIC_API_URL || "https://api.24therapy.ai/api/v1",

  /** Therapist portal — app.24therapy.ai */
  therapistApp: process.env.NEXT_PUBLIC_THERAPIST_APP_URL || "https://app.24therapy.ai",

  /** Patient portal — my.24therapy.ai */
  patientApp: process.env.NEXT_PUBLIC_PATIENT_APP_URL || "https://my.24therapy.ai",

  /** Admin portal — admin.24therapy.ai */
  adminApp: process.env.NEXT_PUBLIC_ADMIN_APP_URL || "https://admin.24therapy.ai",
} as const;

// ─── Email Addresses ──────────────────────────────────────────────────────────

export const EMAILS = {
  hello: "hello@24therapy.ai",
  support: "support@24therapy.ai",
  sales: "sales@24therapy.ai",
  security: "security@24therapy.ai",
  legal: "legal@24therapy.ai",
  privacy: "privacy@24therapy.ai",
  press: "press@24therapy.ai",
  careers: "careers@24therapy.ai",
  providers: "providers@24therapy.ai",
  enterprise: "enterprise@24therapy.ai",
} as const;

// ─── External Links ───────────────────────────────────────────────────────────

export const SOCIAL = {
  twitter: "https://twitter.com/24therapyai",
  linkedin: "https://linkedin.com/company/24therapyai",
} as const;

export const EXTERNAL = {
  calendly: process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/24therapy/demo",
  statusPage: "https://status.24therapy.ai",
} as const;

// ─── Auth URLs ────────────────────────────────────────────────────────────────

export const AUTH_URLS = {
  therapistLogin: `${DOMAINS.therapistApp}/login`,
  therapistSignup: `${DOMAINS.web}/signup?role=therapist`,
  therapistOnboarding: `${DOMAINS.therapistApp}/onboarding`,

  patientLogin: `${DOMAINS.patientApp}/login`,
  patientSignup: `${DOMAINS.web}/signup?role=patient`,
  patientOnboarding: `${DOMAINS.patientApp}/onboarding`,

  adminLogin: `${DOMAINS.adminApp}/login`,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the login URL for a given role */
export function getLoginUrl(role: "therapist" | "patient" | "admin"): string {
  switch (role) {
    case "therapist": return AUTH_URLS.therapistLogin;
    case "patient":   return AUTH_URLS.patientLogin;
    case "admin":     return AUTH_URLS.adminLogin;
  }
}

/** Returns the onboarding URL for a given role */
export function getOnboardingUrl(role: "therapist" | "patient"): string {
  return role === "therapist"
    ? AUTH_URLS.therapistOnboarding
    : AUTH_URLS.patientOnboarding;
}

/** Build a mailto href */
export function mailto(address: string, subject?: string): string {
  return subject
    ? `mailto:${address}?subject=${encodeURIComponent(subject)}`
    : `mailto:${address}`;
}
