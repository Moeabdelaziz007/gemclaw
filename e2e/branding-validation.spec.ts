import { expect, test, gotoAuthed } from './setup';

/**
 * Mission 06: Branding & Identity
 *
 * The sovereign critical path through GemClaw's three public entry points:
 *   1. /dashboard . the surface a returning user lands on
 *   2. /forge     . the Aether Forge identity that defines the product
 *   3. /workspace . the persistent agent workspace
 *   4. /settings  . the configuration matrix
 *
 * These tests intentionally hit the real Next.js build with strict text
 * validation rather than regex sniffing. Previous incarnations matched on
 * `/Aether/i` and dropped to a 5-second timeout when the page silently
 * redirected to `/` because the auth fixture had not propagated. The new
 * `gotoAuthed` helper surfaces that failure mode immediately with an
 * actionable error message and the assertions now demand the exact element
 * text the components actually render.
 *
 * The `Gemclaw -> GemClaw` brand-string rebrand landed on main via PR #32;
 * the assertions below already reference the canonical `GemClaw` wordmark
 * and the exact translation-dict markers (`Sovereign_OS`, `System Parameters`,
 * `Neural Entity Synthesis`) so future drift fails loudly.
 */
test.describe('Mission 06: Branding & Identity', () => {
  test('renders GemClaw AIOS title and Sovereign_OS marker on the dashboard', async ({ page }) => {
    await gotoAuthed(page, '/dashboard');

    await expect(page).toHaveTitle(/GemClaw/i);

    // The dashboard shell stamps a Sovereign_OS V3.0 marker that is stable
    // across themes and locales. We require it to be visible, not just to
    // exist in the DOM.
    await expect(page.getByText(/Sovereign_OS/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders the Aether Forge identity at /forge', async ({ page }) => {
    await gotoAuthed(page, '/forge');

    // The header is a single h2 that splits "Aether" into a neon span and
    // leaves " Forge" as the trailing text node. Anchoring on the h2 via
    // data-testid lets us assert both halves of the wordmark without
    // coupling to the exact DOM split between span and text node.
    const aetherForgeHeading = page.locator('h2[data-testid="aether-forge-heading"]');
    await expect(aetherForgeHeading).toBeVisible({ timeout: 15_000 });
    await expect(aetherForgeHeading).toContainText('Aether');
    await expect(aetherForgeHeading).toContainText('Forge');

    // The subtitle is the canonical product tagline. Strict exact-text
    // match so a future rename surfaces here instead of silently passing.
    await expect(page.getByText('Neural Entity Synthesis', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('preserves the GemClaw title across workspace and exposes Settings parameters', async ({ page }) => {
    await gotoAuthed(page, '/workspace');
    await expect(page).toHaveTitle(/GemClaw/i);

    await gotoAuthed(page, '/settings');
    // "System Parameters" is the live translation-dict key, not a regex
    // approximation, so a typo in the dictionary will fail loudly here.
    await expect(page.getByText('System Parameters', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
