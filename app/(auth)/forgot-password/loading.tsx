import { RouteLoading } from "@/components/patient/route-loading";

/**
 * 🔴 0165: the sign-in pages, while one is built. The layout is a pass-through
 * (each page renders its own shell), so the skeleton is the whole screen, the
 * same one the patient app shows.
 *
 * 🔴 Board 902, ruling N14: ONE PER SECTION, NOT ONE AT THE GROUP ROOT. The
 * group-root copy wrapped every sign-in door, and the console's first sign-in
 * sat on "One moment…" for thirty seconds, the same hang N14 moved every
 * portal's skeleton down for.
 */
export default function AuthLoading() {
  return <RouteLoading />;
}
