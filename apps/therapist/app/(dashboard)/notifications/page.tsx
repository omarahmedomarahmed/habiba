"use client";

import { useState } from "react";
import {
  Bell, AlertTriangle, Calendar, MessageSquare, FileText,
  Activity, Brain, User, CheckCircle2, Clock, Filter,
  MarkAsUnread, Settings, Trash2, Archive, ChevronRight,
  Shield, Heart, Zap, TrendingUp, CreditCard, BookOpen,
  Check, X, RefreshCw, Sparkles, Star, Users, ClipboardList
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationCategory =
  | "all"
  | "risk_alerts"
  | "clinical"
  | "sessions"
  | "messages"
  | "ai_insights"
  | "billing"
  | "system";

type NotificationPriority = "critical" | "high" | "medium" | "low";

interface Notification {
  id: string;
  category: Exclude<NotificationCategory, "all">;
  priority: NotificationPriority;
  title: string;
  body: string;
  patient_name?: string;
  patient_id?: string;
  action_label?: string;
  action_href?: string;
  timestamp: string;
  read: boolean;
  archived: boolean;
  ai_generated?: boolean;
  metadata?: Record<string, string | number>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    category: "risk_alerts",
    priority: "critical",
    title: "⚠️ Crisis Risk Signal — Immediate Attention",
    body: "James Rodriguez disclosed suicidal ideation during today's session check-in. AI Radar score elevated to 94/100. Safety protocol should be initiated immediately.",
    patient_name: "James Rodriguez",
    patient_id: "p3",
    action_label: "View Risk Monitor",
    action_href: "/risk-monitor",
    timestamp: "2025-12-20T14:32:00",
    read: false,
    archived: false,
    ai_generated: true,
    metadata: { radar_score: 94, previous_score: 71 },
  },
  {
    id: "n2",
    category: "risk_alerts",
    priority: "high",
    title: "PHQ-9 Score Increase — Review Required",
    body: "Sarah Chen completed her weekly PHQ-9 assessment. Score increased from 8 to 15 (moderate-to-severe range), a 7-point increase since last week. Significant worsening detected.",
    patient_name: "Sarah Chen",
    patient_id: "p1",
    action_label: "View Assessment",
    action_href: "/assessments",
    timestamp: "2025-12-20T11:15:00",
    read: false,
    archived: false,
    ai_generated: true,
    metadata: { phq9_current: 15, phq9_previous: 8 },
  },
  {
    id: "n3",
    category: "sessions",
    priority: "high",
    title: "Session Starting in 15 Minutes",
    body: "Your session with Michael Torres begins at 2:00 PM. Session room is ready. Pre-session brief and agenda are prepared.",
    patient_name: "Michael Torres",
    patient_id: "p2",
    action_label: "Prepare Session",
    action_href: "/sessions/s2/prepare",
    timestamp: "2025-12-20T13:45:00",
    read: false,
    archived: false,
    metadata: { session_time: "2:00 PM", session_type: "Individual" },
  },
  {
    id: "n4",
    category: "ai_insights",
    priority: "medium",
    title: "AI Insight: Recurring Theme Detected",
    body: "Across 3 recent sessions with Emma Williams, AI has identified a recurring theme of 'perfectionism and fear of failure' appearing in work-related discussions. This may warrant direct clinical exploration.",
    patient_name: "Emma Williams",
    patient_id: "p4",
    action_label: "View Memory Layer",
    action_href: "/memory",
    timestamp: "2025-12-20T09:20:00",
    read: false,
    archived: false,
    ai_generated: true,
    metadata: { sessions_analyzed: 3, confidence: 87 },
  },
  {
    id: "n5",
    category: "messages",
    priority: "medium",
    title: "New Message from Patient",
    body: "Olivia Kim sent you a message: 'Hi Dr. Smith, I wanted to let you know the breathing exercises have been really helpful this week...'",
    patient_name: "Olivia Kim",
    patient_id: "p5",
    action_label: "Reply",
    action_href: "/messages",
    timestamp: "2025-12-20T08:55:00",
    read: true,
    archived: false,
  },
  {
    id: "n6",
    category: "clinical",
    priority: "medium",
    title: "Treatment Plan Review Due",
    body: "James Rodriguez's treatment plan is due for the quarterly review scheduled for December 21st. The plan was last reviewed on September 15th. AI summary of progress is available.",
    patient_name: "James Rodriguez",
    patient_id: "p3",
    action_label: "Review Plan",
    action_href: "/treatment-plans",
    timestamp: "2025-12-20T07:00:00",
    read: true,
    archived: false,
    ai_generated: true,
  },
  {
    id: "n7",
    category: "sessions",
    priority: "medium",
    title: "Session Note Pending Signature",
    body: "Session note for Sarah Chen (December 19th, 50 min) has been drafted by AI and is awaiting your review and signature. Insurance billing requires signature within 24 hours.",
    patient_name: "Sarah Chen",
    patient_id: "p1",
    action_label: "Review Note",
    action_href: "/notes",
    timestamp: "2025-12-19T17:00:00",
    read: true,
    archived: false,
    ai_generated: true,
  },
  {
    id: "n8",
    category: "billing",
    priority: "low",
    title: "Insurance Claim Denied — Action Required",
    body: "Blue Cross claim for David Patel (session 11/28) was denied. Reason: Authorization expired. You need to obtain a new authorization and resubmit within 30 days.",
    patient_name: "David Patel",
    patient_id: "p6",
    action_label: "View Billing",
    action_href: "/billing",
    timestamp: "2025-12-19T14:22:00",
    read: true,
    archived: false,
  },
  {
    id: "n9",
    category: "ai_insights",
    priority: "low",
    title: "Monthly AI Clinical Summary Ready",
    body: "Your December AI clinical summary is ready. Highlights: 89% session attendance rate, average PHQ-9 improvement of 3.2 points across active patients, 2 patients reached remission criteria.",
    action_label: "View Report",
    action_href: "/reports",
    timestamp: "2025-12-19T09:00:00",
    read: true,
    archived: false,
    ai_generated: true,
  },
  {
    id: "n10",
    category: "sessions",
    priority: "low",
    title: "Upcoming Session Reminder — Tomorrow",
    body: "You have 4 sessions scheduled tomorrow (December 21st): Sarah Chen 10:00 AM, Michael Torres 11:30 AM, Emma Williams 2:00 PM, Olivia Kim 4:00 PM.",
    action_label: "View Schedule",
    action_href: "/sessions",
    timestamp: "2025-12-19T08:00:00",
    read: true,
    archived: false,
  },
  {
    id: "n11",
    category: "risk_alerts",
    priority: "medium",
    title: "Missed Session — No Contact",
    body: "David Patel missed his scheduled session (December 15th) without prior cancellation. This is his second consecutive missed session. Outreach may be clinically indicated.",
    patient_name: "David Patel",
    patient_id: "p6",
    action_label: "Send Outreach",
    action_href: "/messages",
    timestamp: "2025-12-15T16:00:00",
    read: true,
    archived: false,
  },
  {
    id: "n12",
    category: "system",
    priority: "low",
    title: "New Feature Available: AI Session Prep",
    body: "AI-powered session preparation briefs are now available 30 minutes before each session. Access session room to see auto-generated agendas based on memory layer insights.",
    action_label: "Learn More",
    action_href: "/ai-workspace",
    timestamp: "2025-12-15T10:00:00",
    read: true,
    archived: false,
  },
  {
    id: "n13",
    category: "clinical",
    priority: "low",
    title: "GAD-7 Assessment Overdue",
    body: "Michael Torres's monthly GAD-7 assessment is 5 days overdue. Please schedule the assessment at your next session or send a patient portal link.",
    patient_name: "Michael Torres",
    patient_id: "p2",
    action_label: "Schedule Assessment",
    action_href: "/assessments",
    timestamp: "2025-12-14T09:00:00",
    read: true,
    archived: false,
  },
  {
    id: "n14",
    category: "billing",
    priority: "low",
    title: "Payment Received",
    body: "Sarah Chen's co-pay of $35.00 was successfully processed for the December 18th session. Payment reference #TX-2025-4821.",
    patient_name: "Sarah Chen",
    patient_id: "p1",
    action_label: "View Invoice",
    action_href: "/billing",
    timestamp: "2025-12-18T15:30:00",
    read: true,
    archived: false,
  },
];

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORIES: { id: NotificationCategory; label: string; icon: React.ElementType; color: string }[] = [
  { id: "all", label: "All", icon: Bell, color: "text-slate-600" },
  { id: "risk_alerts", label: "Risk Alerts", icon: AlertTriangle, color: "text-red-600" },
  { id: "clinical", label: "Clinical", icon: ClipboardList, color: "text-blue-600" },
  { id: "sessions", label: "Sessions", icon: Calendar, color: "text-purple-600" },
  { id: "messages", label: "Messages", icon: MessageSquare, color: "text-green-600" },
  { id: "ai_insights", label: "AI Insights", icon: Sparkles, color: "text-violet-600" },
  { id: "billing", label: "Billing", icon: CreditCard, color: "text-orange-600" },
  { id: "system", label: "System", icon: Settings, color: "text-slate-500" },
];

const PRIORITY_CONFIG = {
  critical: { label: "Critical", bg: "bg-red-100", text: "text-red-700", border: "border-red-300", dot: "bg-red-500" },
  high: { label: "High", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dot: "bg-orange-500" },
  medium: { label: "Medium", bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  low: { label: "Low", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
};

function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;
  const criticalCount = notifications.filter(n => n.priority === "critical" && !n.read && !n.archived).length;

  const filtered = notifications.filter(n => {
    if (n.archived) return false;
    if (activeCategory !== "all" && n.category !== activeCategory) return false;
    if (showUnreadOnly && n.read) return false;
    return true;
  });

  // Sort: critical first, then by timestamp
  const sorted = [...filtered].sort((a, b) => {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const archiveNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true } : n));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkMarkRead = () => {
    setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, read: true } : n));
    setSelectedIds(new Set());
  };

  const bulkArchive = () => {
    setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, archived: true } : n));
    setSelectedIds(new Set());
  };

  const getCategoryCount = (cat: NotificationCategory) => {
    if (cat === "all") return notifications.filter(n => !n.read && !n.archived).length;
    return notifications.filter(n => n.category === cat && !n.read && !n.archived).length;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {criticalCount > 0
              ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} requiring immediate attention`
              : `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              showUnreadOnly ? "bg-primary/10 border-primary/30 text-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Unread Only
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            Preferences
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalCount > 0 && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-red-800 mb-0.5">
              {criticalCount} Critical Alert{criticalCount > 1 ? "s" : ""} Require Immediate Attention
            </div>
            <div className="text-xs text-red-700">
              Patient safety concerns have been detected. Please review the critical alerts below and take appropriate clinical action.
            </div>
          </div>
          <button
            onClick={() => setActiveCategory("risk_alerts")}
            className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 shrink-0"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Notification Preferences Panel */}
      {showPreferences && (
        <div className="mb-4 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Notification Preferences</h3>
            <button onClick={() => setShowPreferences(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Risk & Safety Alerts", desc: "Critical patient safety notifications", enabled: true },
              { label: "Session Reminders", desc: "Upcoming session alerts (15 min, 1 hour)", enabled: true },
              { label: "Clinical Milestones", desc: "Assessment changes, treatment plan reviews", enabled: true },
              { label: "AI Insights", desc: "Pattern detection and memory layer updates", enabled: true },
              { label: "Secure Messages", desc: "New messages from patients", enabled: true },
              { label: "Billing Alerts", desc: "Claim denials, payment confirmations", enabled: false },
              { label: "Note Reminders", desc: "Unsigned notes and documentation alerts", enabled: true },
              { label: "System Updates", desc: "Platform news and feature announcements", enabled: false },
            ].map(({ label, desc, enabled }) => (
              <div key={label} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg">
                <div className={cn(
                  "w-9 h-5 rounded-full transition-all cursor-pointer relative mt-0.5 shrink-0",
                  enabled ? "bg-primary" : "bg-slate-200"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    enabled ? "left-4" : "left-0.5"
                  )} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">Changes saved automatically</div>
            <div className="flex gap-2">
              <button className="text-xs text-primary font-medium">Email Digest: Daily</button>
              <span className="text-slate-300">|</span>
              <button className="text-xs text-primary font-medium">SMS Alerts: Critical Only</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {/* Category Filter Sidebar */}
        <div className="w-48 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {CATEGORIES.map(({ id, label, icon: Icon, color }) => {
              const count = getCategoryCount(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategory(id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-slate-100 last:border-0 transition-all",
                    activeCategory === id ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className={cn("w-4 h-4", activeCategory === id ? "text-primary" : color)} />
                  <span className={cn("text-xs font-semibold flex-1", activeCategory === id && "text-primary")}>{label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center",
                      id === "risk_alerts" ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600"
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1">
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
              <button onClick={bulkMarkRead} className="text-xs text-slate-600 hover:text-primary flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Mark Read
              </button>
              <button onClick={bulkArchive} className="text-xs text-slate-600 hover:text-primary flex items-center gap-1">
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600">
                Cancel
              </button>
            </div>
          )}

          {/* Notification Items */}
          <div className="space-y-2">
            {sorted.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <div className="text-sm font-semibold text-slate-600">All caught up!</div>
                <div className="text-xs text-slate-400 mt-1">No notifications match your current filters</div>
              </div>
            ) : (
              sorted.map(notification => {
                const pConf = PRIORITY_CONFIG[notification.priority];
                const isExpanded = expanded === notification.id;
                const isSelected = selectedIds.has(notification.id);
                const categoryConf = CATEGORIES.find(c => c.id === notification.category);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "bg-white border rounded-xl transition-all overflow-hidden",
                      notification.priority === "critical" && !notification.read
                        ? "border-red-300 shadow-sm shadow-red-100"
                        : notification.priority === "high" && !notification.read
                          ? "border-orange-200"
                          : "border-slate-200",
                      isSelected && "ring-2 ring-primary/30",
                      !notification.read && "shadow-sm"
                    )}
                  >
                    <div className="flex items-start p-4 gap-3">
                      {/* Select checkbox */}
                      <div
                        onClick={() => toggleSelect(notification.id)}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-1 cursor-pointer transition-all",
                          isSelected ? "bg-primary border-primary" : "border-slate-300 hover:border-primary"
                        )}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>

                      {/* Priority dot */}
                      <div className="mt-1.5 shrink-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full", pConf.dot, notification.read && "opacity-50")} />
                      </div>

                      {/* Category Icon */}
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        notification.priority === "critical" ? "bg-red-100" :
                          notification.priority === "high" ? "bg-orange-100" :
                            notification.category === "ai_insights" ? "bg-violet-100" :
                              notification.category === "sessions" ? "bg-purple-100" :
                                notification.category === "messages" ? "bg-green-100" :
                                  notification.category === "billing" ? "bg-orange-100" :
                                    "bg-slate-100"
                      )}>
                        {categoryConf && (
                          <categoryConf.icon className={cn("w-4 h-4", categoryConf.color)} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-sm font-semibold",
                                !notification.read ? "text-slate-800" : "text-slate-600"
                              )}>{notification.title}</span>
                              {notification.ai_generated && (
                                <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" /> AI
                                </span>
                              )}
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", pConf.bg, pConf.text)}>
                                {pConf.label}
                              </span>
                            </div>
                            {notification.patient_name && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-500">{notification.patient_name}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-full" />
                            )}
                            <span className="text-[10px] text-slate-400">{timeAgo(notification.timestamp)}</span>
                          </div>
                        </div>

                        <p className={cn(
                          "text-xs mt-1.5 leading-relaxed",
                          isExpanded ? "" : "line-clamp-2",
                          !notification.read ? "text-slate-700" : "text-slate-500"
                        )}>
                          {notification.body}
                        </p>

                        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                          <div className="flex items-center gap-3 mt-2">
                            {Object.entries(notification.metadata).map(([key, val]) => (
                              <span key={key} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {key.replace(/_/g, " ")}: <strong>{val}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-3">
                          {notification.action_label && notification.action_href && (
                            <Link
                              href={notification.action_href}
                              onClick={() => markRead(notification.id)}
                              className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              {notification.action_label} <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <button
                            onClick={() => setExpanded(isExpanded ? null : notification.id)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => markRead(notification.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => archiveNotification(notification.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More */}
          {sorted.length > 0 && (
            <div className="mt-4 text-center">
              <button className="text-xs text-slate-500 hover:text-primary flex items-center gap-1.5 mx-auto">
                <RefreshCw className="w-3.5 h-3.5" />
                Load older notifications
              </button>
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Summary</div>

            <div className="space-y-2.5">
              {[
                { label: "Unread", value: unreadCount, color: "text-primary" },
                { label: "Critical", value: criticalCount, color: "text-red-600" },
                { label: "Today", value: notifications.filter(n => {
                  const d = new Date(n.timestamp);
                  const today = new Date();
                  return d.toDateString() === today.toDateString();
                }).length, color: "text-slate-700" },
                { label: "This Week", value: notifications.filter(n => {
                  const diff = Date.now() - new Date(n.timestamp).getTime();
                  return diff < 7 * 24 * 60 * 60 * 1000;
                }).length, color: "text-slate-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={cn("text-sm font-bold", color)}>{value}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-bold text-slate-700 mb-2.5">By Category</div>
              <div className="space-y-1.5">
                {CATEGORIES.filter(c => c.id !== "all").map(({ id, label, icon: Icon, color }) => {
                  const count = notifications.filter(n => n.category === id && !n.archived).length;
                  const unread = notifications.filter(n => n.category === id && !n.read && !n.archived).length;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveCategory(id)}
                      className={cn(
                        "w-full flex items-center gap-2 py-1 text-left rounded transition-all",
                        activeCategory === id && "text-primary"
                      )}
                    >
                      <Icon className={cn("w-3 h-3", color)} />
                      <span className="text-[10px] text-slate-600 flex-1">{label}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{count}</span>
                      {unread > 0 && (
                        <span className="w-4 h-4 bg-primary/20 text-primary text-[9px] font-bold rounded-full flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Quick Actions</div>
              <div className="space-y-1.5">
                <button onClick={markAllRead} className="w-full text-xs text-left text-primary hover:underline flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Mark all as read
                </button>
                <button className="w-full text-xs text-left text-slate-500 hover:text-primary flex items-center gap-1.5">
                  <Archive className="w-3 h-3" /> Archive all read
                </button>
                <button onClick={() => setShowPreferences(true)} className="w-full text-xs text-left text-slate-500 hover:text-primary flex items-center gap-1.5">
                  <Settings className="w-3 h-3" /> Notification settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
