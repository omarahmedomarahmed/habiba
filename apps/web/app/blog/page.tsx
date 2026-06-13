import Link from "next/link";
import { Calendar, Clock, ChevronRight, Tag, User, ArrowRight, BookOpen, TrendingUp, Brain, Shield, Heart, Sparkles, Search } from "lucide-react";

const BLOG_CATEGORIES = [
  { id: "all", label: "All Articles", count: 24 },
  { id: "ai-therapy", label: "AI in Therapy", count: 8 },
  { id: "clinical-practice", label: "Clinical Practice", count: 7 },
  { id: "mental-health", label: "Mental Health", count: 5 },
  { id: "technology", label: "Technology", count: 4 },
];

const FEATURED_POST = {
  slug: "ai-copilot-session-notes",
  category: "AI in Therapy",
  title: "How AI Copilots Are Changing What Happens Inside the Therapy Room",
  excerpt: "Real-time session intelligence doesn't replace clinical judgment — it amplifies it. We explore how AI is enabling therapists to be more present, more insightful, and more effective in every session.",
  author: { name: "Dr. Aisha Khalil", role: "Clinical Director", initials: "AK" },
  date: "December 12, 2025",
  read_time: "8 min read",
  image_placeholder: "from-indigo-600 to-blue-700",
  tags: ["AI Copilot", "Session Notes", "Clinical Intelligence"],
};

const BLOG_POSTS = [
  {
    slug: "mental-health-memory-layer",
    category: "AI in Therapy",
    title: "The Mental Health Memory Layer: Why AI Needs to Remember Across Sessions",
    excerpt: "Patient care is longitudinal. A therapist working with someone for 2 years builds an intricate model of their history. Here's how AI memory systems are being built to mirror that depth.",
    author: { name: "Dr. Marcus Chen", role: "AI Research Lead", initials: "MC" },
    date: "December 8, 2025",
    read_time: "11 min read",
    category_color: "bg-indigo-100 text-indigo-700",
    tags: ["Memory Layer", "Longitudinal Care"],
  },
  {
    slug: "crisis-radar-ai-risk",
    category: "Clinical Practice",
    title: "Predicting the Unpredictable: How AI Risk Models Are Approaching Crisis Prevention",
    excerpt: "Can a platform detect early warning signs of a mental health crisis before it becomes acute? We examine the promise and limits of AI risk detection in clinical settings.",
    author: { name: "Sarah Mitchell, LCSW", role: "Clinical Advisor", initials: "SM" },
    date: "December 5, 2025",
    read_time: "9 min read",
    category_color: "bg-rose-100 text-rose-700",
    tags: ["Crisis Prevention", "Risk Assessment", "AI Safety"],
  },
  {
    slug: "soap-notes-ai-efficiency",
    category: "Clinical Practice",
    title: "SOAP Notes in 90 Seconds: The Real Impact of AI-Assisted Documentation on Therapist Burnout",
    excerpt: "Administrative burden is the #1 driver of therapist burnout. We surveyed 200 clinicians and measured the actual time and emotional cost of documentation — and what happens when AI takes it over.",
    author: { name: "Dr. Priya Nath", role: "Research Psychologist", initials: "PN" },
    date: "December 1, 2025",
    read_time: "7 min read",
    category_color: "bg-emerald-100 text-emerald-700",
    tags: ["Documentation", "Burnout", "Efficiency"],
  },
  {
    slug: "hipaa-ai-compliance",
    category: "Technology",
    title: "HIPAA, AI, and Patient Data: What Every Mental Health Clinician Needs to Know in 2026",
    excerpt: "As AI tools proliferate in healthcare, the compliance landscape is shifting rapidly. We break down what HIPAA-compliant AI looks like, what risks to watch for, and how to evaluate any platform you're considering.",
    author: { name: "James Torres, JD", role: "Healthcare Compliance Counsel", initials: "JT" },
    date: "November 28, 2025",
    read_time: "12 min read",
    category_color: "bg-amber-100 text-amber-700",
    tags: ["HIPAA", "Compliance", "Privacy"],
  },
  {
    slug: "knowledge-graph-patient-intelligence",
    category: "AI in Therapy",
    title: "Knowledge Graphs in Mental Health: Building Patient Intelligence That Compounds Over Time",
    excerpt: "Session notes are static. A knowledge graph is alive. We explain how structured patient memory — built from every session, assessment, and observation — creates a clinical intelligence layer that gets smarter with every interaction.",
    author: { name: "Dr. Aisha Khalil", role: "Clinical Director", initials: "AK" },
    date: "November 22, 2025",
    read_time: "10 min read",
    category_color: "bg-indigo-100 text-indigo-700",
    tags: ["Knowledge Graph", "Patient Intelligence"],
  },
  {
    slug: "therapist-marketplace-matching",
    category: "Mental Health",
    title: "Better Therapist-Patient Matching: How Algorithms Are Improving Treatment Outcomes",
    excerpt: "Fit matters enormously in therapy. A mismatch of therapeutic style, specialty, or approach can cost patients months of progress. Here's how data-driven matching is transforming how patients find their therapist.",
    author: { name: "Amara Jones, PhD", role: "Clinical Psychologist", initials: "AJ" },
    date: "November 18, 2025",
    read_time: "8 min read",
    category_color: "bg-blue-100 text-blue-700",
    tags: ["Matching", "Patient Access", "Marketplace"],
  },
  {
    slug: "cbt-ai-augmentation",
    category: "Clinical Practice",
    title: "Augmenting CBT: How AI Tools Are Extending Evidence-Based Therapy Beyond the 50-Minute Hour",
    excerpt: "CBT's effectiveness is well established — but what happens to homework compliance, between-session engagement, and skill reinforcement when AI tools enter the picture?",
    author: { name: "Dr. Marcus Chen", role: "AI Research Lead", initials: "MC" },
    date: "November 14, 2025",
    read_time: "9 min read",
    category_color: "bg-purple-100 text-purple-700",
    tags: ["CBT", "AI Tools", "Evidence-Based"],
  },
  {
    slug: "telehealth-mental-health-2026",
    category: "Technology",
    title: "Telehealth in 2026: The Mental Health Technology Stack Every Practice Needs",
    excerpt: "The post-pandemic telehealth boom has matured into a permanent shift. We review the essential technology infrastructure for modern mental health practices — from video to EHR to AI.",
    author: { name: "Sarah Mitchell, LCSW", role: "Clinical Advisor", initials: "SM" },
    date: "November 10, 2025",
    read_time: "10 min read",
    category_color: "bg-teal-100 text-teal-700",
    tags: ["Telehealth", "Technology", "Practice Management"],
  },
];

const RESOURCES = [
  { icon: BookOpen, title: "Clinical Guide: AI Documentation", description: "Complete guide to AI-assisted note-taking", href: "#" },
  { icon: Shield, title: "HIPAA Compliance Checklist", description: "Essential compliance for AI tools in practice", href: "#" },
  { icon: Brain, title: "AI Copilot Webinar", description: "Live demo with practicing clinicians", href: "#" },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0d2d54] to-[#1a3a6b] text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-[#2EC4B6]" />
              <span className="text-[#2EC4B6] text-sm font-semibold uppercase tracking-wide">Clinical Intelligence Blog</span>
            </div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              The Future of Mental Health
              <span className="text-[#2EC4B6]"> Technology</span>
            </h1>
            <p className="text-xl text-white/70 leading-relaxed mb-8">
              Deep dives on AI in therapy, clinical practice transformation, and the tools redefining mental healthcare. Written by clinicians, researchers, and technologists.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search articles..."
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]/50"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Category filters */}
        <div className="flex flex-wrap gap-3 mb-12">
          {BLOG_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.id === "all" ? "/blog" : `/blog?category=${cat.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                cat.id === "all"
                  ? "bg-[#0A2342] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                cat.id === "all" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
              }`}>{cat.count}</span>
            </Link>
          ))}
        </div>

        {/* Featured post */}
        <div className="mb-16">
          <div className={`rounded-3xl bg-gradient-to-br ${FEATURED_POST.image_placeholder} overflow-hidden`}>
            <div className="grid md:grid-cols-5 min-h-[400px]">
              <div className="md:col-span-3 p-10 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    Featured
                  </span>
                  <span className="bg-white/20 text-white text-xs px-3 py-1.5 rounded-full">
                    {FEATURED_POST.category}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                  {FEATURED_POST.title}
                </h2>
                <p className="text-white/80 text-base leading-relaxed mb-6">
                  {FEATURED_POST.excerpt}
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {FEATURED_POST.author.initials}
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{FEATURED_POST.author.name}</div>
                    <div className="text-white/60 text-xs">{FEATURED_POST.author.role}</div>
                  </div>
                  <span className="text-white/40 text-xs ml-4">{FEATURED_POST.date}</span>
                  <span className="text-white/40 text-xs">· {FEATURED_POST.read_time}</span>
                </div>
                <Link
                  href={`/blog/${FEATURED_POST.slug}`}
                  className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold px-6 py-3 rounded-2xl hover:bg-white/90 transition-colors w-fit"
                >
                  Read Article <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="md:col-span-2 flex items-center justify-center p-10">
                <div className="text-center">
                  <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <Brain className="h-12 w-12 text-white/60" />
                  </div>
                  <div className="space-y-2">
                    {FEATURED_POST.tags.map((tag) => (
                      <div key={tag} className="bg-white/10 text-white/80 text-xs px-3 py-1.5 rounded-full">
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Article grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="bg-white border border-gray-200 rounded-3xl overflow-hidden hover:shadow-lg transition-all duration-200 group">
              {/* Colored header bar */}
              <div className="h-2 bg-gradient-to-r from-[#0A2342] to-[#2EC4B6]" />

              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.category_color}`}>
                    {post.category}
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-3 group-hover:text-[#0A2342] transition-colors">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>

                <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {post.tags.map((tag) => (
                    <span key={tag} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#0A2342] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                      {post.author.initials}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-900">{post.author.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {post.read_time}
                  </div>
                </div>

                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#0A2342] hover:text-[#2EC4B6] transition-colors"
                >
                  Read article <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Resources section */}
        <div className="bg-gray-50 rounded-3xl p-10 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Free Clinical Resources</h2>
            <p className="text-gray-600">Guides, checklists, and webinars for mental health professionals</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {RESOURCES.map((resource) => {
              const Icon = resource.icon;
              return (
                <Link
                  key={resource.title}
                  href={resource.href}
                  className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-[#0A2342] hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 bg-[#0A2342]/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#0A2342]" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-[#0A2342]">{resource.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{resource.description}</p>
                  <span className="text-sm font-medium text-[#2EC4B6] flex items-center gap-1">
                    Download Free <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-3xl p-12 text-center text-white">
          <div className="max-w-xl mx-auto">
            <div className="w-14 h-14 bg-[#2EC4B6]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-7 w-7 text-[#2EC4B6]" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Stay at the Frontier</h2>
            <p className="text-white/70 mb-8">
              Join 8,000+ mental health professionals receiving weekly insights on AI, clinical practice, and the future of therapy.
            </p>
            <div className="flex gap-3 max-w-sm mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]/50"
              />
              <button className="px-6 py-3 bg-[#2EC4B6] text-white font-semibold rounded-2xl hover:bg-[#25a99d] transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
            <p className="text-white/40 text-xs mt-4">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
