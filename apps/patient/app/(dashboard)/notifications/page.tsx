"use client";

import { useState } from "react";
import {
  Bell, Calendar, MessageSquare, ClipboardList, Heart, Brain,
  AlertTriangle, CheckCircle, Clock, Archive, Trash2, Settings,
  X, ChevronRight, Sparkles, Shield, Filter, MoreHorizontal,
  BookOpen, Star, Activity, Video, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationCategory = "all" | "appointments" | "messages" | "assessments" | "wellness" | "ai" | "system";
type NotificationPriority = "urgent" | "high" | "medium" | "low";

interface PatientNotification {
  id: string;
  category: Exclude<NotificationCategory, "all">;
  priority: NotificationPriority;
  title: string;
  body: string;
  action_label?: string;
  action_href?: string;
  timestamp: string;
  read: boolean;
  archived: boolean;
  icon_override?: string;
}

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

const MOCK_NOTIFICATIONS: PatientNotification[] = [
  {
    id: "n1",
    category: "appointments",
    priority: "high",
    title: "Session reminder — tomorrow at 3:00 PM",
    body: "Your session with Dr. Sarah Chen is tomorrow at 3:00 PM. Join from your device. No download required.",
    action_label: "Join session",
    action_href: "/sessions",
    timestamp: "2h ago",
    read: false,
    archived: false,
  },
  {
    id: "n2",
    category: "assessments",
    priority: "high",
    title: "PHQ-9 assessment is ready for you",
    body: "Dr. Chen has sent you a PHQ-9 mood questionnaire. It takes about 5 minutes to complete and helps track your progress.",
    action_label: "Complete assessment",
    action_href: "/assessments",
    timestamp: "4h ago",
    read: false,
    archived: false,
  },
  {
    id: "n3",
    category: "ai",
    priority: "medium",
    title: "Your weekly wellness summary is ready",
    body: "Based on your mood check-ins this week, your average mood score was 6.8/10 — up from 5.9 last week. You're making progress.",
    action_label: "View summary",
    action_href: "/progress",
    timestamp: "Yesterday",
    read: false,
    archived: false,
  },
  {
    id: "n4",
    category: "messages",
    priority: "medium",
    title: "New message from Dr. Chen",
    body: "Dr. Sarah Chen sent you a message. Tap to read it securely.",
    action_label: "Read message",
    action_href: "/messages",
    timestamp: "Yesterday",
    read: false,
    archived: false,
  },
  {
    id: "n5",
    category: "wellness",
    priority: "low",
    title: "Mood check-in reminder",
    body: "You haven't logged your mood today. A 30-second check-in helps your therapist track your progress between sessions.",
    action_label: "Log mood",
    action_href: "/mood",
    timestamp: "2 days ago",
    read: true,
    archived: false,
  },
  {
    id: "n6",
    category: "appointments",
    priority: "medium",
    title: "Session confirmed — December 30 at 3:00 PM",
    body: "Your next session with Dr. Sarah Chen has been scheduled for Monday, December 30 at 3:00 PM.",
    timestamp: "3 days ago",
    read: true,
    archived: false,
  },
  {
    id: "n7",
    category: "ai",
    priority: "low",
    title: "Journal prompt for today",
    body: "Today's reflection prompt: 'What's one small thing that went well today, and what made it possible?' Writing even one paragraph can be meaningful.",
    action_label: "Open journal",
    action_href: "/journal",
    timestamp: "3 days ago",
    read: true,
    archived: false,
  },
  {
    id: "n8",
    category: "wellness",
    priority: "medium",
    title: "Homework assigned: Thought Record",
    body: "Dr. Chen has assigned you a thought record exercise to complete before your next session. This should take about 15 minutes.",
    action_label: "View homework",
    action_href: "/progress",
    timestamp: "4 days ago",
    read: true,
    archived: false,
  },
  {
    id: "n9",
    category: "assessments",
    priority: "low",
    title: "You completed your PHQ-9 — score: 8",
    body: "Your latest PHQ-9 score is 8 (mild). Your previous score was 11 (moderate). That's real progress.",
    action_label: "View results",
    action_href: "/assessments",
    timestamp: "1 week ago",
    read: true,
    archived: false,
  },
  {
    id: "n10",
    category: "system",
    priority: "low",
    title: "Account security reminder",
    body: "We recommend enabling two-factor authentication for your account to keep your health information secure.",
    action_label: "Update security",
    action_href: "/settings",
    timestamp: "1 week ago",
    read: true,
    archived: false,
  },
  {
    id: "n11",
    category: "messages",
    priority: "low",
    title: "Resource shared by Dr. Chen",
    body: "Dr. Chen shared a resource with you: 'Understanding Cognitive Distortions — A Patient Guide' (PDF, 4 pages).",
    action_label: "View resource",
    action_href: "/resources",
    timestamp: "1 week ago",
    read: true,
    archived: true,
  },
];

const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
  high: { label: "Important", color: "bg-orange-100 text-orange-700" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  low: { label: "", color: "" },
};

export default function PatientNotificationsPage() {
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [notifications, setNotifications] = useState<PatientNotification[]>(MOCK_NOTIFICATIONS);
  const [showPrefs, setShowPrefs] = useState(false);

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const archiveNotif = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, archived: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = notifications.filter((n) => {
    if (n.archived !== showArchived) return false;
    if (activeCategory === "all") return true;
    return n.category === activeCategory;
  });

  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;

  const categoryCount = (cat: Exclude<NotificationCategory, "all">) =>
    notifications.filter((n) => n.category === cat && !n.read && !n.archived).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
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
                  <div
                    className={cn(
                      "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                      pref.enabled ? "bg-[#2EC4B6]" : "bg-gray-200"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        pref.enabled ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
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
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center ml-0.5">
                {unreadCount}
              </span>
            )}
          </button>
          {(Object.entries(CATEGORY_CONFIG) as [Exclude<NotificationCategory, "all">, typeof CATEGORY_CONFIG[keyof typeof CATEGORY_CONFIG]][]).map(
            ([key, cfg]) => {
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
            }
          )}
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
        {filtered.length === 0 ? (
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
              const cfg = CATEGORY_CONFIG[notif.category];
              const CategoryIcon = cfg.icon;
              const priorityCfg = PRIORITY_CONFIG[notif.priority];

              return (
                <div
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={cn(
                    "bg-white rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-sm",
                    notif.read ? "border-gray-200" : "border-l-4 border-l-[#2EC4B6] border-gray-200"
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
                          <span className={cn("font-semibold text-sm", notif.read ? "text-gray-700" : "text-gray-900")}>
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <span className="w-2 h-2 bg-[#2EC4B6] rounded-full flex-shrink-0" />
                          )}
                          {priorityCfg.label && (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", priorityCfg.color)}>
                              {priorityCfg.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-gray-400">{notif.timestamp}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); archiveNotif(notif.id); }}
                            className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 ml-1"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{notif.body}</p>
                      {notif.action_label && (
                        <a
                          href={notif.action_href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#2EC4B6] hover:text-[#26b0a3] font-medium"
                        >
                          {notif.action_label} <ChevronRight className="w-3.5 h-3.5" />
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
        {!showArchived && activeCategory === "all" && (
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
