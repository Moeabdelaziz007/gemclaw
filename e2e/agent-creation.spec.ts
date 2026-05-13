import { test, expect } from '@playwright/test';

test('navigate to hub and verify materialization button', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  // Mock auth state for the test
  await page.addInitScript(() => {
    window.localStorage.setItem('firebase:authUser:mock-app-key', JSON.stringify({ uid: 'test-user' }));
  });

  await page.goto('/hub');
  await page.waitForLoadState('networkidle');

  // Verify 'Materialize_Entity' button exists and is interactive
  const materializeBtn = page.locator('button', { hasText: 'Materialize_Entity' }).first();
  await expect(materializeBtn).toBeVisible();
  await expect(materializeBtn).toBeEnabled();

  // Test navigation to forge
  await materializeBtn.click();
  await expect(page).toHaveURL(/.*\/forge/);
});
