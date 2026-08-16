// @ts-expect-error — clamscan has no type declarations
import ClamScanModule from 'clamscan';
import { Readable } from 'stream';

type ClamScan = Awaited<ReturnType<typeof ClamScanModule.prototype.init>>;

let scanner: ClamScan | null = null;
let initFailed = false;
let lastFailTime = 0;
// Retry init after this delay (ms) so ClamAV can recover without an API restart
const RETRY_INTERVAL_MS = 30_000;

/**
 * Lazily initialise the ClamAV scanner. Returns null if ClamAV is not
 * available (e.g. container still starting up). The caller decides
 * whether to fail-closed or allow based on REQUIRE_VIRUS_SCAN.
 *
 * If init previously failed, we retry every RETRY_INTERVAL_MS so the
 * scanner can recover without an API restart (e.g. ClamAV container
 * was still booting on the first upload).
 */
async function getScanner(): Promise<ClamScan | null> {
  if (scanner) return scanner;
  if (initFailed && Date.now() - lastFailTime < RETRY_INTERVAL_MS) return null;

  try {
    const clamscan = new ClamScanModule();
    scanner = await clamscan.init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || 'clamav',
        port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
        timeout: 60000,
        localFallback: false,
      },
      preference: 'clamdscan',
    });
    initFailed = false; // reset on success
    return scanner;
  } catch (err: any) {
    // Mark as failed but allow retry after RETRY_INTERVAL_MS
    initFailed = true;
    lastFailTime = Date.now();
    return null;
  }
}

export interface ScanResult {
  clean: boolean;
  reason?: string;
  scannerAvailable: boolean;
}

/**
 * Scan a buffer for viruses using ClamAV (clamd).
 *
 * Behaviour when the scanner is unavailable:
 *   - If REQUIRE_VIRUS_SCAN=true  → returns { clean: false, scannerAvailable: false }
 *     so the caller rejects the upload (fail-closed).
 *   - If REQUIRE_VIRUS_SCAN=false → returns { clean: true, scannerAvailable: false }
 *     so the caller allows the upload (fail-open, dev convenience).
 */
export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  const requireScan = process.env.REQUIRE_VIRUS_SCAN !== 'false';
  const cs = await getScanner();

  if (!cs) {
    return {
      clean: !requireScan,
      reason: requireScan ? 'VIRUS_SCANNER_UNAVAILABLE' : undefined,
      scannerAvailable: false,
    };
  }

  try {
    const stream = Readable.from([buffer]);
    const result: any = await cs.scanStream(stream);
    // clamscan returns { isInfected, viruses, resultString }
    if (result && result.isInfected === false) {
      return { clean: true, scannerAvailable: true };
    }
    const virusNames = result?.viruses?.length
      ? result.viruses.join(', ')
      : result?.resultString || 'INFECTED';
    return {
      clean: false,
      reason: virusNames,
      scannerAvailable: true,
    };
  } catch (err: any) {
    return {
      clean: !requireScan,
      reason: requireScan ? `SCAN_ERROR: ${err.message}` : undefined,
      scannerAvailable: false,
    };
  }
}

/**
 * Reset the failed-init flag so we can retry on the next upload
 * (useful when ClamAV was still starting up).
 */
export function resetScanner(): void {
  initFailed = false;
  scanner = null;
}
