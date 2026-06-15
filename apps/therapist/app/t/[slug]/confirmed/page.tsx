"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Video, Calendar, Clock, Link2, Loader2, Copy } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://habiba-production.up.railway.app/api/v1";

async function apiFetch(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface BookingConfirmation {
  id: string;
  patient_name: string;
  patient_email: string;
  scheduled_at: string;
  duration_mins: number;
  price_cents: number;
  therapist_name: string;
  therapist_avatar_url: string | null;
  join_token: string | null;
  session_id: string | null;
}

function BookingConfirmedInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");

  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    apiFetch(`/booking/confirmed/${bookingId}`)
      .then((res) => setBooking(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  const joinUrl = booking?.join_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${booking.join_token}`
    : null;

  const gcalUrl = booking?.scheduled_at && joinUrl
    ? (() => {
        const start = new Date(booking.scheduled_at);
        const end = new Date(start.getTime() + booking.duration_mins * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
          `&text=${encodeURIComponent(`Session with ${booking.therapist_name}`)}` +
          `&dates=${fmt(start)}/${fmt(end)}` +
          `&details=${encodeURIComponent(`Join your session: ${joinUrl}`)}&sf=true&output=xml`;
      })()
    : null;

  const copyLink = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">You&apos;re booked!</h1>
          <p className="text-slate-500 text-sm">Check your email for confirmation and the join link.</p>
        </div>

        {booking ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
            {/* Therapist */}
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
              {booking.therapist_avatar_url ? (
                <img src={booking.therapist_avatar_url} alt={booking.therapist_name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Video className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Session with</p>
                <p className="font-semibold text-slate-900">{booking.therapist_name}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-700">
                  {new Date(booking.scheduled_at).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-700">
                  {new Date(booking.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{booking.duration_mins} minutes
                </span>
              </div>
            </div>

            {/* Join link */}
            {joinUrl && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Your join link</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 text-xs text-slate-600 truncate font-mono">{joinUrl}</span>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <a
                  href={joinUrl}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Join Session
                </a>
                {gcalUrl && (
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Add to Google Calendar
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4 text-center text-slate-500 text-sm">
            Your booking is confirmed. Check your email for details.
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          A confirmation email has been sent to {booking?.patient_email || "your inbox"}.
        </p>
      </div>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <BookingConfirmedInner />
    </Suspense>
  );
}
