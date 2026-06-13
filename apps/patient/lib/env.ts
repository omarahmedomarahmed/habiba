export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL is not set. Configure it in Vercel project settings.');
  }
  return (url || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '') + '/api/v1';
}

export function getBaseUrl(): string {
  return getApiUrl().replace(/\/api\/v1\/?$/, '');
}

// Reviewed: 2026-06-13 — 24Therapy audit
