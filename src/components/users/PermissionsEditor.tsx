"use client"

import { useEffect, useRef } from "react"
import { PERMISSION_TREE, ALL_PERMISSIONS, isSelfProtectedPermission } from "@/lib/permissions"
import { Collapsible } from "@/components/ui/collapsible"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface PermTreeNode {
  key: string
  en: string
  zh: string
  leaves?: { key: string; en: string; zh: string }[]
  children?: PermTreeNode[]
}

interface PermissionsEditorProps {
  permissions: string[]
  userRole: string
  isSelf: boolean
  onChange: (permissions: string[]) => void
}

function leavesOf(node: PermTreeNode): string[] {
  const own = node.leaves?.map((l) => l.key) ?? []
  const nested = node.children?.flatMap(leavesOf) ?? []
  return [...own, ...nested]
}

function TriCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
    />
  )
}

export function PermissionsEditor({ permissions, userRole, isSelf, onChange }: PermissionsEditorProps) {
  const { t, language } = useLanguage()
  const isAdmin = userRole === "ADMIN"
  // Empty array means "full access" (back-compat) — reflect that as all-checked in the UI too.
  const effective = isAdmin || permissions.length === 0 ? ALL_PERMISSIONS : permissions

  function setLeaves(keys: string[], value: boolean) {
    if (isAdmin) return
    const lockedOn = isSelf ? keys.filter(isSelfProtectedPermission) : []
    const next = new Set(permissions.length === 0 ? ALL_PERMISSIONS : permissions)
    if (value) {
      keys.forEach((k) => next.add(k))
    } else {
      keys.forEach((k) => {
        if (!(isSelf && isSelfProtectedPermission(k))) next.delete(k)
      })
      lockedOn.forEach((k) => next.add(k)) // keep self-protected leaves on regardless
    }
    onChange([...next])
  }

  function renderLeaf(leaf: { key: string; en: string; zh: string }) {
    const checked = effective.includes(leaf.key)
    const disabled = isAdmin || (isSelf && isSelfProtectedPermission(leaf.key))
    return (
      <label
        key={leaf.key}
        className={[
          "flex items-center gap-2 rounded px-2 py-1 text-sm select-none",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50",
        ].join(" ")}
      >
        <TriCheckbox checked={checked} indeterminate={false} disabled={disabled} onChange={() => setLeaves([leaf.key], !checked)} />
        <span>
          {leaf.en}
          {language === "zh" && <span className="ml-1 text-xs text-slate-400">{leaf.zh}</span>}
        </span>
      </label>
    )
  }

  function renderNode(node: PermTreeNode, depth: number) {
    const allLeaves = leavesOf(node)
    const checkedCount = allLeaves.filter((k) => effective.includes(k)).length
    const allChecked = checkedCount === allLeaves.length
    const noneChecked = checkedCount === 0
    const disabled = isAdmin
    const header = (
      <label
        className={["flex items-center gap-2 text-sm font-medium text-slate-800", disabled ? "opacity-60" : "cursor-pointer"].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <TriCheckbox
          checked={allChecked}
          indeterminate={!allChecked && !noneChecked}
          disabled={disabled}
          onChange={() => setLeaves(allLeaves, !allChecked)}
        />
        <span>
          {node.en}
          {language === "zh" && <span className="ml-1 text-xs font-normal text-slate-400">{node.zh}</span>}
        </span>
      </label>
    )

    // Single-leaf, no-children nodes (Dashboard, Jobs) render as a flat row — nothing to expand.
    if (!node.children && node.leaves && node.leaves.length === 1) {
      return <div key={node.key} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">{header}</div>
    }

    return (
      <Collapsible key={node.key} header={header} defaultOpen={depth === 0 && !!node.children}>
        {node.children
          ? node.children.map((child) => renderNode(child, depth + 1))
          : node.leaves!.map(renderLeaf)}
      </Collapsible>
    )
  }

  return (
    <div className="space-y-2">
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
      <div className="space-y-1.5">
        {PERMISSION_TREE.map((node) => renderNode(node, 0))}
      </div>
    </div>
  )
}
