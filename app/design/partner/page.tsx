import type { Metadata } from "next";

import { PartnerPortal } from "./portal";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Partner portal" };

export default async function PartnerDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <PartnerPortal />;
}
