import type { Metadata } from "next";

import { ClinicPortal } from "./portal";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Clinic portal" };

export default async function ClinicDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <ClinicPortal />;
}
