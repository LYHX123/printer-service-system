"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info"

interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

interface ToastAPI {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI>({
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  function add(type: ToastType, message: string) {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4500
    )
  }

  const api: ToastAPI = {
    success: (m) => add("success", m),
    error: (m) => add("error", m),
    warning: (m) => add("warning", m),
    info: (m) => add("info", m),
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 top-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastAPI {
  return useContext(ToastContext)
}

// ─── Toast Item ───────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
}

const TOAST_ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const TOAST_ICON_COLOR: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: () => void
}) {
  const Icon = TOAST_ICONS[toast.type]

  return (
    <div
      role="alert"
      className={cn(
        "flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg",
        TOAST_STYLES[toast.type]
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TOAST_ICON_COLOR[toast.type])} />
      <p className="flex-1 text-sm font-medium leading-5">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
