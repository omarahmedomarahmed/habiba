"use client";

import { LockedPageOverlay } from "@/components/LockedPageOverlay";
import { useUIStore } from "@/lib/store";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText, Search, Filter, Plus, Clock, CheckCircle2, AlertCircle,
  Edit3, Download, Eye, Brain, Sparkles, Calendar, User, Tag
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { notesAPI, APIError } from "@/lib/api";

interface Note {
  id: string;
  patient_id: string;
  patient_name: string;
  session_date: string;
  session_number: number;
  note_format: string;
  status: string;
  created_at: string;
  finalized_at: string | null;
  ai_generated: boolean;
  word_count: number;
  risk_flag: boolean;
  preview: string;
  tags: string[];
}

const STATUS_CONFIG = {
  finalized: { label: "Finalized", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  draft: { label: "Draft", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Edit3 },
  needs_review: { label: "Needs Review", color: "text-red-700 bg-red-50 border-red-200", icon: AlertCircle },
};

const FORMAT_COLORS: Record<string, string> = {
  SOAP: "bg-blue-100 text-blue-700",
  DAP: "bg-purple-100 text-purple-700",
  BIRP: "bg-cyan-100 text-cyan-700",
};

const LIMIT = 20;

function SkeletonRow() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 bg-surface-tertiary rounded" />
            <div className="h-4 w-12 bg-surface-tertiary rounded" />
          </div>
          <div className="h-3 w-full bg-surface-tertiary rounded" />
          <div className="h-3 w-3/4 bg-surface-tertiary rounded" />
          <div className="h-3 w-48 bg-surface-tertiary rounded mt-2" />
        </div>
      </div>
    </div>
  );
}

function normalizeNote(raw: Record<string, unknown>): Note {
  const patient = (raw.patient as Record<string, unknown>) || {};
  const patientName =
    (raw.patient_name as string) ||
    (patient.first_name
      ? `${patient.first_name} ${patient.last_name || ""}`.trim()
      : (raw.patient_id as string) || "Unknown");

  return {
    id: (raw.id as string) || "",
    patient_id: (raw.patient_id as string) || (patient.id as string) || "",
    patient_name: patientName,
    session_date: (raw.session_date as string) || (raw.created_at as string) || "",
    session_number: (raw.session_number as number) || 0,
    note_format: ((raw.note_format as string) || (raw.format as string) || "SOAP").toUpperCase(),
    status: (raw.status as string) || "draft",
    created_at: (raw.created_at as string) || "",
    finalized_at: (raw.finalized_at as string) || null,
    ai_generated: !!(raw.ai_generated ?? raw.is_ai_generated),
    word_count: (raw.word_count as number) || 0,
    risk_flag: !!(raw.risk_flag ?? raw.has_risk_flag),
    preview:
      (raw.preview as string) ||
      (raw.content as string)?.slice(0, 160) ||
      (raw.subjective as string)?.slice(0, 160) ||
      "",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
  };
}

function NotesPageInner() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(total / LIMIT);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: LIMIT,
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(formatFilter !== "all" ? { format: formatFilter } : {}),
      };
      const result = await notesAPI.list(params);
      const raw = Array.isArray(result)
        ? result
        : ((result as { data?: unknown[] }).data ?? []);
      const tot = Array.isArray(result)
        ? (result as unknown[]).length
        : ((result as { total?: number }).total ?? (raw as unknown[]).length);
      setNotes((raw as Record<string, unknown>[]).map(normalizeNote));
      setTotal(tot);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError((err as Error).message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, formatFilter]);

  // Debounced search
  useEffect(() => {
    const delay = search ? 400 : 0;
    const t = setTimeout(() => {
      setPage(1);
      fetchNotes();
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Immediate fetch on filter/page change
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes, statusFilter, formatFilter, page]);

  const pendingCount = notes.filter((n) => n.status === "draft" || n.status === "needs_review").length;
  const flaggedCount = notes.filter((n) => n.risk_flag).length;
  const aiCount = notes.filter((n) => n.ai_generated).length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Session Notes</h1>
            <p className="text-ink-500 text-sm mt-1">AI-assisted clinical documentation</p>
          </div>
          <Link href="/notes/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Note
          </Link>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
            <button onClick={fetchNotes} className="text-xs text-red-600 hover:underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Notes", value: loading ? "—" : total, icon: FileText, color: "text-blue-600 bg-blue-50" },
            { label: "Pending", value: loading ? "—" : pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50", alert: pendingCount > 0 },
            { label: "Flagged", value: loading ? "—" : flaggedCount, icon: AlertCircle, color: "text-red-600 bg-red-50", alert: flaggedCount > 0 },
            { label: "AI Generated", value: loading ? "—" : aiCount, icon: Brain, color: "text-purple-600 bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className={cn("card p-4 flex items-center gap-3", "alert" in stat && stat.alert && "border-amber-200 bg-amber-50/30")}>
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.color)}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-ink-900">{stat.value}</div>
                <div className="text-xs text-ink-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="text"
                placeholder="Search notes by patient, content, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 w-full"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn("btn-secondary flex items-center gap-2", showFilters && "bg-primary-50 border-primary-300")}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-tertiary">
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink-600 font-medium">Status:</label>
                {["all", "draft", "needs_review", "finalized"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      statusFilter === s ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                    )}
                  >
                    {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink-600 font-medium">Format:</label>
                {["all", "SOAP", "DAP", "BIRP"].map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFormatFilter(f); setPage(1); }}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      formatFilter === f ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

          {!loading && notes.length === 0 && (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-500 font-medium">No notes found</p>
              <p className="text-ink-400 text-sm mt-1">
                {search || statusFilter !== "all" || formatFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Notes are created automatically after sessions"}
              </p>
            </div>
          )}

          {!loading && notes.map((note) => {
            const status = STATUS_CONFIG[note.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
            const StatusIcon = status.icon;
            return (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <div className={cn(
                  "card p-5 hover:shadow-card-hover transition-all cursor-pointer group",
                  note.risk_flag && "border-l-4 border-l-red-500"
                )}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary-700">
                        {getInitials(note.patient_name)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-900">{note.patient_name}</span>
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", FORMAT_COLORS[note.note_format] ?? "bg-gray-100 text-gray-700")}>
                            {note.note_format}
                          </span>
                          {note.ai_generated && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-xs font-medium">
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                          {note.risk_flag && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium">
                              <AlertCircle className="w-3 h-3" />
                              Risk Flag
                            </span>
                          )}
                        </div>
                        <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>

                      {/* Preview */}
                      <p className="text-sm text-ink-600 mt-1.5 line-clamp-2">{note.preview}</p>

                      {/* Tags */}
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Tag className="w-3 h-3 text-ink-400" />
                          {note.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded bg-surface-tertiary text-ink-500 text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {note.session_number > 0 && `Session #${note.session_number} · `}{formatDate(note.session_date)}
                        </span>
                        {note.word_count > 0 && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {note.word_count} words
                          </span>
                        )}
                        {note.finalized_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Finalized {formatDate(note.finalized_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="View">
                        <Eye className="w-4 h-4 text-ink-400" />
                      </button>
                      {note.status !== "finalized" && (
                        <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="Edit">
                          <Edit3 className="w-4 h-4 text-ink-400" />
                        </button>
                      )}
                      <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 text-ink-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} notes
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-ink-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  const verificationStatus = useUIStore((s) => s.verificationStatus);
  const isLocked = verificationStatus !== null && verificationStatus !== "approved";
  return (
    <LockedPageOverlay isLocked={isLocked}>
      <NotesPageInner />
    </LockedPageOverlay>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
