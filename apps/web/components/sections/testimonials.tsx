import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Dr. Sara Ahmed",
    role: "Clinical Psychologist",
    location: "Cairo, Egypt",
    avatar: "SA",
    rating: 5,
    text: "24Therapy has completely transformed my practice. I used to spend 2+ hours after clinic writing notes. Now AI handles it in 30 seconds. The clinical copilot is like having a brilliant colleague in the room.",
    highlight: "2+ hours saved daily",
  },
  {
    name: "Dr. Omar Hassan",
    role: "Psychiatrist",
    location: "Dubai, UAE",
    avatar: "OH",
    rating: 5,
    text: "The patient memory system is remarkable. It surfaces information from sessions 6 months ago that I would never remember. My patients feel truly heard because I can reference their complete history.",
    highlight: "Complete patient context",
  },
  {
    name: "Leila Mansour",
    role: "Patient",
    location: "Egypt",
    avatar: "LM",
    rating: 5,
    text: "I was skeptical about AI in therapy, but the initial chat helped me understand exactly what I needed. I was matched with my therapist the same day. The progress tracking motivates me to keep going.",
    highlight: "Found therapist same day",
  },
  {
    name: "Dr. Yasmine Khalil",
    role: "Practice Owner",
    location: "Riyadh, Saudi Arabia",
    avatar: "YK",
    rating: 5,
    text: "Managing 8 therapists was chaos before 24Therapy. Now I have complete visibility into all sessions, billing, and outcomes from one dashboard. My admin workload dropped by 60%.",
    highlight: "60% less admin work",
  },
  {
    name: "Ahmed Mostafa",
    role: "Therapist",
    location: "Alexandria, Egypt",
    avatar: "AM",
    rating: 5,
    text: "The Radar feature changed my income completely. I pick up 3-4 additional sessions per week from patients who need immediate help. The AI-generated notes mean I barely stay late anymore.",
    highlight: "+4 sessions/week income",
  },
  {
    name: "Dr. Nora Qasim",
    role: "Child & Adolescent Therapist",
    location: "Jordan",
    avatar: "NQ",
    rating: 5,
    text: "I was worried AI would feel impersonal, but the copilot actually makes sessions MORE human. It reminds me to follow up on things I might miss. My clients report feeling more supported than ever.",
    highlight: "More human, not less",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 bg-white" id="testimonials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-4">
            Loved by Therapists & Patients
          </h2>
          <p className="text-xl text-slate-600">
            Real stories from real mental health professionals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow"
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>

              {/* Quote */}
              <div className="relative mb-4">
                <Quote className="w-8 h-8 text-[#1F5EFF]/20 absolute -top-1 -left-1" />
                <p className="text-slate-700 text-sm leading-relaxed pl-4">{t.text}</p>
              </div>

              {/* Highlight badge */}
              <div className="inline-flex items-center gap-1 bg-[#EEF2FF] text-[#1F5EFF] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                ✓ {t.highlight}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-[#0A2342] text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.role} · {t.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
