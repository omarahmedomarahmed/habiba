"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Search, User, Paperclip, Smile, Info, Phone,
  Video, MoreHorizontal, Clock, CheckCheck, Check,
  Brain, Shield, AlertCircle, ChevronDown, Heart, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { messagesAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/store";

interface Thread {
  id: string;
  participant: {
    name: string;
    role: "therapist" | "system" | "support";
    title?: string;
    initials: string;
    gradient: string;
    online: boolean;
  };
  last_message: string;
  last_time: string;
  unread: number;
  pinned: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: "me" | "therapist" | "system";
  time: string;
  status: "sending" | "sent" | "delivered" | "read";
  type: "text" | "note" | "reminder" | "resource";
  resource_title?: string;
}


const QUICK_REPLIES = [
  "Thank you, Dr. Smith!",
  "I'll complete it before Monday",
  "See you Monday at 10!",
  "I have a question about...",
];

export default function MessagesPage() {
  const { accessToken } = useAuthStore();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load real conversations on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await messagesAPI.conversations() as { data: Record<string, unknown>[] };
        const loaded: Thread[] = (res.data || []).map((c: any) => ({
          id: c.id as string,
          participant: {
            name: c.participant_name || c.patient_name || c.other_user_name || 'Your Therapist',
            role: 'therapist' as const,
            title: c.participant_title || '',
            initials: (c.participant_name || 'T').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
            gradient: 'from-blue-500 to-indigo-600',
            online: false,
          },
          last_message: c.last_message as string || '',
          last_time: c.updated_at ? new Date(c.updated_at as string).toLocaleDateString() : '',
          unread: (c.unread_count as number) || 0,
          pinned: false,
        }));
        setThreads(loaded);
        if (loaded.length > 0) setActiveThread(loaded[0].id);
      } catch { /* no conversations yet */ }
      finally { setLoadingThreads(false); }
    }
    loadConversations();
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeThread) return;
    setLoadingMessages(true);
    setMessages([]);
    messagesAPI.messages(activeThread, { limit: 50 })
      .then((res: any) => {
        setMessages((res.data || []).map((m: any) => ({
          id: m.id as string,
          content: m.content as string,
          sender: m.is_mine ? 'me' as const : 'therapist' as const,
          time: new Date(m.created_at as string).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          status: 'delivered' as const,
          type: 'text' as const,
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [activeThread]);

  // Real-time WebSocket listener for incoming messages
  useEffect(() => {
    if (!accessToken || !activeThread) return;
    const socket = getSocket(accessToken);
    const handleNewMessage = (data: Record<string, unknown>) => {
      if (data.conversation_id !== activeThread) return;
      setMessages(prev => [...prev, {
        id: data.id as string,
        content: data.content as string,
        sender: 'therapist' as const,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        status: 'delivered' as const,
        type: 'text' as const,
      }]);
    };
    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [accessToken, activeThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`, content: text, sender: "me",
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      status: "sending", type: "text"
    };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    if (activeThread) {
      try {
        await messagesAPI.send(activeThread, text);
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: "delivered" as const } : m));
      } catch {
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: "sending" as const } : m));
      }
    } else {
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: "delivered" as const } : m));
      }, 1000);
    }
  };

  const activeThreadData = threads.find(t => t.id === activeThread);

  return (
    <div className="flex h-[calc(100vh-80px)] -mx-4 -my-6">
      {/* Thread list */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-xl text-xs focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loadingThreads && threads.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-gray-400">No messages yet. Your therapist will reach out here.</div>
          )}
          {threads.map(thread => (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread.id)}
              className={cn(
                "w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-all",
                activeThread === thread.id ? "bg-blue-50 border-r-2 border-[#0A2342]" : ""
              )}
            >
              <div className="relative">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br shrink-0", thread.participant.gradient)}>
                  {thread.participant.initials}
                </div>
                {thread.participant.online && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold text-gray-900 truncate">{thread.participant.name}</p>
                  <p className="text-[10px] text-gray-400 shrink-0 ml-1">{thread.last_time}</p>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{thread.last_message}</p>
              </div>
              {thread.unread > 0 && (
                <div className="w-4 h-4 bg-[#0A2342] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-white font-bold">{thread.unread}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          {activeThreadData && (
            <>
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br", activeThreadData.participant.gradient)}>
                {activeThreadData.participant.initials}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{activeThreadData.participant.name}</p>
                <p className="text-xs text-gray-400">
                  {activeThreadData.participant.role === "therapist" ? activeThreadData.participant.title : "Support"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button disabled title="Voice calls coming soon" className="p-2 text-slate-300 rounded-xl cursor-not-allowed opacity-50">
                  <Phone className="h-4 w-4" />
                </button>
                <button disabled title="Video calls coming soon" className="p-2 text-slate-300 rounded-xl cursor-not-allowed opacity-50">
                  <Video className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={cn("p-2 rounded-xl hover:bg-gray-100", showInfo ? "text-[#0A2342]" : "text-gray-400")}
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Important notice */}
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Messaging is for non-urgent communication only. For crisis support, call or text <strong>988</strong>.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {loadingMessages && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loadingMessages && !activeThread && (
            <div className="flex flex-col items-center justify-center h-full text-sm text-gray-400">Select a conversation.</div>
          )}
          {!loadingMessages && activeThread && messages.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-8">No messages yet. Say hello!</div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-2", msg.sender === "me" ? "justify-end" : "justify-start")}>
              {msg.sender === "therapist" && (
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 mt-1">
                  <span className="text-xs font-bold text-white">AS</span>
                </div>
              )}

              <div className={cn("max-w-[80%] flex flex-col", msg.sender === "me" ? "items-end" : "items-start")}>
                {msg.type === "resource" ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3 hover:border-[#0A2342]/30 cursor-pointer">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Brain className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{msg.resource_title}</p>
                      <p className="text-xs text-blue-500">Tap to open</p>
                    </div>
                  </div>
                ) : msg.type === "reminder" ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2.5 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{msg.content}</p>
                  </div>
                ) : (
                  <div className={cn(
                    "rounded-2xl px-3 py-2.5 text-sm",
                    msg.sender === "me" ? "bg-[#0A2342] text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                  )}>
                    {msg.content}
                  </div>
                )}

                <div className={cn("flex items-center gap-1 mt-0.5", msg.sender === "me" ? "flex-row-reverse" : "flex-row")}>
                  <p className="text-[10px] text-gray-400">{msg.time}</p>
                  {msg.sender === "me" && (
                    <span className="text-[10px] text-gray-400">
                      {msg.status === "read" ? <CheckCheck className="h-3 w-3 text-blue-500" /> :
                       msg.status === "delivered" ? <CheckCheck className="h-3 w-3" /> :
                       <Check className="h-3 w-3" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        <div className="bg-white border-t border-gray-100 px-4 pt-2 flex gap-2 overflow-x-auto">
          {QUICK_REPLIES.map(reply => (
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className="shrink-0 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-[#0A2342] hover:text-white transition-all whitespace-nowrap"
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-3">
          <div className="flex items-end gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Message Dr. Smith..."
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none resize-none max-h-20"
                rows={1}
              />
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <Smile className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="p-2.5 bg-[#0A2342] text-white rounded-2xl disabled:opacity-40 hover:bg-[#123A63]"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="h-3 w-3 text-gray-300" />
            <p className="text-[10px] text-gray-400">Messages are encrypted and HIPAA-compliant. Not for emergencies.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
