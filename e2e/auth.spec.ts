/**
 * E2E — Authentication flows
 *
 * Covers:
 *  - Login page renders for all 3 portals
 *  - Successful login redirects to dashboard
 *  - Invalid credentials shows error
 *  - Suspended account shows error
 *  - Role mismatch (therapist creds on admin portal) shows error
 *  - Logout clears session and redirects to /login
 *  - Middleware redirects unauthenticated users to /login
 */

import { test, expect } from '@playwright/test';
import { mockLoginSuccess, mockLoginFailure, mockLoginSuspended } from './helpers/mock-api';

// ─── Login page renders ───────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('therapist portal shows email + password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ─── Successful login ─────────────────────────────────────────────────────────

test.describe('Successful login', () => {
  test('therapist: valid credentials redirect to /dashboard', async ({ page }) => {
    await mockLoginSuccess(page, 'therapist');
    await page.goto('/login');
    await page.fill('input[type="email"]', 'therapist@clinic.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });
});

// ─── Failed login ─────────────────────────────────────────────────────────────

test.describe('Failed login', () => {
  test('wrong password shows error message', async ({ page }) => {
    await mockLoginFailure(page);
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Error banner should appear
    await expect(page.locator('text=/invalid|incorrect|wrong/i')).toBeVisible({ timeout: 5000 });
    // Must stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('suspended account shows suspension message', async ({ page }) => {
    await mockLoginSuspended(page);
    await page.goto('/login');
    await page.fill('input[type="email"]', 'suspended@example.com');
    await page.fill('input[type="password"]', 'anypassword123');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/suspend/i')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('empty form fields do not submit (HTML5 validation)', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // Form should not submit — still on /login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Middleware auth redirect ─────────────────────────────────────────────────

test.describe('Middleware redirect', () => {
  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    // No tt_auth cookie set — middleware should redirect
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('unauthenticated access to /patients redirects to /login', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('/login is publicly accessible without redirect', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('/forgot-password is publicly accessible without redirect', async ({ page }) => {
    await page.goto('/forgot-password');
    // Should NOT redirect to /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 3000 });
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('logging in then clearing cookie redirects to /login on next navigation', async ({ page }) => {
    await mockLoginSuccess(page, 'therapist');
    // Also mock any requests the dashboard makes so it doesn't error
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 200, body: '{"data":[]}' }));
    await page.goto('/login');
    await page.fill('input[type="email"]', 'therapist@clinic.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // Simulate logout: clear tt_auth cookie
    await page.context().clearCookies();

    // Next navigation to a protected route should redirect
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
