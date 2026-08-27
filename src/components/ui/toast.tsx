"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppMode } from "@/components/platform/AppModeProvider"
import { useLanguage } from "@/lib/i18n/LanguageContext"

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
  const isAppMode = useAppMode()
  const { language } = useLanguage()

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

  // Safety net for actions that fail before they ever reach their own
  // try/catch + toast.error (a genuine network drop mid-fetch, e.g.) — a
  // truly unhandled rejection today leaves the submit button correctly
  // un-stuck (react-hook-form resets isSubmitting either way) but the user
  // gets no explanation at all. Anything already caught elsewhere never
  // reaches this listener, so it can't double up with an existing message.
  useEffect(() => {
    function handleUnhandledRejection() {
      add("error", language === "zh" ? "网络错误，请重试" : "Network error, please try again")
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection)
  }, [language])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className={cn(
          "fixed right-4 z-50 flex flex-col gap-2",
          // Clears the fixed app-mode top bar + status bar safe area.
          isAppMode ? "top-[calc(4.25rem+env(safe-area-inset-top))]" : "top-4"
        )}
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
        // max-w-80 (not a fixed w-80): the container only pins the right
        // edge (`right-4`, no matching `left`), so a fixed width could run
        // past the left edge on narrow phones. w-[calc(100vw-2rem)] caps it
        // to the viewport with the same 1rem margin on both sides instead.
        "flex w-[calc(100vw-2rem)] max-w-80 items-start gap-3 rounded-lg border p-4 shadow-lg",
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
