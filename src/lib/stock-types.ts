import type { PartCategory } from "@/types"
import type { TranslationKey } from "@/lib/i18n/translations"

/**
 * UI-facing stock buckets. The underlying PartCategory enum (11 values) is kept
 * unchanged in the database — this is purely a display/grouping layer so the
 * Stock module can present 3 simple categories instead of 11.
 */
export type StockType = "EQUIPMENT" | "CONSUMPTION" | "PARTS"

export const STOCK_TYPES: StockType[] = ["EQUIPMENT", "CONSUMPTION", "PARTS"]

export const STOCK_TYPE_LABELS: Record<StockType, string> = {
  EQUIPMENT: "Equipment",
  CONSUMPTION: "Consumption",
  PARTS: "Parts",
}

export const CATEGORIES_FOR_STOCK_TYPE: Record<StockType, PartCategory[]> = {
  EQUIPMENT: ["LAPTOP_PART", "DESKTOP_PART", "CCTV_PART", "PROJECTOR_PART"],
  CONSUMPTION: ["TONER", "DRUM", "DEVELOPER", "FUSER", "MAINTENANCE_KIT", "ROLLER"],
  PARTS: ["GENERAL"],
}

export const CATEGORY_TO_STOCK_TYPE: Record<PartCategory, StockType> = STOCK_TYPES.reduce(
  (acc, stockType) => {
    for (const category of CATEGORIES_FOR_STOCK_TYPE[stockType]) acc[category] = stockType
    return acc
  },
  {} as Record<PartCategory, StockType>
)

export function getStockType(category: PartCategory): StockType {
  return CATEGORY_TO_STOCK_TYPE[category]
}

/** Default low-stock alert thresholds by stock type. Quantity at or below this triggers a low-stock alert. */
export const LOW_STOCK_THRESHOLDS: Record<StockType, number> = {
  EQUIPMENT: 2,
  CONSUMPTION: 5,
  PARTS: 2,
}

export function getLowStockThreshold(category: PartCategory): number {
  return LOW_STOCK_THRESHOLDS[getStockType(category)]
}

/** Category used when creating a new item under a given stock type (DB enum value stays hidden from the UI). */
export const DEFAULT_CATEGORY_FOR_STOCK_TYPE: Record<StockType, PartCategory> = {
  EQUIPMENT: "LAPTOP_PART",
  CONSUMPTION: "TONER",
  PARTS: "GENERAL",
}

export function isStockType(value: string | undefined): value is StockType {
  return STOCK_TYPES.includes(value as StockType)
}

/** Equipment items are described by Model; Consumption/Parts items by Item Name. */
export function itemNameTranslationKey(stockType: StockType): "model" | "itemName" {
  return stockType === "EQUIPMENT" ? "model" : "itemName"
}

const STOCK_TYPE_COUNT_LABELS: Record<StockType, { singular: TranslationKey; plural: TranslationKey }> = {
  EQUIPMENT: { singular: "unitSingular", plural: "unitPlural" },
  CONSUMPTION: { singular: "consumableSingular", plural: "consumablePlural" },
  PARTS: { singular: "part", plural: "parts" },
}

/** Translation key for the "N Unit(s)/Consumable(s)/Part(s)" count label, by stock type and count. */
export function stockCountTranslationKey(stockType: StockType, count: number): TranslationKey {
  const labels = STOCK_TYPE_COUNT_LABELS[stockType]
  return count === 1 ? labels.singular : labels.plural
}

/** A spare part whose quantity has dropped to or below its category's low-stock threshold. */
export type LowStockAlert = {
  id: string
  stockType: StockType
  brand: string | null
  name: string
  quantity: number
  threshold: number
  isOutOfStock: boolean
}
