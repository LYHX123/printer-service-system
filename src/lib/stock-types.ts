import type { PartCategory } from "@/types"

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
