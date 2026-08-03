"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Plus, Trash2, Upload, X as XIcon } from "lucide-react"
import { CustomerWithProjectsSchema, type CustomerWithProjectsInput } from "@/lib/schemas"
import { createCustomer, updateCustomer } from "@/lib/actions/customers"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE, CUSTOMER_STANDARD_DOCUMENT_TYPES } from "@/lib/constants"
import type { TranslationKey } from "@/lib/i18n/translations"

interface CustomerFormProps {
  defaultValues?: Partial<CustomerWithProjectsInput>
  customerId?: string
}

const STANDARD_TYPE_LABEL_KEYS: Record<(typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number], TranslationKey> = {
  REGISTRATION_CERTIFICATE: "registrationCertificate",
  PIN_CERTIFICATE: "pinCertificate",
  CR12: "cr12",
  VAT_CERTIFICATE: "vatCertificate",
  COMPANY_PROFILE: "companyProfile",
}

export function CustomerForm({ defaultValues, customerId }: CustomerFormProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(customerId)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerWithProjectsInput>({
    resolver: zodResolver(CustomerWithProjectsSchema) as Resolver<CustomerWithProjectsInput>,
    defaultValues: { projects: [], ...defaultValues },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "projects" })

  // Staged, not-yet-uploaded files for the 3 KYC document slots — only relevant on
  // create, since the customer doesn't have an id to attach documents to until the
  // create action returns one.
  const [stagedDocs, setStagedDocs] = useState<Partial<Record<(typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number], File>>>({})

  function stageFile(type: (typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number], file: File | undefined) {
    if (!file) return
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      toast.error(t("documentTypeNotAllowed"))
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast.error(t("documentTooLarge"))
      return
    }
    setStagedDocs((prev) => ({ ...prev, [type]: file }))
  }

  async function uploadStagedDocs(newCustomerId: string) {
    const entries = Object.entries(stagedDocs) as [(typeof CUSTOMER_STANDARD_DOCUMENT_TYPES)[number], File][]
    for (const [type, file] of entries) {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("documentType", type)
      try {
        const res = await fetch(`/api/customers/${newCustomerId}/documents`, { method: "POST", body: formData })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(`${t(STANDARD_TYPE_LABEL_KEYS[type])}: ${body.error ?? t("documentUploadFailed")}`)
        }
      } catch {
        toast.error(`${t(STANDARD_TYPE_LABEL_KEYS[type])}: ${t("documentUploadFailed")}`)
      }
    }
  }

  async function onSubmit(data: CustomerWithProjectsInput) {
    if (isEdit) {
      const result = await updateCustomer(customerId!, data)
      if (result?.error) toast.error(result.error)
      return
    }

    const result = await createCustomer(data)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (result.dropboxWarning) {
      toast.error(result.dropboxWarning)
    }

    // The customer record is safely created at this point regardless of what happens
    // next — a document upload failure must never lose the customer that was just
    // created (each upload reports its own error via toast above).
    if (Object.keys(stagedDocs).length > 0) {
      await uploadStagedDocs(result.id)
    }

    router.push(`/customers/${result.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("companyName")} htmlFor="companyName" required error={errors.companyName?.message}>
              <Input id="companyName" placeholder="e.g. ABC Sdn Bhd" {...register("companyName")} error={errors.companyName?.message} />
            </FormField>
            <FormField label={t("shortName")} htmlFor="shortName" required error={errors.shortName?.message}>
              <Input id="shortName" placeholder="e.g. CSCEC" {...register("shortName")} error={errors.shortName?.message} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("pinNumber")} htmlFor="pinNumber" error={errors.pinNumber?.message}>
              <Input id="pinNumber" placeholder="e.g. P000000000A" {...register("pinNumber")} />
            </FormField>
            <FormField label={t("mainContactName")} htmlFor="name" error={errors.name?.message}>
              <Input id="name" placeholder="e.g. Ahmad bin Abdullah" {...register("name")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("mainContactPhone")} htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" type="tel" placeholder="e.g. 012-3456789" {...register("phone")} error={errors.phone?.message} />
            </FormField>
            <FormField label={t("mainContactEmail")} htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" placeholder="e.g. hq@company.com" {...register("email")} error={errors.email?.message} />
            </FormField>
          </div>

          <FormField label={t("mainAddress")} htmlFor="location" error={errors.location?.message}>
            <Input id="location" placeholder="e.g. Nairobi, Kenya" {...register("location")} />
          </FormField>

          <FormField label={t("notes")} htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </FormField>
        </div>

        {!isEdit && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t("projectsAndContacts")}</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() =>
                  append({ name: "", contactPerson: "", phone: "", contactEmail: "", address: "", notes: "" })
                }
              >
                {t("addProject")}
              </Button>
            </div>

            {typeof errors.projects?.message === "string" && (
              <p className="text-xs text-red-600">{errors.projects.message}</p>
            )}

            {fields.length === 0 ? (
              <p className="text-sm text-slate-400 italic">{t("noProjectsYet")}</p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative rounded-lg border border-slate-200 p-4 space-y-4">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={t("removeProject")}
                      className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="grid grid-cols-1 gap-4 pr-8 sm:grid-cols-2">
                      <FormField
                        label={t("projectName")}
                        htmlFor={`projects.${index}.name`}
                        required
                        error={errors.projects?.[index]?.name?.message}
                      >
                        <Input {...register(`projects.${index}.name`)} error={errors.projects?.[index]?.name?.message} />
                      </FormField>
                      <FormField label={t("contactName")} htmlFor={`projects.${index}.contactPerson`}>
                        <Input {...register(`projects.${index}.contactPerson`)} />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        label={t("contactPhone")}
                        htmlFor={`projects.${index}.phone`}
                        error={errors.projects?.[index]?.phone?.message}
                      >
                        <Input type="tel" {...register(`projects.${index}.phone`)} />
                      </FormField>
                      <FormField
                        label={t("contactEmail")}
                        htmlFor={`projects.${index}.contactEmail`}
                        error={errors.projects?.[index]?.contactEmail?.message}
                      >
                        <Input type="email" {...register(`projects.${index}.contactEmail`)} />
                      </FormField>
                    </div>

                    <FormField label={t("projectAddress")} htmlFor={`projects.${index}.address`}>
                      <Input {...register(`projects.${index}.address`)} />
                    </FormField>

                    <FormField label={t("notes")} htmlFor={`projects.${index}.notes`}>
                      <Textarea rows={2} {...register(`projects.${index}.notes`)} />
                    </FormField>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isEdit && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">{t("customerDocuments")}</h2>
            <div className="space-y-3">
              {CUSTOMER_STANDARD_DOCUMENT_TYPES.map((type) => {
                const file = stagedDocs[type]
                return (
                  <div key={type} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{t(STANDARD_TYPE_LABEL_KEYS[type])}</p>
                      <p className="truncate text-xs text-slate-500">
                        {file ? file.name : t("documentNotUploaded")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {file && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<XIcon className="h-3.5 w-3.5" />}
                          onClick={() => setStagedDocs((prev) => { const next = { ...prev }; delete next[type]; return next })}
                        >
                          {t("cancel")}
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept={ALLOWED_DOCUMENT_TYPES.join(",")}
                          onChange={(e) => stageFile(type, e.target.files?.[0])}
                        />
                        <span className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                          <Upload className="h-3.5 w-3.5" />
                          {file ? t("replace") : t("uploadFile")}
                        </span>
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
