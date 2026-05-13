import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bridgeStatusManager } from '../lib/utils/bridgeStatusManager';

// Mock dependencies used by the manager
vi.mock('../lib/network/runtime', () => ({
  fetchWithTimeout: vi.fn(),
  getLocalBridgeUrl: vi.fn(() => 'http://localhost:3001/status'),
  isBridgeCheckEnabled: vi.fn(() => true),
}));

import { fetchWithTimeout, isBridgeCheckEnabled, getLocalBridgeUrl } from '../lib/network/runtime';

describe('BridgeStatusManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force manager state reset via type coercion for isolated tests
    (bridgeStatusManager as any).status = 'unknown';
    (bridgeStatusManager as any).lastChecked = 0;
    if ((bridgeStatusManager as any).probeTimer) {
      clearTimeout((bridgeStatusManager as any).probeTimer);
      (bridgeStatusManager as any).probeTimer = null;
    }
  });

  afterEach(() => {
      bridgeStatusManager.destroy();
  });

  it('should initialize with unknown status', () => {
    expect(bridgeStatusManager.getStatus()).toBe('unknown');
  });

  it('should notify subscribers on status change', async () => {
    const subscriber = vi.fn();
    const unsubscribe = bridgeStatusManager.subscribe(subscriber);

    // Should immediately notify current status ('unknown')
    expect(subscriber).toHaveBeenCalledWith('unknown');

    // Mock fetch failure
    (fetchWithTimeout as any).mockRejectedValueOnce(new Error('Network error'));
    
    await bridgeStatusManager.probe(true);

    // Status changed to stateless, should notify again
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
    expect(subscriber).toHaveBeenCalledWith('stateless');
    
    unsubscribe();
  });

  it('should update status to stateless on failed probe', async () => {
    (fetchWithTimeout as any).mockRejectedValueOnce(new Error('Network error'));
    await bridgeStatusManager.probe(true);

    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should update status to bridge on successful probe', async () => {
    (fetchWithTimeout as any).mockResolvedValueOnce({ ok: true });

    await bridgeStatusManager.probe(true);
    expect(bridgeStatusManager.getStatus()).toBe('bridge');
  });

  it('should respect isBridgeCheckEnabled', async () => {
    (isBridgeCheckEnabled as any).mockReturnValueOnce(false);
    
    await bridgeStatusManager.probe(true);

    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });

  it('should handle missing bridge URL', async () => {
    (getLocalBridgeUrl as any).mockReturnValueOnce('');

    await bridgeStatusManager.probe(true);

    expect(bridgeStatusManager.getStatus()).toBe('stateless');
  });
});
