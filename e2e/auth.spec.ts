import { test, expect } from '@playwright/test';

test('auth redirect checks and structure', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  // Mock Firebase Auth REST API for sign-in check
  await page.route('**/identitytoolkit.googleapis.com/v1/accounts:lookup*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [{
          localId: 'test-user-123',
          email: 'test@gemigram.os',
          emailVerified: true
        }]
      })
    });
  });

  // Inject a mock Firebase token into localStorage/cookies if needed by the app
  await page.addInitScript(() => {
    const mockUser = {
      uid: 'test-user-123',
      email: 'test@gemigram.os',
      stsTokenManager: {
        accessToken: 'mock-test-token',
        refreshToken: 'mock-refresh-token',
        expirationTime: Date.now() + 3600000
      }
    };
    // Adjust key based on your Firebase version/config if necessary
    window.localStorage.setItem('firebase:authUser:mock-app-key', JSON.stringify(mockUser));
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Assert we are actually on dashboard and not redirected to login
  await expect(page).toHaveURL(/.*\/dashboard/);
  await expect(page.locator('h1')).toBeVisible(); 
});
