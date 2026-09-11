/**
 * Every page in the product, and who is meant to see it.
 *
 * 37R.23g asks for ONE table covering every page, so the list is the whole
 * `app/**\/page.tsx` inventory rather than the interesting subset. A route that
 * needs an id carries a `needs` key, and the sweep fills it from what the
 * walkthrough actually created — a page nobody could reach with real data is
 * recorded as unreachable rather than quietly dropped.
 */
export const ROUTES = [
  /* ---------------------------------------------------------- public -- */
  { path: "/", who: "out", group: "public" },
  { path: "/for-patients", who: "out", group: "public", cms: true },
  { path: "/for-clinics", who: "out", group: "public" },
  { path: "/developers", who: "out", group: "public" },
  { path: "/integrations", who: "out", group: "public" },
  { path: "/integrations/whatsapp", who: "out", group: "public", cms: true },
  { path: "/radar", who: "out", group: "public" },
  { path: "/verify", who: "out", group: "public" },
  { path: "/privacy", who: "out", group: "public", cms: true },
  { path: "/terms", who: "out", group: "public", cms: true },
  { path: "/login", who: "out", group: "auth" },
  { path: "/signup", who: "out", group: "auth" },
  { path: "/forgot-password", who: "out", group: "auth" },
  { path: "/reset-password", who: "out", group: "auth" },
  { path: "/staff/sign-in", who: "out", group: "auth" },
  { path: "/patient/login", who: "out", group: "auth" },
  { path: "/patient/signup", who: "out", group: "auth" },
  { path: "/patient/forgot-password", who: "out", group: "auth" },

  /* ------------------------------------------------------- therapist -- */
  { path: "/dashboard", who: "therapist", group: "portal" },
  { path: "/sessions", who: "therapist", group: "portal" },
  { path: "/sessions/new", who: "therapist", group: "portal" },
  { path: "/sessions/:session", who: "therapist", group: "portal", needs: "session" },
  { path: "/sessions/:session/room", who: "therapist", group: "portal", needs: "session" },
  { path: "/patients", who: "therapist", group: "portal" },
  { path: "/patients/:patient", who: "therapist", group: "portal", needs: "patient" },
  { path: "/patients/:patient/documents", who: "therapist", group: "portal", needs: "patient" },
  { path: "/patients/:patient/evidence", who: "therapist", group: "portal", needs: "patient" },
  { path: "/notes", who: "therapist", group: "portal" },
  { path: "/copilot", who: "therapist", group: "portal" },
  { path: "/copilot/:patient", who: "therapist", group: "portal", needs: "patient" },
  { path: "/assistant", who: "therapist", group: "portal" },
  { path: "/on-call", who: "therapist", group: "portal" },
  { path: "/earnings", who: "therapist", group: "portal" },
  { path: "/billing", who: "therapist", group: "portal" },
  { path: "/connect", who: "therapist", group: "portal" },
  { path: "/settings", who: "therapist", group: "portal" },
  { path: "/settings/codes", who: "therapist", group: "portal" },
  { path: "/support", who: "therapist", group: "portal" },
  { path: "/onboarding", who: "therapist", group: "portal" },

  /* --------------------------------------------------------- patient -- */
  { path: "/patient", who: "patient", group: "patient" },
  { path: "/patient/sessions", who: "patient", group: "patient" },
  { path: "/patient/homework", who: "patient", group: "patient" },
  { path: "/patient/journal", who: "patient", group: "patient" },
  { path: "/patient/summary", who: "patient", group: "patient" },
  { path: "/patient/record", who: "patient", group: "patient" },
  { path: "/patient/profile", who: "patient", group: "patient" },
  { path: "/patient/account", who: "patient", group: "patient" },
  { path: "/patient/billing", who: "patient", group: "patient" },
  { path: "/patient/browse", who: "patient", group: "patient" },
  { path: "/patient/radar", who: "patient", group: "patient" },
  { path: "/patient/claim", who: "patient", group: "patient" },
  { path: "/patient/consent", who: "patient", group: "patient" },
  { path: "/patient/residency", who: "patient", group: "patient" },

  /* ----------------------------------------------------------- admin -- */
  { path: "/admin", who: "admin", group: "admin" },
  { path: "/admin/verifications", who: "admin", group: "admin" },
  { path: "/admin/therapists", who: "admin", group: "admin" },
  { path: "/admin/support", who: "admin", group: "admin" },
  { path: "/admin/numbers", who: "admin", group: "admin" },
  { path: "/admin/radar", who: "admin", group: "admin" },
  { path: "/admin/payouts", who: "admin", group: "admin" },
  { path: "/admin/ratings", who: "admin", group: "admin" },
  { path: "/admin/vault", who: "admin", group: "admin" },
  { path: "/admin/taxonomy", who: "admin", group: "admin" },
  { path: "/admin/announce", who: "admin", group: "admin" },
  { path: "/admin/content", who: "admin", group: "admin" },
  { path: "/admin/settings", who: "admin", group: "admin" },
  { path: "/admin/strings", who: "admin", group: "admin" },
  { path: "/admin/audit", who: "admin", group: "admin" },
  { path: "/admin/usage", who: "admin", group: "admin" },
  { path: "/admin/errors", who: "admin", group: "admin" },
  { path: "/admin/tv", who: "admin", group: "admin" },
];
