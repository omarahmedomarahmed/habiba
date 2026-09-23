import type { Metadata } from "next";

import { ConsolePortal } from "./portal";

export const metadata: Metadata = { title: "Operations console" };

export default function ConsoleDesign() {
  return <ConsolePortal />;
}
