"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText, Search, Filter, Plus, Clock, CheckCircle2, AlertCircle,
  Edit3, Download, Eye, ChevronRight, Brain, Sparkles, MoreHorizontal,
  Calendar, User, Tag, TrendingUp
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const MOCK_NOTES = [
  {
    id: "n1", patient_id: "p1", patient_name: "Sarah Chen", session_date: "2025-12-15T10:00:00Z",
    session_number: 24, note_format: "SOAP", status: "finalized",
    created_at: "2025-12-15T11:30:00Z", finalized_at: "2025-12-15T12:15:00Z",
    ai_generated: true, word_count: 380, risk_flag: false,
    preview: "Patient reports improvement in sleep patterns and reduced anxiety symptoms. CBT homework completed.",
    tags: ["progress", "sleep", "CBT"],
  },
  {
    id: "n2", patient_id: "p2", patient_name: "Michael Torres", session_date: "2025-12-14T11:00:00Z",
    session_number: 12, note_format: "DAP", status: "draft",
    created_at: "2025-12-14T12:00:00Z", finalized_at: null,
    ai_generated: true, word_count: 290, risk_flag: false,
    preview: "Patient discussed work-related stressors and interpersonal conflict. GAD symptoms elevated.",
    tags: ["work-stress", "anxiety", "interpersonal"],
  },
  {
    id: "n3", patient_id: "p3", patient_name: "James Rodriguez", session_date: "2025-12-14T14:00:00Z",
    session_number: 36, note_format: "SOAP", status: "needs_review",
    created_at: "2025-12-14T15:00:00Z", finalized_at: null,
    ai_generated: true, word_count: 450, risk_flag: true,
    preview: "Patient expressed passive suicidal ideation. Safety plan reviewed and updated. Crisis support contacts confirmed.",
    tags: ["risk", "safety-plan", "suicidal-ideation"],
  },
  {
    id: "n4", patient_id: "p4", patient_name: "Emma Williams", session_date: "2025-12-09T14:00:00Z",
    session_number: 18, note_format: "BIRP", status: "finalized",
    created_at: "2025-12-09T15:00:00Z", finalized_at: "2025-12-09T16:30:00Z",
    ai_generated: true, word_count: 310, risk_flag: false,
    preview: "OCD symptoms show moderate improvement. ERP exercises progressing well.",
    tags: ["OCD", "ERP", "progress"],
  },
  {
    id: "n5", patient_id: "p5", patient_name: "Olivia Kim", session_date: "2025-12-01T15:00:00Z",
    session_number: 8, note_format: "SOAP", status: "finalized",
    created_at: "2025-12-01T16:00:00Z", finalized_at: "2025-12-01T17:00:00Z",
    ai_generated: false, word_count: 220, risk_flag: false,
    preview: "Social anxiety management strategies discussed. Exposure hierarchy created.",
    tags: ["social-anxiety", "exposure", "hierarchy"],
  },
];

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

export default function NotesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = MOCK_NOTES.filter((n) => {
    const matchSearch = !search ||
      n.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      n.preview.toLowerCase().includes(search.toLowerCase()) ||
      n.tags.some((t) => t.includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || n.status === statusFilter;
    const matchFormat = formatFilter === "all" || n.note_format === formatFilter;
    return matchSearch && matchStatus && matchFormat;
  });

  const pendingCount = MOCK_NOTES.filter((n) => n.status === "draft" || n.status === "needs_review").length;
  const flaggedCount = MOCK_NOTES.filter((n) => n.risk_flag).length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Session Notes</h1>
            <p className="text-ink-500 text-sm mt-1">AI-assisted clinical documentation</p>
          </div>
          <Link
            href="/sessions"
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Session Note
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Notes", value: MOCK_NOTES.length, icon: FileText, color: "text-blue-600 bg-blue-50" },
            { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50", alert: pendingCount > 0 },
            { label: "Flagged", value: flaggedCount, icon: AlertCircle, color: "text-red-600 bg-red-50", alert: flaggedCount > 0 },
            { label: "AI Generated", value: MOCK_NOTES.filter((n) => n.ai_generated).length, icon: Brain, color: "text-purple-600 bg-purple-50" },
          ].map((stat) => (
            <div key={stat.label} className={cn("card p-4 flex items-center gap-3", stat.alert && "border-amber-200 bg-amber-50/30")}>
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
                    onClick={() => setStatusFilter(s)}
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
                    onClick={() => setFormatFilter(f)}
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
          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-500">No notes found matching your filters.</p>
            </div>
          )}

          {filtered.map((note) => {
            const status = STATUS_CONFIG[note.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = status.icon;
            return (
              <Link key={note.id} href={`/sessions/${note.id}/notes`}>
                <div className={cn(
                  "card p-5 hover:shadow-card-hover transition-all cursor-pointer group",
                  note.risk_flag && "border-l-4 border-l-red-500"
                )}>
                  <div className="flex items-start gap-4">
                    {/* Patient Avatar */}
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
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", FORMAT_COLORS[note.note_format])}>
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
                          Session #{note.session_number} · {formatDate(note.session_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {note.word_count} words
                        </span>
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
      </div>
    </div>
  );
}
