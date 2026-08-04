import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies
vi.mock('pdf-parse', () => ({
  default: vi.fn(async () => ({ text: 'extracted pdf text' })),
}));

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: vi.fn(async () => ({ data: { text: 'OCR text result' } })),
    terminate: vi.fn(async () => {}),
  })),
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn(async () => ({ value: 'docx text content' })),
  default: { extractRawText: vi.fn(async () => ({ value: 'docx text content' })) },
}));

vi.mock('exceljs', () => ({
  default: vi.fn().mockImplementation(() => ({
    workbook: { xlsx: { load: vi.fn(async () => {}) }, eachSheet: vi.fn() },
  })),
}));

const { extractText } = await import('../../src/core/documents/text-extraction.service.js');

describe('TextExtractionService', () => {
  describe('extractText', () => {
    it('extracts text from PDF', async () => {
      const text = await extractText(Buffer.from('fake pdf'), 'application/pdf');
      expect(text).toBe('extracted pdf text');
    });

    it('extracts text from images via OCR', async () => {
      const text = await extractText(Buffer.from('fake image'), 'image/png');
      expect(text).toBe('OCR text result');
    });

    it('extracts text from DOCX', async () => {
      const text = await extractText(
        Buffer.from('fake docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(text).toBe('docx text content');
    });

    it('extracts text from CSV as plain text', async () => {
      const text = await extractText(Buffer.from('col1,col2\nval1,val2'), 'text/csv');
      expect(text).toBe('col1,col2\nval1,val2');
    });

    it('returns empty string for unsupported MIME types', async () => {
      const text = await extractText(Buffer.from('unknown'), 'application/octet-stream');
      expect(text).toBe('');
    });

    it('returns empty string on extraction failure (non-throwing)', async () => {
      // Override the pdf-parse mock to throw
      const pdfParse = (await import('pdf-parse')).default as any;
      pdfParse.mockRejectedValueOnce(new Error('parse error'));
      const text = await extractText(Buffer.from('bad pdf'), 'application/pdf');
      expect(text).toBe('');
    });
  });
});
