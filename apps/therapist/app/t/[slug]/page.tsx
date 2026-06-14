"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Video, Clock, ChevronLeft, ChevronRight, Loader2, Shield, Check } from "lucide-react";

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

interface Offering {
  id: string;
  duration_mins: number;
  price_cents: number;
  currency: string;
}

interface TherapistProfile {
  id: string;
  display_name: string;
  bio: string | null;
  specializations: string[];
  timezone: string;
  avatar_url: string | null;
  offerings: Offering[];
}

type Step = "loading" | "error" | "profile" | "slots" | "form" | "submitting";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>("loading");
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/booking/t/${slug}`)
      .then((res) => {
        const data: TherapistProfile = res?.data ?? res;
        setProfile(data);
        if (data.offerings?.length === 1) setSelectedOffering(data.offerings[0]);
        setStep("profile");
      })
      .catch((err) => {
        setErrorMsg(err.status === 404 ? "This booking page doesn't exist." : "Could not load therapist profile.");
        setStep("error");
      });
  }, [slug]);

  const fetchSlots = useCallback(async (date: string, durationMins: number) => {
    setSlotsLoading(true);
    setSlots([]);
    try {
      const res = await apiFetch(`/booking/t/${slug}/slots?date=${date}&duration_mins=${durationMins}`);
      setSlots(res?.data ?? res ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [slug]);

  const handleDayClick = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const clicked = new Date(calYear, calMonth, day);
    if (clicked < today) return;
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(iso);
    setSelectedSlot(null);
    setStep("slots");
    if (selectedOffering) fetchSlots(iso, selectedOffering.duration_mins);
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setStep("form");
  };

  const handleBook = async () => {
    if (!patientName.trim() || !patientEmail.trim() || !selectedSlot || !selectedOffering) return;
    setStep("submitting");
    setSubmitError(null);
    try {
      const res = await apiFetch(`/booking/t/${slug}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          patient_name: patientName.trim(),
          patient_email: patientEmail.trim(),
          offering_id: selectedOffering.id,
          scheduled_at: selectedSlot,
        }),
      });
      const checkoutUrl = res?.data?.checkout_url ?? res?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        // Dev: no Stripe configured
        window.location.href = `/t/${slug}/confirmed?booking_id=${res?.data?.booking_id ?? res?.booking_id}`;
      }
    } catch (err: any) {
      setSubmitError(err.data?.message || "Could not complete booking. Please try again.");
      setStep("form");
    }
  };

  const formatSlot = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const today = new Date();
  const cells = buildCalendar(calYear, calMonth);

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-md max-w-sm w-full text-center">
          <Video className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <h2 className="text-slate-900 text-xl font-semibold mb-2">Not Found</h2>
          <p className="text-slate-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Therapist header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-start gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-500/20 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Video className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900">{profile?.display_name}</h1>
              {profile?.bio && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{profile.bio}</p>
              )}
              {profile?.specializations && profile.specializations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.specializations.slice(0, 4).map((s) => (
                    <span key={s} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Duration picker */}
        {profile && profile.offerings.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Session Duration
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {profile.offerings.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOffering(o);
                    setSelectedSlot(null);
                    setSlots([]);
                    if (selectedDate) {
                      setStep("slots");
                      fetchSlots(selectedDate, o.duration_mins);
                    }
                  }}
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                    selectedOffering?.id === o.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-lg font-bold text-slate-900">{o.duration_mins} min</span>
                  <span className="text-sm text-slate-500 mt-0.5">
                    ${(o.price_cents / 100).toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar */}
        {selectedOffering && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                  else setCalMonth(m => m - 1);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold text-slate-800">
                {MONTHS[calMonth]} {calYear}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                  else setCalMonth(m => m + 1);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const cellDate = new Date(calYear, calMonth, day);
                cellDate.setHours(0, 0, 0, 0);
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                const isPast = cellDate < todayMidnight;
                const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = iso === selectedDate;
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && handleDayClick(day)}
                    disabled={isPast}
                    className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isPast
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Time slots */}
        {selectedDate && (step === "slots" || step === "form") && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Available times — {formatDate(selectedDate)}
            </h2>
            {slotsLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No available slots for this date.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleSlotSelect(slot)}
                    className={`py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                      selectedSlot === slot
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-700 hover:border-blue-300"
                    }`}
                  >
                    {formatSlot(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking form */}
        {step === "form" && selectedSlot && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Your details</h2>

            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
              <div className="flex justify-between text-slate-600 mb-1">
                <span>{selectedOffering?.duration_mins} min session</span>
                <span className="font-semibold">${((selectedOffering?.price_cents || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="text-slate-400 text-xs">{formatDate(selectedSlot)} at {formatSlot(selectedSlot)}</div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Full name <span className="text-red-500">*</span></label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {submitError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{submitError}</div>
            )}

            <button
              onClick={handleBook}
              disabled={!patientName.trim() || !patientEmail.trim()}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Pay ${((selectedOffering?.price_cents || 0) / 100).toFixed(2)} &amp; Book
            </button>
          </div>
        )}

        {step === "submitting" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Redirecting to payment…</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mt-2">
          <Shield className="w-3.5 h-3.5" />
          <span>Secure payment · No account required</span>
        </div>
      </div>
    </div>
  );
}
