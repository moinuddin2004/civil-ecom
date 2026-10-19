import { MAX_ADDRESSES } from '@aricon/shared';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import type { AddressData } from '../../models/user.model.js';

/*
 * Saved-address rules (SPEC §5.1): at most 10, and exactly one default whenever there are any.
 * Pure functions over the stored list; the service saves the result in one write.
 */

export interface AddressFields {
  label: string;
  contactName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  areaId: string;
  city: string;
  /** true → this becomes the default. false/absent never un-sets the only default. */
  isDefault?: boolean;
}

const ADDRESS_NOT_FOUND = "We couldn't find that address.";

function stored(fields: AddressFields, id: Types.ObjectId, isDefault: boolean): AddressData {
  return {
    _id: id,
    label: fields.label,
    contactName: fields.contactName,
    phone: fields.phone,
    line1: fields.line1,
    line2: fields.line2,
    landmark: fields.landmark,
    areaId: new Types.ObjectId(fields.areaId),
    city: fields.city,
    isDefault,
  };
}

function indexOf(addresses: readonly AddressData[], id: string): number {
  const index = addresses.findIndex((address) => String(address._id) === id);
  if (index < 0) throw AppError.notFound(ADDRESS_NOT_FOUND);
  return index;
}

/** The first address is always the default; `isDefault: true` moves the default to the new one. */
export function addAddress(addresses: readonly AddressData[], fields: AddressFields, id = new Types.ObjectId()): AddressData[] {
  if (addresses.length >= MAX_ADDRESSES) {
    throw AppError.validation(`You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`);
  }
  const makeDefault = addresses.length === 0 || fields.isDefault === true;
  return [
    ...addresses.map((address) => (makeDefault ? { ...address, isDefault: false } : address)),
    stored(fields, id, makeDefault),
  ];
}

export function updateAddress(addresses: readonly AddressData[], id: string, fields: AddressFields): AddressData[] {
  const index = indexOf(addresses, id);
  const makeDefault = fields.isDefault === true;
  return addresses.map((address, i) => {
    if (i === index) return stored(fields, address._id, address.isDefault || makeDefault);
    return makeDefault ? { ...address, isDefault: false } : address;
  });
}

/** Deleting the default makes the first remaining address the default. */
export function removeAddress(addresses: readonly AddressData[], id: string): AddressData[] {
  const index = indexOf(addresses, id);
  const removed = addresses[index];
  const rest = addresses.filter((_, i) => i !== index);
  if (removed?.isDefault && rest.length > 0 && !rest.some((address) => address.isDefault)) {
    return rest.map((address, i) => (i === 0 ? { ...address, isDefault: true } : address));
  }
  return rest;
}

export function setDefaultAddress(addresses: readonly AddressData[], id: string): AddressData[] {
  indexOf(addresses, id);
  return addresses.map((address) => ({ ...address, isDefault: String(address._id) === id }));
}
