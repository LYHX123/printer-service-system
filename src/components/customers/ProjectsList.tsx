"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { setCustomerBranchActive } from "@/lib/actions/customerBranches"
import { ProjectFormModal } from "./ProjectFormModal"
import type { CustomerBranchDetail } from "@/lib/data/customerBranches"

interface ProjectsListProps {
  customerId: string
  projects: CustomerBranchDetail[]
  canManage: boolean
}

export function ProjectsList({ customerId, projects, canManage }: ProjectsListProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerBranchDetail | null>(null)
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null)

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(project: CustomerBranchDetail) {
    setEditing(project)
    setModalOpen(true)
  }

  function toggleActive(project: CustomerBranchDetail) {
    if (project.isActive && confirmingDeactivateId !== project.id) {
      setConfirmingDeactivateId(project.id)
      return
    }
    setConfirmingDeactivateId(null)
    startTransition(async () => {
      const result = await setCustomerBranchActive(customerId, project.id, !project.isActive)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(project.isActive ? "Project deactivated" : "Project reactivated")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{t("projectsAndContacts")}</h2>
        {canManage && (
          <Button type="button" variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openAdd}>
            {t("addProject")}
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{t("noProjectsYet")}</p>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    {!p.isActive && <Badge className="bg-slate-100 text-slate-500">{t("inactiveLabel")}</Badge>}
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-sm text-slate-600 sm:grid-cols-2">
                    <p>{p.contactPerson || "—"}</p>
                    <p>{p.phone || "—"}</p>
                    <p>{p.contactEmail || "—"}</p>
                    <p>{p.address || "—"}</p>
                  </div>
                  {p.notes && <p className="mt-1 text-xs text-slate-400">{p.notes}</p>}
                </div>

                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(p)}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={p.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                      loading={isPending}
                      onClick={() => toggleActive(p)}
                    >
                      {p.isActive ? t("deactivate") : t("reactivate")}
                    </Button>
                  </div>
                )}
              </div>

              {confirmingDeactivateId === p.id && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>{t("confirmDeactivateProject")}</span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="font-medium text-amber-900 underline"
                      onClick={() => toggleActive(p)}
                    >
                      {t("deactivate")}
                    </button>
                    <button
                      type="button"
                      className="text-amber-700"
                      onClick={() => setConfirmingDeactivateId(null)}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ProjectFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        customerId={customerId}
        project={editing}
      />
    </div>
  )
}
