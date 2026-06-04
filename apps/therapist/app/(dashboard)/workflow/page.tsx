"use client";

import { useState } from "react";
import {
  Workflow, Play, Pause, CheckCircle2, Clock, AlertTriangle,
  Plus, ChevronRight, Settings, Zap, Calendar, Users, Brain,
  FileText, MessageSquare, Bell, Shield, Activity, ArrowRight,
  Mail, Phone, Target, Star, RefreshCw, Eye, Edit3, Layers,
  ToggleLeft, ToggleRight, Sparkles, Copy, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowStatus = "active" | "paused" | "draft";
type TriggerType = "session_completed" | "assessment_due" | "risk_threshold" | "no_contact" | "appointment_reminder" | "homework_due" | "medication_check" | "billing";
type ActionType = "send_message" | "send_email" | "create_task" | "schedule_session" | "alert_therapist" | "generate_report" | "update_risk" | "send_assessment";

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  trigger: { type: TriggerType; label: string };
  actions: Array<{ type: ActionType; label: string }>;
  runs_count: number;
  last_run: string;
  success_rate: number;
  category: "clinical" | "administrative" | "patient_engagement" | "safety" | "billing";
}

const WORKFLOWS: WorkflowItem[] = [
  {
    id: "wf1",
    name: "Post-Session Documentation Reminder",
    description: "Automatically reminds therapist to complete session notes within 24 hours of a completed session.",
    status: "active",
    trigger: { type: "session_completed", label: "Session Completed" },
    actions: [
      { type: "alert_therapist", label: "Send note completion reminder" },
      { type: "create_task", label: "Create overdue task at 24hrs" },
    ],
    runs_count: 124,
    last_run: "2h ago",
    success_rate: 97,
    category: "clinical",
  },
  {
    id: "wf2",
    name: "Weekly PHQ-9 for Active MDD Patients",
    description: "Sends PHQ-9 assessment link to all active patients with MDD diagnosis every Monday morning.",
    status: "active",
    trigger: { type: "assessment_due", label: "Weekly schedule (Monday 9AM)" },
    actions: [
      { type: "send_assessment", label: "Send PHQ-9 to patient portal" },
      { type: "alert_therapist", label: "Notify therapist when completed" },
    ],
    runs_count: 86,
    last_run: "3 days ago",
    success_rate: 89,
    category: "clinical",
  },
  {
    id: "wf3",
    name: "High-Risk Alert Protocol",
    description: "When a patient's Radar score exceeds 70, immediately alert the therapist and create a safety review task.",
    status: "active",
    trigger: { type: "risk_threshold", label: "Radar Score > 70" },
    actions: [
      { type: "alert_therapist", label: "Urgent push notification to therapist" },
      { type: "create_task", label: "Create safety assessment task" },
      { type: "send_message", label: "Check-in message to patient" },
    ],
    runs_count: 8,
    last_run: "5 days ago",
    success_rate: 100,
    category: "safety",
  },
  {
    id: "wf4",
    name: "No-Contact Follow-Up",
    description: "If a patient has not contacted or attended a session in 14 days, trigger an outreach sequence.",
    status: "active",
    trigger: { type: "no_contact", label: "No contact for 14 days" },
    actions: [
      { type: "send_message", label: "Automated check-in message" },
      { type: "alert_therapist", label: "Alert therapist if no response (24hrs)" },
      { type: "update_risk", label: "Increase Radar monitoring frequency" },
    ],
    runs_count: 12,
    last_run: "Yesterday",
    success_rate: 83,
    category: "patient_engagement",
  },
  {
    id: "wf5",
    name: "Session Appointment Reminders",
    description: "Send automated appointment reminders 48h and 2h before each session.",
    status: "active",
    trigger: { type: "appointment_reminder", label: "48hrs and 2hrs before session" },
    actions: [
      { type: "send_message", label: "Patient reminder (48hrs)" },
      { type: "send_message", label: "Final reminder (2hrs)" },
    ],
    runs_count: 248,
    last_run: "1h ago",
    success_rate: 99,
    category: "administrative",
  },
  {
    id: "wf6",
    name: "Homework Follow-Up",
    description: "Send a brief check-in message 3 days after assigning session homework to encourage completion.",
    status: "active",
    trigger: { type: "homework_due", label: "3 days after homework assigned" },
    actions: [
      { type: "send_message", label: "Motivational homework reminder" },
    ],
    runs_count: 67,
    last_run: "4 days ago",
    success_rate: 91,
    category: "patient_engagement",
  },
  {
    id: "wf7",
    name: "Insurance Authorization Reminder",
    description: "Alert therapist when a patient's insurance authorization is expiring within 30 days.",
    status: "paused",
    trigger: { type: "billing", label: "Authorization expires in 30 days" },
    actions: [
      { type: "alert_therapist", label: "Authorization renewal reminder" },
      { type: "generate_report", label: "Generate medical necessity letter draft" },
    ],
    runs_count: 14,
    last_run: "2 weeks ago",
    success_rate: 86,
    category: "billing",
  },
  {
    id: "wf8",
    name: "Monthly Outcome Summary (AI)",
    description: "AI generates a brief monthly clinical summary for each active patient on the 1st of the month.",
    status: "draft",
    trigger: { type: "assessment_due", label: "Monthly (1st of month)" },
    actions: [
      { type: "generate_report", label: "AI generate patient progress summary" },
      { type: "alert_therapist", label: "Notify therapist for review" },
    ],
    runs_count: 0,
    last_run: "Never",
    success_rate: 0,
    category: "clinical",
  },
];

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active: { label: "Active", color: "text-emerald-700", bg: "bg-emerald-100", icon: Play },
  paused: { label: "Paused", color: "text-amber-700", bg: "bg-amber-100", icon: Pause },
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100", icon: Edit3 },
};

const CATEGORY_CONFIG = {
  clinical: { label: "Clinical", color: "text-blue-700", bg: "bg-blue-50" },
  administrative: { label: "Administrative", color: "text-purple-700", bg: "bg-purple-50" },
  patient_engagement: { label: "Patient Engagement", color: "text-teal-700", bg: "bg-teal-50" },
  safety: { label: "Safety", color: "text-red-700", bg: "bg-red-50" },
  billing: { label: "Billing", color: "text-amber-700", bg: "bg-amber-50" },
};

const TRIGGER_ICONS: Record<TriggerType, React.ElementType> = {
  session_completed: Calendar,
  assessment_due: Target,
  risk_threshold: AlertTriangle,
  no_contact: Bell,
  appointment_reminder: Clock,
  homework_due: FileText,
  medication_check: Shield,
  billing: Activity,
};

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  send_message: MessageSquare,
  send_email: Mail,
  create_task: CheckCircle2,
  schedule_session: Calendar,
  alert_therapist: Bell,
  generate_report: Brain,
  update_risk: Zap,
  send_assessment: FileText,
};

const WORKFLOW_TEMPLATES = [
  { name: "PHQ-9 Weekly Monitor", category: "clinical", trigger: "Weekly schedule" },
  { name: "Crisis Protocol Escalation", category: "safety", trigger: "Risk score spike" },
  { name: "Treatment Plan Review", category: "clinical", trigger: "90 days in treatment" },
  { name: "New Patient Welcome", category: "patient_engagement", trigger: "Patient enrolled" },
  { name: "Session No-Show Protocol", category: "administrative", trigger: "No-show detected" },
  { name: "Discharge Follow-Up", category: "clinical", trigger: "Treatment ended" },
];

export default function WorkflowPage() {
  const [activeCategory, setActiveCategory] = useState<"all" | keyof typeof CATEGORY_CONFIG>("all");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [workflows, setWorkflows] = useState(WORKFLOWS);

  const toggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(wf => {
      if (wf.id !== id) return wf;
      return { ...wf, status: wf.status === "active" ? "paused" : "active" };
    }));
  };

  const filteredWorkflows = workflows.filter(wf =>
    activeCategory === "all" || wf.category === activeCategory
  );

  const stats = {
    active: workflows.filter(w => w.status === "active").length,
    total_runs: workflows.reduce((acc, w) => acc + w.runs_count, 0),
    avg_success: Math.round(workflows.filter(w => w.runs_count > 0).reduce((acc, w) => acc + w.success_rate, 0) / workflows.filter(w => w.runs_count > 0).length),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="h-6 w-6 text-[#0A2342]" />
            Workflow Automation
          </h1>
          <p className="text-sm text-gray-500 mt-1">Automate clinical, administrative, and patient engagement workflows</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Copy className="h-4 w-4" /> From Template
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors">
            <Plus className="h-4 w-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Workflows", value: stats.active, icon: Play, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Total Workflows", value: workflows.length, icon: Layers, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Total Runs This Month", value: stats.total_runs, icon: Zap, color: "text-indigo-700", bg: "bg-indigo-50" },
          { label: "Avg Success Rate", value: `${stats.avg_success}%`, icon: CheckCircle2, color: "text-amber-700", bg: "bg-amber-50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-2xl border border-gray-200 p-4 flex items-center gap-3", stat.bg)}>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <Icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Workflow list */}
        <div className="col-span-2 space-y-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                activeCategory === "all" ? "bg-[#0A2342] text-white border-[#0A2342]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              All ({workflows.length})
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
              const count = workflows.filter(w => w.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as keyof typeof CATEGORY_CONFIG)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                    activeCategory === cat ? `${cfg.bg} ${cfg.color} border-current` : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Workflow cards */}
          <div className="space-y-3">
            {filteredWorkflows.map((wf) => {
              const statusCfg = STATUS_CONFIG[wf.status];
              const catCfg = CATEGORY_CONFIG[wf.category];
              const TriggerIcon = TRIGGER_ICONS[wf.trigger.type];
              const StatusIcon = statusCfg.icon;
              const isSelected = selectedWorkflow?.id === wf.id;

              return (
                <div
                  key={wf.id}
                  onClick={() => setSelectedWorkflow(isSelected ? null : wf)}
                  className={cn(
                    "bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm",
                    isSelected ? "border-[#0A2342] ring-1 ring-[#0A2342]/20" : "border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900 text-sm">{wf.name}</span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", catCfg.bg, catCfg.color)}>
                          {catCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{wf.description}</p>

                      {/* Trigger → Actions flow */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                          <TriggerIcon className="h-3.5 w-3.5 text-blue-600" />
                          <span className="text-[11px] font-medium text-blue-700">{wf.trigger.label}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                        {wf.actions.slice(0, 2).map((action, i) => {
                          const ActionIcon = ACTION_ICONS[action.type];
                          return (
                            <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                              <ActionIcon className="h-3.5 w-3.5 text-gray-500" />
                              <span className="text-[11px] text-gray-600">{action.label}</span>
                            </div>
                          );
                        })}
                        {wf.actions.length > 2 && (
                          <span className="text-[11px] text-gray-400">+{wf.actions.length - 2} more</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Status toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWorkflow(wf.id); }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all",
                          statusCfg.bg, statusCfg.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </button>

                      {/* Stats */}
                      {wf.runs_count > 0 && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">{wf.runs_count} runs</div>
                          <div className="text-xs font-medium text-emerald-600">{wf.success_rate}% success</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail / Templates */}
        <div className="space-y-4">
          {selectedWorkflow ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#0A2342] p-5 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-xl",
                    STATUS_CONFIG[selectedWorkflow.status].bg,
                    STATUS_CONFIG[selectedWorkflow.status].color
                  )}>
                    {STATUS_CONFIG[selectedWorkflow.status].label}
                  </span>
                  <button onClick={() => setSelectedWorkflow(null)} className="text-white/60 hover:text-white">✕</button>
                </div>
                <h3 className="font-bold text-base">{selectedWorkflow.name}</h3>
                <p className="text-white/60 text-xs mt-1">{CATEGORY_CONFIG[selectedWorkflow.category].label}</p>
              </div>

              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                <p className="text-sm text-gray-700">{selectedWorkflow.description}</p>

                {/* Trigger */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Trigger</p>
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                    {(() => {
                      const TIcon = TRIGGER_ICONS[selectedWorkflow.trigger.type];
                      return <TIcon className="h-4 w-4 text-blue-600" />;
                    })()}
                    <span className="text-sm font-medium text-blue-700">{selectedWorkflow.trigger.label}</span>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Actions ({selectedWorkflow.actions.length})</p>
                  <div className="space-y-2">
                    {selectedWorkflow.actions.map((action, i) => {
                      const AIcon = ACTION_ICONS[action.type];
                      return (
                        <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                          <div className="w-6 h-6 bg-gray-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-500">
                            {i + 1}
                          </div>
                          <AIcon className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-xs text-gray-700">{action.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats */}
                {selectedWorkflow.runs_count > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div className="text-xl font-bold text-gray-900">{selectedWorkflow.runs_count}</div>
                        <div className="text-xs text-gray-500">Total Runs</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-emerald-600">{selectedWorkflow.success_rate}%</div>
                        <div className="text-xs text-gray-500">Success Rate</div>
                      </div>
                    </div>
                    <div className="text-center mt-2 text-xs text-gray-400">Last run: {selectedWorkflow.last_run}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => toggleWorkflow(selectedWorkflow.id)}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
                      selectedWorkflow.status === "active"
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    )}
                  >
                    {selectedWorkflow.status === "active" ? "Pause Workflow" : "Activate Workflow"}
                  </button>
                  <button className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors flex items-center justify-center gap-1.5">
                    <Edit3 className="h-4 w-4" /> Edit Workflow
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Templates */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Workflow Templates
                </h3>
                <div className="space-y-2">
                  {WORKFLOW_TEMPLATES.map((template) => {
                    const catCfg = CATEGORY_CONFIG[template.category as keyof typeof CATEGORY_CONFIG];
                    return (
                      <button
                        key={template.name}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all text-left"
                      >
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{template.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", catCfg?.bg, catCfg?.color)}>
                              {catCfg?.label}
                            </span>
                            <span className="text-[10px] text-gray-400">{template.trigger}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Workflow suggestion */}
              <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-semibold">AI Workflow Suggestions</span>
                </div>
                <p className="text-white/70 text-xs mb-3">Based on your current caseload and practice patterns, the AI has identified workflows that could save you time.</p>
                <button className="w-full py-2 bg-white/10 border border-white/20 text-white text-xs font-medium rounded-xl hover:bg-white/20 transition-colors">
                  View AI Suggestions
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
