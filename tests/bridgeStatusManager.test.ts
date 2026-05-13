import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bridgeStatusManager } from '../lib/utils/bridgeStatusManager';
import { fetchWithTimeout, getLocalBridgeUrl, isBridgeCheckEnabled } from '../lib/network/runtime';

// Mock runtime utils
vi.mock('../lib/network/runtime', () => ({
  fetchWithTimeout: vi.fn(),
  getLocalBridgeUrl: vi.fn(),
  isBridgeCheckEnabled: vi.fn(),
}));

describe('BridgeStatusManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    bridgeStatusManager.destroy(); // Reset state
    (isBridgeCheckEnabled as any).mockReturnValue(true);
    (getLocalBridgeUrl as any).mockReturnValue('http://localhost:8080');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with unknown status', () => {
    expect(bridgeStatusManager.getStatus()).toBe('unknown');
  });

  it('should notify subscribers on status change', () => {
    const callback = vi.fn();
    bridgeStatusManager.subscribe(callback);
    
    // Initial notification
    expect(callback).toHaveBeenCalledWith('unknown');
    
    // Trigger update (internal method via public probe failure)
    (fetchWithTimeout as any).mockRejectedValue(new Error('Fail'));
    bridgeStatusManager.probe(true);
    
    // Status should change to stateless
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should update status to bridge on successful probe', async () => {
    (fetchWithTimeout as any).mockResolvedValue({ ok: true });
    
    await bridgeStatusManager.probe(true);
    
    expect(bridgeStatusManager.getStatus()).toBe('bridge');
  });

  it('should update status to stateless on failed probe', async () => {
    (fetchWithTimeout as any).mockRejectedValue(new Error('Network Error'));
    
    await bridgeStatusManager.probe(true);
    
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should respect isBridgeCheckEnabled', async () => {
    (isBridgeCheckEnabled as any).mockReturnValue(false);
    
    await bridgeStatusManager.probe(true);
    
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('should handle missing bridge URL', async () => {
    (getLocalBridgeUrl as any).mockReturnValue(null);

    await bridgeStatusManager.probe(true);

    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should not re-probe within TTL when status is already set', async () => {
    // Set status to bridge via a successful probe
    (fetchWithTimeout as any).mockResolvedValue({ ok: true });
    await bridgeStatusManager.probe(true);
    expect(bridgeStatusManager.getStatus()).toBe('bridge');

    // Reset mock to track calls
    (fetchWithTimeout as any).mockClear();

    // Non-forced probe within TTL should not call fetchWithTimeout again
    await bridgeStatusManager.probe(false);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from status notifications', () => {
    const callback = vi.fn();
    const unsubscribe = bridgeStatusManager.subscribe(callback);

    // Should have been called on subscribe
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('unknown');

    // Unsubscribe
    unsubscribe();
    callback.mockClear();

    // Trigger a status change — callback should NOT be called
    (fetchWithTimeout as any).mockRejectedValue(new Error('Gone'));
    bridgeStatusManager.probe(true);

    // Give microtasks a moment then check
    return Promise.resolve().then(() => {
      expect(callback).not.toHaveBeenCalled();
    });
  });

  it('should notify multiple subscribers when status changes', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    bridgeStatusManager.subscribe(cb1);
    bridgeStatusManager.subscribe(cb2);

    // Both should receive the initial 'unknown' status
    expect(cb1).toHaveBeenCalledWith('unknown');
    expect(cb2).toHaveBeenCalledWith('unknown');

    cb1.mockClear();
    cb2.mockClear();

    (fetchWithTimeout as any).mockResolvedValue({ ok: true });
    await bridgeStatusManager.probe(true);

    expect(cb1).toHaveBeenCalledWith('bridge');
    expect(cb2).toHaveBeenCalledWith('bridge');
  });

  it('should set status to stateless when bridge responds with non-ok status', async () => {
    // fetchWithTimeout in the real implementation throws HttpStatusError for non-ok,
    // but the mock can return a non-ok response to simulate the catch branch
    (fetchWithTimeout as any).mockResolvedValue({ ok: false });

    await bridgeStatusManager.probe(true);

    // A non-ok response should cause the catch branch → stateless
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should clear subscribers and timers on destroy', () => {
    const callback = vi.fn();
    bridgeStatusManager.subscribe(callback);
    callback.mockClear();

    bridgeStatusManager.destroy();

    // Trigger a probe failure that would schedule retry timer
    (fetchWithTimeout as any).mockRejectedValue(new Error('Gone'));

    // After destroy, subscribers set is cleared — callback must not fire
    return bridgeStatusManager.probe(true).then(() => {
      expect(callback).not.toHaveBeenCalled();
    });
  });

  it('should not call fetchWithTimeout when probe is already in progress (no force)', async () => {
    // Set status to unknown so normal TTL check passes, but isProbing will be true
    (fetchWithTimeout as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 500)));

    // Start first probe (not awaited, so isProbing is true during second call)
    const firstProbe = bridgeStatusManager.probe(true);

    // Second non-forced probe while first is in progress should be skipped
    (fetchWithTimeout as any).mockClear();
    await bridgeStatusManager.probe(false);
    expect(fetchWithTimeout).not.toHaveBeenCalled();

    // Advance timers to resolve the first probe
    vi.runAllTimersAsync();
    await firstProbe;
  });

  it('destroy should be idempotent and not throw on multiple calls', () => {
    // Multiple destroy calls should not throw
    assert.doesNotThrow = (fn: () => void) => { fn(); };
    expect(() => bridgeStatusManager.destroy()).not.toThrow();
    expect(() => bridgeStatusManager.destroy()).not.toThrow();
  });

  it('should still report last known status after destroy', async () => {
    // Probe to set a concrete status
    (fetchWithTimeout as any).mockResolvedValue({ ok: true });
    await bridgeStatusManager.probe(true);
    expect(bridgeStatusManager.getStatus()).toBe('bridge');

    // destroy() clears subscribers/timers but preserves status
    bridgeStatusManager.destroy();
    // Status is preserved (not reset) after destroy
    expect(bridgeStatusManager.getStatus()).toBe('bridge');
  });
});
