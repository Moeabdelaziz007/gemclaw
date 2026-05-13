import { test, expect } from '@playwright/test';

/**
 * 🧪 Mission 06: Branding Validation
 * Verifies that the Gemclaw AIOS branding and Aether Forge identity 
 * are correctly applied across the system.
 */
test.describe('Mission 06: Branding & Identity', () => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the root/dashboard
    await page.goto('/dashboard');
  });

  test('should display Gemclaw AIOS branding in the title and dashboard', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
    // Title check
    await expect(page).toHaveTitle(/Gemclaw/i);
    
    // Header/Logo check (if applicable)
    // Looking for Gemclaw text in the UI
    const branding = page.getByText(/Gemclaw/i);
    await expect(branding.first()).toBeVisible();
  });

  test('should verify Aether Forge identity in the forge route', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
    await page.goto('/forge');
    
    // Check for "Aether Forge" specifically
    await expect(page.getByText(/Aether Forge/i)).toBeVisible();
    
    // Check for "Synthesis Chamber" which is part of the Forge identity
    await expect(page.getByText(/SYNTHESIS CHAMBER/i)).toBeVisible();
  });

  test('should verify branding consistency in setting/workspace', async ({ page }) => {
  test.skip(!!process.env.CI && process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'mock-key', 'Skipping in CI without real Firebase keys');
    // Workspace check
    await page.goto('/workspace');
    await expect(page).toHaveTitle(/Gemclaw/i);
    
    // Settings check
    await page.goto('/settings');
    await expect(page.getByText(/SYSTEM_PARAMETERS/i)).toBeVisible();
  });
});
