export const DEFAULT_CURRENCY = "KES"
export const DEFAULT_VAT_PERCENT = 16
export const DEFAULT_COUNTRY = "Kenya"
export const DEFAULT_TIMEZONE = "Africa/Nairobi"

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5MB

export const ALLOWED_DOCUMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

export const CUSTOMER_DOCUMENT_TYPES = [
  "CONTRACT",
  "ID_DOCUMENT",
  "CORRESPONDENCE",
  "OTHER",
] as const
