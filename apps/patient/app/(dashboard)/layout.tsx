import { PatientSidebar } from "@/components/layout/patient-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <PatientSidebar />
      <main className="flex-1 md:ml-[240px] overflow-hidden">
        {children}
      </main>
    </div>
  );
}
