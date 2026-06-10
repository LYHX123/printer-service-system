"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CheckCircle } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { updateUserRole, setUserActive } from "@/lib/actions/users"
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
    toast.success("Role updated")
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
    toast.success(isActive ? "User disabled" : "User enabled")
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
          Disable
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          onClick={() => setConfirmOpen(true)}
        >
          Enable
        </Button>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isActive ? "Disable User" : "Enable User"}
        description={
          isActive
            ? "This user will no longer be able to log in. You can re-enable their account at any time."
            : "This user will regain access and be able to log in again."
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={isActive ? "outline" : undefined}
              loading={submitting}
              onClick={handleToggleActive}
            >
              {isActive ? "Disable User" : "Enable User"}
            </Button>
          </div>
        }
      >
        <div />
      </Modal>
    </div>
  )
}
