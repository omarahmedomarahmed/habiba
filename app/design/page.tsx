import type { Metadata } from "next";

import { Hub } from "./hub";

export const metadata: Metadata = { title: "Overview" };

export default function DesignIndex() {
  return <Hub />;
}
