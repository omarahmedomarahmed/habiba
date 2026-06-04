"use client";

import { useState } from "react";
import {
  BookOpen, Plus, Search, Lock, Heart, Lightbulb, Star, Tag,
  Calendar, Clock, ChevronRight, Edit3, Trash2, Eye, EyeOff,
  Sparkles, Brain, Shield, Filter, MoreHorizontal, Save,
  ArrowLeft, CheckCircle2, Mic, Image, Link2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JournalEntry {
  id: string;
  date: string;
  time: string;
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  is_private: boolean;
  shared_with_therapist: boolean;
  word_count: number;
  ai_insight?: string;
  prompt_used?: string;
}

const JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: "j1",
    date: "2025-12-16",
    time: "8:45 PM",
    title: "Processing today's breakthrough",
    content: "Something clicked today during my morning meditation. I realized that my constant need for validation at work isn't really about work at all — it's about my relationship with my dad growing up. Dr. Smith has been nudging me toward this for weeks but today it actually landed.\n\nI sat with that feeling for a while instead of immediately trying to fix it or push it away. That's new for me. I'm learning that feelings don't need to be solved — they need to be felt.\n\nI'm writing this down because I want to remember this moment. The moment I understood that my inner critic isn't protecting me — it's repeating old patterns.",
    mood: 8,
    tags: ["breakthrough", "self-awareness", "inner-child"],
    is_private: false,
    shared_with_therapist: true,
    word_count: 112,
    ai_insight: "This entry shows significant cognitive reframing — connecting present patterns to early experiences. This type of insight is a key indicator of therapeutic progress."
  },
  {
    id: "j2",
    date: "2025-12-14",
    time: "10:20 PM",
    title: "Hard day at work",
    content: "The quarterly review did not go how I hoped. My manager gave me feedback that felt harsh even though I know it wasn't meant that way. I spent the rest of the afternoon ruminating instead of working.\n\nI caught myself catastrophizing — 'I'm terrible at my job,' 'I'm going to get fired,' 'I never do anything right.' These are the automatic thoughts Dr. Smith and I identified. Just noticing them is progress, even when I can't stop them.\n\nUsed the 5-4-3-2-1 grounding technique on the drive home. It helped a little.",
    mood: 4,
    tags: ["work", "anxiety", "cbt", "automatic-thoughts"],
    is_private: true,
    shared_with_therapist: false,
    word_count: 108,
    ai_insight: "You demonstrated excellent self-awareness by catching your automatic thoughts. Noting the grounding technique use shows active coping strategy implementation."
  },
  {
    id: "j3",
    date: "2025-12-13",
    time: "7:30 PM",
    title: "Family dinner — actually good!",
    content: "Had dinner with mom, my sister, and her kids tonight. I was dreading it a little because family gatherings can feel complicated. But it was actually wonderful.\n\nI practiced staying present instead of half-being there while my mind races. Played with my nephews for an hour after dinner. Completely forgot about work, anxiety, everything. Just... in the moment.\n\nMaybe this is what Dr. Smith means by behavioral activation. Doing things even when you don't feel like it and discovering that the feeling can shift.",
    mood: 9,
    tags: ["family", "connection", "mindfulness", "behavioral-activation"],
    is_private: false,
    shared_with_therapist: true,
    word_count: 97,
    ai_insight: "Beautiful example of successful behavioral activation and mindful presence. The connection between action and mood shift is a key therapeutic insight."
  },
  {
    id: "j4",
    date: "2025-12-10",
    time: "9:15 PM",
    title: "Gratitude reflection",
    content: "Three things I'm genuinely grateful for today:\n\n1. My friend Sarah called just to check in. I sometimes feel like I'm a burden to people, but she reached out first.\n\n2. I finished a project at work that I'd been procrastinating on for two weeks. The relief was physical.\n\n3. My body — I went for a walk and my legs carried me. I take this for granted too often.\n\nI want to do this more. Finding small things to appreciate feels like exercising a muscle I've let atrophy.",
    mood: 7,
    tags: ["gratitude", "reflection", "self-compassion"],
    is_private: false,
    shared_with_therapist: true,
    word_count: 95,
  }
];

const WRITING_PROMPTS = [
  { id: "p1", category: "Reflection", prompt: "What emotion has been most present for you this week? Where do you feel it in your body?" },
  { id: "p2", category: "Growth", prompt: "Describe a moment recently when you handled something differently than you would have a year ago." },
  { id: "p3", category: "Self-Compassion", prompt: "What would you say to a dear friend who was feeling exactly what you're feeling right now?" },
  { id: "p4", category: "Gratitude", prompt: "What are three small things that made today livable or even good?" },
  { id: "p5", category: "Processing", prompt: "Is there something you've been avoiding thinking about? What would happen if you sat with it for just 5 minutes?" },
  { id: "p6", category: "Future", prompt: "What does the version of you who has healed look like? What does their typical Tuesday look like?" },
  { id: "p7", category: "Therapy Prep", prompt: "What would you most want Dr. Smith to understand about your week that you haven't told her yet?" },
  { id: "p8", category: "Patterns", prompt: "When did you last feel truly calm and safe? What was different about that moment?" },
];

const TAGS_AVAILABLE = ["anxiety", "depression", "work", "family", "relationships", "sleep", "breakthrough", "setback", "gratitude", "anger", "fear", "hope", "grief", "self-care", "cbt", "mindfulness", "medication", "goals"];

export default function JournalPage() {
  const [view, setView] = useState<"list" | "write" | "read">("list");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "private" | "shared">("all");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [newEntryPrivate, setNewEntryPrivate] = useState(false);
  const [newEntryShare, setNewEntryShare] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);

  const filteredEntries = JOURNAL_ENTRIES.filter(e => {
    const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || (activeFilter === "private" && e.is_private) || (activeFilter === "shared" && e.shared_with_therapist);
    return matchesSearch && matchesFilter;
  });

  const wordCount = newEntryContent.trim().split(/\s+/).filter(Boolean).length;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  if (view === "read" && selectedEntry) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => { setView("list"); setSelectedEntry(null); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Journal
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">
                {new Date(selectedEntry.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {selectedEntry.time}
              </p>
              <h2 className="text-xl font-bold text-gray-900">{selectedEntry.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedEntry.is_private ? (
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> Private
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                  <Eye className="h-3 w-3" /> Shared
                </span>
              )}
              {selectedEntry.mood && <span className="text-xl">{selectedEntry.mood >= 7 ? "😊" : selectedEntry.mood >= 4 ? "😐" : "😔"}</span>}
            </div>
          </div>

          <div className="prose prose-sm max-w-none">
            {selectedEntry.content.split("\n\n").map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed mb-3">{para}</p>
            ))}
          </div>

          {selectedEntry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-100">
              {selectedEntry.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {selectedEntry.ai_insight && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-800">AI Reflection</span>
              <span className="text-xs text-indigo-400 ml-auto">Shared with Dr. Smith</span>
            </div>
            <p className="text-sm text-indigo-700">{selectedEntry.ai_insight}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          <button className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    );
  }

  if (view === "write") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("list")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{wordCount} words</span>
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </div>

        {/* Prompts */}
        <div>
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
          >
            <Sparkles className="h-4 w-4" />
            {showPrompts ? "Hide prompts" : "Need a prompt?"}
          </button>
          {showPrompts && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {WRITING_PROMPTS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setNewEntryContent(p.prompt + "\n\n"); setSelectedPrompt(p.id); setShowPrompts(false); }}
                  className="text-left p-3 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                  <span className="text-xs font-medium text-indigo-600 block mb-1">{p.category}</span>
                  <span className="text-sm text-gray-700">{p.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <input
            value={newEntryTitle}
            onChange={e => setNewEntryTitle(e.target.value)}
            placeholder="Entry title (optional)"
            className="w-full px-6 pt-5 pb-2 text-lg font-semibold text-gray-900 placeholder-gray-300 focus:outline-none"
          />
          <div className="px-6 pb-2">
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <textarea
            value={newEntryContent}
            onChange={e => setNewEntryContent(e.target.value)}
            placeholder="What's on your mind? This is your safe space to process, reflect, and explore..."
            className="w-full px-6 py-3 min-h-64 text-gray-700 leading-relaxed placeholder-gray-300 focus:outline-none resize-none text-sm"
            autoFocus
          />
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" /> Add tags
          </p>
          <div className="flex flex-wrap gap-2">
            {TAGS_AVAILABLE.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                  selectedTags.includes(tag)
                    ? "bg-[#0A2342] text-white border-[#0A2342]"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0A2342]"
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" /> Privacy
          </p>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-700">Keep private</p>
                <p className="text-xs text-gray-400">Only you can see this entry</p>
              </div>
            </div>
            <div
              onClick={() => setNewEntryPrivate(!newEntryPrivate)}
              className={cn(
                "w-10 h-6 rounded-full transition-all cursor-pointer relative",
                newEntryPrivate ? "bg-[#0A2342]" : "bg-gray-200"
              )}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", newEntryPrivate ? "left-5" : "left-1")} />
            </div>
          </label>
          {!newEntryPrivate && (
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-rose-400" />
                <div>
                  <p className="text-sm text-gray-700">Share with Dr. Smith</p>
                  <p className="text-xs text-gray-400">Your therapist can read this</p>
                </div>
              </div>
              <div
                onClick={() => setNewEntryShare(!newEntryShare)}
                className={cn(
                  "w-10 h-6 rounded-full transition-all cursor-pointer relative",
                  newEntryShare ? "bg-rose-500" : "bg-gray-200"
                )}
              >
                <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", newEntryShare ? "left-5" : "left-1")} />
              </div>
            </label>
          )}
        </div>

        {/* AI Analysis button */}
        {newEntryContent.length > 100 && (
          <button
            onClick={() => setShowAIAnalysis(true)}
            className="w-full py-2.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 flex items-center justify-center gap-2"
          >
            <Brain className="h-4 w-4" /> Get AI reflection on this entry
          </button>
        )}

        {showAIAnalysis && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-800">AI Reflection</span>
            </div>
            <p className="text-sm text-indigo-700">
              Your writing shows active self-reflection and emotional processing. The themes you're exploring connect meaningfully to the work you're doing in therapy. This entry would be valuable context for Dr. Smith.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your private space to process and reflect</p>
        </div>
        <button
          onClick={() => setView("write")}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors"
        >
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total entries", value: "24", icon: BookOpen },
          { label: "This month", value: "8", icon: Calendar },
          { label: "Day streak", value: "5", icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <Icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search journal..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["all", "shared", "private"] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                activeFilter === f ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt of the day */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Today's Reflection Prompt</span>
        </div>
        <p className="text-sm text-gray-700 mb-3">"{WRITING_PROMPTS[6].prompt}"</p>
        <button
          onClick={() => { setNewEntryContent(WRITING_PROMPTS[6].prompt + "\n\n"); setView("write"); }}
          className="text-xs text-amber-700 font-medium hover:text-amber-900 flex items-center gap-1"
        >
          Write about this <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No entries found</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => { setSelectedEntry(entry); setView("read"); }}
              className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-[#0A2342]/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{entry.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {entry.time} · {entry.word_count} words
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {entry.mood && <span className="text-base">{entry.mood >= 7 ? "😊" : entry.mood >= 4 ? "😐" : "😔"}</span>}
                  {entry.is_private ? (
                    <span className="p-1 bg-gray-100 rounded-lg"><Lock className="h-3 w-3 text-gray-400" /></span>
                  ) : (
                    <span className="p-1 bg-blue-50 rounded-lg"><Eye className="h-3 w-3 text-blue-400" /></span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {entry.content.substring(0, 150)}...
              </p>

              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">#{tag}</span>
                  ))}
                  {entry.tags.length > 3 && <span className="text-xs text-gray-400">+{entry.tags.length - 3}</span>}
                </div>
                {entry.ai_insight && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-indigo-500">
                    <Brain className="h-3 w-3" /> AI
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
