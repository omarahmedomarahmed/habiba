import type { Metadata } from "next";

import { PatientSample } from "./sample";

export const metadata: Metadata = { title: "Patient app" };

export default function PatientDesign() {
  return <PatientSample />;
}
