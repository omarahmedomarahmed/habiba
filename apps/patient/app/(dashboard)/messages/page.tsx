"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle, Send, Paperclip, Phone, Video,
  Info, Shield, ChevronLeft, MoreVertical
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const MOCK_MESSAGES = [
  {
    id: "m1", sender: "therapist", name: "Dr. Smith",
    text: "Hi Sarah! I wanted to check in on how you're feeling since our last session. Have you had a chance to practice the breathing exercises we discussed?",
    timestamp: "2025-12-15T11:00:00Z", read: true,
  },
  {
    id: "m2", sender: "patient",
    text: "Hi Dr. Smith! Yes, I've been practicing the 4-7-8 breathing every evening before bed. It has been helping with the sleep anxiety a lot.",
    timestamp: "2025-12-15T11:30:00Z", read: true,
  },
  {
    id: "m3", sender: "therapist", name: "Dr. Smith",
    text: "That's wonderful to hear! Consistency is key. I'm also sending you a thought record worksheet to try before our next session. Fill it out whenever you notice a negative thought pattern.",
    timestamp: "2025-12-15T11:45:00Z", read: true,
  },
  {
    id: "m4", sender: "patient",
    text: "Thank you! I'll start using it today. Looking forward to our session on Monday.",
    timestamp: "2025-12-15T12:00:00Z", read: true,
  },
  {
    id: "m5", sender: "therapist", name: "Dr. Smith",
    text: "I just sent you a PHQ-9 assessment to complete before our next session. It will help us track your progress. It takes about 5 minutes. 😊",
    timestamp: "2025-12-16T09:00:00Z", read: false,
  },
];

export default function PatientMessagesPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    const newMsg = {
      id: `m${Date.now()}`,
      sender: "patient" as const,
      text: message.trim(),
      timestamp: new Date().toISOString(),
      read: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
          <span className="text-sm font-bold text-blue-700">DS</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 text-sm">Dr. Smith</p>
          <p className="text-xs text-slate-400">Your therapist · Online</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* HIPAA Notice */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          All messages are encrypted and HIPAA-compliant. For emergencies, call 988 or 911.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-h-[calc(100vh-200px)]">
        {messages.map((msg, i) => {
          const isTherapist = msg.sender === "therapist";
          const showDate = i === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[i - 1].timestamp).toDateString();

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-2">
                  <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {formatDate(msg.timestamp)}
                  </span>
                </div>
              )}
              <div className={cn("flex items-end gap-2", isTherapist ? "justify-start" : "justify-end")}>
                {isTherapist && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-600">DS</span>
                  </div>
                )}
                <div className={cn(
                  "max-w-xs lg:max-w-sm xl:max-w-md px-4 py-3 rounded-2xl text-sm",
                  isTherapist
                    ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                    : "bg-blue-600 text-white rounded-br-sm"
                )}>
                  <p className="leading-relaxed">{msg.text}</p>
                  <p className={cn("text-[10px] mt-1.5",
                    isTherapist ? "text-slate-400" : "text-blue-200"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {!isTherapist && msg.read && " · Read"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-end gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Dr. Smith..."
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none outline-none max-h-24"
              rows={1}
            />
            <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <Paperclip className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
              message.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 px-1">
          Messages are for non-urgent communication only. Response within 24-48 hours.
        </p>
      </div>
    </div>
  );
}
