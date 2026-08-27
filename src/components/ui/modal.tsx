"use client"

import { type ReactNode, useEffect, useId } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { registerBackHandler, unregisterBackHandler } from "@/lib/platform/back-handler-stack"

type ModalSize = "sm" | "md" | "lg" | "xl"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: ModalSize
  footer?: ReactNode
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  // Priority 2 in the Android back-button stack (below MoreSheet) — see
  // AndroidBackHandler. No-ops on desktop (nothing ever calls handleBack()
  // there), so the existing Escape-key close above stays the desktop path.
  const backHandlerId = useId()
  useEffect(() => {
    if (!isOpen) return
    registerBackHandler(backHandlerId, 2, onClose)
    return () => unregisterBackHandler(backHandlerId)
  }, [isOpen, onClose, backHandlerId])

  if (!isOpen || typeof document === "undefined") return null

  const modal = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
        "sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
        className={cn(
          "relative w-full rounded-xl bg-white shadow-2xl",
          // dvh (not vh): on Android WebView, 100vh doesn't shrink when the
          // on-screen keyboard opens, so a vh-capped modal could extend
          // behind the keyboard with its footer (Save/Cancel) unreachable.
          // dvh tracks the actual visible viewport instead.
          "flex flex-col max-h-[90dvh]",
          SIZE_CLASSES[size]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-slate-200 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )

  // Portal to <body> so `fixed` positioning is always relative to the viewport,
  // even when a modal is opened from inside an animated (transformed) ancestor.
  return createPortal(modal, document.body)
}
