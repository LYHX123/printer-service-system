"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CheckCircle } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { updateUserRole, setUserActive } from "@/lib/actions/users"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ROLE_LABELS } from "@/types"
import type { Role } from "@/types"

const ROLES: Role[] = ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"]

interface UserActionsProps {
  userId: string
  role: Role
  isActive: boolean
  isSelf: boolean
}

export function UserActions({ userId, role, isActive, isSelf }: UserActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [updatingRole, setUpdatingRole] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isActive ? t("disableUser") : t("enableUser")}
        description={
          isActive
            ? t("disableUserDesc")
            : t("enableUserDesc")
        }
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
    </div>
  )
}
