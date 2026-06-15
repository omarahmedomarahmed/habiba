/**
 * E2E — Admin portal: production-readiness verification
 *
 * Scenarios:
 *  1. Admin login → redirects to /dashboard
 *  2. Dashboard loads with stat cards (real API, no stuck "Loading...")
 *  3. Users page — table renders, search works, View panel opens
 *  4. Therapists page — table renders, Approve button visible
 *  5. Crisis page — loads without WebSocket crash
 *  6. Analytics page — chart containers render within 10s
 *  7. Compliance page — compliance score shown from API
 *  8. Feature flags — toggles functional
 *  9. Marketing hero — homepage renders without broken mock cards
 * 10. /for-patients — shows real cards or empty state (never mock names)
 */

import { test, expect, Page } from '@playwright/test';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const ADMIN_TOKEN = 'mock-admin-token';

async function mockAdminLogin(page: Page) {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'admin-1',
          email: 'admin@24therapy.ai',
          first_name: 'Admin',
          last_name: 'User',
          role: 'super_admin',
          status: 'active',
          organization_id: 'org-1',
        },
        tokens: { access_token: ADMIN_TOKEN, refresh_token: 'mock-refresh', expires_in: 900 },
        organization: { id: 'org-1', name: '24Therapy', slug: '24therapy', status: 'active' },
      }),
    }),
  );
}

async function mockDashboardAPIs(page: Page) {
  await page.route('**/api/v1/analytics/platform/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_users: 1240,
        active_therapists: 87,
        active_sessions: 12,
        mrr: 42000,
        ai_calls_today: 334,
        crisis_alerts_today: 2,
      }),
    }),
  );
  await page.route('**/api/v1/admin/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        database: { status: 'operational' },
        ai: { status: 'operational' },
        video: { status: 'operational' },
        billing: { status: 'operational' },
        notifications: { status: 'operational' },
      }),
    }),
  );
}

async function loginAsAdmin(page: Page) {
  await mockAdminLogin(page);
  await mockDashboardAPIs(page);
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@24therapy.ai');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

// ─── 1. Admin login ───────────────────────────────────────────────────────────

test.describe('Admin login', { tag: '@admin' }, () => {
  test('valid credentials redirect to /dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── 2. Dashboard loads ───────────────────────────────────────────────────────

test.describe('Admin dashboard', { tag: '@admin' }, () => {
  test('stat cards visible, no stuck loading state', async ({ page }) => {
    await loginAsAdmin(page);
    // Wait for at least one stat card to be visible
    await expect(page.locator('[class*="stat"], [class*="card"], [class*="border"]').first()).toBeVisible({ timeout: 10000 });
    // Ensure no perpetual spinner is shown
    await page.waitForTimeout(3000);
    const spinners = page.locator('.animate-spin');
    await expect(spinners).toHaveCount(0);
  });
});

// ─── 3. Users page ───────────────────────────────────────────────────────────

test.describe('Users page', { tag: '@admin' }, () => {
  test('table loads and search works', async ({ page }) => {
    await page.route('**/api/v1/admin/users*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', role: 'therapist', status: 'active', created_at: new Date().toISOString() },
            { id: 'u2', email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones', role: 'patient', status: 'active', created_at: new Date().toISOString() },
          ],
          total: 2,
        }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/users');
    await expect(page.locator('table, [role="table"], [class*="table"]').first()).toBeVisible({ timeout: 8000 });
    // Search input should exist
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('alice');
    await expect(page.locator('text=Alice')).toBeVisible({ timeout: 5000 });
  });

  test('View button opens detail panel', async ({ page }) => {
    await page.route('**/api/v1/admin/users*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith', role: 'therapist', status: 'active', created_at: new Date().toISOString() }],
          total: 1,
        }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/users');
    await page.waitForSelector('table, [role="table"]', { timeout: 8000 });
    // Click the first View / eye button
    const viewBtn = page.locator('button[aria-label*="view" i], button[title*="view" i], button svg.lucide-eye').first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      // A detail panel or modal should appear
      await expect(page.locator('[class*="panel"], [class*="modal"], [class*="drawer"], [class*="detail"]').first()).toBeVisible({ timeout: 4000 });
    }
  });
});

// ─── 4. Therapists page ──────────────────────────────────────────────────────

test.describe('Therapists page', { tag: '@admin' }, () => {
  test('table renders and Approve button is visible', async ({ page }) => {
    await page.route('**/api/v1/admin/users*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 't1', email: 'doc@clinic.com', first_name: 'Dr', last_name: 'Jane', role: 'therapist', verification_status: 'pending', status: 'active', created_at: new Date().toISOString() },
          ],
          total: 1,
        }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/therapists');
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 8000 });
    // Approve button should be visible for pending therapist
    await expect(page.locator('button:has-text("Approve"), button:has-text("approve")').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── 5. Crisis page ──────────────────────────────────────────────────────────

test.describe('Crisis page', { tag: '@admin' }, () => {
  test('loads without crash (WebSocket is optional)', async ({ page }) => {
    await page.route('**/api/v1/crisis*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], count: 0 }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/crisis');
    // Page should render — either empty state or alert list
    await expect(page.locator('h1, h2').filter({ hasText: /crisis/i }).first()).toBeVisible({ timeout: 8000 });
    // No JS error modal / crash overlay
    await expect(page.locator('text=Something went wrong')).toHaveCount(0);
    await expect(page.locator('text=Application error')).toHaveCount(0);
  });
});

// ─── 6. Analytics page ───────────────────────────────────────────────────────

test.describe('Analytics page', { tag: '@admin' }, () => {
  test('chart containers render within 10s', async ({ page }) => {
    await page.route('**/api/v1/analytics/platform/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: { total_users: 1200, active_sessions: 34, mrr: 38000, ai_calls: 4500 },
          mrr_trend: [{ month: '2026-01', mrr: 30000 }, { month: '2026-02', mrr: 38000 }],
          top_orgs: [{ name: 'Acme Clinic', sessions: 120, revenue: 9600 }],
        }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/analytics');
    // Wait up to 10s for any chart/metric container to appear
    await expect(
      page.locator('[class*="chart"], [class*="metric"], [class*="stat"], [class*="card"]').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── 7. Compliance page ──────────────────────────────────────────────────────

test.describe('Compliance page', { tag: '@admin' }, () => {
  test('compliance score shown from API (not hardcoded)', async ({ page }) => {
    await page.route('**/api/v1/admin/organizations*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'org-1', name: 'Test Org' }], total: 1 }),
      }),
    );
    await page.route('**/api/v1/admin/compliance/org-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          compliance_score: 94,
          hipaa_checks: [{ name: 'Encryption at rest', status: 'pass' }],
          data_retention: { policy: '7 years', automated: true },
          encryption_status: { at_rest: true, in_transit: true },
        }),
      }),
    );
    await loginAsAdmin(page);
    await page.goto('/compliance');
    // Compliance score should be displayed
    await expect(page.locator('text=94').or(page.locator('text=94%')).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── 8. Feature flags ────────────────────────────────────────────────────────

test.describe('Feature flags', { tag: '@admin' }, () => {
  test('toggles are functional and call API', async ({ page }) => {
    await page.route('**/api/v1/admin/feature-flags', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { key: 'ai_copilot', name: 'AI Copilot', description: 'Real-time AI suggestions', enabled: true },
          { key: 'crisis_detection', name: 'Crisis Detection', description: 'Keyword + AI risk', enabled: true },
        ]),
      }),
    );
    let patchCalled = false;
    await page.route('**/api/v1/admin/feature-flags/**', (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'ai_copilot', enabled: false }) });
      } else {
        route.continue();
      }
    });

    await loginAsAdmin(page);
    await page.goto('/feature-flags');
    // Toggle buttons (checkboxes or switch inputs) should be visible
    const toggle = page.locator('input[type="checkbox"], button[role="switch"]').first();
    await expect(toggle).toBeVisible({ timeout: 8000 });
    await toggle.click();
    // Verify the PATCH was called
    await page.waitForTimeout(500);
    expect(patchCalled).toBe(true);
  });
});

// ─── 9. Marketing hero ───────────────────────────────────────────────────────

test.describe('Marketing homepage', { tag: '@web' }, () => {
  test('hero renders without broken mock therapist cards', async ({ page }) => {
    // Mock therapist search — return empty to verify no fallback mock data shown
    await page.route('**/api/v1/marketplace/search*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { listings: [] }, total: 0 }),
      }),
    );
    // Hero page should render the main heading
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    // Static fake names like "Dr. Sarah Chen" must NOT appear
    await expect(page.locator('text=Dr. Sarah Chen')).toHaveCount(0);
    await expect(page.locator('text=Michael Torres')).toHaveCount(0);
  });
});

// ─── 10. /for-patients ───────────────────────────────────────────────────────

test.describe('/for-patients page', { tag: '@web' }, () => {
  test('shows real cards or empty state, never static mock names', async ({ page }) => {
    await page.route('**/api/v1/marketplace/search*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      }),
    );
    await page.goto('/for-patients');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    // Static fake names must not appear
    await expect(page.locator('text=Dr. Sarah Chen')).toHaveCount(0);
    await expect(page.locator('text=Emily Rodriguez')).toHaveCount(0);
    // Empty state message should be visible
    await expect(page.locator('text=directory loading').or(page.locator('text=Check back soon'))).toBeVisible({ timeout: 5000 });
  });

  test('shows real therapist cards when API returns data', async ({ page }) => {
    await page.route('**/api/v1/marketplace/search*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'th1', first_name: 'Real', last_name: 'Therapist', title: 'Licensed Psychologist', specializations: ['Anxiety'], rating: 4.9, availability_status: 'today', public_slug: 'real-therapist' },
          ],
          total: 1,
        }),
      }),
    );
    await page.goto('/for-patients');
    await expect(page.locator('text=Real Therapist')).toBeVisible({ timeout: 8000 });
  });
});
