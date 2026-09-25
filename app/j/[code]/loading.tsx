import { RouteLoading } from "@/components/patient/route-loading";

/** 🔴 W3: a token page outside every layout, so the orb comes with the skeleton. */
export default function WallCodeLoading() {
  return <RouteLoading withOrb />;
}
