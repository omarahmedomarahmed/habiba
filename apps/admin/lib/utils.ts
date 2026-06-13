import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined, format = "short"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  if (format === "short") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (format === "time") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (format === "datetime") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString();
}

export function getInitials(name: string): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

// Reviewed: 2026-06-13 — 24Therapy audit
