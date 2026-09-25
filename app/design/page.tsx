import type { Metadata } from "next";

import { Hub } from "./hub";
import { guardDesignGallery } from "./_ds/guard";

export const metadata: Metadata = { title: "Overview" };

export default async function DesignIndex() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <Hub />;
}
