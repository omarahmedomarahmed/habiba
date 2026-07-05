/**
 * 24Therapy Therapist Portal — API Client
 * Handles all communication with the NestJS backend
 */

import { getApiUrl } from '@/lib/env';

const API_URL = getApiUrl();

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setStoredTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

let _isRefreshing = false;
let _refreshQueue: ((t: string) => void)[] = [];

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); return null; }
    const json = await res.json();
    const { access_token, refresh_token } = json.data?.tokens || {};
    if (access_token) { setStoredTokens(access_token, refresh_token || rt); return access_token; }
    return null;
  } catch { return null; }
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}, _retry = true): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const token = getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  const response = await fetch(url, { ...fetchOptions, headers });

  // Token refresh on 401
  if (response.status === 401 && _retry) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      const newToken = await refreshAccessToken();
      _isRefreshing = false;
      if (!newToken) {
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new APIError(401, "Session expired");
      }
      _refreshQueue.forEach(cb => cb(newToken));
      _refreshQueue = [];
    } else {
      await new Promise<void>(resolve => { _refreshQueue.push(() => resolve()); });
    }
    return apiFetch<T>(endpoint, options, false);
  }

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); } catch { /* empty */ }
    throw new APIError(
      response.status,
      errorData?.message || `HTTP ${response.status}`,
      errorData
    );
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  // Unwrap NestJS standard { success, data, meta } wrapper
  return (json.data !== undefined ? json.data : json) as T;
}

// ============================================================
// AUTH
// ============================================================
export const authAPI = {
  login: async (email: string, password: string) => {
    // Direct fetch to handle the wrapper correctly
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new APIError(res.status, json.message || "Login failed", json);
    // json.data = { user, tokens, organization }
    const data = json.data;
    if (data?.tokens?.access_token) {
      setStoredTokens(data.tokens.access_token, data.tokens.refresh_token || "");
    }
    return data as { user: Record<string, unknown>; tokens: { access_token: string; refresh_token: string; expires_in: number }; organization: Record<string, unknown> };
  },

  register: (data: Record<string, string>) =>
    apiFetch<{ user: Record<string, unknown>; tokens: { access_token: string; refresh_token: string } }>(
      "/auth/register", { method: "POST", body: JSON.stringify(data) }
    ),

  refresh: () => refreshAccessToken(),

  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
};

// ============================================================
// PATIENTS
// ============================================================
export const patientsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number; cursor?: string }>("/patients", { params }),

  get: (id: string) =>
    apiFetch<Record<string, unknown>>(`/patients/${id}`).then(
      (r) => ((r as any)?.patient ?? r) as Record<string, unknown>,
    ),

  create: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/patients", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/patients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/patients/${id}`, { method: "DELETE" }),

  timeline: (id: string, params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/timeline`, { params }),

  moodTrend: (id: string, days?: number) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/mood-trend`, { params: { days } }),

  addMoodEntry: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/patients/${id}/mood`, { method: "POST", body: JSON.stringify(data) }),

  assessments: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/assessments`),

  memories: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/memories`),

  goals: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/goals`),

  medications: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/patients/${id}/medications`),
};

// ============================================================
// SESSIONS
// ============================================================
export const sessionsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number }>("/sessions", { params }),

  get: (id: string) => apiFetch<Record<string, unknown>>(`/sessions/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/sessions", { method: "POST", body: JSON.stringify(data) }),

  updateStatus: (id: string, status: string, data?: Record<string, unknown>) =>
    apiFetch(`/sessions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...data }),
    }),

  ensureRoom: (id: string) =>
    apiFetch<{ video_room_url: string | null; configured: boolean }>(`/sessions/${id}/ensure-room`, { method: "POST" }),

  transcript: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/sessions/${id}/transcript`),

  aiNote: (id: string) => apiFetch<Record<string, unknown>>(`/sessions/${id}/note`),

  dashboardStats: () => apiFetch<Record<string, unknown>>("/sessions/dashboard"),

  usage: () => apiFetch<{ plan_key: string; sessions_this_month: number; max_sessions_month: number | null; trial_session_used: boolean }>("/sessions/usage"),

  invite: (id: string, emails: string[]) =>
    apiFetch(`/sessions/${id}/invite`, { method: "POST", body: JSON.stringify({ emails }) }),

  joinInfo: (token: string) =>
    apiFetch<Record<string, unknown>>(`/sessions/join/${token}`),

  joinByToken: (token: string, body: { name: string; email?: string }) =>
    apiFetch<{ session_id: string; video_room_url: string }>(`/sessions/join/${token}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  shareReport: (id: string, body: { email: string; note_id?: string }) =>
    apiFetch<{ shared: boolean; email: string }>(`/sessions/${id}/share-report`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

};

// ============================================================
// AI
// ============================================================
export const aiAPI = {
  generateNote: (sessionId: string, noteType?: string) =>
    apiFetch<Record<string, unknown>>(`/ai/sessions/${sessionId}/notes/generate`, {
      method: "POST",
      body: JSON.stringify({ note_type: noteType || "soap" }),
    }),

  generateSummary: (sessionId: string) =>
    apiFetch<Record<string, unknown>>(`/ai/sessions/${sessionId}/summary`, { method: "POST" }),

  copilotSuggestions: (sessionId: string) =>
    apiFetch<Record<string, unknown>>(`/ai/sessions/${sessionId}/copilot`),

  riskCheck: (sessionId: string) =>
    apiFetch<Record<string, unknown>>(`/ai/sessions/${sessionId}/risk-check`, { method: "POST" }),

  approveNote: (noteId: string, data: Record<string, unknown>) =>
    apiFetch(`/ai/notes/${noteId}/approve`, { method: "PATCH", body: JSON.stringify(data) }),

  searchMemory: (patientId: string, query: string) =>
    apiFetch<Record<string, unknown>>(`/ai/patients/${patientId}/memory/search`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  aiChat: (message: string, context?: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/ai/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, mode: 'therapist', context }),
    }),

  assistantChat: (body: { message: string; range?: 'today' | 'this_week' | 'last_week'; session_id?: string; patient_id?: string; history?: Array<{ role: string; content: string }> }) =>
    apiFetch<{ reply: string; credits_remaining: number | 'unlimited' } | { success: false; error: string; credits_balance: number; upsell: string }>("/ai/assistant/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  sessionChat: (sessionId: string, body: { message: string; history?: Array<{ role: string; content: string }> }) =>
    apiFetch<{ reply: string; credits_remaining: number | 'unlimited' } | { success: false; error: string; upsell: string }>(`/ai/sessions/${sessionId}/chat`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  assistantCredits: () =>
    apiFetch<{ balance: number | 'unlimited' }>("/ai/assistant/credits"),
};

// ============================================================
// THERAPISTS
// ============================================================
export const therapistsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<Record<string, unknown>[]>("/therapists", { params }),
  me: () => apiFetch<Record<string, unknown>>("/therapists/me"),
  updateProfile: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/therapists/me", { method: "PATCH", body: JSON.stringify(data) }),
  availability: () => apiFetch<Record<string, unknown>[]>("/therapists/me/availability"),
  updateAvailability: (data: Record<string, unknown>[]) =>
    apiFetch("/therapists/me/availability", { method: "PUT", body: JSON.stringify(data) }),
  submitForReview: () =>
    apiFetch<{ success: boolean }>("/therapists/me/submit-review", { method: "PATCH" }),
  saveCredentials: (data: { license_type?: string; license_number?: string; license_state?: string; license_expiry?: string; npi_number?: string }) =>
    apiFetch<{ success: boolean }>("/therapists/me/credentials", { method: "PATCH", body: JSON.stringify(data) }),
  uploadAvatar: (avatar_data_url: string) =>
    apiFetch<{ avatar_url: string }>("/therapists/me/avatar", {
      method: "POST",
      body: JSON.stringify({ avatar_data_url }),
    }),
};

// ============================================================
// BILLING
// ============================================================
export const billingAPI = {
  summary: () => apiFetch<Record<string, unknown>>("/billing/summary"),
  invoices: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number }>("/billing/invoices", { params }),
  subscriptions: () => apiFetch<Record<string, unknown>>("/billing/subscription"),
  plans: () => apiFetch<Record<string, unknown>[]>("/billing/plans"),
  usageMe: () => apiFetch<{
    plan: { plan_key: string; name: string; price_monthly_usd: number | null; price_per_session_usd: number | null };
    sessions_this_month: number;
    quota: { included: number; rollover_in: number; used: number; remaining: number } | null;
    trial_session_used: boolean;
    pending_bills: Array<{ id: string; amount_due_usd: number; stripe_checkout_url: string | null; charged_at: string; description: string; session_id: string }>;
    charge_history: Array<{ id: string; amount_usd: number; discount_usd: number; amount_due_usd: number; status: string; description: string; charged_at: string; paid_at: string | null; plan_key: string }>;
    ai_credits: number | 'unlimited';
  }>("/billing/usage/me"),
  subscribe: (body: { plan_key: string; seats?: number; interval?: 'monthly' | 'annual'; success_url: string; cancel_url: string }) =>
    apiFetch<{ checkout_url: string | null; session_id?: string; message?: string }>("/billing/subscribe", { method: "POST", body: JSON.stringify(body) }),
  confirmCheckout: (sessionId: string) =>
    apiFetch<{ applied: boolean; plan_key?: string; status?: string }>("/billing/confirm-checkout", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),
  refreshChargeCheckout: (chargeId: string) =>
    apiFetch<{ charge_id: string; checkout_url: string | null }>(`/billing/charges/${chargeId}/checkout`, { method: "POST" }),
  cancel: () => apiFetch<Record<string, unknown>>("/billing/cancel", { method: "POST" }),
  myFeatures: () => apiFetch<{
    plan_key: string; display_name: string;
    sessions: { model: 'payg' | 'quota' | 'unlimited'; price_per_session_usd?: number; included_per_month?: number };
    ai_chat: 'per_session_credits' | 'unlimited';
    recordings: boolean; radar: boolean; hipaa_baa: boolean;
    analytics: 'basic' | 'full'; treatment_plans: boolean;
  }>("/billing/my-features"),
};

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notificationsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; unread_count: number }>("/notifications", { params }),
  markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch("/notifications/mark-all-read", { method: "PATCH" }),
  preferences: () => apiFetch<Record<string, unknown>>("/notifications/preferences"),
  updatePreferences: (data: Record<string, unknown>) =>
    apiFetch("/notifications/preferences", { method: "PUT", body: JSON.stringify(data) }),
};

// ============================================================
// NOTES
// ============================================================
export const notesAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number }>("/notes", { params }),

  get: (id: string) => apiFetch<Record<string, unknown>>(`/notes/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/notes", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  finalize: (id: string) =>
    apiFetch(`/notes/${id}/finalize`, { method: "POST" }),

  delete: (id: string) => apiFetch(`/notes/${id}`, { method: "DELETE" }),
};

// ============================================================
// TREATMENT PLANS
// ============================================================
export const treatmentPlansAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number }>("/treatment-plans", { params }),

  get: (id: string) => apiFetch<Record<string, unknown>>(`/treatment-plans/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/treatment-plans", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/treatment-plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  goals: (planId: string) =>
    apiFetch<Record<string, unknown>[]>(`/treatment-plans/${planId}/goals`),

  addGoal: (planId: string, data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/treatment-plans/${planId}/goals`, { method: "POST", body: JSON.stringify(data) }),

  protocols: () => apiFetch<Record<string, unknown>[]>("/treatment-plans/protocols"),
};

// ============================================================
// RADAR (Therapist Matching / New Patient Requests)
// ============================================================
export const radarAPI = {
  requests: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number }>("/radar/therapist/requests", { params }),

  accept: (requestId: string) =>
    apiFetch(`/radar/requests/${requestId}/accept`, { method: "POST" }),

  decline: (requestId: string, reason?: string) =>
    apiFetch(`/radar/requests/${requestId}/decline`, { method: "POST", body: JSON.stringify({ reason }) }),

  stats: () => apiFetch<Record<string, unknown>>("/radar/analytics"),
};

// ============================================================
// ANALYTICS
// ============================================================
export const analyticsAPI = {
  overview: (period?: string) =>
    apiFetch<Record<string, unknown>>("/analytics/overview", { params: { period } }),
  sessionMetrics: (period?: string) =>
    apiFetch<Record<string, unknown>[]>("/analytics/sessions", { params: { period } }),
  patientOutcomes: () => apiFetch<Record<string, unknown>>("/analytics/outcomes"),
  aiUsage: (period?: string) =>
    apiFetch<Record<string, unknown>>("/analytics/ai-usage", { params: { period } }),
  dashboard: (period?: string) =>
    apiFetch<Record<string, unknown>>("/analytics/therapist/dashboard", { params: { period } }),
};

// ============================================================

// ============================================================

export const usersAPI = {
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<{ success: boolean }>("/users/me/password", {
      method: "PATCH",
      body: JSON.stringify({ current_password, new_password }),
    }),
  getNotificationPreferences: () =>
    apiFetch<Record<string, unknown>>("/users/me/notification-preferences"),
  updateNotificationPreferences: (prefs: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/users/me/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }),
};

export { APIError };
export default apiFetch;

// Reviewed: 2026-06-13 — 24Therapy audit
