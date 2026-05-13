import { test, expect } from '@playwright/test';

test.describe('AetherOS Golden Path', () => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  test('Voice -> Materialize -> Workspace flow', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
    // 1. Visit Landing Page
    await page.goto('/');
    await expect(page).toHaveTitle(/Gemclaw/);

    // 2. Trigger Auth (Launch_Terminal)
    const launchBtn = page.locator('button', { hasText: /Launch_Terminal/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click();
    }

    // Assume we either login or it skips auth in E2E (depends on if there's a mock)
    // We will navigate directly to Forge to simulate logged in state
    await page.goto('/forge');
    await page.waitForLoadState('networkidle');

    // 3. Forge an Agent
    // Mock the Speech Recognition if possible, or just click "Initialize Protocol"
    const initBtn = page.locator('button', { hasText: /Initialize Protocol/i });
    if (await initBtn.isVisible()) {
      await initBtn.click();
    }
    
    // Wait for the manifestation step
    const materializeBtn = page.locator('button', { hasText: /Materialize_Entity/i }).first();
    if (await materializeBtn.isVisible()) {
      await materializeBtn.click();
    }

    // 4. Verify Workspace
    await expect(page).toHaveURL(/.*\/workspace/);
    await page.waitForLoadState('networkidle');

    const workspaceHeader = page.locator('h1', { hasText: /Workspace/i }).first();
    await expect(workspaceHeader).toBeVisible({ timeout: 10000 });
  });
});
