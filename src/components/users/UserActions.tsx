"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CheckCircle, ShieldCheck, Pencil, LockOpen } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import {
  updateUserRole,
  setUserActive,
  updateUserPermissions,
  unlockUser,
  updateUserProfile,
} from "@/lib/actions/users"
import { PermissionsEditor } from "@/components/users/PermissionsEditor"
import { UpdateUserProfileSchema, type UpdateUserProfileInput } from "@/lib/schemas"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ROLE_LABELS } from "@/types"
import type { Role } from "@/types"

const ROLES: Role[] = ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"]

interface UserActionsProps {
  userId: string
  role: Role
  isActive: boolean
  isSelf: boolean
  modulePermissions: string[]
  isLocked: boolean
  name: string
  username: string | null
  phone: string | null
  department: string | null
  position: string | null
}

export function UserActions({
  userId,
  role,
  isActive,
  isSelf,
  modulePermissions,
  isLocked,
  name,
  username,
  phone,
  department,
  position,
}: UserActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()

  const [updatingRole, setUpdatingRole] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [tempPermissions, setTempPermissions] = useState<string[]>(modulePermissions)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting: savingProfile },
  } = useForm<UpdateUserProfileInput>({
    resolver: zodResolver(UpdateUserProfileSchema) as Resolver<UpdateUserProfileInput>,
    defaultValues: {
      name,
      username: username ?? "",
      phone: phone ?? "",
      department: department ?? "",
      position: position ?? "",
      newPassword: "",
    },
  })

  async function handleRoleChange(newRole: Role) {
    if (newRole === role) return
    setUpdatingRole(true)
    const result = await updateUserRole(userId, { role: newRole })
    setUpdatingRole(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("roleUpdated"))
    router.refresh()
  }

  async function handleToggleActive() {
    setSubmitting(true)
    const result = await setUserActive(userId, !isActive)
    setSubmitting(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(isActive ? t("userDisabled") : t("userEnabled"))
    setConfirmOpen(false)
    router.refresh()
  }

  async function handleSavePermissions() {
    setSavingPermissions(true)
    const result = await updateUserPermissions(userId, { modulePermissions: tempPermissions })
    setSavingPermissions(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("permissionsUpdated"))
    setPermissionsOpen(false)
    router.refresh()
  }

  async function handleUnlock() {
    setUnlocking(true)
    const result = await unlockUser(userId)
    setUnlocking(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("userUnlocked"))
    setUnlockOpen(false)
    router.refresh()
  }

  async function handleSaveProfile(data: UpdateUserProfileInput) {
    const result = await updateUserProfile(userId, data)
    if (result?.error) { toast.error(result.error); return }
    toast.success(t("profileUpdated"))
    setEditOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Role selector */}
      <Select
        value={role}
        disabled={isSelf || updatingRole}
        onChange={(e) => handleRoleChange(e.target.value as Role)}
        className="w-36 py-1.5 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </Select>

      {/* Permissions */}
      <Button
        variant="outline"
        size="sm"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        onClick={() => { setTempPermissions(modulePermissions); setPermissionsOpen(true) }}
      >
        {t("editPermissions")}
      </Button>

      {/* Edit profile */}
      <Button
        variant="outline"
        size="sm"
        icon={<Pencil className="h-3.5 w-3.5" />}
        onClick={() => {
          reset({ name, username: username ?? "", phone: phone ?? "", department: department ?? "", position: position ?? "", newPassword: "" })
          setEditOpen(true)
        }}
      >
        {t("editProfile")}
      </Button>

      {/* Unlock (only when locked) */}
      {isLocked && (
        <Button
          variant="outline"
          size="sm"
          icon={<LockOpen className="h-3.5 w-3.5" />}
          onClick={() => setUnlockOpen(true)}
          className="text-amber-700 border-amber-300 hover:bg-amber-50"
        >
          {t("unlock")}
        </Button>
      )}

      {/* Disable / Enable */}
      {isActive ? (
        <Button variant="outline" size="sm" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => setConfirmOpen(true)} disabled={isSelf}>
          {t("disable")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" icon={<CheckCircle className="h-3.5 w-3.5" />} onClick={() => setConfirmOpen(true)}>
          {t("enable")}
        </Button>
      )}

      {/* Disable/Enable confirmation modal */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isActive ? t("disableUser") : t("enableUser")}
        description={isActive ? t("disableUserDesc") : t("enableUserDesc")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>{t("cancel")}</Button>
            <Button type="button" variant={isActive ? "outline" : undefined} loading={submitting} onClick={handleToggleActive}>
              {isActive ? t("disableUser") : t("enableUser")}
            </Button>
          </div>
        }
      >
        <div />
      </Modal>

      {/* Permissions modal */}
      <Modal
        isOpen={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        title={`${t("editPermissions")} / 编辑权限`}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPermissionsOpen(false)} disabled={savingPermissions}>{t("cancel")}</Button>
            <Button type="button" loading={savingPermissions} onClick={handleSavePermissions}>{t("savePermissions")}</Button>
          </div>
        }
      >
        <PermissionsEditor permissions={tempPermissions} userRole={role} isSelf={isSelf} onChange={setTempPermissions} />
      </Modal>

      {/* Unlock confirmation modal */}
      <Modal
        isOpen={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        title={t("unlockUser")}
        description={t("unlockUserDesc")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setUnlockOpen(false)} disabled={unlocking}>{t("cancel")}</Button>
            <Button type="button" loading={unlocking} onClick={handleUnlock}>{t("unlockUser")}</Button>
          </div>
        }
      >
        <div />
      </Modal>

      {/* Edit profile modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("editProfile")}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingProfile}>{t("cancel")}</Button>
            <Button type="submit" form="edit-profile-form" loading={savingProfile}>{t("saveProfile")}</Button>
          </div>
        }
      >
        <form id="edit-profile-form" onSubmit={handleSubmit(handleSaveProfile)} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t("fullName")} htmlFor="edit-name" required error={errors.name?.message}>
              <Input id="edit-name" placeholder="e.g. Jane Doe" {...register("name")} error={errors.name?.message} />
            </FormField>
            <FormField label={t("username")} htmlFor="edit-username" required error={errors.username?.message}>
              <Input id="edit-username" placeholder="e.g. jane_doe" autoComplete="off" {...register("username")} error={errors.username?.message} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label={t("phone")} htmlFor="edit-phone" error={errors.phone?.message}>
              <Input id="edit-phone" placeholder="+254700000000" {...register("phone")} error={errors.phone?.message} />
            </FormField>
            <FormField label={t("department")} htmlFor="edit-dept" error={errors.department?.message}>
              <Input id="edit-dept" placeholder="IT" {...register("department")} error={errors.department?.message} />
            </FormField>
            <FormField label={t("position")} htmlFor="edit-pos" error={errors.position?.message}>
              <Input id="edit-pos" placeholder="Engineer" {...register("position")} error={errors.position?.message} />
            </FormField>
          </div>
          <FormField label="New Password" htmlFor="edit-pwd" error={errors.newPassword?.message} hint="Leave blank to keep current password">
            <Input id="edit-pwd" type="password" placeholder="••••••••" autoComplete="new-password" {...register("newPassword")} error={errors.newPassword?.message} />
          </FormField>
        </form>
      </Modal>
    </div>
  )
}
