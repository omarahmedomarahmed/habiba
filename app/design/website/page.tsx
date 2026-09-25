import type { Metadata } from "next";

import { Homepage } from "./home";
import { guardDesignGallery } from "../_ds/guard";

export const metadata: Metadata = { title: "Website" };

export default async function WebsiteSample() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <Homepage />;
}
