import type { Prisma } from "@/generated/prisma/client"
import type { InitializationModule, InitializationPlan, RequiredModuleReason } from "./types"
import { INITIALIZATION_MODULES, MODULE_INFO, DOMAIN_TABLES, GLOBAL_DELETE_ORDER } from "./types"

type Client = Prisma.TransactionClient

/**
 * Company-wide existence checks that decide whether an already-selected
 * module forces another module to also be required. "Company-wide" is
 * correct here (not per-row/per-customer) because a module selection always
 * means "delete every row of this module for this company" — so e.g. once
 * CUSTOMER is selected, every Customer row in the company is going away, so
 * "does this company have any Quotation at all" is exactly the right
 * question for whether Quotation must also be selected.
 *
 * Each entry only fires when its trigger module is selected/required and
 * its target module isn't already selected/required, and only when the
 * live count is actually > 0 — an empty related table never forces
 * anything, so a user who only ever has (e.g.) Customers with no
 * Quotations can initialize Customer alone.
 */
async function findRequiredAdditions(
  client: Client,
  companyId: string,
  effective: Set<InitializationModule>
): Promise<RequiredModuleReason[]> {
  const additions: RequiredModuleReason[] = []

  if (effective.has("CUSTOMER") && !effective.has("QUOTATION")) {
    const count = await client.quotation.count({ where: { companyId } })
    if (count > 0) {
      additions.push({
        module: "QUOTATION",
        requiredBy: "CUSTOMER",
        affectedRecordCount: count,
        reasonEn: `Customer data is referenced by ${count} quotation(s). Quotation must also be initialized.`,
        reasonZh: `客户数据被 ${count} 个报价单引用，必须一并初始化报价单。`,
      })
    }
  }

  if (effective.has("CUSTOMER") && !effective.has("INVOICE")) {
    const count = await client.invoice.count({ where: { companyId } })
    if (count > 0) {
      additions.push({
        module: "INVOICE",
        requiredBy: "CUSTOMER",
        affectedRecordCount: count,
        reasonEn: `Customer data is referenced by ${count} invoice(s). Invoice must also be initialized.`,
        reasonZh: `客户数据被 ${count} 张发票引用，必须一并初始化发票。`,
      })
    }
  }

  if (effective.has("CUSTOMER") && !effective.has("LEDGER")) {
    const [ledgerCount, salesCount] = await Promise.all([
      client.ledgerEntry.count({ where: { companyId, customerId: { not: null } } }),
      client.salesLedgerEntry.count({ where: { companyId, customerId: { not: null } } }),
    ])
    const count = ledgerCount + salesCount
    if (count > 0) {
      additions.push({
        module: "LEDGER",
        requiredBy: "CUSTOMER",
        affectedRecordCount: count,
        reasonEn: `Customer data is referenced by ${count} ledger record(s). Ledger must also be initialized.`,
        reasonZh: `客户数据被 ${count} 条台账记录引用，必须一并初始化台账。`,
      })
    }
  }

  if (effective.has("QUOTATION") && !effective.has("INVOICE")) {
    const count = await client.invoice.count({ where: { companyId, quotationId: { not: null } } })
    if (count > 0) {
      additions.push({
        module: "INVOICE",
        requiredBy: "QUOTATION",
        affectedRecordCount: count,
        reasonEn: `${count} invoice(s) reference existing quotations. Invoice must also be initialized.`,
        reasonZh: `${count} 张发票引用了现有报价单，必须一并初始化发票。`,
      })
    }
  }

  if (effective.has("INVOICE") && !effective.has("LEDGER")) {
    const count = await client.salesLedgerEntry.count({ where: { companyId, invoiceId: { not: null } } })
    if (count > 0) {
      additions.push({
        module: "LEDGER",
        requiredBy: "INVOICE",
        affectedRecordCount: count,
        reasonEn: `${count} sales ledger record(s) reference existing invoices. Ledger must also be initialized.`,
        reasonZh: `${count} 条销售台账记录引用了现有发票，必须一并初始化台账。`,
      })
    }
  }

  return additions
}

async function countTable(client: Client, table: string, companyId: string): Promise<number> {
  switch (table) {
    case "Customer": return client.customer.count({ where: { companyId } })
    case "CustomerBranch": return client.customerBranch.count({ where: { companyId } })
    case "CustomerDocument": return client.customerDocument.count({ where: { companyId } })
    case "CustomerContract": return client.customerContract.count({ where: { companyId } })
    case "CommunicationLog": return client.communicationLog.count({ where: { companyId } })
    case "Equipment": return client.equipment.count({ where: { companyId } })
    case "EquipmentPhoto": return client.equipmentPhoto.count({ where: { equipment: { companyId } } })
    case "MeterReading": return client.meterReading.count({ where: { equipment: { companyId } } })
    case "ServiceJob": return client.serviceJob.count({ where: { companyId } })
    case "JobPhoto": return client.jobPhoto.count({ where: { job: { companyId } } })
    case "RepairReport": return client.repairReport.count({ where: { job: { companyId } } })
    case "JobPart": return client.jobPart.count({ where: { report: { job: { companyId } } } })
    case "JobStatusLog": return client.jobStatusLog.count({ where: { job: { companyId } } })
    case "SparePart": return client.sparePart.count({ where: { companyId } })
    case "InventoryStock": return client.inventoryStock.count({ where: { part: { companyId } } })
    case "InventoryTransaction": return client.inventoryTransaction.count({ where: { companyId } })
    case "PurchaseOrder": return client.purchaseOrder.count({ where: { companyId } })
    case "PurchaseOrderItem": return client.purchaseOrderItem.count({ where: { purchaseOrder: { companyId } } })
    case "Quotation": return client.quotation.count({ where: { companyId } })
    case "QuotationItem": return client.quotationItem.count({ where: { quotation: { companyId } } })
    case "QuotationDocument": return client.quotationDocument.count({ where: { companyId } })
    case "QuotationVersion": return client.quotationVersion.count({ where: { companyId } })
    case "Invoice": return client.invoice.count({ where: { companyId } })
    case "InvoiceItem": return client.invoiceItem.count({ where: { invoice: { companyId } } })
    case "InvoiceDocument": return client.invoiceDocument.count({ where: { companyId } })
    case "LedgerEntry": return client.ledgerEntry.count({ where: { companyId } })
    case "SalesLedgerEntry": return client.salesLedgerEntry.count({ where: { companyId } })
    case "ReceiptAllocation": return client.receiptAllocation.count({ where: { ledgerEntry: { companyId } } })
    case "ShopAccountEntry": return client.shopAccountEntry.count({ where: { companyId } })
    case "Task": return client.task.count({ where: { companyId } })
    case "TaskParticipant": return client.taskParticipant.count({ where: { task: { companyId } } })
    case "TaskStep": return client.taskStep.count({ where: { task: { companyId } } })
    case "TaskStepImage": return client.taskStepImage.count({ where: { step: { task: { companyId } } } })
    default:
      throw new Error(`Unknown initialization table: ${table}`)
  }
}

/**
 * Read-only — never writes. Resolves the full set of modules that will
 * actually be touched (selected ∪ required, fixed-point over
 * findRequiredAdditions since a requirement can itself trigger another,
 * e.g. Customer -> Quotation -> Invoice -> Ledger), then counts every table
 * in that effective set. Used by both the Preview step and — re-run fresh,
 * never trusting the client's copy — by the real Initialize step.
 */
export async function buildInitializationPlan(
  client: Client,
  companyId: string,
  selectedModules: InitializationModule[],
  resetNumbering: boolean
): Promise<InitializationPlan> {
  const selected = selectedModules.filter((m) => (INITIALIZATION_MODULES as readonly string[]).includes(m))
  const effective = new Set<InitializationModule>(selected)
  const requiredReasons: RequiredModuleReason[] = []

  // Fixed-point: at most `INITIALIZATION_MODULES.length` rounds could ever add something new.
  for (let round = 0; round < INITIALIZATION_MODULES.length; round++) {
    const additions = await findRequiredAdditions(client, companyId, effective)
    const newOnes = additions.filter((a) => !effective.has(a.module))
    if (newOnes.length === 0) break
    for (const a of newOnes) {
      effective.add(a.module)
      requiredReasons.push(a)
    }
  }

  const requiredModules = GLOBAL_DELETE_ORDER.filter((m) => effective.has(m) && !selected.includes(m))
  const effectiveModules = GLOBAL_DELETE_ORDER.filter((m) => effective.has(m))

  const recordCounts: Record<string, number> = {}
  for (const mod of effectiveModules) {
    for (const table of DOMAIN_TABLES[mod]) {
      recordCounts[table] = await countTable(client, table, companyId)
    }
  }

  const selectedLabels = effectiveModules.map((m) => MODULE_INFO[m].labelEn).join(", ")
  const numberingNote = resetNumbering
    ? `Customer and Stock use a count-based number generator (CUST-0001, PRT-00001) that already restarts from 1 automatically once all rows in that module are deleted — no separate counter exists to reset. Quotation and Invoice numbers are entered manually by the user (no generated counter at all). Reset Business Numbering has nothing additional to do for: ${selectedLabels || "(none selected)"}.`
    : "Reset Business Numbering was not selected — no numbering changes."

  return {
    companyId,
    selectedModules: selected,
    requiredModules,
    requiredReasons,
    effectiveModules,
    recordCounts,
    resetNumbering,
    numberingNote,
  }
}
