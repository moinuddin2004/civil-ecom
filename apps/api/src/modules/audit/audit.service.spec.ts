import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { changedFields } from './audit.service.js';

describe('changedFields (audit before/after)', () => {
  it('keeps only the fields that changed, as plain JSON', () => {
    const id = new Types.ObjectId();
    const before = { name: 'Lucky OPC', price: 425, categoryId: id, tags: ['a'], note: undefined as string | undefined };
    const after = { name: 'Lucky OPC', price: 415, categoryId: id, tags: ['a', 'b'], note: 'set' };

    expect(changedFields(before, after, ['name', 'price', 'categoryId', 'tags', 'note'])).toEqual({
      before: { price: 425, tags: ['a'], note: null },
      after: { price: 415, tags: ['a', 'b'], note: 'set' },
    });
  });

  it('is empty when nothing changed (ObjectIds and dates compare by value)', () => {
    const at = new Date('2026-09-01T00:00:00Z');
    const a = { id: new Types.ObjectId('0123456789abcdef01234567'), at };
    const b = { id: new Types.ObjectId('0123456789abcdef01234567'), at: new Date(at) };
    expect(changedFields(a, b, ['id', 'at'])).toEqual({ before: {}, after: {} });
  });
});
