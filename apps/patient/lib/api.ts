/**
 * 24Therapy Patient Portal — API Client
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API error');
  }
  return res.json();
}

// ============================================================
// Auth
// ============================================================
export const authAPI = {
  login: (email: string, password: string) =>
    apiRequest<{ user: any; token: string }>('/auth/patient/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// ============================================================
// Sessions
// ============================================================
export const sessionsAPI = {
  getUpcoming: (token: string) =>
    apiRequest<any[]>('/sessions/patient/upcoming', {}, token),
  getPast: (token: string) =>
    apiRequest<any[]>('/sessions/patient/past', {}, token),
  getOne: (id: string, token: string) =>
    apiRequest<any>(`/sessions/${id}`, {}, token),
  joinRoom: (id: string, token: string) =>
    apiRequest<{ room_url: string; token: string }>(`/sessions/${id}/join`, {}, token),
};

// ============================================================
// Assessments
// ============================================================
export const assessmentsAPI = {
  getPending: (token: string) =>
    apiRequest<any[]>('/assessments/patient/pending', {}, token),
  getCompleted: (token: string) =>
    apiRequest<any[]>('/assessments/patient/completed', {}, token),
  submit: (assessmentId: string, answers: any, token: string) =>
    apiRequest<any>(`/assessments/${assessmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }, token),
};

// ============================================================
// Messages
// ============================================================
export const messagesAPI = {
  getConversation: (therapistId: string, token: string) =>
    apiRequest<any[]>(`/messages/conversation/${therapistId}`, {}, token),
  send: (message: string, token: string) =>
    apiRequest<any>('/messages', {
      method: 'POST',
      body: JSON.stringify({ content: message }),
    }, token),
};

// ============================================================
// Progress
// ============================================================
export const progressAPI = {
  getScores: (token: string) =>
    apiRequest<any>('/patients/progress/scores', {}, token),
  getMoodHistory: (token: string) =>
    apiRequest<any[]>('/patients/progress/mood', {}, token),
  logMood: (score: number, note: string, token: string) =>
    apiRequest<any>('/patients/mood', {
      method: 'POST',
      body: JSON.stringify({ score, note }),
    }, token),
};

// ============================================================
// Resources
// ============================================================
export const resourcesAPI = {
  getAll: (token: string) =>
    apiRequest<any[]>('/resources', {}, token),
  getByCategory: (category: string, token: string) =>
    apiRequest<any[]>(`/resources?category=${category}`, {}, token),
};
