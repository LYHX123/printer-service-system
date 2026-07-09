"use client"

import { ALL_MODULES, MODULE_LABELS, ADMIN_SELF_PROTECTED } from "@/lib/permissions"
import type { Module } from "@/lib/permissions"
import type { Role } from "@/types"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface PermissionsEditorProps {
  permissions: string[]
  userRole: Role
  isSelf: boolean
  onChange: (permissions: string[]) => void
}

export function PermissionsEditor({ permissions, userRole, isSelf, onChange }: PermissionsEditorProps) {
  const { t, language } = useLanguage()
  const isAdmin = userRole === "ADMIN"

  function toggle(module: Module) {
    if (isAdmin) return
    if (isSelf && ADMIN_SELF_PROTECTED.includes(module)) return
    const next = permissions.includes(module)
      ? permissions.filter((p) => p !== module)
      : [...permissions, module]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t("adminFullAccess")}
        </p>
      )}
      {!isAdmin && isSelf && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          {t("selfProtectedModules")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_MODULES.map((module) => {
          const checked = isAdmin || permissions.length === 0 || permissions.includes(module)
          const disabled = isAdmin || (isSelf && ADMIN_SELF_PROTECTED.includes(module))
          const labels = MODULE_LABELS[module]

          return (
            <label
              key={module}
              className={[
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm select-none transition-colors",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                checked
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(module)}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="leading-none">
                <span className="font-medium">{labels.en}</span>
                {language === "zh" && (
                  <span className="ml-1 text-xs text-slate-400">{labels.zh}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
