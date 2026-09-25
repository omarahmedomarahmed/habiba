import type { Metadata } from "next";

import { TherapistWorkspace } from "./workspace";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Therapist workspace" };

export default async function TherapistDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <TherapistWorkspace />;
}
