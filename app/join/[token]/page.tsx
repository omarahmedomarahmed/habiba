import type { Metadata } from "next";

import { JoinFlow } from "@/components/join/join-flow";
import { resolveJoinToken } from "@/lib/data/sessions";

export const metadata: Metadata = {
  title: "Join your session",
  // A join link must never be indexed, and the page must never be cached.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveJoinToken(token);

  if (!session) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-slate-900">This link is no longer active</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Session links expire after 12 hours and stop working once the session has finished. Ask
          your therapist to send you a new one.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <JoinFlow token={token} modality={session.modality} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="px-4 py-5 sm:px-6">
        <span className="text-[15px] font-bold tracking-tight text-navy-500">24Therapy</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center sm:px-6">
        <p className="text-xs text-slate-400">
          If you need urgent help, call or text 988 at any time.
        </p>
      </footer>
    </div>
  );
}
