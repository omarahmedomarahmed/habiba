"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Video, Mic, MicOff, Shield, AlertCircle, Loader2, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://habiba-production.up.railway.app/api/v1";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message || "Request failed"), { status: res.status, data: err });
  }
  return res.json();
}

interface SessionInfo {
  session_id: string;
  therapist_name: string;
  scheduled_at: string;
  status: string;
  video_room_url: string | null;
}

export default function JoinSessionPage() {
  const params = useParams();
  const token = params.token as string;

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/sessions/join/${token}`)
      .then((data: any) => {
        const session = data?.data?.session ?? data?.data ?? data;
        setSessionInfo(session);
      })
      .catch((err: any) => {
        setLoadError(err.status === 404 ? "This session link is not valid or has ended." : "Could not load session. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
    } catch {
      setMicGranted(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return;
    setJoining(true);
    try {
      const res = await apiFetch(`/sessions/join/${token}`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      const data = res?.data ?? res;
      setVideoUrl(data?.video_room_url ?? sessionInfo?.video_room_url ?? null);
      setJoined(true);
    } catch (err: any) {
      setLoadError(err.data?.message || "Could not join session. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
          <p className="text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Session Unavailable</h2>
          <p className="text-slate-400 text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  if (joined && videoUrl) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white text-sm font-medium">Session with {sessionInfo?.therapist_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-xs">End-to-end encrypted</span>
          </div>
        </div>
        <iframe
          src={videoUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          className="flex-1 w-full border-0"
        />
      </div>
    );
  }

  if (joined && !videoUrl) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-400" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">You're in the waiting room</h2>
          <p className="text-slate-400 text-sm">Your therapist will start the session shortly.</p>
        </div>
      </div>
    );
  }

  const scheduledStr = sessionInfo?.scheduled_at
    ? new Date(sessionInfo.scheduled_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Join Session</h1>
          <p className="text-slate-400 text-sm">
            with <span className="text-white font-medium">{sessionInfo?.therapist_name}</span>
          </p>
          {scheduledStr && (
            <p className="text-slate-500 text-xs mt-1">{scheduledStr}</p>
          )}
        </div>

        {/* Mic permission */}
        {micGranted === null && (
          <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <Mic className="w-5 h-5 text-blue-400" />
              <span className="text-white text-sm font-medium">Microphone access needed</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">We need microphone access for real-time transcription and AI note generation.</p>
            <button
              onClick={requestMic}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Allow Microphone
            </button>
          </div>
        )}

        {micGranted === false && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3 mb-4 flex items-center gap-2">
            <MicOff className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-amber-300 text-xs">Microphone blocked — AI transcription won't work. You can still join.</p>
          </div>
        )}

        {micGranted === true && (
          <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-green-300 text-xs">Microphone ready</p>
          </div>
        )}

        {/* Join form */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Your name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email <span className="text-slate-500">(optional — for session summary)</span></label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleJoin}
            disabled={!name.trim() || joining}
            className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            {joining ? "Joining..." : "Join Session"}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>No account required · End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
