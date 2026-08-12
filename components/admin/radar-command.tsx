"use client";

import dynamicImport from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Ban,
  Loader2,
  Pencil,
  PowerOff,
  Search,
  Star,
  Undo2,
} from "lucide-react";

import {
  editRadarProfile,
  forceRadarOffline,
  setRadarSuspension,
} from "@/app/(admin)/admin/actions";
import type { RadarEntry } from "@/components/radar/types";
import { Button, Card, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import type { CommandRow, CommandView } from "@/lib/data/radar-admin";
import { countryFlag, countryName, languageFlag } from "@/lib/geo";
import { cn } from "@/lib/utils";

const Globe = dynamicImport(() => import("@/components/radar/globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-teal-400/60" aria-hidden />
    </div>
  ),
});

/** Faster than the public board: this is the room where you watch it happen. */
const REFRESH_MS = 3_000;

/**
 * The radar, from the operator's chair.
 *
 * Everything the public board hides is visible here — who is suspended and
 * why, who is a demonstration fixture, whose heartbeat has lapsed while they
 * are still advertised — and everything the public board shows is the same
 * globe, so what you are looking at is the thing patients are looking at.
 *
 * No clinical content anywhere on this screen. Availability, geography, money
 * and conduct: nothing anybody said to a therapist.
 */
export function RadarCommand({ initial }: { initial: CommandView }) {
  const [view, setView] = useState(initial);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [only, setOnly] = useState<"all" | "live" | "suspended" | "flagged">("all");
  const [selected, setSelected] = useState<CommandRow | null>(null);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/admin/radar", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        setView((await response.json()) as CommandView);
        setBeat((b) => b + 1);
      } catch {
        /* Keep the last good picture on screen. */
      }
    };
    const timer = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const languages = useMemo(
    () => [...new Set(view.rows.flatMap((row) => row.languages))].sort(),
    [view.rows],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return view.rows.filter((row) => {
      if (country && row.country !== country) return false;
      if (language && !row.languages.includes(language)) return false;
      if (only === "live" && row.status === "offline") return false;
      if (only === "suspended" && !row.suspendedUntil) return false;
      if (only === "flagged" && row.openReports === 0 && !row.stale) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.city ?? "").toLowerCase().includes(needle) ||
        (row.organizationName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [view.rows, query, country, language, only]);

  /* The globe speaks RadarEntry. Everything clinical is absent from both. */
  const entries: RadarEntry[] = useMemo(
    () =>
      rows
        .filter((row) => row.status !== "offline")
        .map((row) => ({
          userId: row.userId,
          firstName: row.name.split(" ")[0] ?? row.name,
          lastName: null,
          credentials: null,
          headline: row.headline,
          photoUrl: null,
          languages: row.languages,
          specialties: row.specialties,
          country: row.country,
          region: row.region,
          city: row.city,
          practice: null,
          rateCents: row.rateCents,
          rating: row.rating,
          status: row.status as "online" | "pending" | "in_session",
          reservedByYou: false,
        })),
    [rows],
  );

  const t = view.totals;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Online" value={t.online} tone="teal" pulse />
        <Stat label="Being booked" value={t.booking} tone="amber" />
        <Stat label="In session" value={t.inSession} tone="brand" />
        <Stat label="Countries" value={t.countries} />
        <Stat label="Our cut · 30d" value={formatUsd(t.feeCents30d)} tone="teal" />
        <Stat
          label="Open reports"
          value={t.openReports}
          tone={t.openReports > 0 ? "red" : undefined}
        />
      </div>

      {/* ------------------------------------------------------------ globe */}
      <div className="relative overflow-hidden rounded-3xl bg-[#04101f]">
        <div className="aspect-square sm:aspect-[16/9]">
          <Globe
            entries={entries}
            selected={country}
            onSelect={(code) => setCountry(code)}
            onPick={(entry) =>
              setSelected(view.rows.find((row) => row.userId === entry.userId) ?? null)
            }
            className="h-full w-full"
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 bg-gradient-to-t from-[#04101f] via-[#04101f]/70 to-transparent px-4 pt-10 pb-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="live-dot h-2 w-2 rounded-full bg-teal-400" />
            {t.online + t.booking + t.inSession} live across {t.countries}{" "}
            {t.countries === 1 ? "country" : "countries"}
            {t.demo > 0 ? (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                {t.demo} demo
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-white/40">refreshed {beat} times · every 3s</p>
        </div>
      </div>

      {/* ---------------------------------------------------------- filters */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <label className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            aria-label="Search clinicians"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, city, practice"
            className="h-9 w-56 ps-8 text-xs"
          />
        </label>

        <select
          aria-label="Language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs"
        >
          <option value="">Any language</option>
          {languages.map((option) => (
            <option key={option} value={option}>
              {languageFlag(option)} {option}
            </option>
          ))}
        </select>

        <select
          aria-label="Country"
          value={country ?? ""}
          onChange={(event) => setCountry(event.target.value || null)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs"
        >
          <option value="">Everywhere</option>
          {view.byCountry.map((entry) => (
            <option key={entry.country} value={entry.country}>
              {countryFlag(entry.country)} {countryName(entry.country) ?? entry.country} ·{" "}
              {entry.online}/{entry.total}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {(["all", "live", "suspended", "flagged"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setOnly(option)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize",
                only === option ? "bg-navy-500 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <span className="ms-auto text-xs text-slate-400">
          {rows.length} of {view.rows.length}
        </span>
      </Card>

      {/* ------------------------------------------------------------ table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-start text-xs text-slate-400">
              <tr>
                <Th>Clinician</Th>
                <Th>Where</Th>
                <Th>State</Th>
                <Th className="text-end">Rating</Th>
                <Th className="text-end">30d</Th>
                <Th className="text-end">Our cut</Th>
                <Th>Control</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.userId} className={cn(row.suspendedUntil && "bg-red-50/50")}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="text-start font-medium text-slate-900 hover:text-brand-600"
                    >
                      {row.name}
                    </button>
                    <span className="block truncate text-[11px] text-slate-400">{row.email}</span>
                    {row.demo ? (
                      <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                        DEMO
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-slate-600">
                    {row.country ? (
                      <>
                        <span aria-hidden>{countryFlag(row.country)}</span>{" "}
                        {row.city ?? countryName(row.country) ?? row.country}
                        <span className="block text-[11px] text-slate-400">{row.region ?? ""}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <State row={row} />
                  </Td>
                  <Td className="text-end tabular-nums">
                    {row.rating ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                        <Star className="h-3 w-3 fill-current" aria-hidden />
                        {row.rating.average.toFixed(1)}
                        <span className="text-slate-400">({row.rating.count})</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                  <Td className="text-end tabular-nums text-slate-600">{row.sessions30d}</Td>
                  <Td className="text-end tabular-nums font-medium text-slate-900">
                    {row.feeCents30d > 0 ? formatUsd(row.feeCents30d) : "—"}
                  </Td>
                  <Td>
                    <Controls row={row} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    Nobody matches that.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {selected ? <Detail row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Stat({
  label,
  value,
  tone,
  pulse,
}: {
  label: string;
  value: number | string;
  tone?: "teal" | "amber" | "brand" | "red";
  pulse?: boolean;
}) {
  return (
    <Card className="px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        {pulse ? <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-400" /> : null}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-2xl font-bold tracking-tight tabular-nums",
          tone === "teal"
            ? "text-teal-600"
            : tone === "amber"
              ? "text-amber-600"
              : tone === "brand"
                ? "text-brand-600"
                : tone === "red"
                  ? "text-red-600"
                  : "text-slate-900",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function State({ row }: { row: CommandRow }) {
  if (row.suspendedUntil) {
    return (
      <span className="inline-flex flex-col">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          <Ban className="h-2.5 w-2.5" aria-hidden />
          suspended
        </span>
        <span className="mt-0.5 text-[10px] text-slate-400">
          until {new Date(row.suspendedUntil).toLocaleDateString()}
        </span>
      </span>
    );
  }

  const tone =
    row.status === "online"
      ? "bg-teal-100 text-teal-700"
      : row.status === "pending"
        ? "bg-amber-100 text-amber-700"
        : row.status === "in_session"
          ? "bg-brand-100 text-brand-700"
          : "bg-slate-100 text-slate-500";

  return (
    <span className="inline-flex flex-col">
      <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
        {row.status === "in_session" ? "in session" : row.status}
      </span>
      {/* An advertised clinician whose heartbeat stopped is the single most
          important anomaly on this page: patients are being sent to somebody
          who has closed their laptop. */}
      {row.stale ? (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
          heartbeat lapsed
        </span>
      ) : null}
      {row.openReports > 0 ? (
        <span className="mt-0.5 text-[10px] font-semibold text-red-600">
          {row.openReports} open report{row.openReports === 1 ? "" : "s"}
        </span>
      ) : null}
    </span>
  );
}

function Controls({ row }: { row: CommandRow }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = (hours: number) =>
    startTransition(async () => {
      setError(null);
      const result = await setRadarSuspension(row.userId, hours, reason || "Administrator action");
      if (result.error) setError(result.error);
      else setOpen(false);
    });

  if (row.suspendedUntil) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => act(0)}
      >
        <Undo2 className="h-3 w-3" aria-hidden />
        Release
      </Button>
    );
  }

  if (!open) {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending || row.status === "offline"}
          onClick={() =>
            startTransition(async () => {
              await forceRadarOffline(row.userId);
            })
          }
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          title="Take them off the board now, without a ban"
        >
          <PowerOff className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Ban
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 space-y-1.5">
      {error ? (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      ) : null}
      <Input
        aria-label="Reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason — they see this"
        className="h-8 text-xs"
      />
      <div className="flex flex-wrap gap-1">
        <Ban24 label="24h" hours={24} act={act} pending={pending} />
        <Ban24 label="3 days" hours={72} act={act} pending={pending} />
        <Ban24 label="Until released" hours={24 * 3650} act={act} pending={pending} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Ban24({
  label,
  hours,
  act,
  pending,
}: {
  label: string;
  hours: number;
  act: (hours: number) => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => act(hours)}
      className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/** One clinician's radar profile, editable. */
function Detail({ row, onClose }: { row: CommandRow; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [headline, setHeadline] = useState(row.headline ?? "");
  const [country, setCountry] = useState(row.country ?? "");
  const [region, setRegion] = useState(row.region ?? "");
  const [city, setCity] = useState(row.city ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <Card
        className="max-h-[86vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">
              {row.email}
              {row.organizationName ? ` · ${row.organizationName}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-400">
            Close
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Row label="Rate">{row.rateCents > 0 ? formatUsd(row.rateCents) : "Free"}</Row>
          <Row label="Payouts">{row.chargesEnabled ? "Connected" : "Not connected"}</Row>
          <Row label="Sessions 30d">{row.sessions30d}</Row>
          <Row label="Gross 30d">{formatUsd(row.grossCents30d)}</Row>
          <Row label="Our cut 30d">{formatUsd(row.feeCents30d)}</Row>
          <Row label="Walk-ins">{row.acceptsWalkIns ? "Yes" : "No"}</Row>
          <Row label="Last seen">
            {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleTimeString() : "never"}
          </Row>
          <Row label="Languages">{row.languages.join(", ") || "—"}</Row>
        </dl>

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Edit their radar profile
          </p>
          <Input
            aria-label="Headline"
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Headline"
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              aria-label="Country code"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="AE"
            />
            <Input
              aria-label="Region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="Region"
            />
            <Input
              aria-label="City"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
            />
          </div>
          {saved ? <p className="text-xs text-teal-700">Saved.</p> : null}
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await editRadarProfile(row.userId, { headline, country, region, city });
                setSaved(true);
              })
            }
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Saving…" : "Save"}
          </Button>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Audited, and they can change it straight back. This is for fixing a phone number in a
            headline or a country picked by mistake, not for taking control of a profile.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-top", className)}>{children}</td>;
}
