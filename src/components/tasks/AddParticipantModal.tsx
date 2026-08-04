"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addTaskParticipants } from "@/lib/actions/tasks"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { cn } from "@/lib/utils"

interface UserOption {
  id: string
  name: string
  role: string
}

interface AddParticipantModalProps {
  isOpen: boolean
  onClose: () => void
  taskId: string
  /** Active, same-company users — already excludes anyone already on the task. */
  candidateUsers: UserOption[]
}

export function AddParticipantModal({ isOpen, onClose, taskId, candidateUsers }: AddParticipantModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setSelectedIds(new Set())
    setSearch("")
  }

  function handleClose() {
    reset()
    onClose()
  }

  function toggleUser(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    const result = await addTaskParticipants(taskId, { userIds: Array.from(selectedIds) })
    setSubmitting(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(t("participantAddedSuccess"))
    reset()
    onClose()
    router.refresh()
  }

  const filteredUsers = candidateUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("addParticipant")}
      description={t("addParticipantModalDesc")}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="button" loading={submitting} disabled={selectedIds.size === 0} onClick={handleSubmit}>
            {t("addParticipant")}
          </Button>
        </div>
      }
    >
      <Input
        placeholder={t("taskSearchStaff")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2"
      />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {candidateUsers.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">{t("allUsersAlreadyParticipants")}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-400">{t("taskNoUsersFound")}</p>
        ) : (
          filteredUsers.map((u) => {
            const checked = selectedIds.has(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUser(u.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  checked ? "bg-blue-50" : "hover:bg-slate-50"
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                  )}
                >
                  {checked && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="font-medium text-slate-900">{u.name}</span>
                <span className="ml-auto text-xs text-slate-400 capitalize">{u.role.toLowerCase()}</span>
              </button>
            )
          })
        )}
      </div>
    </Modal>
  )
}
