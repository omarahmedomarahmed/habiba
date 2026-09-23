import type { Metadata } from "next";

import { ClinicPortal } from "./portal";

export const metadata: Metadata = { title: "Clinic portal" };

export default function ClinicDesign() {
  return <ClinicPortal />;
}
