import { RouteLoading } from "@/components/patient/route-loading";

/**
 * 🔴 0165: the sign-in pages, while one is built. The layout is a pass-through
 * (each page renders its own shell), so the skeleton is the whole screen, the
 * same one the patient app shows.
 */
export default function AuthLoading() {
  return <RouteLoading />;
}
