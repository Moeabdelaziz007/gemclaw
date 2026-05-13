import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/dashboard', '/workspace', '/hub', '/settings', '/about'];

test.describe('Navigation Status Checks', () => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  for (const route of ROUTES) {
    test(`route ${route} should load successfully`, async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
      const response = await page.goto(route);
      
      // Assert status is 200 (or 304 if cached, though unlikely in CI)
      expect(response?.status()).toBeLessThan(400);
      
      await page.waitForLoadState('domcontentloaded');
      
      // Ensure no 500 error messages are visible on screen
      const bodyText = await page.innerText('body');
      expect(bodyText).not.toContain('Internal Server Error');
      expect(bodyText).not.toContain('Application Error');
    });
  }
});
