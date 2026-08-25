"use client"

import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { UploadCloud, Loader2, FileText, X as XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_SIZE } from "@/lib/constants"

export interface FileDropzoneProps {
  /** `accept` attribute for the hidden input, e.g. ALLOWED_IMAGE_TYPES.join(","). */
  accept?: string
  /** MIME whitelist used for client-side validation. Defaults to ALLOWED_IMAGE_TYPES. */
  allowedTypes?: string[]
  multiple?: boolean
  disabled?: boolean
  /** Only enforced when `multiple` is true. */
  maxFiles?: number
  maxSize?: number
  /** Files chosen or dropped this interaction (already validated). */
  onFilesSelected: (files: File[]) => void
  /** Optional controlled list rendered below the dropzone with per-file remove buttons. */
  value?: File[]
  onRemove?: (index: number) => void
  loading?: boolean
  /** Small hint line under the main label, e.g. "JPG, PNG, WEBP — max 5MB". */
  helperText?: string
  /** Externally supplied error (e.g. server response) shown alongside validation errors. */
  error?: string
  label?: string
  compact?: boolean
  /** Even tighter than `compact` — drops the "click to browse" subtext and shrinks padding further. Opt-in only; existing `compact` callers are unaffected. */
  dense?: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({
  accept,
  allowedTypes = ALLOWED_IMAGE_TYPES,
  multiple = false,
  disabled,
  maxFiles,
  maxSize = MAX_PHOTO_SIZE,
  onFilesSelected,
  value,
  onRemove,
  loading,
  helperText,
  error,
  label,
  compact,
  dense,
  className,
}: FileDropzoneProps) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const [dragOver, setDragOver] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const inputId = useId()
  const busy = Boolean(disabled || loading)
  const resolvedAccept = accept ?? allowedTypes.join(",")

  function validate(files: File[]): { valid: File[]; error: string | null } {
    const incoming = multiple ? files : files.slice(0, 1)

    if (multiple && maxFiles && (value?.length ?? 0) + incoming.length > maxFiles) {
      return { valid: [], error: t("tooManyFiles") }
    }
    for (const file of incoming) {
      if (allowedTypes.length && !allowedTypes.includes(file.type)) {
        return { valid: [], error: t("invalidFileType") }
      }
      if (maxSize && file.size > maxSize) {
        return { valid: [], error: t("fileTooLarge") }
      }
    }
    return { valid: incoming, error: null }
  }

  function handleIncoming(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return
    const { valid, error: validationError } = validate(files)
    if (validationError) {
      setInternalError(validationError)
      return
    }
    setInternalError(null)
    onFilesSelected(valid)
  }

  function openPicker() {
    if (!busy) inputRef.current?.click()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      openPicker()
    }
  }

  function resetDrag() {
    dragCounter.current = 0
    setDragOver(false)
  }

  const displayError = error ?? internalError

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-describedby={helperText ? `${inputId}-helper` : undefined}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(e: DragEvent) => {
          e.preventDefault()
          if (busy) return
          dragCounter.current += 1
          if (e.dataTransfer.types.includes("Files")) setDragOver(true)
        }}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
        }}
        onDragLeave={(e: DragEvent) => {
          e.preventDefault()
          dragCounter.current = Math.max(0, dragCounter.current - 1)
          if (dragCounter.current === 0) setDragOver(false)
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          resetDrag()
          if (busy) return
          const files = e.dataTransfer.files
          if (files?.length) handleIncoming(files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors cursor-pointer",
          dense ? "p-2.5" : compact ? "p-4" : "p-6",
          dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300",
          displayError && !dragOver && "border-red-300",
          busy && "pointer-events-none opacity-60"
        )}
      >
        {loading ? (
          <Loader2 className={cn("animate-spin text-slate-400", dense ? "h-4 w-4" : compact ? "h-5 w-5" : "h-6 w-6")} />
        ) : (
          <UploadCloud className={cn("text-slate-400", dense ? "h-4 w-4" : compact ? "h-5 w-5" : "h-6 w-6")} />
        )}
        <p className="text-xs font-medium text-slate-600">{label ?? t("dragDropFiles")}</p>
        {!dense && <p className="text-xs text-slate-400">{t("clickToBrowse")}</p>}
        {helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-slate-400">
            {helperText}
          </p>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={resolvedAccept}
          multiple={multiple}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files
            if (files?.length) handleIncoming(files)
            e.target.value = ""
          }}
        />
      </div>

      {displayError && <p className="mt-2 text-xs text-red-600">{displayError}</p>}

      {value && value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{file.name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{formatFileSize(file.size)}</span>
              {onRemove && (
                <button
                  type="button"
                  aria-label={t("removeFile")}
                  onClick={() => onRemove(i)}
                  disabled={busy}
                  className="shrink-0 text-slate-400 hover:text-red-600"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
