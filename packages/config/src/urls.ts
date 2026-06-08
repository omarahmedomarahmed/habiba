/**
 * @24therapy/config — Centralized URL Configuration
 *
 * Single source of truth for all deployment URLs across the monorepo.
 * All values are driven by environment variables with Vercel URL fallbacks.
 */

// ─── App URLs ─────────────────────────────────────────────────────────────────

export const APP_URLS = {
  web:
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://24-web.vercel.app",

  therapist:
    process.env.NEXT_PUBLIC_THERAPIST_URL ||
    process.env.NEXT_PUBLIC_THERAPIST_APP_URL ||
    "https://24-therapist.vercel.app",

  patient:
    process.env.NEXT_PUBLIC_PATIENT_URL ||
    process.env.NEXT_PUBLIC_PATIENT_APP_URL ||
    "https://24-patient.vercel.app",

  admin:
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_APP_URL ||
    "https://24-admin.vercel.app",

  api:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    "https://api-24therapy-production.up.railway.app/api/v1",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the base API URL (no trailing slash) */
export function getApiUrl(): string {
  return APP_URLS.api.replace(/\/$/, "");
}

/** Builds a full API endpoint path */
export function buildApiEndpoint(path: string): string {
  const base = getApiUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Returns all allowed CORS origins for the backend */
export function getCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    APP_URLS.web,
    APP_URLS.therapist,
    APP_URLS.patient,
    APP_URLS.admin,
  ];
}
