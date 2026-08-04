"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"
import {
  INITIALIZATION_MODULES,
  buildInitializationPlan,
  executeInitializationPlan,
  type InitializationModule,
  type InitializationPlan,
} from "@/lib/systemInit"

const CONFIRMATION_TEXT = "INITIALIZE"

function isValidModuleList(modules: unknown): modules is InitializationModule[] {
  return (
    Array.isArray(modules) &&
    modules.length > 0 &&
    modules.every((m) => (INITIALIZATION_MODULES as readonly string[]).includes(m as string))
  )
}

/**
 * ADMIN-only, regardless of the settings.* leaf permissions a non-admin
 * might hold — System Initialization is a distinct, higher-stakes action
 * than ordinary company-settings editing, so this checks the role directly
 * rather than reusing canManageSettings (which non-admin roles can be
 * granted). Never trust the client's own visibility gating.
 */
async function requireAdmin(): Promise<{ error: string } | { companyId: string; userId: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (session.user.role !== "ADMIN") return { error: "Forbidden — Admin only" }
  return { companyId: session.user.companyId as string, userId: session.user.id as string }
}

export interface PreviewResult {
  plan: InitializationPlan
}

/** Read-only. Never deletes anything — see buildInitializationPlan. */
export async function previewSystemInitialization(
  selectedModules: InitializationModule[],
  resetNumbering: boolean
): Promise<PreviewResult | { error: string }> {
  const auth_ = await requireAdmin()
  if ("error" in auth_) return auth_

  if (!isValidModuleList(selectedModules)) {
    return { error: "Please select at least one module to initialize." }
  }

  try {
    const plan = await buildInitializationPlan(prisma, auth_.companyId, selectedModules, resetNumbering)
    return { plan }
  } catch (error) {
    console.error("System Initialization preview failed:", error)
    return { error: "Failed to build the initialization preview." }
  }
}

export interface InitializeResult {
  effectiveModules: InitializationModule[]
  requiredModules: InitializationModule[]
  deletedCounts: Record<string, number>
  resetNumbering: boolean
  numberingNote: string
  completedAt: string
}

/**
 * Re-validates and re-builds the plan from scratch inside this request —
 * the client's own Preview result is never trusted as the source of truth
 * for what gets deleted, only as a UI convenience shown before this was
 * called. requires ADMIN, a non-empty valid module selection, and the exact
 * confirmation text; in production (NODE_ENV, checked server-side — never
 * inferred from anything the client sends) also requires the explicit
 * production acknowledgement checkbox.
 */
export async function initializeSystem(
  selectedModules: InitializationModule[],
  resetNumbering: boolean,
  confirmationText: string,
  productionAcknowledged: boolean
): Promise<InitializeResult | { error: string }> {
  const auth_ = await requireAdmin()
  if ("error" in auth_) return auth_
  const { companyId, userId } = auth_

  if (!isValidModuleList(selectedModules)) {
    return { error: "Please select at least one module to initialize." }
  }
  if (confirmationText !== CONFIRMATION_TEXT) {
    return { error: `Please type ${CONFIRMATION_TEXT} exactly to confirm.` }
  }
  if (process.env.NODE_ENV === "production" && !productionAcknowledged) {
    return { error: "You must acknowledge that this is a production database before continuing." }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Rebuilt fresh, inside the transaction — so the delete step below
      // acts on the exact same snapshot it just counted, and any change
      // made by another request between Preview and this click can't cause
      // the delete step to silently diverge from what's reported back.
      const plan = await buildInitializationPlan(tx, companyId, selectedModules, resetNumbering)
      const deletedCounts = await executeInitializationPlan(tx, plan)
      return { plan, deletedCounts }
    })

    const completedAt = new Date().toISOString()

    await logActivity({
      companyId,
      entityType: "SystemInitialization",
      entityId: companyId,
      action: "SYSTEM_INITIALIZED",
      performedById: userId,
      metadata: {
        environment: process.env.NODE_ENV ?? "unknown",
        selectedModules: result.plan.selectedModules,
        requiredModules: result.plan.requiredModules,
        effectiveModules: result.plan.effectiveModules,
        deletedCounts: result.deletedCounts,
        resetNumbering,
        completedAt,
      },
    })

    revalidatePath("/settings")
    revalidatePath("/dashboard")

    return {
      effectiveModules: result.plan.effectiveModules,
      requiredModules: result.plan.requiredModules,
      deletedCounts: result.deletedCounts,
      resetNumbering,
      numberingNote: result.plan.numberingNote,
      completedAt,
    }
  } catch (error) {
    console.error("System Initialization failed (transaction rolled back):", error)
    return { error: "Initialization failed — no data was deleted (the whole operation was rolled back)." }
  }
}
