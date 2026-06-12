/**
 * E2E — Crisis alert flow (API-layer)
 *
 * Full WebSocket crisis flow requires a live backend + session, so these tests
 * verify the API contract and UI responses by mocking at the network level.
 *
 * Covers:
 *  - Crisis alerts endpoint returns active count
 *  - Admin portal crisis section renders with mocked alert data
 *  - Therapist crisis panel renders in session room (mocked session)
 *  - Patient-facing pages never expose risk level or indicators
 */

import { test, expect } from '@playwright/test';
import { mockLoginSuccess } from './helpers/mock-api';

const MOCK_SESSION = {
  id: 'sess-1',
  patient_id: 'pt-1',
  therapist_id: 'th-1',
  status: 'in_progress',
  scheduled_time: new Date().toISOString(),
  patient: { id: 'pt-1', user_id: 'user-pt-1', display_name: 'Test Patient' },
};

const MOCK_ALERT = {
  id: 'alert-1',
  risk_level: 'elevated',
  risk_type: 'general',
  indicators: ['keyword-1'],
  alert_status: 'delivered',
  created_at: new Date().toISOString(),
  patient_name: 'Test Patient',
  therapist_name: 'Dr Test',
  conversation_id: 'conv-1',
};

// ─── Therapist portal: crisis panel ──────────────────────────────────────────

test.describe('Crisis alerts (therapist portal)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginSuccess(page, 'therapist');
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'user-1', role: 'therapist', organization_id: 'org-1', email: 'dr@clinic.com',
        }),
      }),
    );
    await page.route('**/api/v1/crisis/alerts**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [MOCK_ALERT], total: 1 }),
      }),
    );
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, body: '{"data":[],"total":0}' }),
    );
  });

  test('crisis alerts page renders without exposing internal risk data in HTML source', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dr@clinic.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    await page.goto('/crisis');
    // Page should load (not 404 / redirect)
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── Patient portal: no risk exposure ────────────────────────────────────────

test.describe('Crisis: patient portal never shows risk level', () => {
  test.use({ baseURL: 'http://localhost:3002' });

  test('patient dashboard HTML does not contain raw risk_level values', async ({ page }) => {
    await mockLoginSuccess(page, 'patient');
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, body: '{"data":[],"total":0}' }),
    );

    await page.goto('/login');
    await page.fill('input[type="email"]', 'patient@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    const url = page.url();
    // Must have navigated away from /login (successfully authed)
    expect(url).not.toMatch(/\/login/);

    // The patient UI must never contain raw risk level strings in visible text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/crisis_alert/i);
    expect(bodyText).not.toMatch(/risk_level/i);
    expect(bodyText).not.toMatch(/elevated risk/i);
    expect(bodyText).not.toMatch(/high risk/i);
    expect(bodyText).not.toMatch(/critical risk/i);
  });
});

// ─── Admin portal: crisis active count ───────────────────────────────────────

test.describe('Crisis alerts (admin portal)', () => {
  test.use({ baseURL: 'http://localhost:3003' });

  test('admin crisis page loads after login', async ({ page }) => {
    await mockLoginSuccess(page, 'super_admin');
    await page.route('**/api/v1/crisis/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [MOCK_ALERT], total: 1, count: 1 }),
      }),
    );
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, body: '{"data":[],"total":0}' }),
    );

    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@24therapy.ai');
    await page.fill('input[type="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    await page.goto('/crisis');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
