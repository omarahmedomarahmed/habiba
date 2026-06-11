"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Search, Send, Plus, Paperclip, Smile,
  CheckCheck, Check, Clock, AlertTriangle, Shield, Info,
  Phone, Video, MoreHorizontal, Archive, Trash2, Flag,
  User, Users, ChevronRight, Brain, Sparkles, FileText,
  Image, Download, Calendar, Bell, Filter
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { messagesAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/store";

interface Thread {
  id: string;
  patient_name: string;
  patient_id: string;
  last_message: string;
  last_message_time: string;
  unread: number;
  type: "patient" | "colleague" | "admin";
  status: "active" | "archived";
  urgent?: boolean;
  last_sender: "me" | "them";
}

interface Message {
  id: string;
  sender: "me" | "them";
  content: string;
  timestamp: string;
  type: "text" | "file" | "system" | "ai_suggestion";
  read: boolean;
  flagged?: boolean;
}

const MOCK_THREADS: Thread[] = [
  {
    id: "t1",
    patient_name: "Marcus Webb",
    patient_id: "p2",
    last_message: "I've been meaning to message you — I missed the last session because...",
    last_message_time: "10:23 AM",
    unread: 2,
    type: "patient",
    status: "active",
    urgent: true,
    last_sender: "them",
  },
  {
    id: "t2",
    patient_name: "Sarah Chen",
    patient_id: "p1",
    last_message: "Thank you, Dr. Smith. I'll complete the thought record before Thursday.",
    last_message_time: "Yesterday",
    unread: 0,
    type: "patient",
    status: "active",
    last_sender: "them",
  },
  {
    id: "t3",
    patient_name: "Emily Park",
    patient_id: "p5",
    last_message: "I wanted to ask — is it normal to still feel this way after 2 months?",
    last_message_time: "Yesterday",
    unread: 1,
    type: "patient",
    status: "active",
    last_sender: "them",
  },
  {
    id: "t4",
    patient_name: "Priya Nair",
    patient_id: "p3",
    last_message: "Saw your note from Dr. Fitch. Will discuss weight check-in Thursday.",
    last_message_time: "Dec 20",
    unread: 0,
    type: "patient",
    status: "active",
    last_sender: "me",
  },
  {
    id: "t5",
    patient_name: "James Rodriguez",
    patient_id: "p4",
    last_message: "Looking forward to next week. The EMDR referral sounds right.",
    last_message_time: "Dec 19",
    unread: 0,
    type: "patient",
    status: "active",
    last_sender: "them",
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  t1: [
    {
      id: "m1",
      sender: "them",
      content: "Hi Dr. Smith, I'm sorry about missing the last two sessions. Things have been really hard.",
      timestamp: "Dec 22 · 9:45 AM",
      type: "text",
      read: true,
    },
    {
      id: "m2",
      sender: "me",
      content: "Hi Marcus, I'm glad you reached out. I've been thinking about you. I'd love to connect — are you available for a brief phone call today or tomorrow?",
      timestamp: "Dec 22 · 11:00 AM",
      type: "text",
      read: true,
    },
    {
      id: "m3",
      sender: "them",
      content: "I've been meaning to message you — I missed the last session because I've been drinking again. More than I should.",
      timestamp: "Today · 10:18 AM",
      type: "text",
      read: false,
      flagged: true,
    },
    {
      id: "m4",
      sender: "them",
      content: "I don't want to talk about it but I also know I need to. Can we reschedule?",
      timestamp: "Today · 10:23 AM",
      type: "text",
      read: false,
    },
  ],
  t2: [
    {
      id: "m1",
      sender: "me",
      content: "Great work in session today, Sarah. Remember to complete the thought record whenever you notice the perfectionism voice coming up. Bring it to Thursday's session.",
      timestamp: "Yesterday · 2:30 PM",
      type: "text",
      read: true,
    },
    {
      id: "m2",
      sender: "them",
      content: "Thank you, Dr. Smith. I'll complete the thought record before Thursday.",
      timestamp: "Yesterday · 3:15 PM",
      type: "text",
      read: true,
    },
  ],
  t3: [
    {
      id: "m1",
      sender: "them",
      content: "I wanted to ask — is it normal to still feel this way after 2 months? Sometimes I wonder if therapy is actually helping.",
      timestamp: "Yesterday · 7:45 PM",
      type: "text",
      read: false,
    },
  ],
};

const AI_QUICK_REPLIES = [
  "I'm glad you reached out. How are you feeling right now?",
  "Thank you for telling me that. Can we find a time to talk this week?",
  "This sounds important. Let's make sure to discuss this in our next session.",
  "I hear you. What would be most helpful right now?",
];

export default function MessagesPage() {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(MOCK_THREADS[0]);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "urgent">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [liveThreads, setLiveThreads] = useState(MOCK_THREADS);
  const [liveMessages, setLiveMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    messagesAPI.conversations()
      .then((res: any) => {
        const threads = (res.data || []).map((c: any) => ({
          id: c.id, patient_name: c.name || c.patient_name || 'Unknown',
          patient_id: c.patient_id || c.other_user_id || '',
          last_message: c.last_message || '', last_message_time: c.updated_at || '',
          unread: c.unread_count || 0, type: 'patient' as const, urgent: false, online: false,
          avatar: '', tags: [], hipaa_acknowledged: true,
        }));
        if (threads.length > 0) { setLiveThreads(threads); setSelectedThread(threads[0]); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedThread) return;
    messagesAPI.messages(selectedThread.id)
      .then((res: any) => {
        const msgs = (res.data || []).map((m: any) => ({
          id: m.id, sender: m.sender_role === 'therapist' ? 'me' : 'them' as const,
          content: m.content, timestamp: m.created_at || '',
          read: true, type: 'text' as const,
        }));
        if (msgs.length > 0) setLiveMessages(prev => ({ ...prev, [selectedThread.id]: msgs }));
      })
      .catch(() => {});
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const handleNew = (msg: any) => {
      const convId = msg.conversation_id;
      const newMsg: Message = {
        id: msg.id, sender: 'them', content: msg.content,
        timestamp: msg.created_at, read: false, type: 'text',
      };
      setLiveMessages(prev => ({
        ...prev, [convId]: [...(prev[convId] || []), newMsg],
      }));
    };
    socket.on('new_message', handleNew);
    return () => { socket.off('new_message', handleNew); };
  }, [accessToken]);

  const messages = selectedThread ? liveMessages[selectedThread.id] || [] : [];

  const filteredThreads = liveThreads.filter(t => {
    const matchesSearch = !searchQuery || t.patient_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "unread" ? t.unread > 0 : t.urgent);
    return matchesSearch && matchesFilter;
  });

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedThread) return;
    const text = messageText;
    setMessageText("");
    setShowAISuggestions(false);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, sender: 'me', content: text,
      timestamp: new Date().toISOString(), read: false, type: 'text',
    };
    setLiveMessages(prev => ({
      ...prev, [selectedThread.id]: [...(prev[selectedThread.id] || []), optimistic],
    }));
    try { await messagesAPI.send(selectedThread.id, text); } catch { /* optimistic stays */ }
  };

  const totalUnread = liveThreads.reduce((acc, t) => acc + t.unread, 0);

  return (
    <div className="flex h-full gap-0 -mx-6 -mt-6">
      {/* Thread list */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900">Messages</h2>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#0A2342] text-white hover:bg-[#123A63]">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5 mt-3">
            {(["all", "unread", "urgent"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-medium capitalize transition-all",
                  filter === f ? "bg-[#0A2342] text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* HIPAA notice */}
        <div className="mx-3 my-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <p className="text-[10px] text-blue-700">End-to-end encrypted · HIPAA compliant</p>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.map(thread => {
            const isSelected = selectedThread?.id === thread.id;

            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3.5 transition-all text-left border-b border-gray-50",
                  isSelected ? "bg-[#0A2342]/5 border-l-2 border-l-[#0A2342]" : "hover:bg-gray-50"
                )}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 bg-[#0A2342] rounded-xl flex items-center justify-center text-white text-sm font-bold">
                    {getInitials(thread.patient_name)}
                  </div>
                  {thread.urgent && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn("text-sm font-semibold truncate", isSelected && "text-[#0A2342]")}>
                      {thread.patient_name}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-1">{thread.last_message_time}</span>
                  </div>
                  <p className={cn(
                    "text-xs truncate",
                    thread.unread > 0 ? "text-gray-900 font-medium" : "text-gray-500"
                  )}>
                    {thread.last_sender === "me" ? "You: " : ""}{thread.last_message}
                  </p>
                </div>
                {thread.unread > 0 && (
                  <div className="w-5 h-5 bg-[#0A2342] rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-1">
                    {thread.unread}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message area */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#0A2342] rounded-xl flex items-center justify-center text-white text-sm font-bold">
                {getInitials(selectedThread.patient_name)}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{selectedThread.patient_name}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Patient
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedThread.urgent && (
                <div className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-xl text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risk Signal Detected
                </div>
              )}
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <Phone className="h-4 w-4" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <Video className="h-4 w-4" />
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* HIPAA + clinical note banner */}
          <div className="mx-4 my-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-700 shrink-0">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            All messages are HIPAA-compliant and encrypted. These messages may be included in the clinical record.
          </div>

          {/* Risk banner if urgent */}
          {selectedThread.urgent && (
            <div className="mx-4 mb-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3 shrink-0">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Risk Signal Detected in Recent Messages</p>
                  <p className="text-xs text-red-700 mt-0.5">Patient disclosed alcohol use increase and expressed avoidance. Radar score: 83. Consider immediate outreach.</p>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-700">Call Patient Now</button>
                    <button className="text-xs border border-red-300 text-red-700 px-3 py-1 rounded-lg hover:bg-red-100">View Risk Profile</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-2", message.sender === "me" ? "flex-row-reverse" : "flex-row")}
              >
                {message.sender === "them" && (
                  <div className="w-7 h-7 bg-[#0A2342] rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-auto">
                    {getInitials(selectedThread.patient_name)}
                  </div>
                )}
                <div className={cn("max-w-xs lg:max-w-md xl:max-w-lg")}>
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    message.sender === "me"
                      ? "bg-[#0A2342] text-white rounded-tr-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                  )}>
                    {message.flagged && (
                      <div className="flex items-center gap-1 text-[10px] text-red-400 mb-1.5 font-semibold">
                        <Flag className="h-2.5 w-2.5" /> Clinical signal flagged
                      </div>
                    )}
                    {message.content}
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 mt-1",
                    message.sender === "me" ? "justify-end" : "justify-start"
                  )}>
                    <span className="text-[10px] text-gray-400">{message.timestamp}</span>
                    {message.sender === "me" && (
                      message.read ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Quick Replies */}
          {showAISuggestions && (
            <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-xl p-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold mb-2">
                <Sparkles className="h-3.5 w-3.5" /> AI Quick Replies
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => { setMessageText(reply); setShowAISuggestions(false); }}
                    className="text-xs bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    {reply.length > 50 ? reply.substring(0, 50) + "..." : reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
            <div className="flex items-end gap-3">
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a clinical message..."
                  rows={1}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none pr-10"
                />
              </div>
              <button
                onClick={() => setShowAISuggestions(!showAISuggestions)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-xl transition-colors",
                  showAISuggestions ? "bg-indigo-100 text-indigo-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={sendMessage}
                disabled={!messageText.trim()}
                className="w-9 h-9 flex items-center justify-center bg-[#0A2342] text-white rounded-xl hover:bg-[#123A63] disabled:opacity-40 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Messages are logged in the clinical record · Non-emergency · Response within 1 business day
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
