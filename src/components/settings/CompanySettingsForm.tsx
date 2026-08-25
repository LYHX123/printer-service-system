"use client"

import { useState } from "react"
import Image from "next/image"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Building2 } from "lucide-react"
import { CompanySettingsSchema, type CompanySettingsInput } from "@/lib/schemas"
import { updateCompanySettings } from "@/lib/actions/settings"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/components/ui/FileDropzone"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { useAppMode } from "@/components/platform/AppModeProvider"
import { cn } from "@/lib/utils"

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "TZS", "UGX"]

const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Dar_es_Salaam",
  "Africa/Kampala",
  "Africa/Kigali",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "UTC",
]

interface CompanySettingsFormProps {
  defaultValues: CompanySettingsInput
  logoUrl: string | null
}

export function CompanySettingsForm({ defaultValues, logoUrl }: CompanySettingsFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isAppMode = useAppMode()
  const [logo, setLogo] = useState(logoUrl)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsInput>({
    resolver: zodResolver(CompanySettingsSchema) as Resolver<CompanySettingsInput>,
    defaultValues,
  })

  async function onSubmit(data: CompanySettingsInput) {
    const result = await updateCompanySettings(data)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(t("companySettingsSaved"))
    }
  }

  async function handleLogoUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/settings/logo", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? t("failedToUploadLogo"))
        return
      }
      setLogo(`${json.logoUrl}?t=${Date.now()}`)
      toast.success(t("logoUpdated"))
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={cn("rounded-xl border border-slate-200 bg-white p-6", isAppMode ? "space-y-3.5" : "space-y-5")}>
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
              isAppMode ? "h-14 w-14" : "h-20 w-20"
            )}
          >
            {logo ? (
              <Image src={logo} alt="Company logo" width={80} height={80} className="h-full w-full object-contain" unoptimized />
            ) : (
              <Building2 className={cn("text-slate-300", isAppMode ? "h-6 w-6" : "h-8 w-8")} />
            )}
          </div>
          <div className="max-w-xs flex-1">
            <FileDropzone
              onFilesSelected={(files) => handleLogoUpload(files[0])}
              loading={uploading}
              compact
              dense={isAppMode}
              label={t("uploadLogo")}
              helperText={isAppMode ? undefined : t("logoFormatHint")}
            />
          </div>
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2", isAppMode ? "gap-3.5" : "gap-5")}>
          <FormField label={t("companyName")} htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="e.g. TechFix Services" {...register("name")} error={errors.name?.message} />
          </FormField>
          <FormField label={t("phoneNumber")} htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="e.g. +254 700 000000" {...register("phone")} />
          </FormField>
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2", isAppMode ? "gap-3.5" : "gap-5")}>
          <FormField label={t("email")} htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" placeholder="e.g. info@company.com" {...register("email")} />
          </FormField>
          <FormField label={t("website")} htmlFor="website" error={errors.website?.message}>
            <Input id="website" placeholder="e.g. https://www.company.com" {...register("website")} />
          </FormField>
        </div>

        <FormField label={t("address")} htmlFor="address" error={errors.address?.message}>
          <Textarea id="address" placeholder={t("fullCompanyAddress")} rows={3} {...register("address")} />
        </FormField>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2", isAppMode ? "gap-3.5" : "gap-5")}>
          <FormField label={t("kraPin")} htmlFor="kraPin" error={errors.kraPin?.message}>
            <Input id="kraPin" placeholder="e.g. P000000000A" {...register("kraPin")} />
          </FormField>
          <FormField label={t("vatPercentage")} htmlFor="vatPercent" required error={errors.vatPercent?.message}>
            <Input id="vatPercent" type="number" step="0.01" min={0} max={100} className="no-spinner" {...register("vatPercent")} error={errors.vatPercent?.message} />
          </FormField>
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2", isAppMode ? "gap-3.5" : "gap-5")}>
          <FormField label={t("currency")} htmlFor="currency" required error={errors.currency?.message}>
            <Select id="currency" {...register("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("timezone")} htmlFor="timezone" required error={errors.timezone?.message}>
            <Select id="timezone" {...register("timezone")}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="submit" loading={isSubmitting}>
          {t("saveChanges")}
        </Button>
      </div>
    </form>
  )
}
