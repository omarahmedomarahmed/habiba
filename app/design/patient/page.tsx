import type { Metadata } from "next";

import { PatientSample } from "./sample";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Patient app" };

export default async function PatientDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <PatientSample />;
}
