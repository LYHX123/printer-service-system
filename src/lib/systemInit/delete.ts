import type { Prisma } from "@/generated/prisma/client"
import type { InitializationModule, InitializationPlan } from "./types"
import { GLOBAL_DELETE_ORDER, DOMAIN_TABLES } from "./types"

type Client = Prisma.TransactionClient

/**
 * Pre-steps that never delete a row — they only clear an optional
 * (nullable) cross-reference from a table OUTSIDE the modules this tool can
 * ever touch (the legacy, unlinked Jobs feature — see types.ts's header
 * note) into a table that's about to be deleted. Always safe: the
 * referencing row keeps its own data (JobPart.partName, ServiceJob's own
 * fields, etc.) and simply loses an optional "this used to point at X"
 * link. Run unconditionally whenever the target module is in the plan,
 * regardless of whether the referencing module happens to also be in scope
 * this run (a harmless no-op if those rows are about to be deleted anyway).
 */
async function runSetNullPreSteps(client: Client, companyId: string, effectiveModules: InitializationModule[]) {
  if (effectiveModules.includes("STOCK")) {
    await client.quotationItem.updateMany({ where: { partId: { not: null }, part: { companyId } }, data: { partId: null } })
    await client.invoiceItem.updateMany({ where: { partId: { not: null }, part: { companyId } }, data: { partId: null } })
    await client.jobPart.updateMany({ where: { partId: { not: null }, part: { companyId } }, data: { partId: null } })
  }
  if (effectiveModules.includes("QUOTATION")) {
    await client.serviceJob.updateMany({ where: { quotationId: { not: null }, quotation: { companyId } }, data: { quotationId: null } })
    await client.communicationLog.updateMany({ where: { quotationId: { not: null }, quotation: { companyId } }, data: { quotationId: null } })
  }
}

async function deleteTable(client: Client, table: string, companyId: string): Promise<number> {
  let result: { count: number }
  switch (table) {
    case "Customer": result = await client.customer.deleteMany({ where: { companyId } }); break
    case "CustomerBranch": result = await client.customerBranch.deleteMany({ where: { companyId } }); break
    case "CustomerDocument": result = await client.customerDocument.deleteMany({ where: { companyId } }); break
    case "CustomerContract": result = await client.customerContract.deleteMany({ where: { companyId } }); break
    case "CommunicationLog": result = await client.communicationLog.deleteMany({ where: { companyId } }); break
    case "Equipment": result = await client.equipment.deleteMany({ where: { companyId } }); break
    case "EquipmentPhoto": result = await client.equipmentPhoto.deleteMany({ where: { equipment: { companyId } } }); break
    case "MeterReading": result = await client.meterReading.deleteMany({ where: { equipment: { companyId } } }); break
    case "ServiceJob": result = await client.serviceJob.deleteMany({ where: { companyId } }); break
    case "JobPhoto": result = await client.jobPhoto.deleteMany({ where: { job: { companyId } } }); break
    case "RepairReport": result = await client.repairReport.deleteMany({ where: { job: { companyId } } }); break
    case "JobPart": result = await client.jobPart.deleteMany({ where: { report: { job: { companyId } } } }); break
    case "JobStatusLog": result = await client.jobStatusLog.deleteMany({ where: { job: { companyId } } }); break
    case "SparePart": result = await client.sparePart.deleteMany({ where: { companyId } }); break
    case "InventoryStock": result = await client.inventoryStock.deleteMany({ where: { part: { companyId } } }); break
    case "InventoryTransaction": result = await client.inventoryTransaction.deleteMany({ where: { companyId } }); break
    case "PurchaseOrder": result = await client.purchaseOrder.deleteMany({ where: { companyId } }); break
    case "PurchaseOrderItem": result = await client.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } }); break
    case "Quotation": result = await client.quotation.deleteMany({ where: { companyId } }); break
    case "QuotationItem": result = await client.quotationItem.deleteMany({ where: { quotation: { companyId } } }); break
    case "QuotationDocument": result = await client.quotationDocument.deleteMany({ where: { companyId } }); break
    case "QuotationVersion": result = await client.quotationVersion.deleteMany({ where: { companyId } }); break
    case "Invoice": result = await client.invoice.deleteMany({ where: { companyId } }); break
    case "InvoiceItem": result = await client.invoiceItem.deleteMany({ where: { invoice: { companyId } } }); break
    case "InvoiceDocument": result = await client.invoiceDocument.deleteMany({ where: { companyId } }); break
    case "LedgerEntry": result = await client.ledgerEntry.deleteMany({ where: { companyId } }); break
    case "SalesLedgerEntry": result = await client.salesLedgerEntry.deleteMany({ where: { companyId } }); break
    case "ReceiptAllocation": result = await client.receiptAllocation.deleteMany({ where: { ledgerEntry: { companyId } } }); break
    case "ShopAccountEntry": result = await client.shopAccountEntry.deleteMany({ where: { companyId } }); break
    case "Task": result = await client.task.deleteMany({ where: { companyId } }); break
    case "TaskParticipant": result = await client.taskParticipant.deleteMany({ where: { task: { companyId } } }); break
    case "TaskStep": result = await client.taskStep.deleteMany({ where: { task: { companyId } } }); break
    case "TaskStepImage": result = await client.taskStepImage.deleteMany({ where: { step: { task: { companyId } } } }); break
    default:
      throw new Error(`Unknown initialization table: ${table}`)
  }
  return result.count
}

/**
 * Executes an already-resolved plan inside the caller's transaction. Never
 * builds its own plan and never trusts one handed to it from outside this
 * module without having been recomputed fresh in the same request (see
 * actions/systemInit.ts) — this function just applies
 * plan.effectiveModules, in GLOBAL_DELETE_ORDER, using the same
 * company-scoped where-clauses the Preview counted with. If anything here
 * throws, the caller's prisma.$transaction rolls back everything — there is
 * no partial-initialization state.
 */
export async function executeInitializationPlan(
  client: Client,
  plan: InitializationPlan
): Promise<Record<string, number>> {
  const { companyId, effectiveModules } = plan
  await runSetNullPreSteps(client, companyId, effectiveModules)

  const deletedCounts: Record<string, number> = {}
  for (const mod of GLOBAL_DELETE_ORDER) {
    if (!effectiveModules.includes(mod)) continue
    for (const table of DOMAIN_TABLES[mod]) {
      deletedCounts[table] = await deleteTable(client, table, companyId)
    }
  }
  return deletedCounts
}
