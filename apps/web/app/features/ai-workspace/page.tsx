import { redirect } from "next/navigation";

// AI Workspace is the same as AI Scribe — redirect to canonical page
export default function AIWorkspacePage() {
  redirect("/ai-scribe");
}
