/**
 * 24Therapy Admin Portal — API Client
 * Handles all communication with the NestJS backend
 */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://api-24therapy-production.up.railway.app'
).replace(/\/api\/v1\/?$/, '') + '/api/v1';

// ============================================================
// TOKEN HELPERS
// ============================================================
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_refresh_token');
}

function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_access_token', accessToken);
  localStorage.setItem('admin_refresh_token', refreshToken);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
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
    this.name = 'APIError';
  }
}

// ============================================================
// CORE FETCH WITH TOKEN REFRESH
// ============================================================
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const json = await res.json();
    const { access_token, refresh_token } = json.data?.tokens || {};
    if (access_token) {
      setTokens(access_token, refresh_token || refreshToken);
      return access_token;
    }
    clearTokens();
    return null;
  } catch {
    clearTokens();
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
  retry = true
): Promise<T> {
  const { params, ...fetchOptions } = options as any;

  let url = `${API_URL}${path}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...fetchOptions, headers });

  // Handle 401 with token refresh
  if (response.status === 401 && retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await attemptTokenRefresh();
      isRefreshing = false;

      if (!newToken) {
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new APIError(401, 'Session expired. Please log in again.');
      }

      onTokenRefreshed(newToken);
    } else {
      // Wait for ongoing refresh
      await new Promise<void>((resolve) => {
        refreshSubscribers.push(() => resolve());
      });
    }

    // Retry with new token
    return apiFetch<T>(path, options, false);
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
  // Unwrap NestJS standard response wrapper
  return (json.data !== undefined ? json.data : json) as T;
}

// ============================================================
// AUTH API
// ============================================================
export const authAPI = {
  login: async (email: string, password: string, mfa_code?: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, mfa_code }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new APIError(res.status, json.message || 'Login failed', json);
    }

    const data = json.data;
    if (data?.tokens?.access_token) {
      setTokens(data.tokens.access_token, data.tokens.refresh_token);
    }
    return data as { user: any; tokens: any; organization: any };
  },

  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },

  me: () => apiFetch<any>('/auth/me'),

  refresh: async () => {
    const newToken = await attemptTokenRefresh();
    return newToken;
  },
};

// ============================================================
// ADMIN API
// ============================================================
export const adminAPI = {
  // Dashboard stats
  platformStats: () => apiFetch<any>('/analytics/admin/overview'),
  recentActivity: () => apiFetch<any>('/analytics/admin/activity'),

  // Organizations
  organizations: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/organizations', { params } as any),
  getOrganization: (id: string) => apiFetch<any>(`/organizations/${id}`),
  updateOrganization: (id: string, data: any) =>
    apiFetch<any>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Users
  users: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/users', { params } as any),
  updateUser: (id: string, data: any) =>
    apiFetch<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  suspendUser: (id: string) =>
    apiFetch<any>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'suspended' }) }),
  activateUser: (id: string) =>
    apiFetch<any>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }),
  impersonateUser: (id: string) =>
    apiFetch<{ impersonation_token: string; user: any }>(`/admin/users/${id}/impersonate`, { method: 'POST' }),

  // Organizations
  suspendOrg: (id: string) =>
    apiFetch<any>(`/admin/organizations/${id}/suspend`, { method: 'POST' }),
  activateOrg: (id: string) =>
    apiFetch<any>(`/admin/organizations/${id}/activate`, { method: 'POST' }),

  // Therapists
  therapists: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/therapists', { params } as any),
  approveTherapist: (id: string) =>
    apiFetch<any>(`/therapists/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verification_status: 'verified' }) }),
  rejectTherapist: (id: string, reason: string) =>
    apiFetch<any>(`/therapists/${id}/verify`, { method: 'PATCH', body: JSON.stringify({ verification_status: 'rejected', rejection_reason: reason }) }),

  // Analytics
  analyticsOverview: (period?: string) =>
    apiFetch<any>('/analytics/overview', { params: { period } } as any),
  analyticsRevenue: (period?: string) =>
    apiFetch<any>('/analytics/revenue', { params: { period } } as any),

  // Billing
  invoices: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/billing/invoices', { params } as any),
  subscriptions: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/billing/subscriptions', { params } as any),

  // Audit logs
  auditLogs: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/admin/audit-logs', { params } as any),

  // PHI access log (HIPAA)
  phiAuditLog: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/admin/phi-access-log', { params } as any),
};

// ============================================================
// CRM / SALES PIPELINE API
// ============================================================
export const crmAPI = {
  leads: (params?: Record<string, string | number | undefined>) =>
    apiFetch<{ data: any[]; total: number }>('/crm/leads', { params } as any),
  getLead: (id: string) => apiFetch<any>(`/crm/leads/${id}`),
  createLead: (data: any) =>
    apiFetch<any>('/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: string, data: any) =>
    apiFetch<any>(`/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  pipelineStats: () => apiFetch<any>('/crm/pipeline/stats'),
  analytics: (period?: string) =>
    apiFetch<any>('/crm/analytics', { params: { period } } as any),
};

export const notificationsAPI = {
  list: (params?: { type?: string; unread?: boolean; limit?: number }) =>
    apiFetch<any>('/notifications', { params: params as any }),
  markRead: (id: string) =>
    apiFetch<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
};

export { setTokens, clearTokens, getAccessToken, getRefreshToken };
export default apiFetch;
