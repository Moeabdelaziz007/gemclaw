import test from 'node:test';
import assert from 'node:assert/strict';
import { db, auth, storage, googleProvider } from '@/firebase';

test('handleFirestoreError', async (t) => {
  // Suppress console.error
  const originalConsoleError = console.error;
  t.beforeEach(() => {
    console.error = () => {};
  });
  t.afterEach(() => {
    console.error = originalConsoleError;
  });

  await t.test('handles Error instance correctly', () => {
    const error = new Error('Permission denied');

    assert.throws(() => {
      handleFirestoreError(error, OperationType.GET, 'users/123');
    }, (e: any) => {
      assert.ok(e instanceof Error);
      const parsed = JSON.parse(e.message);
      assert.equal(parsed.error, 'Permission denied');
      assert.equal(parsed.operationType, OperationType.GET);
      assert.equal(parsed.path, 'users/123');
      // In tests/server environment, auth is mocked as { currentUser: null }
      // Because `undefined` values are stripped out by JSON.stringify, we only get providerInfo
      assert.deepEqual(parsed.authInfo, {
        providerInfo: []
      });
      return true;
    });
  });

  await t.test('handles string error correctly', () => {
    const error = 'Some string error';

    assert.throws(() => {
      handleFirestoreError(error, OperationType.CREATE, 'docs/456');
    }, (e: any) => {
      assert.ok(e instanceof Error);
      const parsed = JSON.parse(e.message);
      assert.equal(parsed.error, 'Some string error');
      assert.equal(parsed.operationType, OperationType.CREATE);
      assert.equal(parsed.path, 'docs/456');
      return true;
    });
  });

  await t.test('handles object error correctly', () => {
    const error = { code: 403, msg: 'Forbidden' };

    assert.throws(() => {
      handleFirestoreError(error, OperationType.DELETE, null);
    }, (e: any) => {
      assert.ok(e instanceof Error);
      const parsed = JSON.parse(e.message);
      assert.equal(parsed.error, '[object Object]');
      assert.equal(parsed.operationType, OperationType.DELETE);
      assert.equal(parsed.path, null);
      return true;
    });
  });

  await t.test('handles null error correctly', () => {
    assert.throws(() => {
      handleFirestoreError(null, OperationType.UPDATE, 'test/path');
    }, (e: any) => {
      assert.ok(e instanceof Error);
      const parsed = JSON.parse(e.message);
      assert.equal(parsed.error, 'null');
      assert.equal(parsed.operationType, OperationType.UPDATE);
      assert.equal(parsed.path, 'test/path');
      return true;
    });
  });
});
