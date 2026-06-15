"use client";

import { useState, useEffect } from "react";
import { Link2, Copy, Check, Clock, DollarSign, Save, CalendarDays } from "lucide-react";
import { therapistsAPI, bookingAPI } from "@/lib/api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS: string[] = [];
for (let h = 8; h <= 20; h++) {
  const hStr = h.toString().padStart(2, "0");
  TIME_OPTIONS.push(`${hStr}:00`);
  if (h < 20) TIME_OPTIONS.push(`${hStr}:30`);
}

function formatTime(t: string) {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${mm} ${suffix}`;
}

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface Offering {
  duration_mins: number;
  price_cents: number;
  is_enabled: boolean;
}

export default function BookingPage() {
  // --- Slug state ---
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMsg, setSlugMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Availability state ---
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false }))
  );
  const [availSaving, setAvailSaving] = useState(false);
  const [availMsg, setAvailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // --- Offerings state ---
  const [offerings, setOfferings] = useState<Offering[]>([
    { duration_mins: 30, price_cents: 0, is_enabled: false },
    { duration_mins: 60, price_cents: 0, is_enabled: false },
  ]);
  const [offeringSaving, setOfferingSaving] = useState(false);
  const [offeringMsg, setOfferingMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Load on mount
  useEffect(() => {
    therapistsAPI.me().then((me) => {
      const s = (me.public_slug as string) || "";
      setSlug(s);
      setSlugInput(s);
    }).catch(() => {});

    therapistsAPI.availability().then((data) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      setSlots(
        DAYS.map((_, i) => {
          const existing = data.find((d: Record<string, unknown>) => d.day_of_week === i);
          if (existing) {
            return {
              day_of_week: i,
              start_time: (existing.start_time as string) || "09:00",
              end_time: (existing.end_time as string) || "17:00",
              is_active: existing.is_active !== false,
            };
          }
          return { day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false };
        })
      );
    }).catch(() => {});

    bookingAPI.myOfferings().then((data) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      const merged = [
        { duration_mins: 30, price_cents: 0, is_enabled: false },
        { duration_mins: 60, price_cents: 0, is_enabled: false },
      ].map((def) => {
        const found = data.find((o) => o.duration_mins === def.duration_mins);
        return found ? { duration_mins: found.duration_mins, price_cents: found.price_cents, is_enabled: found.is_enabled } : def;
      });
      setOfferings(merged);
    }).catch(() => {});
  }, []);

  // --- Slug handlers ---
  async function saveSlug() {
    const trimmed = slugInput.trim();
    if (!trimmed) { setSlugMsg({ type: "err", text: "Slug cannot be empty." }); return; }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      setSlugMsg({ type: "err", text: "Only lowercase letters, numbers, and hyphens allowed." });
      return;
    }
    setSlugSaving(true);
    setSlugMsg(null);
    try {
      await therapistsAPI.updateSlug(trimmed);
      setSlug(trimmed);
      setSlugMsg({ type: "ok", text: "Booking link saved." });
    } catch {
      setSlugMsg({ type: "err", text: "Could not save — slug may already be taken." });
    } finally {
      setSlugSaving(false);
    }
  }

  function copyLink() {
    const url = `https://24therapy.ai/t/${slug || slugInput}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // --- Availability handlers ---
  function toggleDay(i: number) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, is_active: !s.is_active } : s));
  }

  function updateSlotTime(i: number, field: "start_time" | "end_time", val: string) {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function saveAvailability() {
    setAvailSaving(true);
    setAvailMsg(null);
    try {
      await therapistsAPI.updateAvailability(slots as unknown as Record<string, unknown>[]);
      setAvailMsg({ type: "ok", text: "Availability saved." });
    } catch {
      setAvailMsg({ type: "err", text: "Failed to save availability." });
    } finally {
      setAvailSaving(false);
    }
  }

  // --- Offerings handlers ---
  function toggleOffering(i: number) {
    setOfferings((prev) => prev.map((o, idx) => idx === i ? { ...o, is_enabled: !o.is_enabled } : o));
  }

  function setOfferingPrice(i: number, val: string) {
    const dollars = parseFloat(val) || 0;
    setOfferings((prev) => prev.map((o, idx) => idx === i ? { ...o, price_cents: Math.round(dollars * 100) } : o));
  }

  async function saveOfferings() {
    setOfferingSaving(true);
    setOfferingMsg(null);
    try {
      await bookingAPI.updateOfferings(offerings);
      setOfferingMsg({ type: "ok", text: "Session offerings saved." });
    } catch {
      setOfferingMsg({ type: "err", text: "Failed to save offerings." });
    } finally {
      setOfferingSaving(false);
    }
  }

  const publicUrl = `24therapy.ai/t/${slug || slugInput || "your-name"}`;

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Booking</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your public booking link, availability, and session offerings.</p>
        </div>

        {/* ── Section 1: Booking Link ─────────────────────────────── */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-[#2EC4B6]" />
            <h2 className="font-semibold text-white">Booking Link</h2>
          </div>

          {/* URL preview */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-4">
            <span className="text-gray-400 text-sm truncate">{publicUrl}</span>
            <button
              onClick={copyLink}
              className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs text-[#2EC4B6] hover:text-teal-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Custom slug</label>
              <input
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="your-name"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#2EC4B6] transition-colors"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={saveSlug}
                disabled={slugSaving || slugInput === slug}
                className="flex items-center gap-1.5 bg-[#2EC4B6] hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {slugSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {slugMsg && (
            <p className={`mt-2 text-xs ${slugMsg.type === "ok" ? "text-[#2EC4B6]" : "text-red-400"}`}>
              {slugMsg.text}
            </p>
          )}
        </div>

        {/* ── Section 2: Availability ────────────────────────────── */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-[#2EC4B6]" />
            <h2 className="font-semibold text-white">Session Availability</h2>
          </div>

          <div className="space-y-3">
            {DAYS.map((day, i) => {
              const slot = slots[i];
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {/* Day toggle */}
                  <button
                    onClick={() => toggleDay(i)}
                    className={`flex-shrink-0 w-full sm:w-28 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      slot.is_active
                        ? "bg-[#2EC4B6]/10 border-[#2EC4B6] text-[#2EC4B6]"
                        : "bg-gray-900 border-gray-700 text-gray-500"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${slot.is_active ? "bg-[#2EC4B6]" : "bg-gray-600"}`} />
                    {day.slice(0, 3)}
                  </button>

                  {/* Time selects */}
                  {slot.is_active && (
                    <div className="flex items-center gap-2 flex-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <select
                        value={slot.start_time}
                        onChange={(e) => updateSlotTime(i, "start_time", e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:border-[#2EC4B6] transition-colors"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </select>
                      <span className="text-gray-500 text-xs flex-shrink-0">to</span>
                      <select
                        value={slot.end_time}
                        onChange={(e) => updateSlotTime(i, "end_time", e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:border-[#2EC4B6] transition-colors"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{formatTime(t)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!slot.is_active && (
                    <span className="text-gray-600 text-xs sm:ml-2">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={saveAvailability}
            disabled={availSaving}
            className="mt-5 flex items-center gap-1.5 bg-[#2EC4B6] hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {availSaving ? "Saving…" : "Save Availability"}
          </button>

          {availMsg && (
            <p className={`mt-2 text-xs ${availMsg.type === "ok" ? "text-[#2EC4B6]" : "text-red-400"}`}>
              {availMsg.text}
            </p>
          )}
        </div>

        {/* ── Section 3: Session Offerings ──────────────────────── */}
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-[#2EC4B6]" />
            <h2 className="font-semibold text-white">Session Offerings</h2>
          </div>

          <div className="space-y-4">
            {offerings.map((o, i) => (
              <div key={o.duration_mins} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                o.is_enabled ? "bg-gray-900 border-[#2EC4B6]/40" : "bg-gray-900 border-gray-700 opacity-60"
              }`}>
                {/* Toggle */}
                <button
                  onClick={() => toggleOffering(i)}
                  className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                    o.is_enabled ? "bg-[#2EC4B6]" : "bg-gray-600"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    o.is_enabled ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>

                {/* Duration label */}
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-white">{o.duration_mins}-min session</span>
                  </div>
                  {!o.is_enabled && <span className="text-xs text-gray-500 mt-0.5 block">Disabled</span>}
                </div>

                {/* Price input */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={o.price_cents > 0 ? (o.price_cents / 100).toFixed(0) : ""}
                    onChange={(e) => setOfferingPrice(i, e.target.value)}
                    placeholder="0"
                    disabled={!o.is_enabled}
                    className="w-20 bg-gray-800 border border-gray-700 rounded-xl px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-[#2EC4B6] disabled:opacity-40 transition-colors"
                  />
                  <span className="text-gray-500 text-xs">USD</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveOfferings}
            disabled={offeringSaving}
            className="mt-5 flex items-center gap-1.5 bg-[#2EC4B6] hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {offeringSaving ? "Saving…" : "Save Offerings"}
          </button>

          {offeringMsg && (
            <p className={`mt-2 text-xs ${offeringMsg.type === "ok" ? "text-[#2EC4B6]" : "text-red-400"}`}>
              {offeringMsg.text}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
