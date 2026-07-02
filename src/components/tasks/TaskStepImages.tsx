"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { TaskStepImageItem } from "@/lib/data/tasks"

interface TaskStepImagesProps {
  stepId: string
  images: TaskStepImageItem[]
  canManage: boolean
}

export function TaskStepImages({ stepId, images, canManage }: TaskStepImagesProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [lightbox, setLightbox] = useState<TaskStepImageItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (images.length === 0) return null

  async function handleDelete(imageId: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/tasks/steps/${stepId}/images/${imageId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Failed to delete image")
        return
      }
      setLightbox(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {t("taskImagesLabel")}
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(img)}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200"
          >
            <img
              src={img.url}
              alt={img.filename}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Modal
        isOpen={!!lightbox}
        onClose={() => setLightbox(null)}
        title={t("taskImagePreview")}
        size="lg"
      >
        {lightbox && (
          <div className="space-y-3">
            <img src={lightbox.url} alt={lightbox.filename} className="w-full rounded-lg" />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {t("taskBy")} {lightbox.uploadedBy.name} · {format(new Date(lightbox.createdAt), "dd MMM yyyy, HH:mm")}
              </span>
              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  loading={deleting}
                  onClick={() => handleDelete(lightbox.id)}
                >
                  {t("taskRemoveImage")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
