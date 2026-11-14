"use client";

import {
  formatDateTime,
  ROLE_LABELS,
  type AdminMeDTO,
  type ApiResponse,
  type PermissionCatalogDTO,
  type StaffDTO,
  type StaffUpdateInput,
  type TemporaryPasswordDTO,
} from "@aricon/shared";
import { Ban, KeyRound, MailCheck, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/shop/status-badges";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  isLastActiveAdmin,
  isSelf,
  staffGuard,
} from "@/lib/admin/staff-guards";
import { apiClient } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-errors";
import { ConfirmDialog } from "./confirm-dialog";
import { StaffFormSheet } from "./staff-form-sheet";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";

export interface StaffTabProps {
  staff: StaffDTO[];
  catalog: PermissionCatalogDTO;
  me: AdminMeDTO;
}

type RowAction = { id: string; kind: "status" | "reset" | "delete" | "verify" };

/**
 * Staff & admins table (SPEC §10.8, ADMIN only). "Add staff" and "Reset password" show the
 * API-generated temporary password once; Block/Unblock is a `PATCH` of the status. The last-admin
 * and self rules lock controls up front, but the API enforces them and its message is shown.
 */
export function StaffTab({ staff, catalog, me }: StaffTabProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<StaffDTO | undefined>(undefined);
  // Bumped on every open so the sheet remounts with fresh form and permission state for whoever it
  // is opened for (instead of resetting that state inside an effect).
  const [sheetKey, setSheetKey] = useState(0);
  const [blockTarget, setBlockTarget] = useState<StaffDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffDTO | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffDTO | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<StaffDTO | null>(null);
  const [pending, setPending] = useState<RowAction | null>(null);
  const [tempPasswordOpen, setTempPasswordOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [tempPasswordFor, setTempPasswordFor] = useState("");

  function openCreate() {
    setSheetMode("create");
    setEditing(undefined);
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  }

  function openEdit(member: StaffDTO) {
    setSheetMode("edit");
    setEditing(member);
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  }

  function showTemporaryPassword(result: TemporaryPasswordDTO) {
    setTempPasswordFor(result.staff.name);
    setTempPassword(result.temporaryPassword);
    setTempPasswordOpen(true);
  }

  async function toggleStatus(member: StaffDTO) {
    if (pending) return;
    const blocking = member.status === "active";
    const body: StaffUpdateInput = { status: blocking ? "blocked" : "active" };
    setPending({ id: member.id, kind: "status" });
    try {
      await apiClient<ApiResponse<StaffDTO>>(`/admin/staff/${member.id}`, {
        method: "PATCH",
        body,
      });
      toast.success(
        blocking ? `${member.name} blocked` : `${member.name} unblocked`,
      );
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function resetPassword(member: StaffDTO) {
    if (pending) return;
    setPending({ id: member.id, kind: "reset" });
    try {
      const { data } = await apiClient<ApiResponse<TemporaryPasswordDTO>>(
        `/admin/staff/${member.id}/reset-password`,
        {
          method: "POST",
        },
      );
      toast.success("Password reset");
      showTemporaryPassword(data);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function markEmailVerified(member: StaffDTO) {
    if (pending) return;
    setPending({ id: member.id, kind: "verify" });
    try {
      await apiClient<ApiResponse<StaffDTO>>(
        `/admin/staff/${member.id}/verify-email`,
        { method: "POST" },
      );
      toast.success(`${member.name}'s email marked as verified`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function deleteStaff(member: StaffDTO) {
    if (pending) return;
    setPending({ id: member.id, kind: "delete" });
    try {
      await apiClient<ApiResponse<StaffDTO>>(`/admin/staff/${member.id}`, {
        method: "DELETE",
      });
      toast.success(`${member.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const visibleStaff = staff.filter((member) => !member.deletedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-700">
          {visibleStaff.length} staff member
          {visibleStaff.length === 1 ? "" : "s"}
        </p>
        <Button type="button" size="sm" onClick={openCreate}>
          Add staff
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-concrete-150 bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-concrete-150 bg-concrete-50 text-left text-xs text-cement">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Last login</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((member) => {
              const guard = staffGuard(member, me, staff);
              const last = isLastActiveAdmin(member, staff);
              const self = isSelf(member, me);
              const busy = pending?.id === member.id;
              const otherBusy = pending !== null && !busy;
              return (
                <tr
                  key={member.id}
                  className="border-b border-concrete-150 last:border-b-0 hover:bg-concrete-50"
                >
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {member.name}
                    {self ? (
                      <span className="ml-1.5 text-xs font-normal text-cement">
                        (you)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{member.email}</td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {ROLE_LABELS[member.role]}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill
                      tone={
                        member.deletedAt
                          ? "neutral"
                          : member.status === "active"
                            ? "success"
                            : "danger"
                      }
                      size="sm"
                    >
                      {member.deletedAt
                        ? "Deleted"
                        : member.status === "active"
                          ? "Active"
                          : "Blocked"}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">
                    {member.lastLoginAt
                      ? formatDateTime(member.lastLoginAt)
                      : "Never"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <>
                        <Tooltip content={`Edit ${member.name}`}>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={busy}
                              aria-label={`Edit ${member.name}`}
                              onClick={() => openEdit(member)}
                            >
                              <Pencil aria-hidden />
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip content={`Reset password for ${member.name}`}>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={
                                otherBusy || (busy && pending?.kind !== "reset")
                              }
                              loading={busy && pending?.kind === "reset"}
                              aria-label={`Reset password for ${member.name}`}
                              onClick={() => setResetTarget(member)}
                            >
                              <KeyRound aria-hidden />
                            </Button>
                          </span>
                        </Tooltip>
                        {me.user.role === "ADMIN" && !member.emailVerified ? (
                          <Tooltip content={`Mark email verified for ${member.name}`}>
                            <span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={
                                  otherBusy || (busy && pending?.kind !== "verify")
                                }
                                loading={busy && pending?.kind === "verify"}
                                aria-label={`Mark email verified for ${member.name}`}
                                onClick={() => setVerifyTarget(member)}
                              >
                                <MailCheck aria-hidden />
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                        <Tooltip
                          content={
                            guard.message ??
                            (member.status === "active"
                              ? `Block ${member.name}`
                              : `Unblock ${member.name}`)
                          }
                        >
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={
                                guard.statusLocked ||
                                otherBusy ||
                                (busy && pending?.kind !== "status")
                              }
                              loading={busy && pending?.kind === "status"}
                              aria-label={
                                member.status === "active"
                                  ? `Block ${member.name}`
                                  : `Unblock ${member.name}`
                              }
                              onClick={() => setBlockTarget(member)}
                            >
                              {member.status === "active" ? (
                                <Ban aria-hidden />
                              ) : (
                                <ShieldCheck aria-hidden />
                              )}
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip
                          content={guard.message ?? `Delete ${member.name}`}
                        >
                          <span>
                            <Button
                              type="button"
                              variant="destructive-outline"
                              size="icon"
                              disabled={
                                guard.statusLocked ||
                                otherBusy ||
                                (busy && pending?.kind !== "delete")
                              }
                              loading={busy && pending?.kind === "delete"}
                              aria-label={`Delete ${member.name}`}
                              onClick={() => setDeleteTarget(member)}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </span>
                        </Tooltip>
                      </>
                      {last ? (
                        <span className="text-xs text-cement">Last admin</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibleStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-cement">
                  No staff members to show.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <StaffFormSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        staffMember={editing}
        catalog={catalog}
        allStaff={staff}
        me={me}
        onCreated={showTemporaryPassword}
      />

      <ConfirmDialog
        open={blockTarget !== null}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        title={`${blockTarget?.status === "active" ? "Block" : "Unblock"} ${blockTarget?.name ?? ""}?`}
        description={
          blockTarget?.status === "active"
            ? "They will be signed out and no longer able to sign in to the admin panel."
            : "They will be able to sign in to the admin panel again."
        }
        confirmLabel={blockTarget?.status === "active" ? "Block" : "Unblock"}
        confirmVariant={
          blockTarget?.status === "active" ? "destructive" : "primary"
        }
        onConfirm={() => {
          if (blockTarget) void toggleStatus(blockTarget);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? ""}?`}
        description="They will no longer be able to sign in. Their order and audit history will be kept."
        confirmLabel="Delete staff member"
        confirmVariant="destructive"
        onConfirm={() => {
          if (deleteTarget) void deleteStaff(deleteTarget);
        }}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title={`Reset password for ${resetTarget?.name ?? ""}?`}
        description="They will be signed out, then sign in with a new temporary password and set their own at first login."
        confirmLabel="Reset password"
        confirmVariant="primary"
        onConfirm={() => {
          if (resetTarget) void resetPassword(resetTarget);
        }}
      />

      <ConfirmDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
        title={`Mark email verified for ${verifyTarget?.name ?? ""}?`}
        description="Only do this if you know the address belongs to them. They will be able to sign in without using the verification link."
        confirmLabel="Mark email verified"
        confirmVariant="primary"
        onConfirm={() => {
          if (verifyTarget) void markEmailVerified(verifyTarget);
        }}
      />

      <TemporaryPasswordDialog
        open={tempPasswordOpen}
        onOpenChange={setTempPasswordOpen}
        staffName={tempPasswordFor}
        password={tempPassword}
      />
    </div>
  );
}
