import { Page } from '@playwright/test';

export const MOCK_TOKENS = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 900,
};

export function mockLoginSuccess(page: Page, role: 'therapist' | 'patient' | 'admin' | 'super_admin' = 'therapist') {
  return page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role,
          status: 'active',
          organization_id: 'org-1',
        },
        tokens: MOCK_TOKENS,
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', status: 'active' },
      }),
    }),
  );
}

export function mockLoginFailure(page: Page, status = 401, message = 'Invalid email or password') {
  return page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: status, message }),
    }),
  );
}

export function mockLoginSuspended(page: Page) {
  return mockLoginFailure(page, 401, 'Account has been suspended. Contact support.');
}

// Reviewed: 2026-06-13 — 24Therapy audit
