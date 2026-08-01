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

/**
 * Single source of truth for the Equipment/Consumption/Parts list table's column
 * widths + alignment. All three stock types render through the same list page,
 * so this is naturally shared — defined once here rather than duplicated so the
 * three views can never drift apart.
 */
export const STOCK_TABLE_COLUMNS = {
  picture: { width: "8%", align: "center" as const },
  brand: { width: "11%", align: "left" as const },
  name: { width: "17%", align: "left" as const },
  model: { width: "15%", align: "left" as const },
  specification: { width: "23%", align: "left" as const },
  quantity: { width: "9%", align: "center" as const },
  status: { width: "9%", align: "center" as const },
  actions: { width: "150px", align: "center" as const },
} satisfies Record<string, { width: string; align: "left" | "center" | "right" }>

/** Builds the shared `w-[...] text-{align}` class for a STOCK_TABLE_COLUMNS entry. */
export function stockColumnClass(col: keyof typeof STOCK_TABLE_COLUMNS): string {
  const { width, align } = STOCK_TABLE_COLUMNS[col]
  return `w-[${width}] text-${align}`
}

/** Translation key for the "Add X Item" button/page title, by stock type. */
export const ADD_ITEM_TRANSLATION_KEYS: Record<StockType, TranslationKey> = {
  EQUIPMENT: "addEquipmentItem",
  CONSUMPTION: "addConsumptionItem",
  PARTS: "addPartItem",
}

/** Translation keys for the list empty state (title + description), by stock type. */
export const EMPTY_STATE_TRANSLATION_KEYS: Record<StockType, { title: TranslationKey; description: TranslationKey }> = {
  EQUIPMENT: { title: "equipmentEmptyTitle", description: "equipmentEmptyDesc" },
  CONSUMPTION: { title: "consumptionEmptyTitle", description: "consumptionEmptyDesc" },
  PARTS: { title: "partsEmptyTitle", description: "partsEmptyDesc" },
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
