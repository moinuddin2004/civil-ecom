import { emailSchema, nameSchema, pkPhoneSchema, STAFF_ROLES, USER_STATUSES } from '@aricon/shared';
import { z } from 'zod';

/**
 * Form schema for the "Add/edit staff" sheet (SPEC §10.8, DESIGN.md §9.5). One form serves both
 * modes, so it can't be the shared `staffCreateSchema` / `staffUpdateSchema` (the request bodies,
 * typed with their `StaffCreateInput` / `StaffUpdateInput`): it has a status field (edit only), a
 * blank phone means "none", and `permissions` is plain component state (via `withDependencies` /
 * `withoutPermission`). The fields reuse the shared validators (`nameSchema`, `emailSchema`,
 * `pkPhoneSchema`).
 */
export const staffFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  /** Optional for staff (SPEC §5.1); blank is allowed, otherwise must be a valid PK mobile number. */
  phone: z.union([z.literal(''), pkPhoneSchema]),
  role: z.enum(STAFF_ROLES),
  status: z.enum(USER_STATUSES),
});
export type StaffFormInput = z.input<typeof staffFormSchema>;
export type StaffFormData = z.output<typeof staffFormSchema>;
