import Link from "next/link";
import { ArrowRight, Brain, Users, Shield } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#1F5EFF]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#24C8DB]/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Brain className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          The Future of Mental Healthcare{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#24C8DB]">
            Starts Here.
          </span>
        </h2>

        <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
          Join thousands of therapists who are saving hours each week, growing their practices, 
          and providing better care — all powered by AI.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-[#1F5EFF]/30 hover:shadow-xl transition-all text-lg"
          >
            Start Free — No Credit Card
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/find-therapist"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-2xl border border-white/20 transition-all text-lg backdrop-blur-sm"
          >
            <Users className="w-5 h-5" />
            Find a Therapist
          </Link>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Shield className="w-4 h-4 text-green-400" />
            <span>HIPAA & GDPR Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span>99.9% Uptime SLA</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
            <span>256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-2 h-2 bg-purple-400 rounded-full" />
            <span>SOC 2 Type II</span>
          </div>
        </div>
      </div>
    </section>
  );
}
