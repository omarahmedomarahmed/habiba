import type { Metadata } from "next";

import { TherapistWorkspace } from "./workspace";

export const metadata: Metadata = { title: "Therapist workspace" };

export default function TherapistDesign() {
  return <TherapistWorkspace />;
}
