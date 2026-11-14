import type { AdminMeDTO, StaffDTO } from "@aricon/shared";

/**
 * UI-side mirror of SPEC §4.5 rule 4: "Cannot demote, block or delete the last active ADMIN. An
 * admin cannot change their own role or block themselves." The staff edit sheet and the staff
 * table call this to lock the relevant controls up front. It is only a hint: the API enforces the
 * rule (`PATCH /api/admin/staff/:id` answers 409), and its message is what the UI shows then.
 */

/** True when `target` is the only `active` `ADMIN` in the current staff list. */
export function isLastActiveAdmin(
  target: StaffDTO,
  allStaff: readonly StaffDTO[],
): boolean {
  if (target.deletedAt || target.role !== "ADMIN" || target.status !== "active")
    return false;
  const activeAdmins = allStaff.filter(
    (s) => !s.deletedAt && s.role === "ADMIN" && s.status === "active",
  );
  return activeAdmins.length === 1 && activeAdmins[0]?.id === target.id;
}

export function isSelf(target: StaffDTO, me: AdminMeDTO): boolean {
  return target.id === me.user.id;
}

export interface StaffGuard {
  /** Role radio/select should be disabled. */
  roleLocked: boolean;
  /** Status select and the table's Block/Unblock action should be disabled. */
  statusLocked: boolean;
  /** Inline guard-rail message to show next to the locked controls, or null when nothing applies. */
  message: string | null;
}

export function staffGuard(
  target: StaffDTO,
  me: AdminMeDTO,
  allStaff: readonly StaffDTO[],
): StaffGuard {
  if (isLastActiveAdmin(target, allStaff)) {
    return {
      roleLocked: true,
      statusLocked: true,
      message: "You can't remove the last admin.",
    };
  }
  if (isSelf(target, me)) {
    return {
      roleLocked: true,
      statusLocked: true,
      message: "You can't change, block or delete your own account.",
    };
  }
  return { roleLocked: false, statusLocked: false, message: null };
}
