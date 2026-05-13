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

  it('should notify subscribers on status change', async () => {
    const callback = vi.fn();
    bridgeStatusManager.subscribe(callback);
    
    // Initial notification
    expect(callback).toHaveBeenCalledWith('unknown');
    
    // Trigger update (internal method via public probe failure)
    (fetchWithTimeout as any).mockRejectedValue(new Error('Fail'));
    await bridgeStatusManager.probe(true);
    
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
});
