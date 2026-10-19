import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { addressSchema, profileSchema } from './account.js';

function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map(({ path, code }) => ({ path, code }));
}

const AREA = '64b7f0c2e4b0a1a2b3c4d5e6';

describe('profileSchema (SPEC §7.2 "Account")', () => {
  it('normalises the phone and clears the company with null or an empty string', () => {
    expect(profileSchema.parse({ name: ' Ali ', phone: '0300 1234567', companyName: ' Khan Builders ' })).toEqual({
      name: 'Ali',
      phone: '+923001234567',
      companyName: 'Khan Builders',
    });
    expect(profileSchema.parse({ name: 'Ali', phone: '03001234567', companyName: null }).companyName).toBeNull();
    expect(profileSchema.parse({ name: 'Ali', phone: '03001234567', companyName: '' }).companyName).toBeNull();
  });

  it('does not let the customer change email, role or status here', () => {
    for (const key of ['email', 'role', 'status', 'permissions']) {
      expect(issues(profileSchema, { name: 'Ali', phone: '03001234567', [key]: 'x' })[0]?.code).toBe(
        'unrecognized_keys',
      );
    }
  });
});

describe('addressSchema (SPEC §5.1 Address)', () => {
  const address = {
    label: 'Site – Gulshan',
    contactName: 'Imran',
    phone: '0321-7654321',
    line1: 'Plot 12, Block 7',
    areaId: AREA,
  };

  it('fills the city with Karachi and normalises the phone', () => {
    expect(addressSchema.parse(address)).toMatchObject({ city: 'Karachi', phone: '+923217654321' });
  });

  it('treats empty optional lines as not given', () => {
    const data = addressSchema.parse({ ...address, line2: '  ', landmark: '' });
    expect(data.line2).toBeUndefined();
    expect(data.landmark).toBeUndefined();
  });

  it('requires label, contact, phone, first line and a valid area', () => {
    expect(issues(addressSchema, { ...address, label: ' ' }).map((i) => i.path)).toEqual([['label']]);
    expect(issues(addressSchema, { ...address, line1: 'ab' }).map((i) => i.path)).toEqual([['line1']]);
    expect(issues(addressSchema, { ...address, areaId: 'gulshan' }).map((i) => i.path)).toEqual([['areaId']]);
    expect(issues(addressSchema, { ...address, phone: '021 34567890' }).map((i) => i.path)).toEqual([['phone']]);
    expect(issues(addressSchema, { ...address, userId: AREA })[0]?.code).toBe('unrecognized_keys');
  });
});
