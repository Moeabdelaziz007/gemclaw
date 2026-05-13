import { test, expect } from '@playwright/test';

test('Settings page interactions', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();
});
