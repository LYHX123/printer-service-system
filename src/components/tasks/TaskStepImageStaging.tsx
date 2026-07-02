"use client"

import { type Dispatch, type SetStateAction } from "react"
import { X } from "lucide-react"
import { FileUploader } from "@/components/ui/file-uploader"
import { useLanguage } from "@/lib/i18n/LanguageContext"

export interface StagedImage {
  file: File
  previewUrl: string
}

interface TaskStepImageStagingProps {
  images: StagedImage[]
  onChange: Dispatch<SetStateAction<StagedImage[]>>
  disabled?: boolean
}

export function TaskStepImageStaging({ images, onChange, disabled }: TaskStepImageStagingProps) {
  const { t } = useLanguage()

  function addFile(file: File) {
    // Functional update: FileUploader may call this multiple times in quick succession
    // (one per selected file) before React re-renders, so a stale `images` closure would drop entries.
    onChange((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }])
  }

  function removeAt(index: number) {
    const target = images[index]
    URL.revokeObjectURL(target.previewUrl)
    onChange((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div>
      <FileUploader onUpload={addFile} label={t("taskUploadImages")} disabled={disabled} multiple />
      {images.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((img, i) => (
            <div key={img.previewUrl} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
              <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t("taskRemoveImage")}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
