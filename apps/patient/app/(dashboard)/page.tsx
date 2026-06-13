"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar, MessageCircle, TrendingUp, BookOpen, ClipboardList,
  Heart, CheckCircle, Clock, ArrowRight, Smile, Star, AlertCircle
} from "lucide-react";
import { patientAPI, sessionsAPI, billingAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface PatientProfile {
  first_name: string;
  last_name: string;
  primary_therapist_name: string;
  primary_therapist_display_name?: string;
  goals?: any[];
}

interface Session {
  id: string;
  scheduled_at: string;
  status: string;
  modality: string;
  therapist_name?: string;
  video_room_url?: string;
}

interface MoodEntry {
  id: string;
  mood: number;
  energy?: number;
  created_at: string;
  notes?: string;
}

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcomingSession, setUpcomingSession] = useState<Session | null>(null);
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    Promise.allSettled([
      patientAPI.me().then((res: any) => setProfile(res?.data || res)),
      sessionsAPI.upcomingSessions
        ? sessionsAPI.upcomingSessions().then((res: any) => {
            const sessions = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            setUpcomingSession(sessions[0] || null);
          })
        : sessionsAPI.list({ status: 'scheduled', limit: 1 }).then((res: any) => {
            const sessions = Array.isArray(res?.data?.data) ? res.data.data :
                           Array.isArray(res?.data) ? res.data :
                           Array.isArray(res) ? res : [];
            setUpcomingSession(sessions[0] || null);
          }),
      patientAPI.moodTrend(7).then((res: any) => {
        const entries = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setRecentMoods(entries.slice(0, 3));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const avgMood = recentMoods.length
    ? Math.round(recentMoods.reduce((s, m) => s + (m.mood || 0), 0) / recentMoods.length * 10) / 10
    : null;

  const therapistName = profile?.primary_therapist_display_name
    || profile?.primary_therapist_name
    || (user as any)?.therapist_name
    || "Your Therapist";

  const firstName = profile?.first_name || (user as any)?.first_name || "there";

  const isSessionSoon = upcomingSession &&
    Math.abs(new Date(upcomingSession.scheduled_at).getTime() - now.getTime()) < 15 * 60 * 1000;

  const formatSessionDate = (dt: string) => {
    const d = new Date(dt);
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return d.toLocaleDateString(undefined, opts);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-2xl p-6 text-white">
        <p className="text-white/70 text-sm">{greeting}</p>
        <h1 className="text-2xl font-bold mt-0.5">{firstName} 👋</h1>
        {therapistName && therapistName !== "Your Therapist" && (
          <p className="text-white/70 text-sm mt-2">Seeing {therapistName}</p>
        )}
      </div>

      {/* Upcoming session */}
      {upcomingSession ? (
        <div className={`rounded-2xl p-5 border ${isSessionSoon ? 'border-[#2EC4B6] bg-[#2EC4B6]/5' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSessionSoon ? 'bg-[#2EC4B6]' : 'bg-slate-100'}`}>
              <Calendar className={`w-5 h-5 ${isSessionSoon ? 'text-white' : 'text-slate-600'}`} />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {isSessionSoon ? '🔴 Session Starting Soon' : 'Upcoming Session'}
              </p>
              <p className="text-xs text-slate-500">{formatSessionDate(upcomingSession.scheduled_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 capitalize">{upcomingSession.modality || 'video'} · {upcomingSession.therapist_name || therapistName}</span>
            {isSessionSoon && upcomingSession.video_room_url && (
              <a href={upcomingSession.video_room_url} target="_blank" rel="noopener noreferrer"
                className="ml-auto px-4 py-2 bg-[#2EC4B6] text-white rounded-xl text-sm font-semibold">
                Join Now
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900">No upcoming sessions</p>
              <p className="text-xs text-slate-500">Schedule your next appointment</p>
            </div>
          </div>
          <Link href="/sessions" className="text-[#1F5EFF] text-sm font-medium flex items-center gap-1">
            View <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-slate-500">Avg Mood (7d)</span>
          </div>
          {avgMood !== null ? (
            <div className="text-2xl font-bold text-slate-900">{avgMood}<span className="text-sm text-slate-400">/10</span></div>
          ) : (
            <p className="text-sm text-slate-400">No entries yet</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-xs text-slate-500">Goals</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {profile?.goals?.filter((g: any) => g.status === 'completed').length || 0}
            <span className="text-sm text-slate-400">/{profile?.goals?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Quick access */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3">QUICK ACCESS</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Log Mood", icon: Smile, href: "/mood", color: "text-rose-500 bg-rose-50" },
            { label: "Journal", icon: BookOpen, href: "/journal", color: "text-violet-500 bg-violet-50" },
            { label: "Homework", icon: CheckCircle, href: "/homework", color: "text-green-500 bg-green-50" },
            { label: "Messages", icon: MessageCircle, href: "/messages", color: "text-blue-500 bg-blue-50" },
            { label: "Progress", icon: TrendingUp, href: "/progress", color: "text-amber-500 bg-amber-50" },
            { label: "Assessments", icon: ClipboardList, href: "/assessments", color: "text-indigo-500 bg-indigo-50" },
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-600 font-medium text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent mood */}
      {recentMoods.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500">RECENT MOOD</p>
            <Link href="/mood" className="text-xs text-[#1F5EFF]">View all</Link>
          </div>
          <div className="space-y-2">
            {recentMoods.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-sm font-bold text-rose-600">
                  {entry.mood}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</p>
                  {entry.notes && <p className="text-xs text-slate-700 truncate">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
