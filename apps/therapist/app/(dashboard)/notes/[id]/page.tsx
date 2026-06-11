"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, CheckCircle2, Edit3, Download, Save, Send,
  Clock, User, Calendar, Sparkles, RefreshCw, AlertTriangle,
  ChevronDown, Copy, MoreHorizontal, FileText, History
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { notesAPI, aiAPI } from "@/lib/api";

type NoteSection = "subjective" | "objective" | "assessment" | "plan";

interface NoteData {
  id: string;
  patient_name: string;
  patient_id: string;
  session_date: string;
  session_number: number;
  therapist_name: string;
  note_format: "SOAP" | "DAP" | "BIRP" | "Progress";
  status: string;
  ai_generated: boolean;
  created_at: string;
  word_count: number;
  risk_flag: boolean;
  content: { SOAP: Record<NoteSection, string> };
  ai_suggestions: string[];
}

export default function NoteDetailPage() {
  const { id } = useParams();
  const noteId = Array.isArray(id) ? id[0] : id as string;
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NoteSection | null>(null);
  const [editContent, setEditContent] = useState("");
  const [format, setFormat] = useState<"SOAP" | "DAP" | "BIRP">("SOAP");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await notesAPI.get(noteId) as Record<string, unknown>;
        const soap = (data.content as Record<string, unknown>)?.SOAP as Record<NoteSection, string> ||
          { subjective: "", objective: "", assessment: "", plan: "" };
        setNote({
          id: data.id as string,
          patient_name: (data.patient_name as string) || "Patient",
          patient_id: data.patient_id as string,
          session_date: data.session_date as string || data.created_at as string,
          session_number: (data.session_number as number) || 1,
          therapist_name: (data.therapist_name as string) || "",
          note_format: (data.note_format as "SOAP") || "SOAP",
          status: (data.status as string) || "draft",
          ai_generated: (data.ai_generated as boolean) ?? true,
          created_at: data.created_at as string,
          word_count: (data.word_count as number) || 0,
          risk_flag: (data.risk_flag as boolean) ?? false,
          content: { SOAP: soap },
          ai_suggestions: (data.ai_suggestions as string[]) || [],
        });
        setFormat(((data.note_format as string) || "SOAP") as "SOAP" | "DAP" | "BIRP");
      } catch {
        // keep null — show error below
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [noteId]);

  const startEdit = (section: NoteSection) => {
    if (!note) return;
    setEditing(section);
    setEditContent(note.content.SOAP[section]);
  };

  const saveEdit = async (section: NoteSection) => {
    if (!note) return;
    const updated = { ...note.content.SOAP, [section]: editContent };
    setNote(prev => prev ? ({
      ...prev,
      content: { ...prev.content, SOAP: updated },
    }) : null);
    setEditing(null);
    try {
      await notesAPI.update(noteId, { content: { SOAP: updated } });
    } catch { /* optimistic update already applied */ }
  };

  const handleFinalize = async () => {
    if (!note) return;
    setFinalizing(true);
    try {
      await notesAPI.finalize(noteId);
      setNote(prev => prev ? { ...prev, status: "finalized" } : null);
    } catch { /* show nothing — status unchanged */ }
    setFinalizing(false);
  };

  const handleRegenerateAI = async () => {
    if (!note) return;
    setSaving(true);
    try {
      const result = await aiAPI.generateNote(note.id, "soap") as Record<string, unknown>;
      const soap = (result.content as Record<string, unknown>)?.SOAP as Record<NoteSection, string>;
      if (soap) setNote(prev => prev ? { ...prev, content: { SOAP: soap } } : null);
    } catch { /* keep existing content */ }
    setSaving(false);
  };

  const SOAP_SECTIONS: { key: NoteSection; label: string; desc: string }[] = [
    { key: "subjective", label: "S — Subjective", desc: "Patient's reported experience" },
    { key: "objective", label: "O — Objective", desc: "Observable data and measurements" },
    { key: "assessment", label: "A — Assessment", desc: "Clinical analysis and diagnosis" },
    { key: "plan", label: "P — Plan", desc: "Treatment plan and next steps" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>;
  if (!note) return <div className="p-6 text-center text-slate-500">Note not found. <Link href="/notes" className="text-violet-600 underline">Back to Notes</Link></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/notes"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Session Note</h1>
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                note.status === "finalized" ? "bg-green-100 text-green-700" :
                note.status === "needs_review" ? "bg-amber-100 text-amber-700" :
                "bg-blue-100 text-blue-700"
              )}>
                {note.status === "finalized" ? "Finalized" :
                 note.status === "needs_review" ? "Needs Review" : "Draft"}
              </span>
              {note.ai_generated && (
                <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                  <Brain className="w-3 h-3" />
                  AI Generated
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {note.patient_name} · {formatDate(note.session_date)} · Session #{note.session_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerateAI}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Regenerate
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          {note.status !== "finalized" && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              {finalizing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Finalize Note
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestions */}
      {note.ai_suggestions.length > 0 && note.status !== "finalized" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-800">AI Clinical Suggestions</h3>
          </div>
          <ul className="space-y-1.5">
            {note.ai_suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-purple-700">
                <span className="text-purple-400 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Format Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Format:</span>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {["SOAP", "DAP", "BIRP"].map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f as any)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-all",
                format === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{note.word_count} words</span>
      </div>

      {/* Note Sections */}
      <div className="space-y-4">
        {SOAP_SECTIONS.map(({ key, label, desc }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {editing !== key && note.status !== "finalized" && (
                  <button
                    onClick={() => startEdit(key)}
                    className="flex items-center gap-1.5 text-xs text-secondary hover:bg-secondary/10 px-2 py-1 rounded transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                <button className="p-1.5 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5">
              {editing === key ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none leading-relaxed"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(key)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {note.content.SOAP[key]}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          Note History
        </h3>
        <div className="space-y-2 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>AI Draft Generated</span>
            <span>{formatDate(note.created_at, "datetime")}</span>
          </div>
          <div className="flex justify-between">
            <span>Therapist</span>
            <span>{note.therapist_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Session Date</span>
            <span>{formatDate(note.session_date, "datetime")}</span>
          </div>
          <div className="flex justify-between">
            <span>Session Number</span>
            <span>#{note.session_number}</span>
          </div>
          {note.status === "finalized" && (
            <div className="flex justify-between text-green-600 font-semibold mt-2">
              <span>Finalized</span>
              <span>✓ Locked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
