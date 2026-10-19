import { MAX_ADDRESSES } from '@aricon/shared';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import type { AddressData } from '../../models/user.model.js';
import { addAddress, removeAddress, setDefaultAddress, updateAddress, type AddressFields } from './address-book.js';

const areaId = new Types.ObjectId().toHexString();

function fields(label: string, isDefault?: boolean): AddressFields {
  return { label, contactName: 'Ahmed Raza', phone: '+923001234567', line1: 'Plot 12', areaId, city: 'Karachi', isDefault };
}

const defaults = (addresses: AddressData[]) => addresses.filter((address) => address.isDefault).map((address) => address.label);

function book(...labels: string[]): AddressData[] {
  return labels.reduce<AddressData[]>((list, label) => addAddress(list, fields(label)), []);
}

describe('address book (SPEC §5.1: max 10, exactly one default)', () => {
  it('makes the first address the default, and later ones only on request', () => {
    const home = book('Home');
    expect(defaults(home)).toEqual(['Home']);
    expect(defaults(addAddress(home, fields('Site')))).toEqual(['Home']);
    expect(defaults(addAddress(home, fields('Site', true)))).toEqual(['Site']);
  });

  it('refuses an 11th address', () => {
    const full = book(...Array.from({ length: MAX_ADDRESSES }, (_, i) => `Address ${i + 1}`));
    expect(() => addAddress(full, fields('One more'))).toThrow(AppError);
  });

  it('update keeps the default unless asked to move it; false never leaves none', () => {
    const list = book('Home', 'Site');
    const site = String(list[1]?._id);
    const home = String(list[0]?._id);

    const renamed = updateAddress(list, site, fields('Site 2'));
    expect(renamed.map((address) => address.label)).toEqual(['Home', 'Site 2']);
    expect(renamed[1]?._id).toEqual(list[1]?._id);
    expect(defaults(renamed)).toEqual(['Home']);

    expect(defaults(updateAddress(list, site, fields('Site', true)))).toEqual(['Site']);
    expect(defaults(updateAddress(list, home, fields('Home', false)))).toEqual(['Home']);
  });

  it('deleting the default moves it to the first remaining address', () => {
    const list = book('Home', 'Site', 'Shop');
    const rest = removeAddress(list, String(list[0]?._id));
    expect(rest.map((address) => address.label)).toEqual(['Site', 'Shop']);
    expect(defaults(rest)).toEqual(['Site']);
    const only = book('Only');
    expect(removeAddress(only, String(only[0]?._id))).toEqual([]);
  });

  it('sets the default, and answers 404 for an unknown address', () => {
    const list = book('Home', 'Site');
    expect(defaults(setDefaultAddress(list, String(list[1]?._id)))).toEqual(['Site']);

    const unknown = new Types.ObjectId().toHexString();
    for (const change of [
      () => setDefaultAddress(list, unknown),
      () => removeAddress(list, unknown),
      () => updateAddress(list, unknown, fields('X')),
    ]) {
      expect(change).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    }
  });
});
