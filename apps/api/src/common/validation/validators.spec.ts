import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsOptionalDateKey } from './validators.js';

class RangeQuery {
  @IsOptionalDateKey()
  from?: string;
}

async function accepts(from: string | undefined): Promise<boolean> {
  const query = new RangeQuery();
  query.from = from;
  return (await validate(query)).length === 0;
}

describe('IsOptionalDateKey', () => {
  it('accepts calendar dates written as YYYY-MM-DD, or nothing', async () => {
    for (const value of ['2026-09-29', '2026-01-01', '2026-12-31', '2028-02-29', undefined]) {
      expect(await accepts(value)).toBe(true);
    }
  });

  it('rejects other shapes and impossible months or days', async () => {
    for (const value of ['2026-9-29', '26-09-29', '2026-13-01', '2026-00-10', '2026-09-32', '2026-09-29T00:00', 'dddd-09-29']) {
      expect(await accepts(value)).toBe(false);
    }
  });
});
