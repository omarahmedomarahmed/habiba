"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell, AlertTriangle, Calendar, MessageSquare, FileText,
  Activity, Brain, CheckCircle2, Filter,
  MailOpen, Settings, Trash2, Archive,
  Shield, Zap, CreditCard, RefreshCw, X
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";
import { notificationsAPI } from "@/lib/api";
import { useUIStore } from "@/lib/store";

type NotificationCategory = "all" | "risk_alerts" | "clinical" | "sessions" | "messages" | "ai_insights" | "billing" | "system";
type NotificationPriority = "critical" | "high" | "medium" | "low";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  risk_alerts: AlertTriangle, clinical: Activity, sessions: Calendar,
  messages: MessageSquare, ai_insights: Brain, billing: CreditCard, system: Shield,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50/30",
  high: "border-l-orange-500 bg-orange-50/20",
  medium: "border-l-amber-500 bg-amber-50/10",
  low: "border-l-slate-300",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-slate-300",
};

function NotificationCard({
  notif, onMarkRead, onArchive,
}: {
  notif: any; onMarkRead: (id: string) => void; onArchive: (id: string) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[notif.category || "system"] || Bell;
  const priority = notif.priority || "medium";
  return (
    <div className={cn(
      "bg-white rounded-xl border-l-4 border border-slate-200 p-4 transition-all hover:shadow-sm",
      PRIORITY_COLORS[priority] || PRIORITY_COLORS.low,
      !notif.read && "ring-1 ring-blue-100"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", PRIORITY_DOT[priority] || PRIORITY_DOT.low)} />
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <CategoryIcon className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={cn("text-sm font-semibold text-slate-800", !notif.read && "text-slate-900")}>
                {notif.title}
              </div>
              {notif.patient_name && (
                <div className="text-xs text-secondary font-medium mb-1">{notif.patient_name}</div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!notif.read && (
                <button onClick={() => onMarkRead(notif.id)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Mark read">
                  <MailOpen className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => onArchive(notif.id)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded" title="Archive">
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {notif.body || notif.message}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-slate-400">
              {notif.created_at ? new Date(notif.created_at).toLocaleString() : notif.timestamp || "–"}
            </span>
            {notif.action_label && notif.action_href && (
              <Link href={notif.action_href} className="text-xs text-secondary hover:underline font-medium">
                {notif.action_label} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const setGlobalNotifCount = useUIStore((s) => s.setNotificationCount);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await notificationsAPI.list({ limit: 50 });
      const list = (data as any)?.data || (data as any) || [];
      setNotifications(Array.isArray(list) ? list : []);
      const unread = (data as any)?.unread_count || list.filter((n: any) => !n.read).length;
      setUnreadCount(unread);
      setGlobalNotifCount(unread);
    } catch {
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [setGlobalNotifCount]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      setGlobalNotifCount(0);
    } catch { /* silent */ }
  };

  const archiveNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const CATEGORIES: { id: NotificationCategory; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Bell },
    { id: "risk_alerts", label: "Risk Alerts", icon: AlertTriangle },
    { id: "clinical", label: "Clinical", icon: Activity },
    { id: "sessions", label: "Sessions", icon: Calendar },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "ai_insights", label: "AI Insights", icon: Brain },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  const filtered = notifications.filter(n => {
    if (n.archived) return false;
    if (activeCategory === "all") return true;
    return (n.category || "system") === activeCategory;
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Clinical alerts, system updates, and AI insights</p>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">{error}</span>}
          <button onClick={fetchNotifications} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-2 h-9 px-4 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Mark all read
            </button>
          )}
          <Link href="/settings" className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const catCount = cat.id === "all"
            ? notifications.filter(n => !n.archived && !n.read).length
            : notifications.filter(n => !n.archived && !n.read && (n.category || "system") === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                activeCategory === cat.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {catCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{catCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((notif) => (
            <NotificationCard key={notif.id} notif={notif} onMarkRead={markRead} onArchive={archiveNotification} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700 mb-1">All caught up!</h3>
          <p className="text-sm text-slate-400">
            {activeCategory === "all" ? "No notifications at this time." : `No ${activeCategory.replace("_", " ")} notifications.`}
          </p>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
