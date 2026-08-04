import { auth } from "@/lib/auth"
import { hasAnyPermission } from "@/lib/permissions"
import { getLowStockCount, getLowStockAlerts } from "@/lib/data/inventory"
import { getOverdueTasks, getActiveTaskCount, getOverdueTaskCount } from "@/lib/data/tasks"
import { getUnpaidSalesBalance, getLedgerMonthStats } from "@/lib/data/ledger"
import { getCurrentMonthShopExpense, getRecentShopAccountEntries } from "@/lib/data/shopAccount"
import {
  getCustomerDashboardMetrics,
  getQuotationDashboardMetrics,
  getInvoiceDashboardMetrics,
  getStockQuantityTotals,
  getRecentQuotations,
  getRecentInvoices,
  getRecentTasks,
  getRecentLedgerEntries,
  getRecentStockMovements,
  quotationsToActivity,
  invoicesToActivity,
  tasksToActivity,
  ledgerToActivity,
  shopAccountToActivity,
  stockToActivity,
  mergeRecentActivity,
} from "@/lib/data/dashboard"
import { DashboardHome } from "@/components/dashboard/DashboardHome"
import type { Role } from "@/types"

// Each module's own contribution to the merged Recent Activity feed is
// fetched shallow (4 rows) — the feed itself caps at 8 after merging, so
// fetching more per module than could ever survive the merge would be
// wasted work.
const RECENT_ACTIVITY_SOURCE_LIMIT = 4
const RECENT_ACTIVITY_TOTAL_LIMIT = 8

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user
  const role = user.role as Role
  const userId = user.id as string
  const companyId = user.companyId as string
  const modulePermissions = (user.modulePermissions as string[]) ?? []
  const firstName = user.name?.split(" ")[0] ?? ""

  const canViewCustomers = hasAnyPermission(role, modulePermissions, "customers.")
  const canViewQuotations = hasAnyPermission(role, modulePermissions, "quotations.")
  const canViewInvoice = hasAnyPermission(role, modulePermissions, "invoice.")
  const canViewStock = hasAnyPermission(role, modulePermissions, "stock.")
  const canViewTasks = hasAnyPermission(role, modulePermissions, "tasks.")
  // Bare "ledger." would also match "ledger.shop.*" (Shop Account is its own
  // sibling sub-module under the same namespace, not a subset of Ledger) —
  // a Shop-Account-only user would incorrectly get the whole Financial
  // Overview. Mirrors the Sidebar's own "/ledger" nav item, which already
  // has to solve this exact same collision (see Sidebar.tsx's permPrefix
  // "ledger.general.|ledger.sales."): only the general + sales books count
  // as "Ledger/Financial" access for Dashboard purposes.
  const canViewLedger =
    hasAnyPermission(role, modulePermissions, "ledger.general.") ||
    hasAnyPermission(role, modulePermissions, "ledger.sales.")
  const canViewShopAccountRaw = hasAnyPermission(role, modulePermissions, "ledger.shop.")
  // Shop Account and Ledger are independent modules (per Sidebar: separate nav
  // items, separate permPrefix). A Shop-Account-only user can still use the
  // Shop Account module itself, but nothing shop-financial is allowed onto
  // the Dashboard's company-wide Financial Overview without also holding
  // real Ledger/Financial access — so this flag (which drives both the Shop
  // Expense metric card and the Shop Account activity feed) requires both.
  const canViewShopAccount = canViewLedger && canViewShopAccountRaw

  const [
    customerMetrics,
    quotationMetrics,
    invoiceMetrics,
    activeTaskCount,
    overdueTaskCount,
    stockTotals,
    lowStockCount,
    lowStockAlerts,
    overdueTaskAlerts,
    unpaidSalesBalance,
    ledgerMonthStats,
    monthShopExpense,
    recentQuotations,
    recentInvoices,
    recentTasks,
    recentLedgerEntries,
    recentShopEntries,
    recentStockMovements,
  ] = await Promise.all([
    canViewCustomers ? getCustomerDashboardMetrics(companyId) : Promise.resolve(null),
    canViewQuotations ? getQuotationDashboardMetrics(companyId) : Promise.resolve(null),
    canViewInvoice ? getInvoiceDashboardMetrics(companyId) : Promise.resolve(null),
    canViewTasks ? getActiveTaskCount(companyId, userId, role) : Promise.resolve(null),
    canViewTasks ? getOverdueTaskCount(companyId, userId, role) : Promise.resolve(null),
    canViewStock ? getStockQuantityTotals(companyId) : Promise.resolve(null),
    canViewStock ? getLowStockCount(companyId) : Promise.resolve(null),
    canViewStock ? getLowStockAlerts(companyId) : Promise.resolve([]),
    canViewTasks ? getOverdueTasks(companyId, userId, role) : Promise.resolve([]),
    canViewLedger ? getUnpaidSalesBalance(companyId) : Promise.resolve(null),
    canViewLedger ? getLedgerMonthStats(companyId) : Promise.resolve(null),
    canViewShopAccount ? getCurrentMonthShopExpense(companyId) : Promise.resolve(null),
    canViewQuotations ? getRecentQuotations(companyId, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
    canViewInvoice ? getRecentInvoices(companyId, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
    canViewTasks ? getRecentTasks(companyId, userId, role, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
    canViewLedger ? getRecentLedgerEntries(companyId, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
    canViewShopAccount ? getRecentShopAccountEntries(companyId, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
    canViewStock ? getRecentStockMovements(companyId, RECENT_ACTIVITY_SOURCE_LIMIT) : Promise.resolve([]),
  ])

  // Pure in-memory merge of already permission-gated arrays — never an
  // extra query, and a module the user can't see contributes an empty
  // array so it can never appear in the merged feed.
  const recentActivity = mergeRecentActivity(
    [
      quotationsToActivity(recentQuotations),
      invoicesToActivity(recentInvoices),
      tasksToActivity(recentTasks),
      ledgerToActivity(recentLedgerEntries),
      shopAccountToActivity(recentShopEntries),
      stockToActivity(recentStockMovements),
    ],
    RECENT_ACTIVITY_TOTAL_LIMIT
  )

  return (
    <DashboardHome
      firstName={firstName}
      permissions={{
        customers: canViewCustomers,
        quotations: canViewQuotations,
        invoice: canViewInvoice,
        stock: canViewStock,
        tasks: canViewTasks,
        ledger: canViewLedger,
        shopAccount: canViewShopAccount,
      }}
      customerMetrics={customerMetrics}
      quotationMetrics={quotationMetrics}
      invoiceMetrics={invoiceMetrics}
      activeTaskCount={activeTaskCount}
      overdueTaskCount={overdueTaskCount}
      stockTotals={stockTotals}
      lowStockCount={lowStockCount}
      lowStockAlerts={lowStockAlerts}
      overdueTaskAlerts={overdueTaskAlerts}
      unpaidSalesBalance={unpaidSalesBalance}
      currentMonthIncome={ledgerMonthStats?.income ?? null}
      currentMonthExpense={ledgerMonthStats?.expense ?? null}
      currentMonthShopExpense={monthShopExpense}
      recentActivity={recentActivity}
    />
  )
}
