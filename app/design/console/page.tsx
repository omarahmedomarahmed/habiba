import type { Metadata } from "next";

import { ConsolePortal } from "./portal";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Operations console" };

export default async function ConsoleDesign() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <ConsolePortal />;
}
