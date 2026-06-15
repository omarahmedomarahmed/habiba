"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, CheckCircle2, Calendar } from "lucide-react";
import { getApiUrl } from "@/lib/env";

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  title?: string;
  specializations?: string[];
  verification_status?: string;
  average_rating?: number;
  availability?: string;
  public_slug?: string;
}

const AVAIL_BADGE: Record<string, { label: string; cls: string }> = {
  today:     { label: "Available today",     cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  this_week: { label: "Available this week", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  next_week: { label: "Next week",           cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function getAvatarGradient(name: string) {
  const colors = [
    "from-[#1F5EFF] to-[#2EC4B6]",
    "from-purple-500 to-indigo-500",
    "from-[#2EC4B6] to-emerald-500",
    "from-amber-500 to-orange-500",
    "from-pink-500 to-purple-500",
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xff;
  return colors[hash % colors.length];
}

function SkeletonCard() {
  return (
    <div className="bg-white/8 border border-white/12 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-white/15 rounded w-28" />
          <div className="h-2.5 bg-white/10 rounded w-36" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-white/10 rounded-full w-16" />
        <div className="h-5 bg-white/10 rounded-full w-20" />
      </div>
    </div>
  );
}

export function HeroTherapistPreview() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/marketplace/search?limit=3`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list: Therapist[] = Array.isArray(data)
          ? data
          : data?.data ?? data?.therapists ?? [];
        setTherapists(list.slice(0, 3));
      })
      .catch(() => setTherapists([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && therapists.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-xs text-white/40 font-medium uppercase tracking-widest mb-3 text-center">
        Featured Therapists
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading
          ? [0, 1, 2].map((i) => <SkeletonCard key={i} />)
          : therapists.map((t, i) => {
              const name = `${t.first_name} ${t.last_name}`;
              const grad = getAvatarGradient(name);
              const avail = t.availability ? (AVAIL_BADGE[t.availability] ?? AVAIL_BADGE.this_week) : AVAIL_BADGE.this_week;
              const href = t.public_slug ? `/t/${t.public_slug}` : `/therapists/${t.id}`;
              const specs = (t.specializations ?? []).slice(0, 2);

              return (
                <Link
                  key={t.id}
                  href={href}
                  className="group bg-white/8 hover:bg-white/12 border border-white/12 hover:border-white/25 rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg`}
                    >
                      {getInitials(t.first_name, t.last_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm leading-tight truncate group-hover:text-[#2EC4B6] transition-colors">
                        {name}
                      </p>
                      {t.title && (
                        <p className="text-xs text-white/45 truncate">{t.title}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {specs.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] bg-white/10 text-white/65 border border-white/12 px-2 py-0.5 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-white/60">
                        {t.average_rating?.toFixed(1) ?? "5.0"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] border px-2 py-0.5 rounded-full ${avail.cls}`}
                    >
                      {avail.label}
                    </span>
                  </div>
                </Link>
              );
            })}
      </div>
      <div className="text-center mt-4">
        <Link
          href="/find-therapist"
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          See all therapists →
        </Link>
      </div>
    </div>
  );
}
