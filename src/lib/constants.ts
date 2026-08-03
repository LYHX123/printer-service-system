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
  "REGISTRATION_CERTIFICATE",
  "PIN_CERTIFICATE",
  "CR12",
  "VAT_CERTIFICATE",
  "COMPANY_PROFILE",
] as const

/**
 * Fixed, named document slots shown on Customer create/detail — one
 * Choose-File/Upload control each. These are also the "standard" document
 * types (see STANDARD_DOCUMENT_TYPE_DROPBOX_NAMES below): a Customer keeps
 * at most one *current* file per standard type, stored in Dropbox under a
 * fixed, standardized filename rather than the uploader's original one.
 */
export const CUSTOMER_STANDARD_DOCUMENT_TYPES = [
  "REGISTRATION_CERTIFICATE",
  "PIN_CERTIFICATE",
  "CR12",
  "VAT_CERTIFICATE",
  "COMPANY_PROFILE",
] as const

/**
 * The fixed Dropbox base filename (extension appended from the uploaded
 * file) for each standard document type — e.g. uploading "CRBC PIN scan
 * 2026.pdf" as PIN_CERTIFICATE is saved to Dropbox as "PIN Certificate.pdf".
 * OTHER and the other free-form types are not in this map — those keep the
 * uploader's original filename verbatim (see dropboxFileNameFor below).
 */
export const STANDARD_DOCUMENT_TYPE_DROPBOX_NAMES: Record<
  (typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number],
  string
> = {
  REGISTRATION_CERTIFICATE: "Registration Certificate",
  PIN_CERTIFICATE: "PIN Certificate",
  CR12: "CR12",
  VAT_CERTIFICATE: "VAT Certificate",
  COMPANY_PROFILE: "Company Profile",
}

export function isStandardDocumentType(
  type: string | null | undefined
): type is (typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number] {
  return Boolean(type) && Object.prototype.hasOwnProperty.call(STANDARD_DOCUMENT_TYPE_DROPBOX_NAMES, type as string)
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".")
  return idx >= 0 ? fileName.slice(idx) : ""
}

/**
 * The Dropbox filename a given (documentType, originalFileName) pair should
 * be saved under. Standard types always get their fixed base name with the
 * uploaded file's own extension preserved (never a format conversion) —
 * everything else (OTHER, CONTRACT, ID_DOCUMENT, CORRESPONDENCE) keeps the
 * original filename exactly as uploaded.
 */
export function dropboxFileNameFor(documentType: string | null | undefined, originalFileName: string): string {
  if (isStandardDocumentType(documentType)) {
    return `${STANDARD_DOCUMENT_TYPE_DROPBOX_NAMES[documentType]}${extensionOf(originalFileName)}`
  }
  return originalFileName
}
