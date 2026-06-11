/**
 * 24Therapy Patient Portal — API Client
 * Handles all communication with the NestJS backend
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://api-24therapy-production.up.railway.app"
).replace(/\/api\/v1\/?$/, "") + "/api/v1";

// ============================================================
// TOKEN HELPERS
// ============================================================
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("patient_access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("patient_refresh_token");
}

function setStoredTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("patient_access_token", access);
  localStorage.setItem("patient_refresh_token", refresh);
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("patient_access_token");
  localStorage.removeItem("patient_refresh_token");
}

// ============================================================
// API ERROR CLASS
// ============================================================
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ============================================================
// TOKEN REFRESH
// ============================================================
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
    if (!res.ok) {
      clearStoredTokens();
      return null;
    }
    const json = await res.json();
    const { access_token, refresh_token } = json.data?.tokens || {};
    if (access_token) {
      setStoredTokens(access_token, refresh_token || rt);
      return access_token;
    }
    clearStoredTokens();
    return null;
  } catch {
    clearStoredTokens();
    return null;
  }
}

// ============================================================
// CORE FETCH
// ============================================================
interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}, retry = true): Promise<T> {
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

  // Handle 401 with token refresh
  if (response.status === 401 && retry) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      const newToken = await refreshAccessToken();
      _isRefreshing = false;

      if (!newToken) {
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new APIError(401, "Session expired. Please log in again.");
      }

      _refreshQueue.forEach((cb) => cb(newToken));
      _refreshQueue = [];
    } else {
      await new Promise<void>((resolve) => {
        _refreshQueue.push(() => resolve());
      });
    }
    return apiFetch<T>(endpoint, options, false);
  }

  if (!response.ok) {
    let errorData: any;
    try { errorData = await response.json(); } catch { /* empty */ }
    throw new APIError(
      response.status,
      errorData?.message || `HTTP ${response.status}`,
      errorData
    );
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  return (json.data !== undefined ? json.data : json) as T;
}

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new APIError(res.status, json.message || "Login failed", json);
    const data = json.data;
    if (data?.tokens?.access_token) {
      setStoredTokens(data.tokens.access_token, data.tokens.refresh_token || "");
    }
    return data as {
      user: Record<string, any>;
      tokens: { access_token: string; refresh_token: string; expires_in: number };
      organization: Record<string, any>;
    };
  },

  logout: async () => {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch { /* empty */ }
    clearStoredTokens();
  },

  me: () => apiFetch<Record<string, any>>("/auth/me"),
};

// ============================================================
// PATIENT API
// ============================================================
export const patientAPI = {
  me: () => apiFetch<Record<string, any>>("/patients/me"),
  update: (data: Record<string, any>) =>
    apiFetch<Record<string, any>>("/patients/me", { method: "PATCH", body: JSON.stringify(data) }),
  moodTrend: (days?: number) =>
    apiFetch<Record<string, any>[]>("/patients/me/mood-trend", { params: { days } } as any),
  addMoodEntry: (data: Record<string, any>) =>
    apiFetch("/patients/me/mood", { method: "POST", body: JSON.stringify(data) }),
};

// ============================================================
// SESSIONS API
// ============================================================
export const sessionsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, any>[]; total: number }>("/sessions", { params } as any),
  get: (id: string) => apiFetch<Record<string, any>>(`/sessions/${id}`),
  upcomingSessions: () =>
    apiFetch<Record<string, any>[]>("/sessions?status=scheduled&limit=5"),
};

// ============================================================
// BILLING API
// ============================================================
export const billingAPI = {
  invoices: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, any>[]; total: number }>("/billing/invoices", { params } as any),
  subscription: () => apiFetch<Record<string, any>>("/billing/subscription"),
  plans: () => apiFetch<Record<string, any>[]>("/billing/plans"),
};

// ============================================================
// NOTIFICATIONS API
// ============================================================
export const notificationsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, any>[]; unread_count: number }>("/notifications", { params } as any),
  markRead: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => apiFetch("/notifications/mark-all-read", { method: "PATCH" }),
  updatePreferences: (data: Record<string, unknown>) =>
    apiFetch("/notifications/preferences", { method: "PUT", body: JSON.stringify(data) }),
};

// ============================================================
// AI COMPANION API
// ============================================================
export const aiAPI = {
  chat: (message: string, context?: Record<string, any>) =>
    apiFetch<Record<string, any>>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, context, role: "patient" }),
    }),
  memories: (patientId: string) =>
    apiFetch<Record<string, any>[]>(`/ai/patients/${patientId}/memories`),
};

// ============================================================
// ASSESSMENTS API
// ============================================================
export const assessmentsAPI = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: Record<string, any>[] }>("/assessments", { params } as any),
  submit: (id: string, answers: Record<string, any>) =>
    apiFetch(`/assessments/${id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
};

export const journalAPI = {
  list: () => apiFetch<{ data: Record<string, unknown>[] }>("/notes", { params: { note_type: "journal" } } as never),
  create: (data: { title: string; content: string; is_private: boolean; tags?: string[] }) =>
    apiFetch<Record<string, unknown>>("/notes", { method: "POST", body: JSON.stringify({ ...data, note_type: "journal" }) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/notes/${id}`, { method: "DELETE" }),
};

export const messagesAPI = {
  conversations: () =>
    apiFetch<{ data: Record<string, unknown>[] }>("/messages/conversations"),
  createConversation: (participant_id: string) =>
    apiFetch<{ data: Record<string, unknown> }>("/messages/conversations", {
      method: "POST",
      body: JSON.stringify({ participant_id }),
    }),
  messages: (conversationId: string, params?: { limit?: number; before?: string }) =>
    apiFetch<{ data: Record<string, unknown>[] }>(`/messages/conversations/${conversationId}/messages`, { params } as never),
  send: (conversationId: string, content: string) =>
    apiFetch<Record<string, unknown>>(`/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  markRead: (conversationId: string) =>
    apiFetch<Record<string, unknown>>(`/messages/conversations/${conversationId}/read`, { method: "POST" }),
};

export { setStoredTokens, getAccessToken, getRefreshToken };
export default apiFetch;
