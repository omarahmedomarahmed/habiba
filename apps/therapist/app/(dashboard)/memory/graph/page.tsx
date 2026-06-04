"use client";

import { useState, useCallback, useRef } from "react";
import {
  Brain, Network, Heart, AlertTriangle, TrendingUp, Star, Shield,
  Target, Pill, User, Flag, Activity, Eye, Lightbulb, ArrowLeft,
  Sparkles, ChevronRight, Layers, Link2, Clock, Plus, Search,
  RefreshCw, ZoomIn, ZoomOut, Maximize2, Filter, Database
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── GRAPH DATA TYPES ──────────────────────────────────────────────────────────

type NodeType =
  | "patient"
  | "trauma"
  | "relationship"
  | "trigger"
  | "pattern"
  | "progress"
  | "preference"
  | "goal"
  | "medication"
  | "life_event"
  | "session"
  | "belief"
  | "emotion";

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  importance: "critical" | "high" | "medium" | "low";
  description: string;
  x: number;
  y: number;
  radius: number;
  sessions: number;
  confidence: number;
  tags?: string[];
  connections: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  strength: "strong" | "moderate" | "weak";
  type: "causal" | "temporal" | "contextual" | "correlational";
}

// ─── MOCK GRAPH DATA ───────────────────────────────────────────────────────────

const GRAPH_NODES: GraphNode[] = [
  // Core patient node
  {
    id: "patient",
    label: "Sarah Chen",
    type: "patient",
    importance: "critical",
    description: "Core patient node. 24 sessions analyzed.",
    x: 400, y: 300,
    radius: 38,
    sessions: 24,
    confidence: 1.0,
    connections: ["father-wound", "perfectionism", "gad", "mdd", "lexapro", "lisa", "grief"],
  },

  // Core psychological structures
  {
    id: "father-wound",
    label: "Father Wound",
    type: "trauma",
    importance: "critical",
    description: "Father emotionally unavailable. Performance = worthiness schema developed. Root of most current patterns.",
    x: 200, y: 160,
    radius: 28,
    sessions: 6,
    confidence: 0.94,
    tags: ["attachment", "schema", "childhood"],
    connections: ["patient", "perfectionism", "people-pleasing", "performance-anxiety"],
  },
  {
    id: "perfectionism",
    label: "Perfectionism Schema",
    type: "belief",
    importance: "critical",
    description: "Core maladaptive schema: 'I must be perfect to deserve love/acceptance.' Connected to father wound.",
    x: 130, y: 300,
    radius: 26,
    sessions: 12,
    confidence: 0.97,
    tags: ["schema", "cognitive", "CBT-target"],
    connections: ["father-wound", "performance-anxiety", "self-criticism", "gad"],
  },
  {
    id: "people-pleasing",
    label: "People-Pleasing",
    type: "pattern",
    importance: "high",
    description: "Behavioral pattern of prioritizing others' approval. Activated in workplace and personal relationships.",
    x: 100, y: 190,
    radius: 22,
    sessions: 5,
    confidence: 0.88,
    tags: ["pattern", "behavior", "relational"],
    connections: ["father-wound", "perfectionism", "performance-anxiety"],
  },

  // Symptoms/Diagnoses
  {
    id: "mdd",
    label: "Depression (MDD)",
    type: "pattern",
    importance: "high",
    description: "Major Depressive Disorder F32.1. PHQ-9 trending 17→13 over 6 months.",
    x: 350, y: 160,
    radius: 24,
    sessions: 24,
    confidence: 0.99,
    tags: ["diagnosis", "PHQ-9", "treatment-target"],
    connections: ["patient", "gad", "grief", "seasonal-pattern", "sleep"],
  },
  {
    id: "gad",
    label: "Anxiety (GAD)",
    type: "pattern",
    importance: "high",
    description: "Generalized Anxiety Disorder F41.1. GAD-7 improved 14→8. Significant functional anxiety.",
    x: 540, y: 160,
    radius: 24,
    sessions: 20,
    confidence: 0.97,
    tags: ["diagnosis", "GAD-7", "treatment-target"],
    connections: ["patient", "mdd", "performance-anxiety", "perfectionism"],
  },

  // Triggers
  {
    id: "performance-anxiety",
    label: "Performance Anxiety",
    type: "trigger",
    importance: "high",
    description: "Work evaluations trigger acute anxiety (8/10). Physiological symptoms: racing heart, difficulty breathing.",
    x: 260, y: 420,
    radius: 22,
    sessions: 8,
    confidence: 0.91,
    tags: ["trigger", "work", "physiological"],
    connections: ["perfectionism", "father-wound", "gad", "work-trigger"],
  },
  {
    id: "work-trigger",
    label: "Work Stressors",
    type: "trigger",
    importance: "medium",
    description: "Occupational stress activates perfectionism and anxiety. Q4 (review season) highest risk period.",
    x: 170, y: 440,
    radius: 20,
    sessions: 6,
    confidence: 0.85,
    tags: ["trigger", "occupational"],
    connections: ["performance-anxiety", "seasonal-pattern"],
  },

  // Progress/Skills
  {
    id: "cbt-skills",
    label: "CBT Skills Acquired",
    type: "progress",
    importance: "high",
    description: "Breathing techniques, cognitive reframing, grounding. Successfully applied in real-world (work review).",
    x: 580, y: 280,
    sessions: 12,
    radius: 22,
    confidence: 0.92,
    tags: ["skill", "milestone", "CBT"],
    connections: ["patient", "breathing-technique", "cognitive-reframing"],
  },
  {
    id: "breathing-technique",
    label: "Breathing Technique",
    type: "progress",
    importance: "medium",
    description: "Diaphragmatic breathing mastered. Used independently during work review Nov 2025.",
    x: 660, y: 200,
    radius: 18,
    sessions: 6,
    confidence: 0.96,
    tags: ["skill", "anxiety-management"],
    connections: ["cbt-skills", "performance-anxiety"],
  },
  {
    id: "cognitive-reframing",
    label: "Cognitive Reframing",
    type: "progress",
    importance: "high",
    description: "Now independently identifies distortions (Session #21 milestone). All-or-nothing thinking, catastrophizing.",
    x: 660, y: 340,
    radius: 20,
    sessions: 9,
    confidence: 0.92,
    tags: ["skill", "cognitive", "CBT", "milestone"],
    connections: ["cbt-skills", "perfectionism", "self-criticism"],
  },

  // Relationships
  {
    id: "lisa",
    label: "Sister (Lisa)",
    type: "relationship",
    importance: "high",
    description: "Primary support figure. Aware of therapy. Strong relationship. Emergency contact.",
    x: 480, y: 430,
    radius: 20,
    sessions: 4,
    confidence: 0.91,
    tags: ["support", "family", "protective-factor"],
    connections: ["patient", "grief"],
  },

  // Other patterns
  {
    id: "self-criticism",
    label: "Self-Critical Voice",
    type: "belief",
    importance: "high",
    description: "'Nothing is ever good enough.' Minimizes achievements. Connected to perfectionism schema.",
    x: 200, y: 370,
    radius: 20,
    sessions: 10,
    confidence: 0.93,
    tags: ["cognition", "negative-self-talk"],
    connections: ["perfectionism", "cognitive-reframing", "mdd"],
  },
  {
    id: "grief",
    label: "Grief (Friend Loss)",
    type: "trauma",
    importance: "high",
    description: "Friend died unexpectedly Oct 2025. Complicated by survivor guilt and difficulty expressing sadness.",
    x: 430, y: 420,
    radius: 22,
    sessions: 3,
    confidence: 0.88,
    tags: ["grief", "recent", "active-processing"],
    connections: ["patient", "mdd", "father-wound", "lisa"],
  },
  {
    id: "seasonal-pattern",
    label: "Seasonal Pattern",
    type: "pattern",
    importance: "high",
    description: "Nov–Jan mood worsening. 2nd confirmed cycle. PHQ-9 +4 pts in winter months.",
    x: 500, y: 70,
    radius: 20,
    sessions: 4,
    confidence: 0.85,
    tags: ["seasonal", "SAD", "predictive"],
    connections: ["mdd", "work-trigger"],
  },
  {
    id: "lexapro",
    label: "Lexapro 10mg",
    type: "medication",
    importance: "high",
    description: "Positive response. Sleep improvement, emotional stabilization. No reported side effects.",
    x: 620, y: 420,
    radius: 20,
    sessions: 6,
    confidence: 0.95,
    tags: ["medication", "SSRI", "effective"],
    connections: ["patient", "sleep", "mdd"],
  },
  {
    id: "sleep",
    label: "Sleep Difficulties",
    type: "pattern",
    importance: "medium",
    description: "Improving. 5.8hrs avg → 6.4hrs post-Lexapro increase. Target: 7+ hrs. Melatonin added.",
    x: 700, y: 420,
    radius: 18,
    sessions: 8,
    confidence: 0.89,
    tags: ["sleep", "improving", "treatment-target"],
    connections: ["mdd", "lexapro"],
  },
];

const GRAPH_EDGES: GraphEdge[] = [
  { from: "patient", to: "father-wound", label: "root cause", strength: "strong", type: "causal" },
  { from: "father-wound", to: "perfectionism", label: "formed", strength: "strong", type: "causal" },
  { from: "father-wound", to: "people-pleasing", label: "developed", strength: "moderate", type: "causal" },
  { from: "perfectionism", to: "performance-anxiety", label: "activates", strength: "strong", type: "causal" },
  { from: "perfectionism", to: "self-criticism", label: "drives", strength: "strong", type: "causal" },
  { from: "perfectionism", to: "gad", label: "maintains", strength: "strong", type: "causal" },
  { from: "performance-anxiety", to: "gad", label: "part of", strength: "strong", type: "causal" },
  { from: "gad", to: "mdd", label: "comorbid", strength: "moderate", type: "correlational" },
  { from: "mdd", to: "sleep", label: "disrupts", strength: "moderate", type: "causal" },
  { from: "mdd", to: "seasonal-pattern", label: "worsens", strength: "moderate", type: "correlational" },
  { from: "patient", to: "cbt-skills", label: "acquired", strength: "strong", type: "temporal" },
  { from: "cbt-skills", to: "breathing-technique", label: "includes", strength: "strong", type: "contextual" },
  { from: "cbt-skills", to: "cognitive-reframing", label: "includes", strength: "strong", type: "contextual" },
  { from: "breathing-technique", to: "performance-anxiety", label: "reduces", strength: "moderate", type: "causal" },
  { from: "cognitive-reframing", to: "perfectionism", label: "targets", strength: "moderate", type: "causal" },
  { from: "patient", to: "lisa", label: "support", strength: "strong", type: "contextual" },
  { from: "patient", to: "grief", label: "experiencing", strength: "strong", type: "temporal" },
  { from: "grief", to: "mdd", label: "worsens", strength: "moderate", type: "causal" },
  { from: "patient", to: "lexapro", label: "prescribed", strength: "strong", type: "contextual" },
  { from: "lexapro", to: "sleep", label: "improves", strength: "moderate", type: "causal" },
  { from: "lexapro", to: "mdd", label: "treats", strength: "moderate", type: "causal" },
];

// ─── NODE STYLE CONFIG ─────────────────────────────────────────────────────────

const NODE_CONFIG: Record<NodeType, { color: string; bg: string; icon: React.ElementType; stroke: string }> = {
  patient: { color: "text-white", bg: "#0A2342", icon: User, stroke: "#0A2342" },
  trauma: { color: "text-rose-700", bg: "#fff1f2", icon: Shield, stroke: "#e11d48" },
  relationship: { color: "text-amber-700", bg: "#fffbeb", icon: Heart, stroke: "#f59e0b" },
  trigger: { color: "text-orange-700", bg: "#fff7ed", icon: AlertTriangle, stroke: "#f97316" },
  pattern: { color: "text-blue-700", bg: "#eff6ff", icon: Activity, stroke: "#3b82f6" },
  progress: { color: "text-emerald-700", bg: "#ecfdf5", icon: TrendingUp, stroke: "#10b981" },
  preference: { color: "text-purple-700", bg: "#f5f3ff", icon: Star, stroke: "#8b5cf6" },
  goal: { color: "text-indigo-700", bg: "#eef2ff", icon: Target, stroke: "#6366f1" },
  medication: { color: "text-teal-700", bg: "#f0fdfa", icon: Pill, stroke: "#14b8a6" },
  life_event: { color: "text-slate-700", bg: "#f8fafc", icon: Flag, stroke: "#64748b" },
  session: { color: "text-gray-700", bg: "#f9fafb", icon: Clock, stroke: "#6b7280" },
  belief: { color: "text-red-700", bg: "#fef2f2", icon: Brain, stroke: "#ef4444" },
  emotion: { color: "text-pink-700", bg: "#fdf2f8", icon: Heart, stroke: "#ec4899" },
};

const IMPORTANCE_CONFIG = {
  critical: { ring: "#dc2626", glow: "rgba(220,38,38,0.2)", label: "Critical" },
  high: { ring: "#f97316", glow: "rgba(249,115,22,0.15)", label: "High" },
  medium: { ring: "#3b82f6", glow: "rgba(59,130,246,0.1)", label: "Medium" },
  low: { ring: "#94a3b8", glow: "rgba(148,163,184,0.1)", label: "Low" },
};

const EDGE_CONFIG = {
  strong: { width: 2.5, opacity: 0.8 },
  moderate: { width: 1.5, opacity: 0.5 },
  weak: { width: 1, opacity: 0.3 },
};

export default function KnowledgeGraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<NodeType | "all">("all");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [highlightConnections, setHighlightConnections] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const filteredNodes = GRAPH_NODES.filter(
    n => activeFilter === "all" || n.type === activeFilter
  );

  const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

  const filteredEdges = GRAPH_EDGES.filter(
    e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
  );

  const getConnectedNodeIds = (nodeId: string) => {
    const connected = new Set<string>();
    GRAPH_EDGES.forEach(e => {
      if (e.from === nodeId) connected.add(e.to);
      if (e.to === nodeId) connected.add(e.from);
    });
    return connected;
  };

  const highlightedNodes = hoveredNode
    ? getConnectedNodeIds(hoveredNode)
    : selectedNode
    ? getConnectedNodeIds(selectedNode.id)
    : null;

  const isNodeHighlighted = (nodeId: string) => {
    if (!highlightedNodes && !hoveredNode && !selectedNode) return true;
    const focusId = hoveredNode || selectedNode?.id;
    if (!focusId) return true;
    return nodeId === focusId || (highlightedNodes?.has(nodeId) ?? false);
  };

  const isEdgeHighlighted = (edge: GraphEdge) => {
    const focusId = hoveredNode || selectedNode?.id;
    if (!focusId) return true;
    return edge.from === focusId || edge.to === focusId;
  };

  const NODE_TYPE_LABELS: Record<NodeType, string> = {
    patient: "Patient",
    trauma: "Trauma/Grief",
    relationship: "Relationships",
    trigger: "Triggers",
    pattern: "Patterns/Diagnoses",
    progress: "Progress/Skills",
    preference: "Preferences",
    goal: "Goals",
    medication: "Medications",
    life_event: "Life Events",
    session: "Sessions",
    belief: "Core Beliefs",
    emotion: "Emotions",
  };

  return (
    <div className="flex h-full gap-0 -mx-6 -mt-6">
      {/* Left panel */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Network className="h-5 w-5 text-[#0A2342]" />
            <h2 className="font-bold text-[#0A2342] text-sm">Knowledge Graph</h2>
            <Link href="/memory" className="ml-auto text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-gray-500">Patient mental model visualization</p>
        </div>

        {/* Patient selector */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5 bg-[#0A2342] text-white rounded-xl p-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-xs font-bold">SC</div>
            <div>
              <p className="text-xs font-semibold">Sarah Chen</p>
              <p className="text-[10px] text-white/60">{GRAPH_NODES.length} nodes · 24 sessions</p>
            </div>
          </div>
        </div>

        {/* Filter by node type */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 px-1">Filter by Type</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all",
                activeFilter === "all" ? "bg-[#0A2342] text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Nodes</span>
              <span className="ml-auto opacity-60">{GRAPH_NODES.length}</span>
            </button>
            {(Object.entries(NODE_CONFIG) as [NodeType, typeof NODE_CONFIG[NodeType]][]).map(([type, cfg]) => {
              const count = GRAPH_NODES.filter(n => n.type === type).length;
              if (count === 0) return null;
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all",
                    activeFilter === type
                      ? "font-medium shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                  style={activeFilter === type ? { backgroundColor: cfg.bg, color: cfg.stroke } : {}}
                >
                  <Icon className="h-3.5 w-3.5" style={activeFilter === type ? { color: cfg.stroke } : {}} />
                  <span>{NODE_TYPE_LABELS[type]}</span>
                  <span className="ml-auto opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Graph settings */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={e => setShowEdgeLabels(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-600">Show edge labels</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={highlightConnections}
              onChange={e => setHighlightConnections(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            <span className="text-xs text-gray-600">Highlight connections</span>
          </label>
        </div>

        {/* Importance legend */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Importance Ring</p>
          {Object.entries(IMPORTANCE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <div className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: cfg.ring }} />
              <span className="text-xs text-gray-600">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">
        {/* Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-800/90 backdrop-blur rounded-2xl px-4 py-2.5 border border-slate-700">
          <button
            onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
          <div className="w-px h-5 bg-slate-600 mx-1" />
          <span className="text-xs text-slate-400">{filteredNodes.length} nodes · {filteredEdges.length} edges</span>
        </div>

        {/* SVG Knowledge Graph */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox="0 0 800 600"
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
            {/* Glow filters */}
            {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
              <filter key={type} id={`glow-${type}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>
          <rect width="800" height="600" fill="url(#grid)" />

          {/* Edges */}
          {filteredEdges.map((edge, i) => {
            const fromNode = GRAPH_NODES.find(n => n.id === edge.from);
            const toNode = GRAPH_NODES.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const cfg = EDGE_CONFIG[edge.strength];
            const isHighlighted = !highlightConnections || isEdgeHighlighted(edge);
            const opacity = isHighlighted ? cfg.opacity : 0.08;

            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;

            const x1 = fromNode.x + ux * fromNode.radius;
            const y1 = fromNode.y + uy * fromNode.radius;
            const x2 = toNode.x - ux * toNode.radius;
            const y2 = toNode.y - uy * toNode.radius;

            // Curve the edges slightly
            const midX = (x1 + x2) / 2 - uy * 20;
            const midY = (y1 + y2) / 2 + ux * 20;

            const edgeColors = {
              causal: "#6366f1",
              temporal: "#10b981",
              contextual: "#f59e0b",
              correlational: "#ec4899",
            };

            return (
              <g key={i} opacity={opacity}>
                <path
                  d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                  fill="none"
                  stroke={edgeColors[edge.type]}
                  strokeWidth={cfg.width}
                  strokeLinecap="round"
                />
                {/* Arrow */}
                <circle cx={x2} cy={y2} r={2} fill={edgeColors[edge.type]} />
                {/* Edge label */}
                {showEdgeLabels && edge.label && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fontSize="8"
                    fill="rgba(255,255,255,0.5)"
                    className="select-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const cfg = NODE_CONFIG[node.type];
            const impCfg = IMPORTANCE_CONFIG[node.importance];
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode === node.id;
            const isHighlighted = !highlightConnections || isNodeHighlighted(node.id);
            const opacity = isHighlighted ? 1 : 0.2;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ opacity, cursor: "pointer" }}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Importance glow ring */}
                {(isSelected || isHovered) && (
                  <circle
                    r={node.radius + 10}
                    fill={impCfg.glow}
                    style={{ filter: `blur(8px)` }}
                  />
                )}

                {/* Outer importance ring */}
                <circle
                  r={node.radius + 5}
                  fill="none"
                  stroke={impCfg.ring}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={isSelected || isHovered ? 0.8 : 0.4}
                  strokeDasharray={node.importance === "critical" ? "none" : "3 2"}
                />

                {/* Main node circle */}
                <circle
                  r={node.radius}
                  fill={node.type === "patient" ? "#0A2342" : cfg.bg}
                  stroke={cfg.stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Confidence fill */}
                <circle
                  r={node.radius - 3}
                  fill="none"
                  stroke={cfg.stroke}
                  strokeWidth={3}
                  strokeDasharray={`${(node.radius - 3) * 2 * Math.PI * node.confidence} ${(node.radius - 3) * 2 * Math.PI}`}
                  transform="rotate(-90)"
                  opacity={0.3}
                  style={{ transition: "stroke-dasharray 1s ease" }}
                />

                {/* Node label */}
                <text
                  y={node.radius + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isSelected || isHovered ? "700" : "500"}
                  fill={isSelected || isHovered ? "white" : "rgba(255,255,255,0.85)"}
                  className="select-none"
                >
                  {node.label}
                </text>

                {/* Session count badge */}
                {node.sessions > 0 && (
                  <g>
                    <circle cx={node.radius - 4} cy={-(node.radius - 4)} r={8} fill="#1e40af" />
                    <text
                      x={node.radius - 4}
                      y={-(node.radius - 4) + 3.5}
                      textAnchor="middle"
                      fontSize="7"
                      fill="white"
                      fontWeight="700"
                      className="select-none"
                    >
                      {node.sessions}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Edge type legend */}
        <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-xl p-3 border border-slate-700">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Edge Types</p>
          {[
            { type: "causal", color: "#6366f1", label: "Causal" },
            { type: "correlational", color: "#ec4899", label: "Correlational" },
            { type: "temporal", color: "#10b981", label: "Temporal" },
            { type: "contextual", color: "#f59e0b", label: "Contextual" },
          ].map(({ type, color, label }) => (
            <div key={type} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-4 h-0.5" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      {selectedNode && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-gray-100" style={{ backgroundColor: NODE_CONFIG[selectedNode.type].bg }}>
            <div className="flex items-center justify-between mb-2">
              {(() => {
                const cfg = NODE_CONFIG[selectedNode.type];
                const Icon = cfg.icon;
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ borderColor: cfg.stroke, backgroundColor: "white" }}>
                      <Icon className="h-4 w-4" style={{ color: cfg.stroke }} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{selectedNode.label}</p>
                      <p className="text-xs" style={{ color: NODE_CONFIG[selectedNode.type].stroke }}>
                        {NODE_TYPE_LABELS[selectedNode.type]}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full border",
                selectedNode.importance === "critical" ? "bg-red-50 text-red-700 border-red-200" :
                selectedNode.importance === "high" ? "bg-orange-50 text-orange-700 border-orange-200" :
                "bg-blue-50 text-blue-700 border-blue-200"
              )}>
                {IMPORTANCE_CONFIG[selectedNode.importance].label}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(selectedNode.confidence * 100)}% confidence
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Description */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Clinical Context</p>
              <p className="text-sm text-gray-700 leading-relaxed">{selectedNode.description}</p>
            </div>

            {/* Tags */}
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connected nodes */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                Connected Nodes ({selectedNode.connections.length})
              </p>
              <div className="space-y-1.5">
                {selectedNode.connections.map(connId => {
                  const connNode = GRAPH_NODES.find(n => n.id === connId);
                  if (!connNode) return null;
                  const connCfg = NODE_CONFIG[connNode.type];
                  const ConnIcon = connCfg.icon;
                  return (
                    <button
                      key={connId}
                      onClick={() => setSelectedNode(connNode)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: connCfg.bg, borderColor: connCfg.stroke, border: "1px solid" }}>
                        <ConnIcon className="h-3 w-3" style={{ color: connCfg.stroke }} />
                      </div>
                      <span className="text-xs text-gray-700 font-medium">{connNode.label}</span>
                      <ChevronRight className="h-3 w-3 text-gray-300 ml-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400">Sessions Referenced</p>
                  <p className="text-lg font-bold text-gray-900">{selectedNode.sessions}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Connections</p>
                  <p className="text-lg font-bold text-gray-900">{selectedNode.connections.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">AI Confidence</p>
                  <p className="text-lg font-bold text-gray-900">{Math.round(selectedNode.confidence * 100)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Importance</p>
                  <p className="text-sm font-bold text-gray-900 capitalize">{selectedNode.importance}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button className="w-full py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium hover:bg-[#123A63] transition-colors flex items-center justify-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> View in Memory Layer
              </button>
              <button className="w-full py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Ask AI About This
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
