"use client";

import { useState } from "react";
import {
  Clipboard, Brain, Target, Activity, Heart, AlertTriangle,
  CheckCircle2, ChevronRight, Plus, Pill, Scale, Book,
  Lightbulb, ArrowRight, BarChart3, TrendingUp, User,
  Shield, Clock, Star, Zap, Layers, MessageSquare,
  FileText, Sparkles, RefreshCw, Search, Calculator,
  BookOpen, ExternalLink, Award
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolCategory = "assessments" | "calculators" | "decision_support" | "resources" | "protocols";

interface ClinicalTool {
  id: string;
  name: string;
  abbreviation?: string;
  category: ToolCategory;
  description: string;
  use_case: string;
  time_to_complete?: string;
  evidence_level?: string;
  icd10_relevant?: string[];
  ai_enhanced: boolean;
  popular?: boolean;
}

const CLINICAL_TOOLS: ClinicalTool[] = [
  // Assessments
  {
    id: "phq9",
    name: "Patient Health Questionnaire-9",
    abbreviation: "PHQ-9",
    category: "assessments",
    description: "Gold-standard depression screening and severity measure. 9-item validated scale for MDD.",
    use_case: "Depression screening, severity monitoring, treatment response",
    time_to_complete: "3 min",
    evidence_level: "Level I",
    icd10_relevant: ["F32", "F33"],
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "gad7",
    name: "Generalized Anxiety Disorder Scale",
    abbreviation: "GAD-7",
    category: "assessments",
    description: "7-item anxiety severity measure. Validated for GAD, panic disorder, social anxiety, PTSD.",
    use_case: "Anxiety screening and severity monitoring",
    time_to_complete: "3 min",
    evidence_level: "Level I",
    icd10_relevant: ["F41", "F40"],
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "pcl5",
    name: "PTSD Checklist for DSM-5",
    abbreviation: "PCL-5",
    category: "assessments",
    description: "20-item self-report measure assessing DSM-5 PTSD symptoms across all four clusters.",
    use_case: "PTSD screening, diagnosis support, treatment monitoring",
    time_to_complete: "5 min",
    evidence_level: "Level I",
    icd10_relevant: ["F43.1"],
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "audit",
    name: "Alcohol Use Disorders Identification Test",
    abbreviation: "AUDIT",
    category: "assessments",
    description: "10-item WHO-developed screen for hazardous and harmful alcohol use.",
    use_case: "Alcohol use screening, brief intervention guidance",
    time_to_complete: "4 min",
    evidence_level: "Level I",
    icd10_relevant: ["F10"],
    ai_enhanced: false,
  },
  {
    id: "asrs",
    name: "Adult ADHD Self-Report Scale",
    abbreviation: "ASRS-v1.1",
    category: "assessments",
    description: "18-item WHO-developed scale for adult ADHD symptoms (6-item screener available).",
    use_case: "ADHD screening in adults, symptom tracking",
    time_to_complete: "5 min",
    evidence_level: "Level I",
    icd10_relevant: ["F90"],
    ai_enhanced: false,
  },
  {
    id: "mdq",
    name: "Mood Disorder Questionnaire",
    abbreviation: "MDQ",
    category: "assessments",
    description: "13-item bipolar disorder screener validated for bipolar I and II.",
    use_case: "Bipolar screening, differential diagnosis support",
    time_to_complete: "5 min",
    evidence_level: "Level II",
    icd10_relevant: ["F31"],
    ai_enhanced: false,
  },
  {
    id: "columbia",
    name: "Columbia Suicide Severity Rating Scale",
    abbreviation: "C-SSRS",
    category: "assessments",
    description: "Clinician-administered suicide risk assessment. Gold standard for suicide risk stratification.",
    use_case: "Suicide risk assessment, crisis triage, safety planning",
    time_to_complete: "10 min",
    evidence_level: "Level I",
    icd10_relevant: ["F43", "F32", "F33"],
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "ders",
    name: "Difficulties in Emotion Regulation Scale",
    abbreviation: "DERS-16",
    category: "assessments",
    description: "Assesses emotional dysregulation across 6 dimensions. Useful for DBT work.",
    use_case: "Emotional dysregulation assessment, DBT progress tracking",
    time_to_complete: "8 min",
    evidence_level: "Level II",
    icd10_relevant: ["F60.3"],
    ai_enhanced: false,
  },
  {
    id: "eq5d",
    name: "EQ-5D Health-Related Quality of Life",
    abbreviation: "EQ-5D",
    category: "assessments",
    description: "5-dimension health status measure. Covers mobility, self-care, activity, pain, anxiety/depression.",
    use_case: "Quality of life tracking, functional outcomes",
    time_to_complete: "3 min",
    evidence_level: "Level I",
    ai_enhanced: false,
  },

  // Calculators
  {
    id: "bmi",
    name: "BMI & Nutritional Status Calculator",
    category: "calculators",
    description: "Calculate BMI with clinical interpretation for eating disorder monitoring.",
    use_case: "Eating disorder treatment monitoring, medical risk stratification",
    ai_enhanced: false,
  },
  {
    id: "med_titration",
    name: "Medication Equivalency Calculator",
    category: "calculators",
    description: "Calculate antidepressant, antipsychotic, and benzodiazepine dose equivalencies.",
    use_case: "Medication management coordination, prescriber communication",
    ai_enhanced: false,
  },
  {
    id: "dose_check",
    name: "Therapeutic Dose Range Checker",
    category: "calculators",
    description: "Verify dosing is within therapeutic range for common psychiatric medications.",
    use_case: "Medication coordination, safety check",
    ai_enhanced: true,
  },

  // Decision Support
  {
    id: "treatment_matcher",
    name: "AI Treatment Modality Matcher",
    category: "decision_support",
    description: "Evidence-based treatment recommendation engine. Match diagnosis and presentation to optimal modalities.",
    use_case: "Treatment planning, modality selection, EBP selection",
    evidence_level: "AI-Assisted",
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "crisis_protocol",
    name: "Crisis Response Protocol Builder",
    category: "decision_support",
    description: "Interactive safety planning tool. Generate individualized crisis safety plans with patient.",
    use_case: "Suicide/homicide risk, acute crisis intervention",
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "differential_dx",
    name: "Differential Diagnosis Assistant",
    category: "decision_support",
    description: "AI-powered differential diagnosis support. Input symptoms → ranked differentials with ICD-10 codes.",
    use_case: "Complex presentations, diagnostic uncertainty, supervision",
    ai_enhanced: true,
  },
  {
    id: "stepped_care",
    name: "Stepped Care Level Selector",
    category: "decision_support",
    description: "Determine appropriate level of care based on acuity, diagnoses, and clinical complexity.",
    use_case: "Level of care decisions, referrals, discharge planning",
    ai_enhanced: true,
  },

  // Resources
  {
    id: "dsm5_reference",
    name: "DSM-5-TR Quick Reference",
    category: "resources",
    description: "Complete DSM-5-TR criteria, specifiers, and differential considerations in searchable format.",
    use_case: "Diagnostic criteria, clinical documentation",
    ai_enhanced: false,
    popular: true,
  },
  {
    id: "icd10_browser",
    name: "ICD-10-CM Mental Health Browser",
    category: "resources",
    description: "Mental health ICD-10-CM code lookup with clinical descriptions and coding guidance.",
    use_case: "Billing, documentation, diagnostic coding",
    ai_enhanced: false,
  },
  {
    id: "intervention_library",
    name: "Evidence-Based Intervention Library",
    category: "resources",
    description: "300+ evidence-based therapeutic techniques organized by modality, diagnosis, and symptom target.",
    use_case: "Session planning, homework assignments, skill teaching",
    ai_enhanced: true,
    popular: true,
  },
  {
    id: "medication_guide",
    name: "Psychiatric Medication Guide",
    category: "resources",
    description: "Non-prescribing clinician reference for psychiatric medications, side effects, and interactions.",
    use_case: "Medication education, patient questions, care coordination",
    ai_enhanced: false,
  },

  // Protocols
  {
    id: "safety_plan",
    name: "Safety Planning Template (Stanley-Brown)",
    category: "protocols",
    description: "Evidence-based Stanley-Brown safety planning intervention template.",
    use_case: "Suicide risk, safety planning, crisis prevention",
    evidence_level: "Level I",
    ai_enhanced: true,
  },
  {
    id: "consent_forms",
    name: "Informed Consent Template Library",
    category: "protocols",
    description: "State-compliant informed consent forms for therapy, assessment, telehealth, and specialized treatments.",
    use_case: "Intake, specialized treatment initiation, telehealth",
    ai_enhanced: false,
  },
  {
    id: "hipaa_forms",
    name: "HIPAA Release & Authorization Forms",
    category: "protocols",
    description: "Compliant ROI forms for care coordination, insurance, legal, and family communication.",
    use_case: "Care coordination, legal requests, collateral contact",
    ai_enhanced: false,
  },
];

const CATEGORY_CONFIG: Record<ToolCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  assessments: { label: "Assessments & Scales", icon: BarChart3, color: "text-blue-700", bg: "bg-blue-50" },
  calculators: { label: "Clinical Calculators", icon: Calculator, color: "text-emerald-700", bg: "bg-emerald-50" },
  decision_support: { label: "Decision Support", icon: Brain, color: "text-indigo-700", bg: "bg-indigo-50" },
  resources: { label: "Clinical Resources", icon: BookOpen, color: "text-amber-700", bg: "bg-amber-50" },
  protocols: { label: "Protocols & Forms", icon: Clipboard, color: "text-rose-700", bg: "bg-rose-50" },
};

// PHQ-9 questions
const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things, such as reading the newspaper or watching television",
  "Moving or speaking so slowly that other people could have noticed? Or the opposite",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

const PHQ9_OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

export default function ClinicalToolsPage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all" | "popular">("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<ClinicalTool | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // PHQ-9 state
  const [phq9Answers, setPhq9Answers] = useState<number[]>(Array(9).fill(-1));
  const [phq9Submitted, setPhq9Submitted] = useState(false);

  const filteredTools = CLINICAL_TOOLS.filter((tool) => {
    const matchesCat = activeCategory === "all" ? true :
      activeCategory === "popular" ? tool.popular :
      tool.category === activeCategory;
    const matchesSearch = !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.abbreviation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const phq9Score = phq9Answers.reduce((acc, v) => acc + (v > -1 ? v : 0), 0);
  const phq9Complete = phq9Answers.every(a => a > -1);
  const phq9Severity = phq9Score <= 4 ? { label: "Minimal/None", color: "text-emerald-700", bg: "bg-emerald-50" } :
    phq9Score <= 9 ? { label: "Mild", color: "text-yellow-700", bg: "bg-yellow-50" } :
    phq9Score <= 14 ? { label: "Moderate", color: "text-orange-700", bg: "bg-orange-50" } :
    phq9Score <= 19 ? { label: "Moderately Severe", color: "text-red-700", bg: "bg-red-50" } :
    { label: "Severe", color: "text-red-900", bg: "bg-red-100" };

  return (
    <div className="flex gap-6 -mx-0">
      {/* Left sidebar */}
      <div className="w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sticky top-0">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#0A2342]" />
            Clinical Tools
          </h3>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none"
            />
          </div>

          <div className="space-y-0.5">
            {[
              { id: "popular", label: "Popular Tools", icon: Star },
              { id: "all", label: "All Tools", icon: Layers },
              ...Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({ id, label: cfg.label, icon: cfg.icon })),
            ].map((cat) => {
              const Icon = cat.icon;
              const count = cat.id === "popular" 
                ? CLINICAL_TOOLS.filter(t => t.popular).length 
                : cat.id === "all" 
                  ? CLINICAL_TOOLS.length 
                  : CLINICAL_TOOLS.filter(t => t.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as ToolCategory | "all" | "popular")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all",
                    activeCategory === cat.id ? "bg-[#0A2342] text-white" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{cat.label}</span>
                  <span className="ml-auto opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Clinical Tools</h1>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield className="h-3.5 w-3.5" />
            {CLINICAL_TOOLS.filter(t => t.evidence_level === "Level I").length} Level I Evidence Tools
          </div>
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredTools.map((tool) => {
            const catConf = CATEGORY_CONFIG[tool.category];
            const CatIcon = catConf.icon;
            const isActive = activeTool === tool.id;

            return (
              <div
                key={tool.id}
                className={cn(
                  "bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm",
                  isActive ? "border-[#0A2342] ring-1 ring-[#0A2342]/20" : "border-gray-200"
                )}
                onClick={() => {
                  if (tool.id === "phq9") {
                    setActiveTool(isActive ? null : tool.id);
                    setPhq9Submitted(false);
                    setPhq9Answers(Array(9).fill(-1));
                  } else {
                    setSelectedTool(selectedTool?.id === tool.id ? null : tool);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", catConf.bg)}>
                      <CatIcon className={cn("h-4 w-4", catConf.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-gray-900 text-sm">
                          {tool.abbreviation || tool.name}
                        </span>
                        {tool.popular && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                        {tool.ai_enhanced && (
                          <span className="flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                      </div>
                      {tool.abbreviation && (
                        <p className="text-xs text-gray-500 truncate">{tool.name}</p>
                      )}
                    </div>
                  </div>
                  {tool.evidence_level && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      tool.evidence_level === "Level I" ? "bg-emerald-100 text-emerald-700" :
                      tool.evidence_level === "Level II" ? "bg-blue-100 text-blue-700" :
                      "bg-indigo-100 text-indigo-700"
                    )}>
                      {tool.evidence_level}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mb-3">{tool.description}</p>

                <div className="flex items-center gap-2">
                  {tool.time_to_complete && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="h-3 w-3" /> {tool.time_to_complete}
                    </span>
                  )}
                  {tool.icd10_relevant && (
                    <span className="text-[10px] text-gray-400">
                      ICD: {tool.icd10_relevant.slice(0, 2).join(", ")}
                    </span>
                  )}
                  <button className={cn(
                    "ml-auto flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                    isActive ? "bg-[#0A2342] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}>
                    {isActive ? "Close" : "Open"} <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Inline PHQ-9 */}
                {isActive && tool.id === "phq9" && (
                  <div className="mt-4 border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
                    {!phq9Submitted ? (
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500">
                          Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following problems?
                        </p>
                        {PHQ9_QUESTIONS.map((q, idx) => (
                          <div key={idx}>
                            <p className="text-xs font-medium text-gray-800 mb-2">{idx + 1}. {q}</p>
                            <div className="flex gap-1.5">
                              {PHQ9_OPTIONS.map((opt, val) => (
                                <button
                                  key={val}
                                  onClick={() => {
                                    const newAnswers = [...phq9Answers];
                                    newAnswers[idx] = val;
                                    setPhq9Answers(newAnswers);
                                  }}
                                  className={cn(
                                    "flex-1 py-1.5 text-[10px] rounded-lg border transition-all",
                                    phq9Answers[idx] === val
                                      ? "bg-[#0A2342] text-white border-[#0A2342]"
                                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => { if (phq9Complete) setPhq9Submitted(true); }}
                          disabled={!phq9Complete}
                          className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-[#123A63] transition-colors"
                        >
                          {phq9Complete ? "Calculate Score" : `${phq9Answers.filter(a => a > -1).length}/9 answered`}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className={cn("rounded-xl p-4 text-center", phq9Severity.bg)}>
                          <div className={cn("text-4xl font-bold mb-1", phq9Severity.color)}>{phq9Score}</div>
                          <div className={cn("text-sm font-semibold", phq9Severity.color)}>{phq9Severity.label}</div>
                          <p className="text-xs text-gray-500 mt-1">PHQ-9 Score (0–27)</p>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-gray-500"><span>0–4</span><span>Minimal/None — Monitor</span></div>
                          <div className="flex justify-between text-gray-500"><span>5–9</span><span>Mild — Watchful waiting</span></div>
                          <div className="flex justify-between text-gray-500"><span>10–14</span><span>Moderate — Treatment plan</span></div>
                          <div className="flex justify-between text-gray-500"><span>15–19</span><span>Mod-Severe — Active treatment</span></div>
                          <div className="flex justify-between text-gray-500"><span>20–27</span><span>Severe — Immediate intervention</span></div>
                        </div>
                        {phq9Answers[8] > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-xs text-red-700 font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Suicidal ideation reported (Q9={phq9Answers[8]}). Safety assessment indicated.
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setPhq9Submitted(false); setPhq9Answers(Array(9).fill(-1)); }}
                            className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs"
                          >
                            Retake
                          </button>
                          <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium">
                            Save to Patient Record
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tools found. Try a different search.</p>
          </div>
        )}
      </div>

      {/* Selected tool detail panel */}
      {selectedTool && (
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 sticky top-0 overflow-hidden">
            {/* Header */}
            <div className="bg-[#0A2342] p-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  CATEGORY_CONFIG[selectedTool.category].bg
                )}>
                  {(() => {
                    const Icon = CATEGORY_CONFIG[selectedTool.category].icon;
                    return <Icon className={cn("h-4 w-4", CATEGORY_CONFIG[selectedTool.category].color)} />;
                  })()}
                </div>
                <button onClick={() => setSelectedTool(null)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <h3 className="font-bold text-base">
                {selectedTool.abbreviation && `${selectedTool.abbreviation} — `}{selectedTool.name}
              </h3>
              <p className="text-white/70 text-xs mt-1">{CATEGORY_CONFIG[selectedTool.category].label}</p>
            </div>

            <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">About</p>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedTool.description}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Best Used For</p>
                <p className="text-sm text-gray-700">{selectedTool.use_case}</p>
              </div>

              {selectedTool.icd10_relevant && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">ICD-10 Relevant</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTool.icd10_relevant.map((code) => (
                      <span key={code} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                {selectedTool.evidence_level && (
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium",
                    selectedTool.evidence_level === "Level I" ? "bg-emerald-50 text-emerald-700" :
                    selectedTool.evidence_level === "Level II" ? "bg-blue-50 text-blue-700" :
                    "bg-indigo-50 text-indigo-700"
                  )}>
                    <Award className="h-3 w-3" />
                    {selectedTool.evidence_level}
                  </div>
                )}
                {selectedTool.time_to_complete && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-xl text-xs text-gray-600">
                    <Clock className="h-3 w-3" />
                    {selectedTool.time_to_complete}
                  </div>
                )}
                {selectedTool.ai_enhanced && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 rounded-xl text-xs text-indigo-700">
                    <Sparkles className="h-3 w-3" />
                    AI Enhanced
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <button className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors">
                  Open Tool
                </button>
                {selectedTool.category === "assessments" && (
                  <button className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                    Send to Patient Portal
                  </button>
                )}
                <button className="w-full py-2 border border-gray-200 text-gray-500 rounded-xl text-xs hover:bg-gray-50 flex items-center justify-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> View Research Evidence
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
