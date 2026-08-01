import { auth } from "@/lib/auth"
import { hasAnyPermission } from "@/lib/permissions"
import { getLowStockCount, getLowStockAlerts } from "@/lib/data/inventory"
import { getOverdueTasks, getActiveTaskCount } from "@/lib/data/tasks"
import { getUnpaidSalesBalance, getLedgerMonthStats } from "@/lib/data/ledger"
import { getCurrentMonthShopExpense, getRecentShopAccountEntries } from "@/lib/data/shopAccount"
import {
  getCustomerCount,
  getActiveQuotationCount,
  getInvoiceCount,
  getStockQuantityTotals,
  getRecentQuotations,
  getRecentInvoices,
} from "@/lib/data/dashboard"
import { DashboardHome } from "@/components/dashboard/DashboardHome"
import type { Role } from "@/types"

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
  const canViewLedger = hasAnyPermission(role, modulePermissions, "ledger.")
  const canViewShopAccount = hasAnyPermission(role, modulePermissions, "ledger.shop.")

  const [
    customerCount,
    activeQuotationCount,
    invoiceCount,
    activeTaskCount,
    stockTotals,
    lowStockCount,
    lowStockAlerts,
    overdueTaskAlerts,
    unpaidSalesBalance,
    ledgerMonthStats,
    monthShopExpense,
    recentQuotations,
    recentInvoices,
    recentShopEntries,
  ] = await Promise.all([
    canViewCustomers ? getCustomerCount(companyId) : Promise.resolve(null),
    canViewQuotations ? getActiveQuotationCount(companyId) : Promise.resolve(null),
    canViewInvoice ? getInvoiceCount(companyId) : Promise.resolve(null),
    canViewTasks ? getActiveTaskCount(companyId, userId, role) : Promise.resolve(null),
    canViewStock ? getStockQuantityTotals(companyId) : Promise.resolve(null),
    canViewStock ? getLowStockCount(companyId) : Promise.resolve(null),
    canViewStock ? getLowStockAlerts(companyId) : Promise.resolve([]),
    canViewTasks ? getOverdueTasks(companyId, userId, role) : Promise.resolve([]),
    canViewLedger ? getUnpaidSalesBalance(companyId) : Promise.resolve(null),
    canViewLedger ? getLedgerMonthStats(companyId) : Promise.resolve(null),
    canViewShopAccount ? getCurrentMonthShopExpense(companyId) : Promise.resolve(null),
    canViewQuotations ? getRecentQuotations(companyId) : Promise.resolve([]),
    canViewInvoice ? getRecentInvoices(companyId) : Promise.resolve([]),
    canViewShopAccount ? getRecentShopAccountEntries(companyId) : Promise.resolve([]),
  ])

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
      customerCount={customerCount}
      activeQuotationCount={activeQuotationCount}
      invoiceCount={invoiceCount}
      activeTaskCount={activeTaskCount}
      stockTotals={stockTotals}
      lowStockCount={lowStockCount}
      lowStockAlerts={lowStockAlerts}
      overdueTaskAlerts={overdueTaskAlerts}
      unpaidSalesBalance={unpaidSalesBalance}
      currentMonthIncome={ledgerMonthStats?.income ?? null}
      currentMonthExpense={ledgerMonthStats?.expense ?? null}
      currentMonthShopExpense={monthShopExpense}
      recentQuotations={recentQuotations}
      recentInvoices={recentInvoices}
      recentShopEntries={recentShopEntries}
    />
  )
}
