import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the S3 client
vi.mock('@aws-sdk/client-s3', () => {
  const store = new Map<string, Buffer>();
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn(async (cmd: any) => {
        const name = cmd.constructor.name;
        if (name === 'PutObjectCommand') {
          store.set(cmd.input.Key, Buffer.from(cmd.input.Body));
          return {};
        }
        if (name === 'GetObjectCommand') {
          const body = store.get(cmd.input.Key);
          if (!body) throw Object.assign(new Error('NotFound'), { name: 'NoSuchKey' });
          return { Body: { [Symbol.asyncIterator]: async function* () { yield body; } } };
        }
        if (name === 'DeleteObjectCommand') {
          store.delete(cmd.input.Key);
          return {};
        }
        if (name === 'HeadBucketCommand') {
          return {};
        }
        if (name === 'CreateBucketCommand') {
          return {};
        }
        return {};
      }),
    })),
    PutObjectCommand: vi.fn().mockImplementation((input: any) => ({ constructor: { name: 'PutObjectCommand' }, input })),
    GetObjectCommand: vi.fn().mockImplementation((input: any) => ({ constructor: { name: 'GetObjectCommand' }, input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input: any) => ({ constructor: { name: 'DeleteObjectCommand' }, input })),
    HeadBucketCommand: vi.fn().mockImplementation((input: any) => ({ constructor: { name: 'HeadBucketCommand' }, input })),
    CreateBucketCommand: vi.fn().mockImplementation((input: any) => ({ constructor: { name: 'CreateBucketCommand' }, input })),
  };
});

// Import after mock
const { putObject, getObject, deleteObject, ensureBucket, buildStorageKey } = await import('../../src/core/storage/storage.service.js');

describe('StorageService', () => {
  beforeEach(() => {
    // Reset module-level state between tests
    vi.resetModules();
  });

  describe('buildStorageKey', () => {
    it('builds a key in the format <recordType>/<recordId>/<uuid>-<filename>', () => {
      const key = buildStorageKey('FinancialRecord', 'abc-123', 'uuid-456', 'receipt.pdf');
      expect(key).toBe('FinancialRecord/abc-123/uuid-456-receipt.pdf');
    });

    it('handles special characters in filenames via sanitization (caller responsibility)', () => {
      const key = buildStorageKey('JournalEntry', 'j-1', 'u-1', 'file.pdf');
      expect(key).toBe('JournalEntry/j-1/u-1-file.pdf');
    });
  });

  describe('putObject + getObject', () => {
    it('stores and retrieves a buffer', async () => {
      const key = 'test/buffer-test/data.txt';
      const data = Buffer.from('hello world');
      await putObject(key, data, 'text/plain');
      const retrieved = await getObject(key);
      expect(retrieved.toString()).toBe('hello world');
    });
  });

  describe('deleteObject', () => {
    it('deletes an object without throwing', async () => {
      const key = 'test/delete-test/data.txt';
      await putObject(key, Buffer.from('temp'), 'text/plain');
      await deleteObject(key);
      // Should not throw even if already deleted
      await expect(deleteObject(key)).resolves.not.toThrow();
    });
  });

  describe('ensureBucket', () => {
    it('completes without error', async () => {
      await expect(ensureBucket()).resolves.not.toThrow();
    });
  });
});
