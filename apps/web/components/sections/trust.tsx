import { Users, Clock, Star, Globe, ShieldCheck, Brain } from "lucide-react";

const stats = [
  { icon: Users, value: "2,500+", label: "Therapists Onboarded", color: "bg-blue-100 text-blue-600" },
  { icon: Brain, value: "50,000+", label: "Sessions Processed", color: "bg-purple-100 text-purple-600" },
  { icon: Clock, value: "< 5 min", label: "Avg Therapist Wait", color: "bg-green-100 text-green-600" },
  { icon: Star, value: "4.9/5", label: "Therapist Satisfaction", color: "bg-yellow-100 text-yellow-600" },
  { icon: Globe, value: "12+", label: "Countries Supported", color: "bg-orange-100 text-orange-600" },
  { icon: ShieldCheck, value: "100%", label: "HIPAA Compliant", color: "bg-teal-100 text-teal-600" },
];

export function TrustSection() {
  return (
    <section className="py-16 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#1F5EFF] mb-2">
            Trusted by mental health professionals worldwide
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-[#0A2342] mb-1">{stat.value}</div>
                <div className="text-xs text-slate-500 leading-tight">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Trust logos / Compliance badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {["HIPAA Compliant", "SOC 2 Type II", "GDPR Ready", "ISO 27001", "256-bit Encryption", "99.9% Uptime SLA"].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 font-medium shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-green-500" />
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
