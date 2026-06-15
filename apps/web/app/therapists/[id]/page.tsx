"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shield, MapPin, Globe, Clock, Video, Star, ArrowLeft, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/env";

const API_URL = getApiUrl();

interface TherapistProfile {
  id: string;
  display_name: string;
  bio?: string;
  specialty?: string;
  specializations?: string[];
  languages?: string[];
  avatar_url?: string;
  license_number?: string;
  years_experience?: number;
  location?: string;
  public_slug?: string;
  verification_status?: string;
  session_price_cents?: number;
}

function TherapistProfileInner() {
  const { id } = useParams();
  const [therapist, setTherapist] = useState<TherapistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/marketplace/therapist/${id}`)
      .then(r => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(d => setTherapist(d?.data ?? d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F5EFF]" />
      </div>
    );
  }

  if (notFound || !therapist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 font-medium mb-2">Therapist not found</p>
          <Link href="/find-therapist" className="text-[#1F5EFF] text-sm hover:underline">← Back to directory</Link>
        </div>
      </div>
    );
  }

  const priceStr = therapist.session_price_cents
    ? `$${Math.round(therapist.session_price_cents / 100)}/session`
    : null;

  const initials = therapist.display_name
    ?.split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("") ?? "T";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Link href="/find-therapist" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0A2342]">
            <ArrowLeft className="w-4 h-4" />
            Back to directory
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
              {therapist.avatar_url ? (
                <img src={therapist.avatar_url} alt={therapist.display_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-bold">{initials}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-[#0A2342]">{therapist.display_name}</h1>
                {therapist.verification_status === "approved" && (
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5 font-medium">
                    <Shield className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <p className="text-[#1F5EFF] font-medium mb-1">{therapist.specialty || "Licensed Therapist"}</p>
              {therapist.location && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{therapist.location}
                </p>
              )}
            </div>

            {/* CTA */}
            {therapist.public_slug && (
              <Link
                href={`/t/${therapist.public_slug}`}
                className="shrink-0 px-6 py-3 bg-[#1F5EFF] text-white font-bold rounded-xl hover:bg-[#0A2342] transition-colors shadow-sm"
              >
                Book a Session
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: main content */}
          <div className="lg:col-span-2 space-y-5">
            {therapist.bio && (
              <ProfileSection title="About">
                <p className="text-gray-600 text-sm leading-relaxed">{therapist.bio}</p>
              </ProfileSection>
            )}

            {(therapist.specializations?.length ?? 0) > 0 && (
              <ProfileSection title="Specialties">
                <div className="flex flex-wrap gap-2">
                  {therapist.specializations!.map((s) => (
                    <span key={s} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">{s}</span>
                  ))}
                </div>
              </ProfileSection>
            )}

            {(therapist.languages?.length ?? 0) > 0 && (
              <ProfileSection title="Languages">
                <div className="flex flex-wrap gap-2">
                  {therapist.languages!.map((l) => (
                    <span key={l} className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      <Globe className="w-3 h-3" />{l}
                    </span>
                  ))}
                </div>
              </ProfileSection>
            )}

            <ProfileSection title="Reviews">
              <div className="text-center py-8 text-gray-400">
                <Star className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm font-medium">No reviews yet</p>
                <p className="text-xs mt-1 text-gray-400">Be the first to book a session</p>
              </div>
            </ProfileSection>
          </div>

          {/* Right: session info card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-[#0A2342] mb-4">Session Info</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#1F5EFF]" />
                  Online video sessions
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1F5EFF]" />
                  30 / 60 min sessions
                </div>
                {priceStr && (
                  <div className="text-xl font-bold text-[#0A2342] mt-2">
                    {priceStr}
                  </div>
                )}
              </div>
              {therapist.public_slug && (
                <Link
                  href={`/t/${therapist.public_slug}`}
                  className="block mt-4 w-full text-center py-3 bg-[#1F5EFF] text-white font-bold rounded-xl hover:bg-[#0A2342] transition-colors"
                >
                  Book a Session
                </Link>
              )}
            </div>

            {(therapist.license_number || therapist.years_experience) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-[#0A2342] mb-3">Credentials</h3>
                {therapist.license_number && (
                  <p className="text-sm text-gray-600">
                    License: {therapist.license_number.replace(/.(?=.{4})/g, "·")}
                  </p>
                )}
                {therapist.years_experience && (
                  <p className="text-sm text-gray-600 mt-1">
                    {therapist.years_experience} year{therapist.years_experience !== 1 ? "s" : ""} of experience
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-[#0A2342] mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function TherapistProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F5EFF]" />
      </div>
    }>
      <TherapistProfileInner />
    </Suspense>
  );
}
