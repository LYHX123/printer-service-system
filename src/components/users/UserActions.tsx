"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CheckCircle, ShieldCheck } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { updateUserRole, setUserActive, updateUserPermissions } from "@/lib/actions/users"
import { PermissionsEditor } from "@/components/users/PermissionsEditor"
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
}

export function UserActions({ userId, role, isActive, isSelf, modulePermissions }: UserActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [updatingRole, setUpdatingRole] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [tempPermissions, setTempPermissions] = useState<string[]>(modulePermissions)
  const [savingPermissions, setSavingPermissions] = useState(false)

  async function handleRoleChange(newRole: Role) {
    if (newRole === role) return
    setUpdatingRole(true)
    const result = await updateUserRole(userId, { role: newRole })
    setUpdatingRole(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(t("roleUpdated"))
    router.refresh()
  }

  async function handleToggleActive() {
    setSubmitting(true)
    const result = await setUserActive(userId, !isActive)
    setSubmitting(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(isActive ? t("userDisabled") : t("userEnabled"))
    setConfirmOpen(false)
    router.refresh()
  }

  async function handleSavePermissions() {
    setSavingPermissions(true)
    const result = await updateUserPermissions(userId, { modulePermissions: tempPermissions })
    setSavingPermissions(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(t("permissionsUpdated"))
    setPermissionsOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        value={role}
        disabled={isSelf || updatingRole}
        onChange={(e) => handleRoleChange(e.target.value as Role)}
        className="w-36 py-1.5 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>

      <Button
        variant="outline"
        size="sm"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        onClick={() => {
          setTempPermissions(modulePermissions)
          setPermissionsOpen(true)
        }}
      >
        {t("editPermissions")}
      </Button>

      {isActive ? (
        <Button
          variant="outline"
          size="sm"
          icon={<Ban className="h-3.5 w-3.5" />}
          onClick={() => setConfirmOpen(true)}
          disabled={isSelf}
        >
          {t("disable")}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          onClick={() => setConfirmOpen(true)}
        >
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
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={isActive ? "outline" : undefined}
              loading={submitting}
              onClick={handleToggleActive}
            >
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
            <Button type="button" variant="outline" onClick={() => setPermissionsOpen(false)} disabled={savingPermissions}>
              {t("cancel")}
            </Button>
            <Button type="button" loading={savingPermissions} onClick={handleSavePermissions}>
              {t("savePermissions")}
            </Button>
          </div>
        }
      >
        <PermissionsEditor
          permissions={tempPermissions}
          userRole={role}
          isSelf={isSelf}
          onChange={setTempPermissions}
        />
      </Modal>
    </div>
  )
}
