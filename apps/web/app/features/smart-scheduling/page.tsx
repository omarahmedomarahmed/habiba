import {
  Calendar, Clock, Bell, Users, RefreshCw,
  Smartphone, Globe, Settings, CheckCircle, BarChart3,
} from "lucide-react";
import { ProductPageLayout } from "@/components/product/ProductPageLayout";

const FEATURE_ITEMS = [
  {
    icon: Globe,
    title: "Public Booking Page",
    description:
      "Each therapist gets a personalized booking URL on the 24Therapy marketplace. Patients see your availability, specialties, and rates — and book instantly without any back-and-forth.",
    highlight: "Live in under 5 minutes",
  },
  {
    icon: Calendar,
    title: "Calendar Sync",
    description:
      "Two-way sync with Google Calendar and iCal. Sessions booked on 24Therapy appear on your personal calendar. Block off personal time and it removes availability automatically.",
    highlight: "Google + iCal sync",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    description:
      "Email and SMS reminders sent at 24h, 1h, and 15 minutes before every session. Fully customizable timing and message content. Dramatically reduces no-shows.",
    highlight: "Up to 70% fewer no-shows",
  },
  {
    icon: Users,
    title: "Waitlist Management",
    description:
      "When a session cancels, the next patient on the waitlist is automatically notified and offered the slot. Gaps fill themselves — maximizing your utilization.",
    highlight: "Auto-fill cancellation gaps",
  },
  {
    icon: RefreshCw,
    title: "Recurring Session Scheduling",
    description:
      "Set up weekly, biweekly, or monthly recurring sessions with one click. The patient portal shows all upcoming sessions and allows easy rescheduling with notice requirements.",
    highlight: "One-click recurrence",
  },
  {
    icon: Clock,
    title: "No-Show Tracking",
    description:
      "Every no-show is logged with patient notification timestamps and policy confirmations. Generates a no-show report for billing and informs a patient's reliability score.",
    highlight: "Automated documentation",
  },
  {
    icon: Globe,
    title: "Time Zone Handling",
    description:
      "Patients book in their time zone. The session appears in yours. Reminders fire at the correct local time for both. No timezone confusion, ever.",
    highlight: "Global timezone intelligence",
  },
  {
    icon: Settings,
    title: "Intake Forms",
    description:
      "Custom intake forms sent automatically after booking. Patients complete demographics, insurance, consent forms, and initial screening before the first session.",
    highlight: "Pre-session intake automation",
  },
];

const HERO_PREVIEW = (
  <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 max-w-lg mx-auto text-left">
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs text-white/60 font-medium">June 2026</span>
      <span className="text-xs bg-[#2EC4B6]/20 text-[#2EC4B6] px-2 py-0.5 rounded-full">3 slots available</span>
    </div>
    <div className="space-y-2">
      {[
        { day: "Mon 9", time: "9:00 AM", status: "booked" },
        { day: "Wed 11", time: "2:00 PM", status: "available" },
        { day: "Thu 12", time: "4:00 PM", status: "available" },
        { day: "Fri 13", time: "10:00 AM", status: "available" },
      ].map((slot) => (
        <div
          key={slot.day}
          className={`flex items-center justify-between rounded-lg p-2.5 border text-sm ${
            slot.status === "booked"
              ? "bg-white/5 border-white/10 text-white/40"
              : "bg-[#2EC4B6]/10 border-[#2EC4B6]/30 text-white cursor-pointer hover:bg-[#2EC4B6]/20 transition-colors"
          }`}
        >
          <span>{slot.day}</span>
          <span>{slot.time}</span>
          <span className={`text-xs ${slot.status === "booked" ? "text-white/30" : "text-[#2EC4B6]"}`}>
            {slot.status === "booked" ? "Booked" : "Book →"}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default function SmartSchedulingPage() {
  return (
    <ProductPageLayout
      badgeIcon={Calendar}
      badgeLabel="Smart Scheduling"
      badgeTag="Zero Friction"
      heroTitle={
        <>
          Patients Book Themselves.{" "}
          <span className="text-[#2EC4B6]">You Just Show Up.</span>
        </>
      }
      heroSubtitle="A public booking page, calendar sync, automated reminders, and waitlist management — all working together so you never have to manually schedule a session again."
      ctaPrimary={{ label: "Get Started Free", href: "/signup" }}
      ctaSecondary={{ label: "See Pricing", href: "/pricing" }}
      heroPreview={HERO_PREVIEW}
      stats={[
        { value: "< 2 min", label: "Average booking time" },
        { value: "70%", label: "Fewer no-shows" },
        { value: "24 / 7", label: "Patients can book" },
        { value: "Auto", label: "Waitlist fill" },
      ]}
      featuresTitle="Everything Scheduling Should Be"
      featuresSubtitle="Eight features that eliminate the scheduling back-and-forth and keep your calendar full."
      featureItems={FEATURE_ITEMS}
      featureColumns={4}
      ctaIcon={Calendar}
      ctaTitle="Fill Your Calendar Automatically"
      ctaSubtitle="Stop losing time to scheduling emails. Set your availability once and let patients book, reschedule, and receive reminders without any manual effort."
      ctaButtonLabel="Get Started Free"
      ctaButtonHref="/signup"
    />
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
