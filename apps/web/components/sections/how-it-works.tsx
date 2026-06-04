import { MessageSquare, Search, Video, FileText, ArrowRight } from "lucide-react";

const stepsPatient = [
  { step: 1, icon: MessageSquare, title: "Chat with AI", desc: "Start with our AI — no signup needed. It helps assess your needs and urgency.", color: "bg-blue-100 text-blue-600" },
  { step: 2, icon: Search, title: "Get Matched", desc: "AI recommends the right therapist based on your needs, language, and budget.", color: "bg-purple-100 text-purple-600" },
  { step: 3, icon: Video, title: "Start Your Session", desc: "Book and meet your therapist via secure video, audio, or chat.", color: "bg-green-100 text-green-600" },
  { step: 4, icon: FileText, title: "Track Progress", desc: "View session summaries, progress reports, and mood trends in your portal.", color: "bg-orange-100 text-orange-600" },
];

const stepsTherapist = [
  { step: 1, icon: Search, title: "Create Your Profile", desc: "Set up your licensed profile, specializations, and availability in minutes.", color: "bg-blue-100 text-blue-600" },
  { step: 2, icon: Video, title: "Run Sessions", desc: "Conduct video sessions with built-in AI transcription running automatically.", color: "bg-purple-100 text-purple-600" },
  { step: 3, icon: FileText, title: "AI Writes Your Notes", desc: "Review AI-generated SOAP notes. Edit if needed. Approve. Done in 60 seconds.", color: "bg-green-100 text-green-600" },
  { step: 4, icon: MessageSquare, title: "Build Your Intelligence", desc: "Patient memories accumulate. Each session makes your AI smarter.", color: "bg-orange-100 text-orange-600" },
];

function StepList({ steps }: { steps: typeof stepsPatient }) {
  return (
    <div className="space-y-6">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              {i < steps.length - 1 && (
                <div className="w-0.5 h-6 bg-slate-200 mt-2" />
              )}
            </div>
            <div className="pt-1.5">
              <h4 className="font-semibold text-[#0A2342] mb-1">{step.title}</h4>
              <p className="text-sm text-slate-600">{step.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-[#F8FAFC]" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-4">
            How It Works
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Whether you're a patient seeking help or a therapist growing your practice — 
            24Therapy makes it seamless.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* For Patients */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">For Patients</div>
                <h3 className="text-xl font-bold text-[#0A2342]">Get Help Today</h3>
              </div>
            </div>
            <StepList steps={stepsPatient} />
            <a
              href="/signup?role=patient"
              className="mt-8 w-full flex items-center justify-center gap-2 bg-[#1F5EFF] text-white font-semibold py-3.5 rounded-xl hover:bg-[#0A2342] transition-colors"
            >
              Get Support Today
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* For Therapists */}
          <div className="bg-[#0A2342] rounded-3xl p-8 shadow-sm border border-white/10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wide font-semibold">For Therapists</div>
                <h3 className="text-xl font-bold text-white">Reclaim Your Time</h3>
              </div>
            </div>
            <div className="space-y-6">
              {stepsTherapist.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {i < stepsTherapist.length - 1 && (
                        <div className="w-0.5 h-6 bg-white/20 mt-2" />
                      )}
                    </div>
                    <div className="pt-1.5">
                      <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                      <p className="text-sm text-white/60">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <a
              href="/therapist-join"
              className="mt-8 w-full flex items-center justify-center gap-2 bg-[#1F5EFF] text-white font-semibold py-3.5 rounded-xl hover:bg-[#1649D4] transition-colors"
            >
              Join as a Therapist — It's Free
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
