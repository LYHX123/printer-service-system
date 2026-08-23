import type { PartCategory } from "@/types"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { StockBucket } from "@/lib/permissions"

/**
 * UI-facing stock buckets. The underlying PartCategory enum (11 values) is kept
 * unchanged in the database — this is purely a display/grouping layer so the
 * Stock module can present 3 simple categories instead of 11.
 */
export type StockType = "EQUIPMENT" | "CONSUMPTION" | "PARTS" | "COMMON_PRODUCT"

export const STOCK_TYPES: StockType[] = ["EQUIPMENT", "CONSUMPTION", "PARTS", "COMMON_PRODUCT"]

export const STOCK_TYPE_LABELS: Record<StockType, string> = {
  EQUIPMENT: "Equipment",
  CONSUMPTION: "Consumption",
  PARTS: "Parts",
  COMMON_PRODUCT: "Common Product",
}

/** Localized equivalent of STOCK_TYPE_LABELS for user-facing prose (Stock tabs/filter/create/edit/detail, item selector badges) — see translations.ts. STOCK_TYPE_LABELS itself stays plain English for PDF output and admin-only filter dropdowns, matching this project's existing convention for those surfaces. */
export const STOCK_TYPE_TRANSLATION_KEYS: Record<StockType, TranslationKey> = {
  EQUIPMENT: "stockTypeEquipmentLabel",
  CONSUMPTION: "stockTypeConsumptionLabel",
  PARTS: "stockTypePartsLabel",
  COMMON_PRODUCT: "stockTypeCommonProductLabel",
}

export const CATEGORIES_FOR_STOCK_TYPE: Record<StockType, PartCategory[]> = {
  EQUIPMENT: ["LAPTOP_PART", "DESKTOP_PART", "CCTV_PART", "PROJECTOR_PART"],
  CONSUMPTION: ["TONER", "DRUM", "DEVELOPER", "FUSER", "MAINTENANCE_KIT", "ROLLER"],
  PARTS: ["GENERAL"],
  COMMON_PRODUCT: ["COMMON_PRODUCT"],
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

const STOCK_TYPE_TO_BUCKET: Record<StockType, StockBucket> = {
  EQUIPMENT: "equipment",
  CONSUMPTION: "consumption",
  PARTS: "parts",
  COMMON_PRODUCT: "commonProduct",
}

/** Maps a UI-facing StockType to its `stock.<bucket>.*` permission bucket. */
export function stockTypeToBucket(stockType: StockType): StockBucket {
  return STOCK_TYPE_TO_BUCKET[stockType]
}

/** Convenience: a PartCategory straight to its permission bucket. */
export function categoryToBucket(category: PartCategory): StockBucket {
  return stockTypeToBucket(getStockType(category))
}

/** Default low-stock alert thresholds by stock type. Quantity at or below this triggers a low-stock alert. */
export const LOW_STOCK_THRESHOLDS: Record<StockType, number> = {
  EQUIPMENT: 2,
  CONSUMPTION: 5,
  PARTS: 2,
  // Unused — Common Product is ad-hoc procurement stock, not company-held
  // inventory, so it's excluded from low-stock evaluation entirely (see
  // isLowStockEligible / getEffectiveStockLevel). Never actually consulted.
  COMMON_PRODUCT: 0,
}

export function getLowStockThreshold(category: PartCategory): number {
  return LOW_STOCK_THRESHOLDS[getStockType(category)]
}

/**
 * Stock types that participate in the automatic low-stock alert system
 * (Dashboard Low Stock count/widget, the global floating alerts notification,
 * the Stock list's per-row status badge, and the Low Stock report). Common
 * Product is excluded — it's used for one-off customer-directed purchases, so
 * sitting at 0 is normal and must never surface as a warning. See
 * getEffectiveStockLevel, the single place this gate is applied.
 */
export function isLowStockEligible(stockType: StockType): boolean {
  return stockType !== "COMMON_PRODUCT"
}

/** Category used when creating a new item under a given stock type (DB enum value stays hidden from the UI). */
export const DEFAULT_CATEGORY_FOR_STOCK_TYPE: Record<StockType, PartCategory> = {
  EQUIPMENT: "LAPTOP_PART",
  CONSUMPTION: "TONER",
  PARTS: "GENERAL",
  COMMON_PRODUCT: "COMMON_PRODUCT",
}

/**
 * The Quotation/Delivery/Invoice ITEM NO. column's abbreviation for a given
 * Stock Type — identical across every Excel and PDF output. Single shared
 * mapping: extend this one entry when a new Stock Type is added rather than
 * duplicating the switch in invoiceExcel/quotationExcel/deliveryExcel.
 */
export const DOCUMENT_ITEM_NO_LABELS: Record<StockType, string> = {
  EQUIPMENT: "EQUIPMENT",
  CONSUMPTION: "CONSUM",
  PARTS: "PART",
  COMMON_PRODUCT: "COMMON",
}

export function resolveDocumentItemNoLabel(stockType: StockType): string {
  return DOCUMENT_ITEM_NO_LABELS[stockType]
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
  unit: { width: "8%", align: "center" as const },
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
  COMMON_PRODUCT: "addCommonProductItem",
}

/** Translation keys for the list empty state (title + description), by stock type. */
export const EMPTY_STATE_TRANSLATION_KEYS: Record<StockType, { title: TranslationKey; description: TranslationKey }> = {
  EQUIPMENT: { title: "equipmentEmptyTitle", description: "equipmentEmptyDesc" },
  CONSUMPTION: { title: "consumptionEmptyTitle", description: "consumptionEmptyDesc" },
  PARTS: { title: "partsEmptyTitle", description: "partsEmptyDesc" },
  COMMON_PRODUCT: { title: "commonProductEmptyTitle", description: "commonProductEmptyDesc" },
}

const STOCK_TYPE_COUNT_LABELS: Record<StockType, { singular: TranslationKey; plural: TranslationKey }> = {
  EQUIPMENT: { singular: "unitSingular", plural: "unitPlural" },
  CONSUMPTION: { singular: "consumableSingular", plural: "consumablePlural" },
  PARTS: { singular: "part", plural: "parts" },
  COMMON_PRODUCT: { singular: "commonProductSingular", plural: "commonProductPlural" },
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
