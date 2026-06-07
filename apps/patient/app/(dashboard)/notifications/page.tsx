"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, Calendar, MessageSquare, ClipboardList, Heart, Brain,
  AlertTriangle, CheckCircle, Archive, Settings,
  X, ChevronRight, Sparkles, Shield, MoreHorizontal,
  BookOpen, Star, Activity, Video, Phone, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationsAPI, APIError } from "@/lib/api";

type NotificationCategory = "all" | "appointments" | "messages" | "assessments" | "wellness" | "ai" | "system";

const CATEGORY_CONFIG: Record<Exclude<NotificationCategory, "all">, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  appointments: { label: "Appointments", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
  messages: { label: "Messages", icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50" },
  assessments: { label: "Assessments", icon: ClipboardList, color: "text-orange-600", bg: "bg-orange-50" },
  wellness: { label: "Wellness", icon: Heart, color: "text-rose-500", bg: "bg-rose-50" },
  ai: { label: "AI Insights", icon: Brain, color: "text-[#2EC4B6]", bg: "bg-[#2EC4B6]/10" },
  system: { label: "Account", icon: Shield, color: "text-gray-500", bg: "bg-gray-100" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
  high: { label: "Important", color: "bg-orange-100 text-orange-700" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  low: { label: "", color: "" },
};

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-48" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    </div>
  );
}

// Map backend notification type/category to our CATEGORY_CONFIG keys
function normalizeCategory(n: any): Exclude<NotificationCategory, "all"> {
  const cat = (n.category || n.type || "system").toLowerCase();
  if (cat.includes("appoint") || cat.includes("session") || cat.includes("schedule")) return "appointments";
  if (cat.includes("message") || cat.includes("chat")) return "messages";
  if (cat.includes("assess") || cat.includes("phq") || cat.includes("gad")) return "assessments";
  if (cat.includes("wellness") || cat.includes("homework") || cat.includes("mood")) return "wellness";
  if (cat.includes("ai") || cat.includes("insight") || cat.includes("summary")) return "ai";
  return "system";
}

export default function PatientNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await notificationsAPI.list({ limit: 50 });
      const data = Array.isArray(result) ? result : (result as any).data ?? [];
      const unread = Array.isArray(result) ? result.filter((n: any) => !n.read).length : (result as any).unread_count ?? 0;
      setNotifications(data);
      setUnreadCount(unread);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      // Revert on failure
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsAPI.markAllRead();
    } catch {
      fetchNotifications();
    }
  };

  const handleArchive = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true } : n));
  };

  const isRead = (n: any) => n.read || n.is_read || false;
  const isArchived = (n: any) => n.archived || false;

  const filtered = notifications.filter((n) => {
    if (isArchived(n) !== showArchived) return false;
    if (activeCategory === "all") return true;
    return normalizeCategory(n) === activeCategory;
  });

  const categoryCount = (cat: Exclude<NotificationCategory, "all">) =>
    notifications.filter(n => normalizeCategory(n) === cat && !isRead(n) && !isArchived(n)).length;

  const currentUnread = notifications.filter(n => !isRead(n) && !isArchived(n)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {!loading && currentUnread > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {currentUnread} unread notification{currentUnread !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </button>
            {currentUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-[#2EC4B6] hover:text-[#26b0a3] font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:border-[#2EC4B6] transition-colors"
              title="Notification preferences"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={fetchNotifications} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}

        {/* Preferences Panel */}
        {showPrefs && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Notification Preferences</h2>
              <button onClick={() => setShowPrefs(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Appointment reminders", desc: "24h and 1h before sessions", enabled: true },
                { label: "Assessment requests", desc: "When your therapist sends an assessment", enabled: true },
                { label: "Messages", desc: "New secure messages from your therapist", enabled: true },
                { label: "AI wellness insights", desc: "Weekly mood summaries and prompts", enabled: true },
                { label: "Homework reminders", desc: "Reminders to complete assigned exercises", enabled: false },
                { label: "Security alerts", desc: "Login activity and account changes", enabled: true },
              ].map((pref) => (
                <div key={pref.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{pref.label}</div>
                    <div className="text-xs text-gray-400">{pref.desc}</div>
                  </div>
                  <div className={cn(
                    "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                    pref.enabled ? "bg-[#2EC4B6]" : "bg-gray-200"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      pref.enabled ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
              activeCategory === "all"
                ? "bg-[#0A2342] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            )}
          >
            <Bell className="w-3.5 h-3.5" />
            All
            {currentUnread > 0 && (
              <span className="bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center ml-0.5">
                {currentUnread > 9 ? "9+" : currentUnread}
              </span>
            )}
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [Exclude<NotificationCategory, "all">, any][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = categoryCount(key);
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                  activeCategory === key
                    ? "bg-[#0A2342] text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
                {count > 0 && (
                  <span className="bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center ml-0.5">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Archive toggle */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <button
            onClick={() => setShowArchived(false)}
            className={cn("font-medium", !showArchived ? "text-[#0A2342]" : "text-gray-400 hover:text-gray-600")}
          >
            Inbox
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={cn("font-medium", showArchived ? "text-[#0A2342]" : "text-gray-400 hover:text-gray-600")}
          >
            Archived
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {showArchived ? "No archived notifications" : "You're all caught up!"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {showArchived ? "Archived notifications appear here" : "New notifications will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((notif) => {
              const category = normalizeCategory(notif);
              const cfg = CATEGORY_CONFIG[category];
              const CategoryIcon = cfg.icon;
              const priority = notif.priority || "low";
              const priorityCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
              const read = isRead(notif);
              const timestamp = notif.timestamp || notif.created_at
                ? (notif.timestamp || new Date(notif.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
                : "";

              return (
                <div
                  key={notif.id}
                  onClick={() => { if (!read) handleMarkRead(notif.id); }}
                  className={cn(
                    "bg-white rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-sm group",
                    read ? "border-gray-200" : "border-l-4 border-l-[#2EC4B6] border-gray-200"
                  )}
                >
                  <div className="flex gap-3">
                    {/* Category Icon */}
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.bg)}>
                      <CategoryIcon className={cn("w-4 h-4", cfg.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-semibold text-sm", read ? "text-gray-700" : "text-gray-900")}>
                            {notif.title}
                          </span>
                          {!read && (
                            <span className="w-2 h-2 bg-[#2EC4B6] rounded-full flex-shrink-0" />
                          )}
                          {priorityCfg.label && (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", priorityCfg.color)}>
                              {priorityCfg.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {timestamp && <span className="text-xs text-gray-400">{timestamp}</span>}
                          {!isArchived(notif) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchive(notif.id); }}
                              className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 ml-1 transition-opacity"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {notif.body || notif.message || notif.content || ""}
                      </p>
                      {(notif.action_label || notif.cta_label) && (notif.action_href || notif.cta_url) && (
                        <a
                          href={notif.action_href || notif.cta_url}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#2EC4B6] hover:text-[#26b0a3] font-medium"
                        >
                          {notif.action_label || notif.cta_label}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Wellness Tips Footer */}
        {!loading && !showArchived && activeCategory === "all" && (
          <div className="mt-8 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#2EC4B6]" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">You're doing great</p>
                <p className="text-white/70 text-xs leading-relaxed">
                  Showing up for therapy and completing check-ins are meaningful acts of self-care. Keep going.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
