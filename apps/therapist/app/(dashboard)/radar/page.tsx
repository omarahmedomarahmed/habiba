"use client";

import { LockedPageOverlay } from "@/components/LockedPageOverlay";
import { useUIStore } from "@/lib/store";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Clock, Globe, DollarSign, Shield,
  CheckCircle2, X, Activity, TrendingUp,
  Brain, AlertCircle, Video, RefreshCw, Loader2, AlertTriangle
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { radarAPI, notificationsAPI, APIError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/store";

interface CrisisNotification {
  id: string;
  session_id?: string;
  patient_id?: string;
  risk_level: string;
  body: string;
  created_at: string;
  read_at?: string;
  conversation_id?: string;
}

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

interface RadarStats {
  accepted_today: number;
  match_rate: string;
  avg_match_score: string;
  response_time: string;
  specializations: string;
  session_types: string;
  languages: string;
  rate: string;
}

const urgencyConfig = {
  now: { label: "IMMEDIATE", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  today: { label: "TODAY", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  this_week: { label: "THIS WEEK", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

// ── normalizers ──────────────────────────────────────────────────────────────
function normalizeRequest(raw: Record<string, unknown>): RadarRequest {
  const urgencyRaw = String(raw.urgency || raw.priority || "this_week").toLowerCase();
  const urgency: RadarRequest["urgency"] =
    urgencyRaw === "now" || urgencyRaw === "immediate" || urgencyRaw === "emergency" ? "now"
    : urgencyRaw === "today" || urgencyRaw === "urgent" ? "today"
    : "this_week";

  const issues = Array.isArray(raw.presenting_issues)
    ? (raw.presenting_issues as string[])
    : Array.isArray(raw.issues)
    ? (raw.issues as string[])
    : typeof raw.presenting_issues === "string"
    ? [raw.presenting_issues as string]
    : [];

  const reasons = Array.isArray(raw.match_reasons)
    ? (raw.match_reasons as string[])
    : Array.isArray(raw.reasons)
    ? (raw.reasons as string[])
    : ["Specialization match"];

  const langs = Array.isArray(raw.languages)
    ? (raw.languages as string[])
    : typeof raw.languages === "string"
    ? [raw.languages as string]
    : ["English"];

  return {
    id: String(raw.id || raw._id || Math.random()),
    patient_initials: String(raw.patient_initials || raw.initials || "A.P."),
    age_range: String(raw.age_range || raw.age || "Unknown"),
    gender: String(raw.gender || "Not specified"),
    specialization: String(raw.specialization || raw.specialty || raw.category || "General Therapy"),
    presenting_issues: issues,
    urgency,
    session_type: String(raw.session_type || raw.type || "video") === "audio" ? "audio" : "video",
    languages: langs,
    budget_min: Number(raw.budget_min || raw.budget_low || raw.min_budget || 60),
    budget_max: Number(raw.budget_max || raw.budget_high || raw.max_budget || 120),
    match_score: Number(raw.match_score || raw.score || raw.compatibility || 80),
    match_reasons: reasons,
    time_remaining: Number(raw.time_remaining || raw.expires_in || raw.ttl || 3600),
    anonymous: raw.anonymous !== false,
  };
}

function normalizeStats(raw: Record<string, unknown>): Partial<RadarStats> {
  return {
    accepted_today: Number(raw.accepted_today || raw.accepted || 0),
    match_rate: String(raw.match_rate || raw.acceptance_rate || "—"),
    avg_match_score: String(raw.avg_match_score || raw.average_score || "—"),
    response_time: String(raw.response_time || raw.avg_response_time || "< 2 min"),
    specializations: String(raw.specializations || "Anxiety, Depression, Trauma"),
    session_types: String(raw.session_types || "Video, Audio"),
    languages: String(raw.languages || "English"),
    rate: String(raw.rate || raw.hourly_rate || "$100–$130/hr"),
  };
}

// ── countdown timer ──────────────────────────────────────────────────────────
function CountdownTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

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

// ── skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full" />
          <div className="space-y-1.5">
            <div className="h-3.5 bg-slate-200 rounded w-36" />
            <div className="h-2.5 bg-slate-100 rounded w-24" />
          </div>
        </div>
        <div className="h-8 w-12 bg-slate-200 rounded" />
      </div>
      <div className="h-2.5 bg-slate-100 rounded w-full mb-2" />
      <div className="flex gap-1 mb-3">
        <div className="h-5 bg-slate-100 rounded w-20" />
        <div className="h-5 bg-slate-100 rounded w-24" />
        <div className="h-5 bg-slate-100 rounded w-16" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="flex-1 h-9 bg-slate-100 rounded-lg" />
        <div className="flex-1 h-9 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
function RadarPageInner() {
  const { accessToken } = useAuthStore();
  const [requests, setRequests] = useState<RadarRequest[]>([]);
  const [stats, setStats] = useState<Partial<RadarStats>>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<string, "accept" | "decline">>({});
  const [recentActivity, setRecentActivity] = useState<
    { action: string; patient: string; time: string; type: "accept" | "decline" | "complete" }[]
  >([]);
  const [crisisAlerts, setCrisisAlerts] = useState<CrisisNotification[]>([]);

  // ── fetch requests ──────────────────────────────────────────────────────
  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const json = await radarAPI.requests({ limit: 20 });
      const raw = Array.isArray(json) ? json : (json as any).data ?? [];
      setRequests((raw as Record<string, unknown>[]).map(normalizeRequest));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        // endpoint not yet live — show empty state silently
        setRequests([]);
        return;
      }
      if (!silent) setError("Failed to load radar requests. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── fetch stats ─────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const json = await radarAPI.stats();
      setStats(normalizeStats(json as Record<string, unknown>));
    } catch {
      // stats are non-critical — silently ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, [fetchRequests, fetchStats]);

  // Poll for new requests every 30 seconds while online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => fetchRequests(true), 30_000);
    return () => clearInterval(interval);
  }, [isOnline, fetchRequests]);

  // Fetch crisis alerts on mount + listen for real-time updates
  useEffect(() => {
    const fetchCrisisAlerts = async () => {
      try {
        const data = await notificationsAPI.list({ type: 'crisis_alert', limit: 10 } as any);
        const items = Array.isArray(data) ? data : (data as any).data ?? [];
        setCrisisAlerts(items.map((n: any) => ({
          id: n.id,
          session_id: n.metadata?.session_id,
          patient_id: n.metadata?.patient_id,
          risk_level: n.metadata?.risk_level || 'high',
          body: n.body || n.title || 'Crisis detected',
          created_at: n.created_at,
          read_at: n.read_at,
        })));
      } catch {
        // non-critical — silently ignore
      }
    };
    fetchCrisisAlerts();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const handleCrisis = (alert: any) => {
      setCrisisAlerts((prev) => [{
        id: alert.session_id + '_' + Date.now(),
        session_id: alert.session_id,
        patient_id: alert.patient_id,
        risk_level: alert.risk_level,
        body: `Risk detected. Indicators: ${(alert.indicators || []).join(', ')}`,
        created_at: alert.timestamp || new Date().toISOString(),
      }, ...prev.slice(0, 9)]);
    };
    socket.on('crisis_alert', handleCrisis);
    return () => { socket.off('crisis_alert', handleCrisis); };
  }, [accessToken]);

  // ── accept ──────────────────────────────────────────────────────────────
  const handleAccept = async (id: string) => {
    setActionLoading((a) => ({ ...a, [id]: "accept" }));
    // Optimistic update
    const accepted = requests.find((r) => r.id === id);
    setRequests((r) => r.filter((req) => req.id !== id));
    setAcceptedCount((c) => c + 1);
    if (accepted) {
      setRecentActivity((prev) => [
        {
          action: "Accepted session",
          patient: accepted.patient_initials,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "accept",
        },
        ...prev.slice(0, 9),
      ]);
    }

    try {
      await radarAPI.accept(id);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) return;
      // Rollback if API fails
      if (accepted) {
        setRequests((r) => [accepted, ...r]);
        setAcceptedCount((c) => Math.max(0, c - 1));
      }
    } finally {
      setActionLoading((a) => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  // ── decline ─────────────────────────────────────────────────────────────
  const handleDecline = async (id: string) => {
    setActionLoading((a) => ({ ...a, [id]: "decline" }));
    // Optimistic update
    const declined = requests.find((r) => r.id === id);
    setRequests((r) => r.filter((req) => req.id !== id));
    if (declined) {
      setRecentActivity((prev) => [
        {
          action: "Declined request",
          patient: declined.patient_initials,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type: "decline",
        },
        ...prev.slice(0, 9),
      ]);
    }

    try {
      await radarAPI.decline(id);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) return;
      // Rollback
      if (declined) setRequests((r) => [declined, ...r]);
    } finally {
      setActionLoading((a) => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Crisis Alerts Queue — appears at very top when active */}
      {crisisAlerts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-red-700">Active Crisis Alerts</h3>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{crisisAlerts.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {crisisAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 bg-red-50 border-2 border-red-200 rounded-xl animate-pulse-border"
                style={{ animation: 'pulse 2s infinite' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <div>
                    <span className="font-semibold text-red-800 text-sm capitalize">{alert.risk_level} risk detected</span>
                    <p className="text-xs text-red-600 mt-0.5">{alert.body}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(alert.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.conversation_id && (
                    <a
                      href={`/messages?conversation=${alert.conversation_id}&priority=crisis`}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Crisis Chat
                    </a>
                  )}
                  {alert.session_id && (
                    <a
                      href={`/sessions/${alert.session_id}/room`}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Open Session
                    </a>
                  )}
                  <button
                    onClick={() => setCrisisAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            onClick={() => fetchRequests(true)}
            className="flex items-center gap-1.5 h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => fetchRequests()}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Requests", value: loading ? "—" : requests.length, icon: Zap, color: "text-accent" },
          { label: "Accepted Today", value: statsLoading ? "—" : (stats.accepted_today ?? acceptedCount), icon: CheckCircle2, color: "text-green-500" },
          { label: "Match Rate", value: statsLoading ? "—" : (stats.match_rate ?? "—"), icon: TrendingUp, color: "text-blue-500" },
          { label: "Avg Match Score", value: statsLoading ? "—" : (stats.avg_match_score ?? "—"), icon: Brain, color: "text-purple-500" },
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
            {!loading && requests.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </h3>

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Empty state */}
          {!loading && requests.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Zap className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-600 mb-1">No Active Requests</h4>
              <p className="text-xs text-slate-400">New patient requests will appear here in real-time</p>
              <button
                onClick={() => fetchRequests()}
                className="mt-4 text-xs text-accent font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Request cards */}
          {!loading && requests.map((req) => {
            const urgency = urgencyConfig[req.urgency] ?? urgencyConfig.this_week;
            const isActing = !!actionLoading[req.id];
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
                          {req.age_range} · {req.gender} · {req.session_type === "video"
                            ? <span className="inline-flex items-center gap-0.5"><Video className="w-3 h-3" /> Video</span>
                            : "Audio"}
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
                      disabled={isActing}
                      className="flex-1 h-9 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading[req.id] === "decline" ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : "Decline"}
                    </button>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={isActing}
                      className="flex-1 h-9 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading[req.id] === "accept" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Accept Session
                        </>
                      )}
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
                { label: "Specializations", value: stats.specializations || "Anxiety, Depression, Trauma" },
                { label: "Session Types", value: stats.session_types || "Video, Audio" },
                { label: "Languages", value: stats.languages || "English" },
                { label: "Rate", value: stats.rate || "$100–$130/hr" },
                { label: "Response Time", value: stats.response_time || "< 2 min avg" },
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
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No activity yet today</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map(({ action, patient, time, type }, i) => (
                  <div key={i} className="flex items-center gap-2">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RadarPage() {
  const verificationStatus = useUIStore((s) => s.verificationStatus);
  const isLocked = verificationStatus !== null && verificationStatus !== "approved";
  return (
    <LockedPageOverlay isLocked={isLocked}>
      <RadarPageInner />
    </LockedPageOverlay>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
