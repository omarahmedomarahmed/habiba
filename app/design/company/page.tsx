import type { Metadata } from "next";

import { CompanyPortal } from "./portal";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Company portal" };

export default async function CompanyDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <CompanyPortal />;
}
