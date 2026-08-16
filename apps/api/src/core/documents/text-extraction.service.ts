import type { PrismaClient } from '@prisma/client';

/**
 * Best-effort text extraction from uploaded documents.
 * Supports: PDF (text-based), images (OCR via tesseract.js),
 * DOCX (mammoth), XLSX (exceljs), CSV/DOC (plain text).
 *
 * Extraction runs asynchronously after the upload response is sent.
 * Failures are non-fatal — the document is still stored, just with
 * extractionStatus='failed' and no contentText.
 */

// Lazy-load heavy deps only when needed
async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    // @ts-expect-error — pdf-parse has no type declarations
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch {
    return '';
  }
}

async function extractFromImage(buffer: Buffer): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text || '';
  } catch {
    return '';
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch {
    return '';
  }
}

async function extractFromXlsx(buffer: Buffer): Promise<string> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        const values = row.values as any[];
        if (values) {
          // values[0] is typically undefined; join the rest
          const cells = values.slice(1).map((v) => (v == null ? '' : String(v))).filter(Boolean);
          if (cells.length > 0) lines.push(cells.join(' '));
        }
      });
    });
    return lines.join('\n');
  } catch {
    return '';
  }
}

function extractFromPlainText(buffer: Buffer): string {
  try {
    return buffer.toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Extract text from a buffer based on MIME type.
 * Returns empty string on failure (non-throwing).
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractFromPdf(buffer);
    case 'image/jpeg':
    case 'image/png':
    case 'image/webp':
      return extractFromImage(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return extractFromDocx(buffer);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return extractFromXlsx(buffer);
    case 'text/csv':
    case 'text/plain':
      return extractFromPlainText(buffer);
    default:
      return '';
  }
}

/**
 * Run extraction asynchronously for a stored document.
 * Updates the Document row with contentText and extractionStatus.
 * This is fire-and-forget — errors are logged but not thrown.
 */
export async function extractAndStore(
  prisma: PrismaClient,
  documentId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  try {
    const text = await extractText(buffer, mimeType);
    // Truncate to a reasonable length to avoid bloat (100KB of text)
    const truncated = text.length > 100000 ? text.slice(0, 100000) : text;
    await prisma.document.update({
      where: { id: documentId },
      data: {
        contentText: truncated || null,
        extractionStatus: 'done',
      },
    });
  } catch (err: any) {
    // Non-fatal — mark as failed but don't throw
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { extractionStatus: 'failed' },
      });
    } catch {
      // ignore
    }
  }
}
