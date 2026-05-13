import { test as base, expect, type Page } from '@playwright/test';

/**
 * setup.ts
 * Test fixtures for the GemClaw Playwright suite.
 *
 * Goals (Phase: e2e critical-path stabilization):
 *   1. Provide a Firebase User mock complete enough to satisfy AuthProvider
 *      AND any downstream component that pulls fields off `user`.
 *   2. Block every external Firebase REST surface (identitytoolkit, secure-
 *      token, firestore) so CI never hangs waiting for a network call that
 *      the dummy credentials will never satisfy.
 *   3. Expose a `gotoAuthed` helper that fails with a descriptive error when
 *      a route silently redirects to `/` because the auth fixture did not
 *      propagate. Previously the Aether-Forge test died with a 5s timeout
 *      and zero diagnostic information.
 */

// Complete Firebase User shape. Every field that the firebase/auth `User`
// interface declares is stubbed so component code that pokes at `user.metadata`,
// `user.providerData`, or calls `user.getIdToken()` does not crash silently.
const TEST_USER = {
  uid: 'test-user-123',
  email: 'test@gemclaw.os',
  emailVerified: true,
  displayName: 'Test Sovereign',
  photoURL: 'https://example.com/avatar.png',
  phoneNumber: null,
  providerId: 'firebase',
  isAnonymous: false,
  metadata: {
    creationTime: new Date(0).toUTCString(),
    lastSignInTime: new Date().toUTCString(),
  },
  providerData: [
    {
      providerId: 'password',
      uid: 'test-user-123',
      displayName: 'Test Sovereign',
      email: 'test@gemclaw.os',
      phoneNumber: null,
      photoURL: 'https://example.com/avatar.png',
    },
  ],
  refreshToken: 'mock-refresh-token',
  tenantId: null,
} as const;

export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject the mock BEFORE any page script runs. Both the localStorage entry
    // (so Firebase JS SDK believes it has a hydrated user) and the
    // __e2eMockUser__ global (so the AuthProvider e2e short-circuit can pick
    // it up) are set in the same init script.
    await page.addInitScript((user) => {
      const stored = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        providerData: user.providerData,
        stsTokenManager: {
          accessToken: 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expirationTime: Date.now() + 60 * 60 * 1000,
        },
        createdAt: '0',
        lastLoginAt: String(Date.now()),
      };
      window.localStorage.setItem(
        'firebase:authUser:dummy:[DEFAULT]',
        JSON.stringify(stored),
      );
      window.localStorage.setItem(
        'firebase:authUser:mock-app-key',
        JSON.stringify(stored),
      );

      // Inflate the bare object into something resembling a Firebase User so
      // any consumer that calls getIdToken / reload / toJSON / delete gets a
      // safe stub rather than a TypeError.
      const stubUser = {
        ...user,
        getIdToken: () => Promise.resolve('mock-id-token'),
        getIdTokenResult: () =>
          Promise.resolve({
            token: 'mock-id-token',
            expirationTime: new Date(Date.now() + 60 * 60 * 1000).toUTCString(),
            authTime: new Date().toUTCString(),
            issuedAtTime: new Date().toUTCString(),
            signInProvider: 'password',
            signInSecondFactor: null,
            claims: { uid: user.uid, email: user.email },
          }),
        reload: () => Promise.resolve(),
        toJSON: () => ({ uid: user.uid, email: user.email }),
        delete: () => Promise.resolve(),
      };

      (window as unknown as { __e2eMockUser__: unknown }).__e2eMockUser__ = stubUser;
    }, TEST_USER);

    // Identity Toolkit account lookup: return the canned user. Without this,
    // Firebase Auth's first network call on hydration sees an unreachable
    // host and the page eventually flips user to null.
    await page.route('**/identitytoolkit.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [
            {
              localId: TEST_USER.uid,
              email: TEST_USER.email,
              emailVerified: TEST_USER.emailVerified,
              displayName: TEST_USER.displayName,
              photoUrl: TEST_USER.photoURL,
              providerUserInfo: TEST_USER.providerData,
              createdAt: '0',
              lastLoginAt: String(Date.now()),
            },
          ],
        }),
      }),
    );

    // Secure Token refresh endpoint: same idea, return a canned token so the
    // SDK does not enter the failure path that signs the user out.
    await page.route('**/securetoken.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-id-token',
          id_token: 'mock-id-token',
          refresh_token: 'mock-refresh-token',
          expires_in: '3600',
          token_type: 'Bearer',
          user_id: TEST_USER.uid,
          project_id: 'dummy',
        }),
      }),
    );

    // Firestore + Storage: empty responses are fine for branding tests, the
    // real concern is preventing CI from hanging on a stalled long-poll.
    await page.route('**/firestore.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.route('**/firebasestorage.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await use(page);
  },
});

/**
 * Navigate to an in-app route and assert that the e2e auth fixture
 * propagated. If the route redirects away (typically to `/` when the
 * AuthProvider has not picked up `__e2eMockUser__`) the helper throws a
 * descriptive error so the test author sees the real failure rather than a
 * five-second `locator not visible` timeout.
 */
export async function gotoAuthed(page: Page, route: string) {
  const targetUrl = new URL(route, 'http://localhost:3000');
  const targetLocation = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  const response = await page.goto(targetLocation, { waitUntil: 'domcontentloaded' });

  if (response && response.status() >= 400) {
    throw new Error(`gotoAuthed(${route}): server returned HTTP ${response.status()}`);
  }

  // The AuthProvider short-circuit runs in a useEffect that fires after the
  // first paint. Wait for the global to be visible to client-side scripts
  // before we judge whether the route redirected.
  await page.waitForFunction(
    () => typeof window !== 'undefined' && Boolean((window as unknown as { __e2eMockUser__: unknown }).__e2eMockUser__),
    { timeout: 10_000 },
  );

  // Yield one event-loop tick so React can consume the mock and clear the
  // initial `loading` flag before we sample the URL.
  await page.waitForTimeout(300);

  const landed = new URL(page.url());
  if (
    landed.pathname !== targetUrl.pathname ||
    landed.search !== targetUrl.search ||
    landed.hash !== targetUrl.hash
  ) {
    const landedLocation = `${landed.pathname}${landed.search}${landed.hash}`;
    throw new Error(
      `gotoAuthed(${route}): page redirected to ${landedLocation}. ` +
        `The AuthProvider did not consume __e2eMockUser__ before the route guard fired. ` +
        `Inspect components/Providers.tsx for the e2e short-circuit, or extend the mock with the field the guard expects.`,
    );
  }
  return response;
}

export { expect };
