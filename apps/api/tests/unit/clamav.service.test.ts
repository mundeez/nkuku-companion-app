import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock clamscan
const mockScanStream = vi.fn();
const mockInit = vi.fn();

vi.mock('clamscan', () => ({
  default: vi.fn().mockImplementation(() => ({
    init: mockInit,
  })),
}));

const { scanBuffer, resetScanner } = await import('../../src/core/security/clamav.service.js');

describe('ClamAVService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScanner();
    process.env.REQUIRE_VIRUS_SCAN = 'true';
  });

  describe('scanBuffer', () => {
    it('returns clean when scanner reports clean', async () => {
      mockInit.mockResolvedValueOnce({
        scanStream: vi.fn().mockResolvedValue({ isInfected: false, viruses: [], resultString: 'stream: OK' }),
      });
      const result = await scanBuffer(Buffer.from('clean file'));
      expect(result.clean).toBe(true);
      expect(result.scannerAvailable).toBe(true);
    });

    it('returns infected when scanner detects virus', async () => {
      mockInit.mockResolvedValueOnce({
        scanStream: vi.fn().mockResolvedValue({ isInfected: true, viruses: ['EICAR-Test-Signature'], resultString: 'stream: EICAR-Test-Signature FOUND' }),
      });
      const result = await scanBuffer(Buffer.from('eicar'));
      expect(result.clean).toBe(false);
      expect(result.reason).toContain('EICAR');
      expect(result.scannerAvailable).toBe(true);
    });

    it('fail-closed when scanner unavailable and REQUIRE_VIRUS_SCAN=true', async () => {
      mockInit.mockRejectedValueOnce(new Error('connection refused'));
      const result = await scanBuffer(Buffer.from('test'));
      expect(result.clean).toBe(false);
      expect(result.scannerAvailable).toBe(false);
      expect(result.reason).toBe('VIRUS_SCANNER_UNAVAILABLE');
    });

    it('fail-open when scanner unavailable and REQUIRE_VIRUS_SCAN=false', async () => {
      process.env.REQUIRE_VIRUS_SCAN = 'false';
      mockInit.mockRejectedValueOnce(new Error('connection refused'));
      const result = await scanBuffer(Buffer.from('test'));
      expect(result.clean).toBe(true);
      expect(result.scannerAvailable).toBe(false);
    });

    it('retries init after failure (auto-recovery without API restart)', async () => {
      // First call fails
      mockInit.mockRejectedValueOnce(new Error('connection refused'));
      const r1 = await scanBuffer(Buffer.from('test'));
      expect(r1.scannerAvailable).toBe(false);
      expect(r1.clean).toBe(false); // fail-closed

      // Immediate retry — should still be blocked by retry interval (no mock needed,
      // getScanner returns null without calling mockInit)
      const r2 = await scanBuffer(Buffer.from('test'));
      expect(r2.scannerAvailable).toBe(false);

      // After resetScanner (simulates retry interval elapsing), init succeeds
      resetScanner();
      mockInit.mockResolvedValueOnce({
        scanStream: vi.fn().mockResolvedValue({ isInfected: false, viruses: [], resultString: 'stream: OK' }),
      });
      const r3 = await scanBuffer(Buffer.from('clean file'));
      expect(r3.scannerAvailable).toBe(true);
      expect(r3.clean).toBe(true);
    });
  });
});
