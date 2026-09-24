import { RouteLoading } from "@/components/patient/route-loading";

/** 🔴 P19: the pay page draws its orb itself, so the skeleton carries one too. */
export default function PayLoading() {
  return <RouteLoading withOrb />;
}
