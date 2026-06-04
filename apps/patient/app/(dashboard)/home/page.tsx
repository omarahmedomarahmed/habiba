"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, Clock, Video, Brain, Heart, TrendingUp, BookOpen,
  MessageSquare, CheckCircle2, AlertCircle, Smile, Moon, Zap,
  ArrowRight, Star, Target, Pill, ChevronRight, Activity,
  Sparkles, Shield, Plus, Bell, BookOpenCheck, Users
} from "lucide-react";
import { cn } from "@/lib/utils";

const UPCOMING_SESSION = {
  date: "December 22, 2025",
  time: "10:00 AM",
  therapist: "Dr. Alex Smith",
  type: "Video Session",
  session_number: 25,
  days_until: 6,
  focus: "CBT + Year-end stress management"
};

const TODAY_HOMEWORK = [
  { id: "h1", task: "Practice 4-7-8 breathing (morning)", done: true },
  { id: "h2", task: "Thought record — work stress", done: false },
  { id: "h3", task: "Write 1 gratitude item", done: true },
  { id: "h4", task: "Social event this week", done: false },
];

const RECENT_MOOD = [
  { day: "Mon", value: 6 },
  { day: "Tue", value: 5 },
  { day: "Wed", value: 7 },
  { day: "Thu", value: 7 },
  { day: "Fri", value: 8 },
  { day: "Sat", value: 7 },
  { day: "Sun", value: 7 },
];

const QUICK_ACTIONS = [
  { label: "Log Mood", href: "/mood", icon: Smile, color: "bg-amber-50 text-amber-600 border-amber-100" },
  { label: "Journal", href: "/journal", icon: BookOpenCheck, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  { label: "AI Companion", href: "/ai-companion", icon: Brain, color: "bg-blue-50 text-blue-600 border-blue-100" },
  { label: "Resources", href: "/resources", icon: BookOpen, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
];

const GOALS_PREVIEW = [
  { title: "Reduce PHQ-9 below 9", progress: 52, change: 5, category: "Depression" },
  { title: "Sleep 7+ hrs consistently", progress: 70, change: 5, category: "Sleep" },
  { title: "Re-engage social activities", progress: 40, change: 10, category: "Social" },
];

const AI_INSIGHTS = [
  {
    id: "i1",
    type: "pattern",
    title: "Exercise improves your mood by ~2pts",
    short: "On exercise days, your mood averages 7.8 vs 5.9 on non-exercise days.",
    icon: Zap,
    color: "bg-amber-50 border-amber-100 text-amber-800"
  },
  {
    id: "i2",
    type: "progress",
    title: "Best mood week in 2 months!",
    short: "Your average mood this week (6.9) is the highest since mid-October.",
    icon: TrendingUp,
    color: "bg-emerald-50 border-emerald-100 text-emerald-800"
  },
];

const MEDICATIONS = [
  { name: "Lexapro 10mg", schedule: "Morning · Daily", taken_today: true },
];

function MoodBar({ value }: { value: number }) {
  const color = value >= 7 ? "bg-emerald-400" : value >= 5 ? "bg-blue-400" : "bg-amber-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-12 w-6 bg-gray-100 rounded-full overflow-hidden flex items-end">
        <div className={cn("w-full rounded-full", color)} style={{ height: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );
}

export default function PatientHomePage() {
  const [toggleTaken, setToggleTaken] = useState(MEDICATIONS.map(m => m.taken_today));
  const completedHomework = TODAY_HOMEWORK.filter(h => h.done).length;
  const homeworkPct = Math.round((completedHomework / TODAY_HOMEWORK.length) * 100);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, Sarah 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <Link href="/home" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <Bell className="h-4 w-4 text-gray-400" />
        </Link>
      </div>

      {/* Next Session — prominent */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-white/60 uppercase tracking-wide font-medium">Next Session</span>
          <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-medium">
            In {UPCOMING_SESSION.days_until} days
          </span>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5 text-white/80" />
          </div>
          <div>
            <p className="font-semibold">{UPCOMING_SESSION.therapist}</p>
            <p className="text-xs text-white/60">Session #{UPCOMING_SESSION.session_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm text-white/70">
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {UPCOMING_SESSION.date}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {UPCOMING_SESSION.time}</span>
          <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Video</span>
        </div>

        {UPCOMING_SESSION.focus && (
          <div className="bg-white/10 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-white/50 mb-0.5">Planned focus</p>
            <p className="text-sm text-white">{UPCOMING_SESSION.focus}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button className="flex-1 py-2.5 bg-white text-[#0A2342] rounded-xl text-sm font-semibold hover:bg-white/90 flex items-center justify-center gap-1.5">
            <Video className="h-4 w-4" /> Join Session
          </button>
          <Link href="/appointments" className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map(action => (
          <Link
            key={action.label}
            href={action.href}
            className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-all hover:shadow-sm", action.color)}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Today's homework */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" /> Today's Tasks
          </h3>
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {completedHomework}/{TODAY_HOMEWORK.length} done
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${homeworkPct}%` }} />
        </div>
        <div className="space-y-2">
          {TODAY_HOMEWORK.map((hw) => (
            <div key={hw.id} className="flex items-center gap-3">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2", hw.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300")}>
                {hw.done && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </div>
              <p className={cn("text-sm", hw.done ? "line-through text-gray-400" : "text-gray-700")}>{hw.task}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mood this week */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Smile className="h-4 w-4 text-blue-500" /> This Week's Mood
          </h3>
          <Link href="/mood" className="text-xs text-[#0A2342] flex items-center gap-1">
            Log today <Plus className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex items-end justify-between gap-2">
          {RECENT_MOOD.map((d) => (
            <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-xs font-medium text-gray-700">{d.value}</span>
              <MoodBar value={d.value} />
              <span className="text-xs text-gray-400">{d.day}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Avg: <strong>6.9</strong></span>
          <span className="text-xs text-emerald-600 font-medium">↑ +0.8 vs last week</span>
        </div>
      </div>

      {/* Goals preview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" /> Treatment Goals
          </h3>
          <Link href="/progress" className="text-xs text-[#0A2342] flex items-center gap-1">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {GOALS_PREVIEW.map(goal => (
            <div key={goal.title}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-xs font-medium text-gray-700">{goal.title}</p>
                  <p className="text-xs text-gray-400">{goal.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{goal.progress}%</p>
                  <p className="text-xs text-emerald-600">+{goal.change}% this month</p>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", goal.progress >= 70 ? "bg-emerald-500" : goal.progress >= 40 ? "bg-blue-500" : "bg-amber-400")}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="space-y-2">
        {AI_INSIGHTS.map(insight => {
          const Icon = insight.icon;
          return (
            <div key={insight.id} className={cn("rounded-2xl border p-4 flex gap-3", insight.color)}>
              <div className="w-8 h-8 bg-white/60 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{insight.short}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Medication reminder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Pill className="h-4 w-4 text-teal-500" /> Medication
          </h3>
        </div>
        {MEDICATIONS.map((med, i) => (
          <div key={med.name} className="flex items-center gap-3">
            <button
              onClick={() => {
                const newTaken = [...toggleTaken];
                newTaken[i] = !newTaken[i];
                setToggleTaken(newTaken);
              }}
              className={cn(
                "w-7 h-7 rounded-xl flex items-center justify-center border-2 transition-all shrink-0",
                toggleTaken[i] ? "bg-teal-500 border-teal-500" : "border-gray-300"
              )}
            >
              {toggleTaken[i] && <CheckCircle2 className="h-4 w-4 text-white" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{med.name}</p>
              <p className="text-xs text-gray-400">{med.schedule}</p>
            </div>
            {toggleTaken[i] && <span className="text-xs text-teal-600 font-medium">Taken ✓</span>}
          </div>
        ))}
      </div>

      {/* Crisis support (always visible) */}
      <div className="bg-rose-50 rounded-2xl border border-rose-100 p-4">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5 text-rose-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-700">Need immediate support?</p>
            <p className="text-xs text-rose-600">If you're in crisis: call/text <strong>988</strong> · Text HOME to <strong>741741</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
