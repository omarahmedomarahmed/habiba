import type { Metadata } from "next";

import { CompaniesPage } from "../_site/pages";

export const metadata: Metadata = { title: "Website: for companies" };

export default function Page() {
  return <CompaniesPage />;
}
