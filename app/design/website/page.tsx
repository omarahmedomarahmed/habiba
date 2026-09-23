import type { Metadata } from "next";

import { Homepage } from "./homepage";

export const metadata: Metadata = { title: "Website" };

export default function WebsiteSample() {
  return <Homepage />;
}
