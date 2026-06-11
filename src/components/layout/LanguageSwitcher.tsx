"use client"

import { useLanguage } from "@/lib/i18n/LanguageContext"
import { LANGUAGES } from "@/lib/i18n/translations"
import { cn } from "@/lib/utils"

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          className={cn(
            "rounded-md px-2 py-1 transition-colors",
            language === lang.code
              ? "bg-blue-600 text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          )}
          aria-pressed={language === lang.code}
        >
          {lang.label}
        </button>
      ))}
    </div>
  )
}
