import type { Metadata } from "next";

import { PartnerPortal } from "./portal";

export const metadata: Metadata = { title: "Partner portal" };

export default function PartnerDesign() {
  return <PartnerPortal />;
}
