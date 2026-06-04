/**
 * 24Therapy Therapist Portal — API Client
 * Handles all communication with the NestJS backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

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

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
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
  return response.json();
}

// ============================================================
// AUTH
// ============================================================
export const authAPI = {
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; refresh_token: string; user: Record<string, unknown> }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  register: (data: Record<string, string>) =>
    apiFetch<{ access_token: string; refresh_token: string; user: Record<string, unknown> }>(
      "/auth/register", { method: "POST", body: JSON.stringify(data) }
    ),

  refresh: (refreshToken: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>(
      "/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }
    ),

  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  me: () => apiFetch<Record<string, unknown>>("/auth/me"),
};

// ============================================================
// PATIENTS
// ============================================================
export const patientsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, unknown>[]; total: number; cursor?: string }>("/patients", { params }),

  get: (id: string) => apiFetch<Record<string, unknown>>(`/patients/${id}`),

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

  transcript: (id: string) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/sessions/${id}/transcript`),

  aiNote: (id: string) => apiFetch<Record<string, unknown>>(`/sessions/${id}/ai-note`),

  dashboardStats: () => apiFetch<Record<string, unknown>>("/sessions/dashboard"),
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
    apiFetch<Record<string, unknown>>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};

// ============================================================
// THERAPISTS
// ============================================================
export const therapistsAPI = {
  me: () => apiFetch<Record<string, unknown>>("/therapists/me"),
  updateProfile: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/therapists/me", { method: "PATCH", body: JSON.stringify(data) }),
  availability: () => apiFetch<Record<string, unknown>[]>("/therapists/me/availability"),
  updateAvailability: (data: Record<string, unknown>[]) =>
    apiFetch("/therapists/me/availability", { method: "PUT", body: JSON.stringify(data) }),
};

// ============================================================
// ASSESSMENTS
// ============================================================
export const assessmentsAPI = {
  templates: () => apiFetch<Record<string, unknown>[]>("/assessments/templates"),
  sendToPatient: (patientId: string, templateId: string, data?: Record<string, unknown>) =>
    apiFetch(`/assessments/send`, {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, template_id: templateId, ...data }),
    }),
  results: (patientId: string) =>
    apiFetch<Record<string, unknown>[]>(`/assessments/results/${patientId}`),
  score: (resultId: string, answers: Record<string, number>[]) =>
    apiFetch(`/assessments/results/${resultId}/score`, {
      method: "POST",
      body: JSON.stringify({ answers }),
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
};

export { APIError };
export default apiFetch;
