"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Video, Mic, MicOff, Shield, AlertCircle, Loader2, Check, CreditCard } from "lucide-react";

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
  therapist_id: string;
  therapist_name: string;
  therapist_avatar_url: string | null;
  scheduled_at: string;
  status: string;
  video_room_url: string | null;
  requires_payment: boolean;
  session_price_cents: number | null;
  patient_payment_status: string;
}

type Phase = "loading" | "error" | "payment" | "mic" | "form" | "joining" | "session" | "waiting";

function JoinSessionInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await apiFetch(`/sessions/join/${token}`);
      const session: SessionInfo = data?.data?.session ?? data?.data ?? data;
      setSessionInfo(session);

      const returnedPaid = searchParams.get("paid") === "1";

      if (session.requires_payment && session.patient_payment_status !== "paid" && !returnedPaid) {
        setPhase("payment");
      } else {
        setPhase("mic");
      }
    } catch (err: any) {
      setErrorMsg(
        err.status === 404
          ? "This session link is not valid or has ended."
          : "Could not load session. Please try again.",
      );
      setPhase("error");
    }
  }, [token, searchParams]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const handlePay = async () => {
    if (!email.trim() || !sessionInfo) return;
    setPaymentLoading(true);
    try {
      const res = await apiFetch(`/sessions/join/${token}/pay`, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const checkoutUrl = res?.data?.checkout_url ?? res?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        // Stripe not configured (dev) — proceed anyway
        setPhase("mic");
      }
    } catch (err: any) {
      setErrorMsg(err.data?.message || "Could not initiate payment. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      setPhase("form");
    } catch {
      setMicGranted(false);
      setPhase("form");
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) return;
    setPhase("joining");
    try {
      const res = await apiFetch(`/sessions/join/${token}`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      const data = res?.data ?? res;
      const url = data?.video_room_url ?? sessionInfo?.video_room_url ?? null;
      setVideoUrl(url);
      setPhase(url ? "session" : "waiting");
    } catch (err: any) {
      setErrorMsg(err.data?.message || "Could not join session. Please try again.");
      setPhase("error");
    }
  };

  const scheduledStr = sessionInfo?.scheduled_at
    ? new Date(sessionInfo.scheduled_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  const priceStr = sessionInfo?.session_price_cents
    ? `$${(sessionInfo.session_price_cents / 100).toFixed(2)}`
    : null;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
          <p className="text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Session Unavailable</h2>
          <p className="text-slate-400 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Payment Gate ───────────────────────────────────────────────────────────
  if (phase === "payment") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Therapist header */}
          <div className="text-center mb-8">
            {sessionInfo?.therapist_avatar_url ? (
              <img
                src={sessionInfo.therapist_avatar_url}
                alt={sessionInfo.therapist_name}
                className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 ring-2 ring-blue-500/30"
              />
            ) : (
              <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-white mb-1">Session with</h1>
            <p className="text-blue-400 text-lg font-medium">{sessionInfo?.therapist_name}</p>
            {scheduledStr && <p className="text-slate-500 text-xs mt-1">{scheduledStr}</p>}
          </div>

          {/* Price card */}
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 mb-4">
            <div className="text-center mb-5">
              <p className="text-slate-400 text-sm mb-1">Session fee</p>
              <p className="text-white text-4xl font-bold">{priceStr}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email for receipt</label>
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
              onClick={handlePay}
              disabled={!email.trim() || paymentLoading}
              className="w-full mt-4 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {paymentLoading ? "Redirecting..." : `Pay ${priceStr} to Join`}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure payment · HIPAA compliant</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Session (video) ────────────────────────────────────────────────────────
  if (phase === "session" && videoUrl) {
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

  // ── Waiting room ───────────────────────────────────────────────────────────
  if (phase === "waiting") {
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

  // ── Mic + Form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Join Session</h1>
          <p className="text-slate-400 text-sm">
            with <span className="text-white font-medium">{sessionInfo?.therapist_name}</span>
          </p>
          {scheduledStr && <p className="text-slate-500 text-xs mt-1">{scheduledStr}</p>}
        </div>

        {phase === "mic" && (
          <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <Mic className="w-5 h-5 text-blue-400" />
              <span className="text-white text-sm font-medium">Microphone access needed</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">We need mic access for real-time transcription and AI notes.</p>
            <button
              onClick={requestMic}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Allow Microphone
            </button>
          </div>
        )}

        {phase === "form" && (
          <>
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
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Email <span className="text-slate-500">(optional — for session summary)</span>
                  </label>
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
                disabled={!name.trim() || phase === "joining"}
                className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {phase === "joining" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                {phase === "joining" ? "Joining..." : "Join Session"}
              </button>
            </div>
          </>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>No account required · End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}

export default function JoinSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    }>
      <JoinSessionInner />
    </Suspense>
  );
}
