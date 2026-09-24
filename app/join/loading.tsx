import { RouteLoading } from "@/components/patient/route-loading";

/** 🔴 P19: the join page draws its orb in its own chrome, so the skeleton carries one too. */
export default function JoinLoading() {
  return <RouteLoading withOrb />;
}
