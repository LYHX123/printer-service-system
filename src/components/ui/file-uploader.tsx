"use client"

import { useRef, useState, type DragEvent } from "react"
import { UploadCloud, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void> | void
  label?: string
  disabled?: boolean
}

export function FileUploader({ onUpload, label = "Drag & drop an image, or click to browse", disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Only JPG, PNG, and WEBP images are allowed"
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return "File exceeds 5MB limit"
    }
    return null
  }

  async function handleFile(file: File) {
    const validationError = validate(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div>
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          if (!disabled && !uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setDragOver(false)
          if (disabled || uploading) return
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300",
          (disabled || uploading) && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        ) : (
          <UploadCloud className="h-6 w-6 text-slate-400" />
        )}
        <p className="text-xs text-slate-500">{uploading ? "Uploading…" : label}</p>
        <p className="text-xs text-slate-400">JPG, PNG, WEBP — max 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
