"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { FileUploader } from "@/components/ui/file-uploader"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { format } from "date-fns"
import type { JobPhoto, PhotoType, User } from "@/types"

interface PhotoSectionProps {
  jobId: string
  photoType: PhotoType
  title: string
  photos: (JobPhoto & { uploadedBy: Pick<User, "id" | "name"> })[]
  canDelete: boolean
}

export function PhotoSection({ jobId, photoType, title, photos, canDelete }: PhotoSectionProps) {
  const router = useRouter()
  const toast = useToast()
  const [caption, setCaption] = useState("")
  const [lightbox, setLightbox] = useState<(JobPhoto & { uploadedBy: Pick<User, "id" | "name"> }) | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleUpload(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("photoType", photoType)
    if (caption) formData.append("caption", caption)

    const res = await fetch(`/api/jobs/${jobId}/photos`, {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Failed to upload photo")
      return
    }

    setCaption("")
    toast.success("Photo uploaded")
    router.refresh()
  }

  async function handleDelete(photoId: string) {
    if (!confirm("Delete this photo? This cannot be undone.")) return
    setDeletingId(photoId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/photos/${photoId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Failed to delete photo")
        return
      }
      setLightbox(null)
      toast.success("Photo deleted")
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>

      {photos.length < 10 && (
        <div className="mb-4 space-y-2">
          <Input
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <FileUploader onUpload={handleUpload} label={`Upload ${title.toLowerCase()} photo`} />
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No {title.toLowerCase()} yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightbox(photo)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"
            >
              <img
                src={photo.fileUrl}
                alt={photo.caption ?? title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {photo.caption && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-left text-[10px] text-white">
                  {photo.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox?.caption || title}
        size="lg"
      >
        {lightbox && (
          <div className="space-y-3">
            <img src={lightbox.fileUrl} alt={lightbox.caption ?? title} className="w-full rounded-lg" />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Uploaded by {lightbox.uploadedBy.name} on {format(new Date(lightbox.createdAt), "dd MMM yyyy, HH:mm")}
              </span>
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  loading={deletingId === lightbox.id}
                  onClick={() => handleDelete(lightbox.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
