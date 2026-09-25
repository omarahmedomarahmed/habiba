import { RouteNotFound } from "@/components/patient/route-not-found";

/** The patient chrome already draws the orb, so this one does not. */
export default function PatientNotFound() {
  return <RouteNotFound home="/patient" withOrb={false} />;
}
