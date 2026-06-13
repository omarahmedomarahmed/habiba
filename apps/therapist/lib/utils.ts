import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { getApiUrl, getBaseUrl } from '@/lib/env';

export function formatDate(date: string | Date, format: "short" | "long" | "time" | "datetime" | "relative" = "short"): string {
  const d = new Date(date);
  const now = new Date();

  if (format === "relative") {
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (format === "short") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (format === "long") return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (format === "time") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (format === "datetime") return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString();
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatSessionTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export function getRiskColor(level: string): string {
  switch (level?.toLowerCase()) {
    case "critical": return "text-red-700 bg-red-50 border-red-200";
    case "high": return "text-orange-700 bg-orange-50 border-orange-200";
    case "medium": return "text-yellow-700 bg-yellow-50 border-yellow-200";
    case "low": return "text-green-700 bg-green-50 border-green-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "active": case "completed": case "approved": return "text-green-700 bg-green-50";
    case "scheduled": case "pending": case "in_progress": return "text-blue-700 bg-blue-50";
    case "cancelled": case "rejected": return "text-red-700 bg-red-50";
    case "waiting": return "text-yellow-700 bg-yellow-50";
    default: return "text-slate-600 bg-slate-50";
  }
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

// Reviewed: 2026-06-13 — 24Therapy audit
