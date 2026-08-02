"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Cloud, CloudOff, Link2, Unlink, RefreshCw, FolderCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { testDropboxConnection, initializeDropboxFolders, disconnectDropbox } from "@/lib/actions/dropbox"
import type { DropboxConnectionStatus } from "@/lib/dropbox"

interface DropboxIntegrationCardProps {
  status: DropboxConnectionStatus
  /** Set when redirected back from /api/dropbox/callback with ?dropboxConnected=1 or ?dropboxError=... */
  initialToast?: { type: "success" | "error"; message: string } | null
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DropboxIntegrationCard({ status, initialToast }: DropboxIntegrationCardProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<"test" | "init" | "disconnect" | null>(null)

  useEffect(() => {
    if (!initialToast) return
    if (initialToast.type === "success") toast.success(initialToast.message)
    else toast.error(initialToast.message)
    // Strip the query params so a page refresh doesn't re-show the toast.
    const url = new URL(window.location.href)
    url.searchParams.delete("dropboxConnected")
    url.searchParams.delete("dropboxError")
    window.history.replaceState({}, "", url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runAction(kind: "test" | "init" | "disconnect", action: () => Promise<{ error: string } | { success: true; accountName?: string | null }>) {
    setPendingAction(kind)
    startTransition(async () => {
      const result = await action()
      setPendingAction(null)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (kind === "test") {
        toast.success(t("dropboxConnectionSuccessful"))
      } else if (kind === "init") {
        toast.success(t("dropboxFoldersInitialized"))
      } else {
        toast.success(t("dropboxDisconnected"))
      }
      router.refresh()
    })
  }

  function handleDisconnect() {
    if (!window.confirm(`${t("dropboxDisconnectConfirmTitle")}\n\n${t("dropboxDisconnectConfirmDesc")}`)) return
    runAction("disconnect", disconnectDropbox)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        {status.connected ? (
          <Cloud className="h-5 w-5 text-blue-600" />
        ) : (
          <CloudOff className="h-5 w-5 text-slate-400" />
        )}
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("dropboxIntegration")}</h2>
          <p className="text-xs text-slate-500">{t("dropboxIntegrationDesc")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{t("dropboxConfiguration")}</p>
          <p className={`text-sm font-medium ${status.configured ? "text-green-700" : "text-red-600"}`}>
            {status.configured ? t("dropboxConfigured") : t("dropboxConfigMissing")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{t("dropboxConnectionStatus")}</p>
          <p className={`text-sm font-medium ${status.connected ? "text-green-700" : "text-slate-500"}`}>
            {status.connected ? t("dropboxConnected") : t("dropboxDisconnected")}
          </p>
        </div>
        {status.connected && (
          <>
            <div>
              <p className="text-xs font-medium text-slate-500">{t("dropboxAccount")}</p>
              <p className="text-sm text-slate-900">{status.accountName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{t("dropboxEmail")}</p>
              <p className="text-sm text-slate-900">{status.accountEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{t("dropboxLastConnected")}</p>
              <p className="text-sm text-slate-900">{formatDateTime(status.connectedAt)}</p>
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-slate-500">{t("dropboxRootFolder")}</p>
          <p className="text-sm text-slate-900 font-mono">{status.rootPath}</p>
        </div>
      </div>

      {!status.configured && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {t("dropboxConfigMissingDesc")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!status.connected ? (
          <a href={status.configured ? "/api/dropbox/connect" : undefined} aria-disabled={!status.configured}>
            <Button type="button" disabled={!status.configured} icon={<Link2 className="h-3.5 w-3.5" />}>
              {t("connectDropbox")}
            </Button>
          </a>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              loading={isPending && pendingAction === "test"}
              disabled={isPending}
              onClick={() => runAction("test", testDropboxConnection)}
            >
              {t("testConnection")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<FolderCog className="h-3.5 w-3.5" />}
              loading={isPending && pendingAction === "init"}
              disabled={isPending}
              onClick={() => runAction("init", initializeDropboxFolders)}
            >
              {t("initializeFolders")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Unlink className="h-3.5 w-3.5" />}
              loading={isPending && pendingAction === "disconnect"}
              disabled={isPending}
              onClick={handleDisconnect}
            >
              {t("disconnectDropbox")}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
