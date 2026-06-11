/**
 * Normalizes a Kenyan phone number for use in WhatsApp deep links.
 *
 * - 07XXXXXXXX  -> 2547XXXXXXXX
 * - 01XXXXXXXX  -> 2541XXXXXXXX
 * - +254XXXXXXXXX -> 254XXXXXXXXX (leading "+" stripped)
 * - Anything else: non-digit characters stripped and returned as-is.
 */
export function normalizeKenyaPhone(phone: string): string {
  const trimmed = phone.trim()

  if (trimmed.startsWith("+254")) {
    return trimmed.slice(1).replace(/\D/g, "")
  }

  const digits = trimmed.replace(/\D/g, "")

  if (digits.startsWith("07") || digits.startsWith("01")) {
    return `254${digits.slice(1)}`
  }

  if (digits.startsWith("254")) {
    return digits
  }

  return digits
}

/** Builds a WhatsApp deep link (wa.me) for the given phone number and message. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeKenyaPhone(phone)
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
