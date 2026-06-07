import { redirect } from "next/navigation";

// Use cases are covered by /for-therapists and /enterprise
export default function UseCasesPage() {
  redirect("/for-therapists");
}
