import Link from "next/link"
import { cn } from "@/lib/utils"

export interface TabItem {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  pathPrefix: string
  paramName?: string
}

export function Tabs({
  tabs,
  activeTab,
  pathPrefix,
  paramName = "tab",
}: TabsProps) {
  return (
    <div className="flex gap-0 border-b border-slate-200">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <Link
            key={tab.id}
            href={`${pathPrefix}?${paramName}=${tab.id}`}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
