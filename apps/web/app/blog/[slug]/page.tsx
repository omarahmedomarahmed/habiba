import Link from "next/link";
import { 
  ArrowLeft, Calendar, Clock, User, Share2, Bookmark, 
  ChevronRight, Brain, Sparkles, Heart, Tag, ArrowRight,
  Twitter, Linkedin, Copy, BookOpen
} from "lucide-react";

// In production this would be fetched from CMS/DB
const BLOG_POST_DATA: Record<string, {
  title: string;
  category: string;
  date: string;
  read_time: string;
  author: { name: string; role: string; bio: string; initials: string };
  excerpt: string;
  content: string;
  tags: string[];
  related: Array<{ slug: string; title: string; category: string }>;
}> = {
  "ai-copilot-session-notes": {
    title: "How AI Copilots Are Changing What Happens Inside the Therapy Room",
    category: "AI in Therapy",
    date: "December 12, 2025",
    read_time: "8 min read",
    author: {
      name: "Dr. Aisha Khalil",
      role: "Clinical Director & Licensed Psychologist",
      bio: "Dr. Khalil specializes in integrating technology with evidence-based clinical practice. She has worked with 400+ therapists on implementing AI tools in their practices.",
      initials: "AK"
    },
    excerpt: "Real-time session intelligence doesn't replace clinical judgment — it amplifies it.",
    tags: ["AI Copilot", "Session Notes", "Clinical Intelligence", "Therapist Tools"],
    related: [
      { slug: "mental-health-memory-layer", title: "The Mental Health Memory Layer", category: "AI in Therapy" },
      { slug: "soap-notes-ai-efficiency", title: "SOAP Notes in 90 Seconds", category: "Clinical Practice" },
      { slug: "knowledge-graph-patient-intelligence", title: "Knowledge Graphs in Mental Health", category: "AI in Therapy" },
    ],
    content: `
When Dr. Rachel Torres started her clinical practice 12 years ago, she spent the first 20 minutes after every session writing notes. By the time a patient arrived for their appointment, she had reviewed their chart, but the retrieval was imperfect — she'd occasionally mix up homework assignments or forget a significant disclosure from three sessions back.

She wasn't unusual. A survey of 1,200 outpatient therapists found that the average clinician spends 37% of their working time on documentation and administrative tasks — not with patients.

**The Attention Economy of Therapy**

There's a core tension at the heart of clinical practice: the therapist's finite attention. Being genuinely present with a patient — listening at multiple levels, tracking nonverbal cues, formulating hypotheses in real time, selecting the right intervention — is cognitively demanding work.

At the same time, the therapist is also:
- Remembering what was said three, six, twelve sessions ago
- Noticing when a new disclosure connects to an old pattern
- Monitoring for risk factors that may have changed since the last session
- Planning which therapeutic technique to use next
- Mentally drafting the session note

This cognitive load is the quiet enemy of therapeutic effectiveness. When a therapist is mentally managing all of this at once, some of it inevitably gets crowded out.

**What an AI Copilot Actually Does**

A well-designed AI copilot doesn't try to do the therapy. It tries to free the therapist to do it better.

In practice, this means several things happening simultaneously:

*Memory retrieval in real-time.* As a patient speaks, the AI scans its knowledge graph — built from 12 months of previous sessions — and surfaces relevant prior context. If a patient mentions their sister Lisa, the system surfaces the memory node documenting that Lisa is the patient's primary support and that the patient disclosed feeling secondary to Lisa's needs in Session #14. The therapist sees this in a small sidebar. They didn't forget — they simply didn't have to remember.

*Pattern detection.* The system has seen enough of this patient's language and disclosure patterns to notice when something is different. A patient who normally describes work stress in general terms is today using specific, catastrophizing language. The copilot flags this as a potential escalation worth exploring.

*Evidence-based question suggestions.* Based on what the patient just said, the AI offers two or three Socratic questions drawn from the patient's documented response profile. For a patient who doesn't respond well to direct interpretations but opens up with guided discovery, the suggestions lean toward open-ended inquiry.

*Note structuring in the background.* While the session continues, the AI is organizing what's being said into a structured SOAP note. By the time the session ends, the note is 80% complete.

**What Therapists Actually Say**

When we surveyed 340 clinicians using AI-assisted session tools, the most common response wasn't about efficiency. It was about presence.

"I realized I was spending so much mental energy trying to remember things that I wasn't actually listening," said one therapist in clinical social work practice. "Having the memory layer gave me permission to just be in the room."

Another therapist noted a shift in their relationship with session notes: "I used to dread documentation. Now I see it differently — the note is already 90% there, and reviewing it actually helps me consolidate what happened. It's become a useful clinical tool instead of a burden."

**The Risks and Limits**

No serious conversation about AI copilots in therapy can skip the risks.

The most important: over-reliance on AI suggestions can subtly reshape clinical behavior. If a therapist begins defaulting to AI-suggested questions rather than developing their own clinical intuition, the tool becomes a crutch rather than an amplifier.

There are also privacy and consent considerations. Patients must be clearly informed when AI tools are active in a session. The ethical standard is not just HIPAA compliance — it's meaningful transparency about how data is being used.

And there's the question of what the AI doesn't know. The model doesn't feel the room. It doesn't notice that a patient's shoulders dropped two inches when they mentioned their mother. The embodied, relational knowledge that makes a great therapist can't be captured in a transcript.

**The Right Mental Model**

The analogy that resonates most with clinicians who use AI copilots effectively is that of an experienced clinical supervisor — one who has read every session note, remembers every significant disclosure, and has access to a vast clinical knowledge base.

The supervisor doesn't sit next to you in session and whisper "ask about her father." But before the session, they brief you. During the session, you know they're there if you need them. After the session, they help you make sense of what happened.

An AI copilot is beginning to approximate that role — not the supervisor, but the infrastructure the supervisor relies on. The memory. The pattern recognition. The synthesized clinical knowledge.

The therapist, as always, is still doing the most important work: holding space, bearing witness, and guiding another person toward healing.

That part isn't changing.
    `
  },
};

// Get all slug params for static generation
export async function generateStaticParams() {
  return Object.keys(BLOG_POST_DATA).map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = BLOG_POST_DATA[slug] || BLOG_POST_DATA["ai-copilot-session-notes"];

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar decoration */}
      <div className="h-1 bg-gradient-to-r from-[#0A2342] to-[#2EC4B6]" />

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-[#0A2342]">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/blog" className="hover:text-[#0A2342]">Blog</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-700 font-medium truncate">{post.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A2342] mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>

        {/* Article header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-1.5 rounded-full">
              {post.category}
            </span>
            {post.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
            {post.title}
          </h1>

          <p className="text-xl text-gray-600 leading-relaxed mb-8 font-light">
            {post.excerpt}
          </p>

          {/* Author + Meta */}
          <div className="flex items-center justify-between border-t border-b border-gray-100 py-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#0A2342] rounded-full flex items-center justify-center text-white font-bold">
                {post.author.initials}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{post.author.name}</div>
                <div className="text-sm text-gray-500">{post.author.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {post.read_time}
              </span>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" title="Share on Twitter">
                  <Twitter className="h-4 w-4 text-gray-500" />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" title="Share on LinkedIn">
                  <Linkedin className="h-4 w-4 text-gray-500" />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" title="Copy link">
                  <Copy className="h-4 w-4 text-gray-500" />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" title="Save">
                  <Bookmark className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Article content */}
        <div className="grid grid-cols-3 gap-12">
          <article className="col-span-2">
            <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-a:text-[#0A2342]">
              {post.content.split('\n\n').filter(Boolean).map((block, i) => {
                if (block.startsWith('**') && block.endsWith('**')) {
                  return (
                    <h2 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4">
                      {block.replace(/\*\*/g, '')}
                    </h2>
                  );
                }
                if (block.startsWith('*') && block.endsWith('*')) {
                  const content = block.replace(/^\*/, '').replace(/\*$/, '');
                  const colonIdx = content.indexOf('.');
                  if (colonIdx > -1 && colonIdx < 40) {
                    return (
                      <div key={i} className="mb-4">
                        <strong className="text-gray-900">{content.substring(0, colonIdx + 1)}</strong>
                        <span className="text-gray-700">{content.substring(colonIdx + 1)}</span>
                      </div>
                    );
                  }
                  return <p key={i} className="text-gray-700 leading-relaxed mb-4 italic">{content}</p>;
                }
                if (block.startsWith('- ')) {
                  const items = block.split('\n').filter(line => line.startsWith('- '));
                  return (
                    <ul key={i} className="list-disc pl-6 mb-4 space-y-2">
                      {items.map((item, j) => (
                        <li key={j} className="text-gray-700">{item.substring(2)}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={i} className="text-gray-700 leading-relaxed mb-6">{block}</p>;
              })}
            </div>

            {/* Tags */}
            <div className="mt-12 pt-8 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-gray-400" />
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Author bio */}
            <div className="mt-10 bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {post.author.initials}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-0.5">{post.author.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">{post.author.role}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{post.author.bio}</p>
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="col-span-1 space-y-6">
            {/* CTA */}
            <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-2xl p-6 text-white sticky top-6">
              <div className="w-10 h-10 bg-[#2EC4B6]/20 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="h-5 w-5 text-[#2EC4B6]" />
              </div>
              <h3 className="font-bold text-lg mb-2">Try 24Therapy Free</h3>
              <p className="text-white/70 text-sm mb-5 leading-relaxed">
                Experience the AI copilot, memory layer, and clinical intelligence described in this article.
              </p>
              <Link
                href="/for-therapists"
                className="block w-full py-3 bg-[#2EC4B6] text-white font-semibold rounded-xl text-center hover:bg-[#25a99d] transition-colors text-sm"
              >
                Start Free Trial
              </Link>
              <Link
                href="/ai-scribe"
                className="block w-full py-2.5 mt-2 border border-white/20 text-white/80 font-medium rounded-xl text-center hover:bg-white/10 transition-colors text-sm"
              >
                Watch Demo
              </Link>
            </div>

            {/* Related posts */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-400" />
                Related Articles
              </h4>
              <div className="space-y-4">
                {post.related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/blog/${rel.slug}`}
                    className="block group"
                  >
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wide">
                      {rel.category}
                    </span>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0A2342] leading-tight mt-1 transition-colors">
                      {rel.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-2">Weekly Newsletter</h4>
              <p className="text-xs text-gray-600 mb-3">AI + clinical practice insights every Thursday</p>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-2 focus:outline-none"
              />
              <button className="w-full py-2 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors">
                Subscribe Free
              </button>
            </div>
          </aside>
        </div>

        {/* More articles */}
        <div className="mt-16 pt-12 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">More from the Blog</h2>
          <div className="grid grid-cols-3 gap-6">
            {post.related.map((rel) => (
              <Link
                key={rel.slug}
                href={`/blog/${rel.slug}`}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all group"
              >
                <span className="text-xs font-bold uppercase text-gray-400 tracking-wide">{rel.category}</span>
                <h3 className="font-semibold text-gray-900 mt-2 mb-3 group-hover:text-[#0A2342] transition-colors leading-snug">
                  {rel.title}
                </h3>
                <span className="text-sm text-[#2EC4B6] font-medium flex items-center gap-1">
                  Read article <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
