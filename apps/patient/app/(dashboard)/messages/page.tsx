"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Search, User, Paperclip, Smile, Info, Phone,
  Video, MoreHorizontal, Clock, CheckCheck, Check,
  Brain, Shield, AlertCircle, ChevronDown, Heart, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const THREADS: Thread[] = [
  {
    id: "t1",
    participant: {
      name: "Dr. Alex Smith",
      role: "therapist",
      title: "Licensed Clinical Psychologist",
      initials: "AS",
      gradient: "from-blue-500 to-indigo-600",
      online: false
    },
    last_message: "Looking forward to seeing you on Monday. Please complete the PHQ-9 beforehand.",
    last_time: "Yesterday",
    unread: 1,
    pinned: true
  },
  {
    id: "t2",
    participant: {
      name: "24Therapy Support",
      role: "support",
      initials: "24",
      gradient: "from-[#0A2342] to-[#2F80ED]",
      online: true
    },
    last_message: "Your appointment reminder: Monday Dec 22 at 10:00 AM",
    last_time: "2h ago",
    unread: 0,
    pinned: false
  }
];

const MESSAGES: Message[] = [
  {
    id: "m1", content: "Hi Sarah! Just checking in before your session on Monday. How are you feeling this week?",
    sender: "therapist", time: "Dec 16, 9:15 AM", status: "read", type: "text"
  },
  {
    id: "m2", content: "Hi Dr. Smith! I'm doing okay — had a stressful week with the work review but I used the breathing exercises and they really helped!",
    sender: "me", time: "Dec 16, 10:42 AM", status: "read", type: "text"
  },
  {
    id: "m3", content: "That's wonderful to hear! Using coping skills under real stress is exactly the progress we've been working toward. I'm really proud of you.",
    sender: "therapist", time: "Dec 16, 11:05 AM", status: "read", type: "text"
  },
  {
    id: "m4", content: "Thank you 😊 I also finished the thought records homework — I found it actually really helpful for catching the perfectionist thoughts.",
    sender: "me", time: "Dec 16, 11:22 AM", status: "read", type: "text"
  },
  {
    id: "m5", content: "Excellent! Let's review those together on Monday. In the meantime, I've shared a resource you might find helpful for our upcoming holiday stress conversation.",
    sender: "therapist", time: "Dec 16, 2:30 PM", status: "read", type: "text"
  },
  {
    id: "m6", content: "CBT Strategies for Holiday Stress",
    sender: "therapist", time: "Dec 16, 2:31 PM", status: "read", type: "resource",
    resource_title: "CBT Strategies for Holiday Stress — Article"
  },
  {
    id: "m7", content: "Please remember to complete the PHQ-9 assessment before Monday's session. It takes about 3 minutes.",
    sender: "therapist", time: "Dec 18, 9:00 AM", status: "read", type: "reminder"
  },
  {
    id: "m8", content: "Looking forward to seeing you on Monday. Please complete the PHQ-9 beforehand.",
    sender: "therapist", time: "Dec 19, 4:15 PM", status: "delivered", type: "text"
  },
];

const QUICK_REPLIES = [
  "Thank you, Dr. Smith!",
  "I'll complete it before Monday",
  "See you Monday at 10!",
  "I have a question about...",
];

export default function MessagesPage() {
  const [activeThread, setActiveThread] = useState<string>("t1");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`, content: text, sender: "me",
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      status: "sending", type: "text"
    };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, status: "delivered" as const } : m));
    }, 1000);
  };

  const activeThreadData = THREADS.find(t => t.id === activeThread);

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
          {THREADS.map(thread => (
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
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
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
