import type { Metadata } from "next";

import { CompanyPortal } from "./portal";

export const metadata: Metadata = { title: "Company portal" };

export default function CompanyDesign() {
  return <CompanyPortal />;
}
