"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { CustomerSchema, type CustomerInput } from "@/lib/schemas"
import { createCustomer, updateCustomer } from "@/lib/actions/customers"
import { FormField, Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"

interface CustomerFormProps {
  defaultValues?: Partial<CustomerInput>
  customerId?: string
}

export function CustomerForm({ defaultValues, customerId }: CustomerFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema) as Resolver<CustomerInput>,
    defaultValues,
  })

  async function onSubmit(data: CustomerInput) {
    const result = customerId
      ? await updateCustomer(customerId, data)
      : await createCustomer(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("companyName")} htmlFor="companyName" required error={errors.companyName?.message}>
            <Input id="companyName" placeholder="e.g. ABC Sdn Bhd" {...register("companyName")} error={errors.companyName?.message} />
          </FormField>
          <FormField label={t("pinNumber")} htmlFor="pinNumber" error={errors.pinNumber?.message}>
            <Input id="pinNumber" placeholder="e.g. P000000000A" {...register("pinNumber")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("customerName")} htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Ahmad bin Abdullah" {...register("name")} />
          </FormField>
          <FormField label={t("phone")} htmlFor="phone" required error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="e.g. 012-3456789" {...register("phone")} error={errors.phone?.message} />
          </FormField>
        </div>

        <FormField label={t("location")} htmlFor="location" error={errors.location?.message}>
          <Input id="location" placeholder="e.g. Nairobi, Kenya" {...register("location")} />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {customerId ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
