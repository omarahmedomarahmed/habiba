import { redirect } from "next/navigation";

// Therapist directory consolidated into /find-therapist
export default function TherapistsDirectoryPage() {
  redirect("/find-therapist");
}
