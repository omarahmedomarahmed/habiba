/**
 * 24Therapy Therapist Portal — Global State Store (Zustand)
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================
// AUTH STORE
// ============================================================
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar_url?: string;
  organization_id: string;
  organization_name?: string;
  therapist_id?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  setAuth: (user: User, accessToken: string, refreshToken: string, expiresIn?: number) => void;
  updateTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,
      setAuth: (user, accessToken, refreshToken, expiresIn = 900) => {
        if (typeof document !== 'undefined') {
          // 7-day persistent cookie so middleware auth survives browser restarts
          document.cookie = 'tt_auth=1; path=/; SameSite=Lax; max-age=604800';
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true, expiresAt: Date.now() + expiresIn * 1000 });
      },
      updateTokens: (accessToken, refreshToken, expiresIn = 900) =>
        set({ accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 }),
      clearAuth: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'tt_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, expiresAt: null });
      },
    }),
    {
      name: "24therapy-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        expiresAt: state.expiresAt,
      }),
    }
  )
);

// ============================================================
// UI STORE
// ============================================================
interface UIState {
  sidebarCollapsed: boolean;
  activePatientId: string | null;
  activeSessionId: string | null;
  notificationCount: number;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setActivePatient: (id: string | null) => void;
  setActiveSession: (id: string | null) => void;
  setNotificationCount: (count: number) => void;
  setVerificationStatus: (status: 'pending' | 'approved' | 'rejected' | 'suspended' | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activePatientId: null,
  activeSessionId: null,
  notificationCount: 0,
  verificationStatus: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setActivePatient: (id) => set({ activePatientId: id }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setNotificationCount: (count) => set({ notificationCount: count }),
  setVerificationStatus: (status) => set({ verificationStatus: status }),
}));

// ============================================================
// SESSION ROOM STORE (Live session state)
// ============================================================
interface TranscriptSegment {
  id: string;
  speaker: "therapist" | "patient";
  text: string;
  timestamp: number;
  tags?: string[];
  confidence?: number;
}

interface CopilotSuggestion {
  id: string;
  type: "question" | "observation" | "risk" | "technique" | "topic";
  content: string;
  priority: "high" | "medium" | "low";
  dismissed?: boolean;
}

interface SessionRoomState {
  isLive: boolean;
  isRecording: boolean;
  sessionDuration: number;
  transcript: TranscriptSegment[];
  copilotSuggestions: CopilotSuggestion[];
  riskAlerts: Array<{ id: string; level: string; description: string; timestamp: number }>;
  sessionNoteContent: string;
  copilotPanelOpen: boolean;
  transcriptScrollLocked: boolean;
  setLive: (v: boolean) => void;
  setRecording: (v: boolean) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  addCopilotSuggestion: (suggestion: CopilotSuggestion) => void;
  dismissSuggestion: (id: string) => void;
  addRiskAlert: (alert: { id: string; level: string; description: string; timestamp: number }) => void;
  setSessionNoteContent: (v: string) => void;
  toggleCopilotPanel: () => void;
  setTranscriptScrollLocked: (v: boolean) => void;
  incrementDuration: () => void;
  resetRoom: () => void;
}

export const useSessionRoomStore = create<SessionRoomState>((set) => ({
  isLive: false,
  isRecording: false,
  sessionDuration: 0,
  transcript: [],
  copilotSuggestions: [],
  riskAlerts: [],
  sessionNoteContent: "",
  copilotPanelOpen: true,
  transcriptScrollLocked: true,
  setLive: (v) => set({ isLive: v }),
  setRecording: (v) => set({ isRecording: v }),
  addTranscriptSegment: (segment) =>
    set((s) => ({ transcript: [...s.transcript, segment] })),
  addCopilotSuggestion: (suggestion) =>
    set((s) => ({ copilotSuggestions: [suggestion, ...s.copilotSuggestions].slice(0, 10) })),
  dismissSuggestion: (id) =>
    set((s) => ({
      copilotSuggestions: s.copilotSuggestions.map((sg) =>
        sg.id === id ? { ...sg, dismissed: true } : sg
      ),
    })),
  addRiskAlert: (alert) =>
    set((s) => ({ riskAlerts: [alert, ...s.riskAlerts] })),
  setSessionNoteContent: (v) => set({ sessionNoteContent: v }),
  toggleCopilotPanel: () => set((s) => ({ copilotPanelOpen: !s.copilotPanelOpen })),
  setTranscriptScrollLocked: (v) => set({ transcriptScrollLocked: v }),
  incrementDuration: () => set((s) => ({ sessionDuration: s.sessionDuration + 1 })),
  resetRoom: () =>
    set({
      isLive: false,
      isRecording: false,
      sessionDuration: 0,
      transcript: [],
      copilotSuggestions: [],
      riskAlerts: [],
      sessionNoteContent: "",
    }),
}));

// Reviewed: 2026-06-13 — 24Therapy audit
