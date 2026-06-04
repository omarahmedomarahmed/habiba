"use client";

import { useState, useEffect } from "react";
import {
  Zap, Clock, MapPin, Globe, Star, DollarSign, Shield,
  CheckCircle2, X, ChevronRight, Activity, Users, TrendingUp,
  Brain, AlertCircle, Phone, Video
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface RadarRequest {
  id: string;
  patient_initials: string;
  age_range: string;
  gender: string;
  specialization: string;
  presenting_issues: string[];
  urgency: "now" | "today" | "this_week";
  session_type: "video" | "audio";
  languages: string[];
  budget_min: number;
  budget_max: number;
  match_score: number;
  match_reasons: string[];
  time_remaining: number; // seconds
  anonymous: boolean;
}

const MOCK_REQUESTS: RadarRequest[] = [
  {
    id: "r1",
    patient_initials: "A.K.",
    age_range: "25-35",
    gender: "Female",
    specialization: "Anxiety & Depression",
    presenting_issues: ["Workplace anxiety", "Panic attacks", "Sleep issues"],
    urgency: "now",
    session_type: "video",
    languages: ["English"],
    budget_min: 80,
    budget_max: 120,
    match_score: 96,
    match_reasons: ["Specialization match", "Language match", "Budget match", "Availability match"],
    time_remaining: 300,
    anonymous: true,
  },
  {
    id: "r2",
    patient_initials: "M.L.",
    age_range: "30-40",
    gender: "Male",
    specialization: "Trauma & PTSD",
    presenting_issues: ["Complex PTSD", "Relationship difficulties", "Emotional regulation"],
    urgency: "today",
    session_type: "video",
    languages: ["English", "Spanish"],
    budget_min: 100,
    budget_max: 150,
    match_score: 88,
    match_reasons: ["Specialization match", "Language match"],
    time_remaining: 1800,
    anonymous: true,
  },
  {
    id: "r3",
    patient_initials: "J.W.",
    age_range: "18-25",
    gender: "Non-binary",
    specialization: "Grief & Loss",
    presenting_issues: ["Bereavement", "Depression", "Social withdrawal"],
    urgency: "this_week",
    session_type: "video",
    languages: ["English"],
    budget_min: 60,
    budget_max: 90,
    match_score: 81,
    match_reasons: ["Specialization match", "Client type match"],
    time_remaining: 86400,
    anonymous: true,
  },
];

const urgencyConfig = {
  now: { label: "IMMEDIATE", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  today: { label: "TODAY", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  this_week: { label: "THIS WEEK", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

function CountdownTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (remaining <= 0) return <span className="text-red-600 font-bold text-xs">EXPIRED</span>;

  return (
    <span className={cn(
      "text-xs font-mono font-bold",
      remaining < 60 ? "text-red-600" : remaining < 300 ? "text-amber-600" : "text-slate-600"
    )}>
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  );
}

export default function RadarPage() {
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [isOnline, setIsOnline] = useState(true);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [declinedIds, setDeclinedIds] = useState<string[]>([]);

  const handleAccept = (id: string) => {
    setRequests((r) => r.filter((req) => req.id !== id));
    setAcceptedCount((c) => c + 1);
  };

  const handleDecline = (id: string) => {
    setDeclinedIds((d) => [...d, id]);
    setRequests((r) => r.filter((req) => req.id !== id));
  };

  const activeRequests = requests.filter((r) => !declinedIds.includes(r.id));

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Radar Network</h2>
            <span className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
              isOnline ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"
            )}>
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 live-dot" : "bg-slate-400")} />
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Real-time patient matching — respond to requests as they come in</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={cn(
              "flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border transition-colors",
              isOnline
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-slate-400")} />
            {isOnline ? "Available" : "Offline"}
          </button>
          <button className="flex items-center gap-1.5 h-9 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Zap className="w-4 h-4" />
            Radar Settings
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Requests", value: activeRequests.length, icon: Zap, color: "text-accent" },
          { label: "Accepted Today", value: acceptedCount, icon: CheckCircle2, color: "text-green-500" },
          { label: "Match Rate", value: "89%", icon: TrendingUp, color: "text-blue-500" },
          { label: "Avg Match Score", value: "91%", icon: Brain, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <Icon className={cn("w-5 h-5", color)} />
              <span className="text-2xl font-bold text-slate-900">{value}</span>
            </div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            Active Requests
            {activeRequests.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {activeRequests.length}
              </span>
            )}
          </h3>

          {activeRequests.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-600 mb-1">No Active Requests</h4>
              <p className="text-xs text-slate-400">New patient requests will appear here in real-time</p>
            </div>
          )}

          {activeRequests.map((req) => {
            const urgency = urgencyConfig[req.urgency];
            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden hover:shadow-card-hover transition-shadow">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                        {req.patient_initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">Anonymous Patient</span>
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase", urgency.color)}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", urgency.dot)} />
                            {urgency.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {req.age_range} · {req.gender} · {req.session_type === "video" ? <span className="flex items-center gap-0.5 inline-flex"><Video className="w-3 h-3" /> Video</span> : "Audio"}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent">{req.match_score}%</div>
                      <div className="text-[10px] text-slate-400">match score</div>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-slate-700 mb-1">{req.specialization}</div>
                    <div className="flex flex-wrap gap-1">
                      {req.presenting_issues.map((issue) => (
                        <span key={issue} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {req.languages.join(", ")}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(req.budget_min)}–{formatCurrency(req.budget_max)}/hr
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      <CountdownTimer seconds={req.time_remaining} />
                    </span>
                  </div>

                  {/* Match reasons */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {req.match_reasons.map((reason) => (
                      <span key={reason} className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {reason}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecline(req.id)}
                      className="flex-1 h-9 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="flex-1 h-9 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Accept Session
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Radar Settings Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-secondary" />
              My Radar Profile
            </h3>
            <div className="space-y-2.5">
              {[
                { label: "Availability", value: isOnline ? "✅ Available Now" : "❌ Offline" },
                { label: "Specializations", value: "Anxiety, Depression, Trauma" },
                { label: "Session Types", value: "Video, Audio" },
                { label: "Languages", value: "English, Spanish" },
                { label: "Rate", value: "$100–$130/hr" },
                { label: "Response Time", value: "< 2 min avg" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-medium text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Today&apos;s Activity
            </h3>
            <div className="space-y-2">
              {[
                { action: "Accepted session", patient: "A.K.", time: "10:23 AM", type: "accept" },
                { action: "Declined request", patient: "B.M.", time: "9:15 AM", type: "decline" },
                { action: "Session completed", patient: "C.L.", time: "8:45 AM", type: "complete" },
              ].map(({ action, patient, time, type }) => (
                <div key={time} className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    type === "accept" ? "bg-green-100" : type === "decline" ? "bg-red-100" : "bg-blue-100"
                  )}>
                    {type === "accept" ? <CheckCircle2 className="w-3 h-3 text-green-600" /> :
                     type === "decline" ? <X className="w-3 h-3 text-red-500" /> :
                     <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700">{action}</div>
                    <div className="text-[10px] text-slate-400">{patient} · {time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
