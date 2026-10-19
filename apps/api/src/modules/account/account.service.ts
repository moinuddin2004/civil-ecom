import { DEFAULT_CITY, type AddressDTO, type CustomerDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { isDuplicateKey } from '../../common/errors/mongo-errors.js';
import type { AddressData } from '../../models/user.model.js';
import { AuthUserCache } from '../auth/auth-user-cache.service.js';
import type { Principal } from '../auth/auth.types.js';
import { CredentialsService } from '../auth/credentials.service.js';
import type { ChangePasswordDto } from '../auth/dto/auth.request.dto.js';
import { toCustomerDto } from '../auth/dto/auth.response.dto.js';
import { PasswordHasher } from '../auth/password-hasher.service.js';
import { TokenService } from '../auth/token.service.js';
import { DeliveryAreasRepository } from '../delivery/delivery-areas.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { addAddress, removeAddress, setDefaultAddress, updateAddress, type AddressFields } from './address-book.js';
import type { AddressDto, UpdateProfileDto } from './dto/account.dto.js';

const PHONE_TAKEN = 'Another account already uses this mobile number.';
const SAME_PASSWORD = 'Choose a password different from the current one.';

/** The signed-in customer's profile, password and saved addresses (SPEC §7.2 "Account", §9). */
@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersRepository,
    private readonly areas: DeliveryAreasRepository,
    private readonly credentials: CredentialsService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly cache: AuthUserCache,
  ) {}

  async updateProfile(userId: string, input: UpdateProfileDto): Promise<CustomerDTO> {
    if (await this.users.phoneTakenByOther(input.phone, userId)) throw new AppError('PHONE_TAKEN', PHONE_TAKEN);
    let user;
    try {
      user = await this.users.updateProfile(userId, input);
    } catch (error) {
      // Another account took the number between the check and the write.
      if (isDuplicateKey(error, 'phone')) throw new AppError('PHONE_TAKEN', PHONE_TAKEN);
      throw error;
    }
    if (!user) throw AppError.unauthenticated();
    this.cache.invalidate(userId); // the cached principal carries the name
    return toCustomerDto(user);
  }

  /** Signs out every other device; this one stays signed in (SPEC §7.2: "other sessions deleted"). */
  async changePassword(principal: Principal, input: ChangePasswordDto): Promise<void> {
    if (input.currentPassword === input.newPassword) {
      throw AppError.validation(SAME_PASSWORD, [{ path: 'newPassword', message: SAME_PASSWORD }]);
    }
    await this.credentials.verifyCurrentPassword(principal.userId, input.currentPassword);
    await this.users.setPassword(principal.userId, await this.hasher.hash(input.newPassword));
    await this.tokens.revokeAllForUser(principal.userId, 'password_changed', { exceptFamilyId: principal.familyId });
    this.cache.invalidate(principal.userId);
  }

  async addresses(userId: string): Promise<AddressDTO[]> {
    const book = await this.users.addressBook(userId);
    if (!book) throw AppError.unauthenticated();
    return this.toAddressDtos(book.addresses);
  }

  async addAddress(userId: string, input: AddressDto): Promise<AddressDTO[]> {
    const fields = await this.toFields(input);
    return this.changeAddresses(userId, (addresses) => addAddress(addresses, fields));
  }

  async updateAddress(userId: string, addressId: string, input: AddressDto): Promise<AddressDTO[]> {
    const fields = await this.toFields(input);
    return this.changeAddresses(userId, (addresses) => updateAddress(addresses, addressId, fields));
  }

  removeAddress(userId: string, addressId: string): Promise<AddressDTO[]> {
    return this.changeAddresses(userId, (addresses) => removeAddress(addresses, addressId));
  }

  setDefaultAddress(userId: string, addressId: string): Promise<AddressDTO[]> {
    return this.changeAddresses(userId, (addresses) => setDefaultAddress(addresses, addressId));
  }

  /** Read → change → save only if unchanged since the read, so two tabs can't lose each other's edits. */
  private async changeAddresses(userId: string, change: (addresses: AddressData[]) => AddressData[]): Promise<AddressDTO[]> {
    const book = await this.users.addressBook(userId);
    if (!book) throw AppError.unauthenticated();
    const next = change(book.addresses);
    if (!(await this.users.saveAddresses(userId, book.version, next))) {
      throw AppError.conflict('Your addresses changed in another window. Reload the page and try again.');
    }
    return this.toAddressDtos(next);
  }

  /** The area must exist; an area that doesn't deliver yet can be saved (checkout blocks it). */
  private async toFields(input: AddressDto): Promise<AddressFields> {
    const [area] = await this.areas.findByIds([input.areaId]);
    if (!area) {
      throw AppError.validation('Choose a delivery area from the list.', [
        { path: 'areaId', message: 'Choose a delivery area from the list.' },
      ]);
    }
    return {
      label: input.label,
      contactName: input.contactName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2,
      landmark: input.landmark,
      areaId: input.areaId,
      city: input.city ?? DEFAULT_CITY,
      isDefault: input.isDefault,
    };
  }

  private async toAddressDtos(addresses: readonly AddressData[]): Promise<AddressDTO[]> {
    const areas = await this.areas.findByIds(addresses.map((address) => address.areaId));
    const areaById = new Map(areas.map((area) => [String(area._id), area]));
    return addresses.map((address) => {
      const area = areaById.get(String(address.areaId));
      return {
        id: String(address._id),
        label: address.label,
        contactName: address.contactName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? null,
        landmark: address.landmark ?? null,
        areaId: String(address.areaId),
        areaName: area?.name ?? null,
        areaServiceable: area?.isServiceable ?? false,
        city: address.city,
        isDefault: address.isDefault,
      };
    });
  }
}
