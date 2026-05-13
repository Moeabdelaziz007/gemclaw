import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { verifyIdToken } from '../lib/auth/serverAuth';

// Mock firebase-admin
vi.mock('firebase-admin', () => {
  const mockAuth = {
    verifyIdToken: vi.fn(),
  };
  const mockFirestore = vi.fn();
  return {
    apps: [{}], // MUST NOT BE EMPTY so that admin.auth() is returned instead of null
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
    },
    auth: vi.fn(() => mockAuth),
    firestore: vi.fn(() => mockFirestore),
  };
});

describe('serverAuth', () => {
  const mockAuth = admin.auth() as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (admin.apps as any) = [{}];
  });

  describe('verifyIdToken', () => {
    it('should return null when authHeader is missing', async () => {
      const result = await verifyIdToken(null);
      expect(result).toBeNull();
    });

    it('should return null when authHeader is empty string', async () => {
      const result = await verifyIdToken('');
      expect(result).toBeNull();
    });

    it('should return null when authHeader does not start with Bearer', async () => {
      const result = await verifyIdToken('Token xyz');
      expect(result).toBeNull();
    });

    it('should return null when authHeader is lowercase bearer', async () => {
      const result = await verifyIdToken('bearer xyz');
      expect(result).toBeNull();
    });

    it('should return null when authHeader has no space after Bearer', async () => {
      const result = await verifyIdToken('Bearerxyz');
      expect(result).toBeNull();
    });

    it('should return uid and email for a valid token', async () => {
      mockAuth.verifyIdToken.mockResolvedValue({ uid: 'user-123', email: 'test@gemigram.com' });
      
      const result = await verifyIdToken('Bearer valid-token');
      
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({ uid: 'user-123', email: 'test@gemigram.com' });
    });

    it('should return empty string for email if email is missing in decoded token', async () => {
      mockAuth.verifyIdToken.mockResolvedValue({ uid: 'user-123' });
      
      const result = await verifyIdToken('Bearer valid-token');
      
      expect(result).toEqual({ uid: 'user-123', email: '' });
    });

    it('should return null and log error when verifyIdToken throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuth.verifyIdToken.mockRejectedValue(new Error('Token expired'));
      
      const result = await verifyIdToken('Bearer expired-token');
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ServerAuth] JWT Verification Failed:'),
        expect.any(Error)
      );
      
      // Security Check: Ensure token is not logged
      const loggedError = consoleErrorSpy.mock.calls[0][1] as Error;
      expect(loggedError.message).toBe('Token expired');
      
      consoleErrorSpy.mockRestore();
    });
  });
});
