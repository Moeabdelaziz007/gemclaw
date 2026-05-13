import * as admin from 'firebase-admin';

/**
 * serverAuth.ts
 * Sovereign Server-Side Authentication for GemclawOS.
 * Handles JWT verification using Firebase Admin SDK.
 */

const isConfigured = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (isConfigured) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (e) {
      console.warn('[ServerAuth] Failed to initialize Firebase Admin:', e);
    }
  } else {
    // Only warn if we are NOT in the build phase (or if we actually need it)
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE) {
      console.warn('[ServerAuth] Missing Firebase Admin credentials — Auth endpoints will fail.');
    }
  }
}

// Safely export auth and db
export const auth = admin.apps.length ? admin.auth() : null as unknown as admin.auth.Auth;
export const db = admin.apps.length ? admin.firestore() : null as unknown as admin.firestore.Firestore;

/**
 * verifyIdToken
 * Extracts the Bearer token from the Authorization header and verifies it.
 * @param token - The raw Authorization header string
 * @returns {uid, email} or null if invalid
 */
export async function verifyIdToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Robust fallback for auth instance, mainly for testing
    const authInstance = auth || admin.auth();
    const decodedToken = await authInstance.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };
  } catch (error) {
    console.error('[ServerAuth] JWT Verification Failed:', error);
    return null;
  }
}
