import type { Locale } from "./config"
import { defaultLocale } from "./config"

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  zh: () => import("./dictionaries/zh.json").then((m) => m.default),
}

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries[defaultLocale]
  return loader()
}
