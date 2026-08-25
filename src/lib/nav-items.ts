import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BookOpen,
  UserCog,
  Settings,
  CheckSquare,
  Receipt,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { canAccess, hasAnyPermission, type Module } from "@/lib/permissions"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { Role } from "@/types"

// Single source of truth for the app's navigable modules — shared by the
// desktop Sidebar and the mobile bottom nav / "More" sheet so permission
// gating and route config are never defined twice.

export interface NavItem {
  href: string
  labelKey: TranslationKey | null
  label: string
  icon: LucideIcon
  exact?: boolean
  module: Module
  /** Overrides the module-level check with a specific leaf-permission prefix
   * (used where two nav rows share one Module, e.g. Ledger vs Shop Account). */
  permPrefix?: string
  /**
   * Extra route prefixes that should also count as this item being active.
   * Needed for Invoice: /invoice is just a redirect (see src/app/(dashboard)/invoice/page.tsx),
   * so the browser's real pathname always ends up under /quotations/invoices/** — without this,
   * the Quotations item (href "/quotations") would win that match instead of Invoice.
   */
  matchHrefs?: string[]
}

// One flat, ungrouped list — no more "Operations"/"Administration" section titles.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, module: "dashboard" },
  { href: "/customers", labelKey: "customers", label: "Customers", icon: Users, module: "customers" },
  { href: "/quotations", labelKey: "quotations", label: "Quotations", icon: FileText, module: "quotations" },
  { href: "/delivery", labelKey: "delivery", label: "Delivery", icon: Truck, module: "delivery" },
  { href: "/invoice", labelKey: "invoice", label: "Invoice", icon: Receipt, module: "invoice", matchHrefs: ["/quotations/invoices"] },
  { href: "/stock", labelKey: "inventory", label: "Stock", icon: Package, module: "inventory" },
  { href: "/ledger", labelKey: "ledger", label: "Ledger", icon: BookOpen, module: "ledger", permPrefix: "ledger.general.|ledger.sales." },
  { href: "/ledger/shop", labelKey: "shopAccount", label: "Shop Account", icon: Wallet, module: "ledger", permPrefix: "ledger.shop." },
  { href: "/tasks", labelKey: "tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
  { href: "/users", labelKey: "users", label: "Users", icon: UserCog, module: "users" },
  { href: "/settings", labelKey: "settings", label: "Settings", icon: Settings, module: "settings" },
]

/** hrefs of the items surfaced directly in the mobile bottom nav — everything
 * else (still permission-filtered the same way) shows up in the "More" sheet. */
export const MOBILE_PRIMARY_HREFS = ["/dashboard", "/stock", "/customers", "/tasks"]

export function isNavItemVisible(item: NavItem, role: Role, modulePermissions: string[]): boolean {
  if (item.permPrefix) {
    return item.permPrefix.split("|").some((prefix) => hasAnyPermission(role, modulePermissions, prefix))
  }
  return canAccess(role, item.module, modulePermissions)
}

export function matchesHref(href: string, exact: boolean | undefined, pathname: string): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Picks the active nav item using longest-prefix match across each item's
 * primary href plus any matchHrefs alternates. This handles two kinds of
 * overlap: nav items that share a module prefix (e.g. Ledger "/ledger" vs
 * Shop Account "/ledger/shop") and items whose real routes live under a
 * different item's URL space (e.g. Invoice pages under /quotations/invoices).
 * In both cases the most specific (longest) matching href wins, and only its
 * owning nav item is reported active — never two at once.
 */
export function getActiveHref(items: NavItem[], pathname: string): string | undefined {
  let best: { itemHref: string; matchedHrefLength: number } | undefined
  for (const item of items) {
    for (const href of [item.href, ...(item.matchHrefs ?? [])]) {
      if (!matchesHref(href, item.exact, pathname)) continue
      if (!best || href.length > best.matchedHrefLength) {
        best = { itemHref: item.href, matchedHrefLength: href.length }
      }
    }
  }
  return best?.itemHref
}

export function getVisibleNavItems(role: Role, modulePermissions: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(item, role, modulePermissions))
}
