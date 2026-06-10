/**
 * i18n architecture scaffold (Phase 7).
 *
 * This sets up the locale configuration and dictionary loading infrastructure
 * for future multilingual support. The UI is NOT translated yet — all current
 * pages continue to render English text directly. This module exists so that
 * translation work can be added incrementally without restructuring the app.
 */

export const locales = ["en", "zh"] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
