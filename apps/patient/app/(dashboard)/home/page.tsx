"use client";

import Link from "next/link";
import {
  Calendar, Heart, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Sparkles, ChevronRight, Activity, Brain, Sun, Wind, Target,
  MessageCircle, BookOpen, Bell, Zap, Shield, Star
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const MOCK_PATIENT = {
  name: "Sarah Chen",
  therapist_name: "Dr. Smith",
  next_session: "2025-12-22T10:00:00Z",
  sessions_completed: 24,
  streak_days: 7,
  mood_today: null,
  phq9_score: 13,
  gad7_score: 8,
  phq9_trend: "improving",
  goals_active: 3,
  goals_completed: 1,
  pending_assessments: 1,
  unread_messages: 2,
};

const MOOD_OPTIONS = [
  { value: 1, emoji: "😔", label: "Very Low", color: "text-red-600 hover:bg-red-50 border-red-200" },
  { value: 2, emoji: "😟", label: "Low", color: "text-orange-600 hover:bg-orange-50 border-orange-200" },
  { value: 3, emoji: "😐", label: "Okay", color: "text-yellow-600 hover:bg-yellow-50 border-yellow-200" },
  { value: 4, emoji: "😊", label: "Good", color: "text-green-600 hover:bg-green-50 border-green-200" },
  { value: 5, emoji: "😄", label: "Great", color: "text-emerald-600 hover:bg-emerald-50 border-emerald-200" },
];

const QUICK_TOOLS = [
  { label: "Breathing Exercise", icon: Wind, desc: "4-7-8 technique", href: "/resources?type=breathing", color: "bg-blue-50 text-blue-600" },
  { label: "Mood Journal", icon: Heart, desc: "Log how you feel", href: "/progress?tab=journal", color: "bg-pink-50 text-pink-600" },
  { label: "Crisis Resources", icon: Shield, desc: "Get help now", href: "/resources?type=crisis", color: "bg-red-50 text-red-600" },
  { label: "Homework", icon: BookOpen, desc: "From your therapist", href: "/resources?type=homework", color: "bg-purple-50 text-purple-600" },
];

export default function PatientHomePage() {
  const daysUntilSession = Math.ceil(
    (new Date(MOCK_PATIENT.next_session).getTime() - Date.now()) / 86400000,
  );

  const hourOfDay = new Date().getHours();
  const greeting = hourOfDay < 12 ? "Good morning" : hourOfDay < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        {/* Greeting */}
        <div className="bg-gradient-to-r from-secondary-600 to-secondary-700 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sun className="w-4 h-4 opacity-80" />
                <span className="text-sm text-secondary-200">{greeting}</span>
              </div>
              <h1 className="text-2xl font-bold">Hi, {MOCK_PATIENT.name.split(" ")[0]} 👋</h1>
              <p className="text-secondary-200 text-sm mt-1">
                You&apos;re doing great — {MOCK_PATIENT.streak_days} day streak!
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{MOCK_PATIENT.streak_days}</div>
              <div className="text-xs text-secondary-300">day streak</div>
            </div>
          </div>

          {/* Next session */}
          <div className="mt-4 bg-white/10 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Next session with {MOCK_PATIENT.therapist_name}</p>
              <p className="text-xs text-secondary-300">
                {formatDate(MOCK_PATIENT.next_session)} ·{" "}
                {new Date(MOCK_PATIENT.next_session).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·{" "}
                {daysUntilSession === 0 ? "Today!" : daysUntilSession === 1 ? "Tomorrow" : `${daysUntilSession} days`}
              </p>
            </div>
            <Link href="/sessions" className="bg-white text-secondary-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-secondary-50 transition-colors">
              View
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {(MOCK_PATIENT.pending_assessments > 0 || MOCK_PATIENT.unread_messages > 0) && (
          <div className="space-y-2">
            {MOCK_PATIENT.pending_assessments > 0 && (
              <Link href="/assessments" className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    Assessment pending — PHQ-9 due
                  </p>
                  <p className="text-xs text-amber-600">Takes about 5 minutes · Requested by your therapist</p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </Link>
            )}
            {MOCK_PATIENT.unread_messages > 0 && (
              <Link href="/messages" className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                <MessageCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    {MOCK_PATIENT.unread_messages} new message{MOCK_PATIENT.unread_messages > 1 ? "s" : ""} from {MOCK_PATIENT.therapist_name}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </Link>
            )}
          </div>
        )}

        {/* Today's Mood */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            How are you feeling today?
          </h2>
          <div className="flex items-center justify-between gap-2">
            {MOOD_OPTIONS.map((mood) => (
              <button
                key={mood.value}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all hover:scale-105",
                  "border-slate-200 hover:border-current",
                  mood.color
                )}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-xs font-medium">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Progress Snapshot */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "PHQ-9 Score",
              value: MOCK_PATIENT.phq9_score,
              sub: "Moderate depression",
              icon: Activity,
              trend: MOCK_PATIENT.phq9_trend,
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              label: "GAD-7 Score",
              value: MOCK_PATIENT.gad7_score,
              sub: "Mild anxiety",
              icon: Brain,
              trend: "stable",
              color: "text-yellow-600",
              bg: "bg-yellow-50",
            },
            {
              label: "Sessions Done",
              value: MOCK_PATIENT.sessions_completed,
              sub: "Total sessions",
              icon: Calendar,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Active Goals",
              value: MOCK_PATIENT.goals_active,
              sub: `${MOCK_PATIENT.goals_completed} completed`,
              icon: Target,
              color: "text-green-600",
              bg: "bg-green-50",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
              <div className="flex items-start justify-between">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                {stat.trend && (
                  <span className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded",
                    stat.trend === "improving" ? "text-green-600 bg-green-50" : "text-slate-500 bg-slate-100"
                  )}>
                    {stat.trend === "improving" ? "↓ Improving" : "→ Stable"}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
                <div className="text-sm font-medium text-slate-700">{stat.label}</div>
                <div className="text-xs text-slate-500">{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Tools */}
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Quick Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_TOOLS.map((tool) => (
              <Link
                key={tool.label}
                href={tool.href}
                className="bg-white rounded-xl border border-slate-200 shadow-card p-4 hover:shadow-card-hover transition-all flex items-center gap-3"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", tool.color)}>
                  <tool.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{tool.label}</p>
                  <p className="text-xs text-slate-500">{tool.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h2 className="font-semibold text-slate-800 text-sm">This Week&apos;s Insight</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Your PHQ-9 score has improved by 4 points over the past month. 
            The breathing exercises you&apos;ve been practicing appear to be helping with sleep quality.
            Keep up the great work — consistency is key to progress.
          </p>
          <button className="mt-3 text-xs text-purple-600 font-semibold hover:text-purple-700 flex items-center gap-1">
            View full progress report
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { icon: CheckCircle2, color: "text-green-600 bg-green-50", text: "Session completed with Dr. Smith", time: "Yesterday, 10:00 AM" },
              { icon: Activity, color: "text-blue-600 bg-blue-50", text: "PHQ-9 assessment completed — score: 13", time: "Dec 15" },
              { icon: Calendar, color: "text-purple-600 bg-purple-50", text: "Next session scheduled for Dec 22", time: "Dec 14" },
              { icon: Star, color: "text-amber-600 bg-amber-50", text: "Goal achieved: '3 coping strategies developed'", time: "Dec 10" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", item.color)}>
                  <item.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{item.text}</p>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
