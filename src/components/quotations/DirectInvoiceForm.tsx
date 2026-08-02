"use client"

import { useEffect, useMemo } from "react"
import Image from "next/image"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff, Trash2 } from "lucide-react"
import { DirectInvoiceSchema, type DirectInvoiceInput } from "@/lib/schemas"
import { createDirectInvoice, updateInvoice } from "@/lib/actions/invoices"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { formatCurrency, todayLocalDate } from "@/lib/utils"
import { selectOnFocus } from "@/lib/input-helpers"
import { DEFAULT_VAT_PERCENT } from "@/lib/constants"
import type { SparePartOption } from "@/lib/data/inventory"
import { getStockType, STOCK_TYPE_LABELS } from "@/lib/stock-types"
import { StockItemSearch } from "./StockItemSearch"

interface CustomerOption {
  id: string
  name: string | null
  code: string
  companyName: string
  pinNumber: string | null
}

interface DirectInvoiceFormProps {
  customers: CustomerOption[]
  spareParts: SparePartOption[]
  defaultValues?: Partial<DirectInvoiceInput>
  invoiceId?: string
}

export function DirectInvoiceForm({ customers, spareParts, defaultValues, invoiceId }: DirectInvoiceFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(invoiceId)

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DirectInvoiceInput>({
    resolver: zodResolver(DirectInvoiceSchema) as Resolver<DirectInvoiceInput>,
    defaultValues: {
      vatPercent: DEFAULT_VAT_PERCENT,
      items: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Same reasoning as QuotationForm — default to today in the browser's local
  // timezone, computed after mount (avoids SSR/client hydration mismatch),
  // create-only so editing an existing invoice never overwrites its date.
  useEffect(() => {
    if (!isEdit) setValue("date", todayLocalDate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCustomerId = watch("customerId")
  const watchedItems = watch("items")
  const vatPercent = Number(watch("vatPercent")) || 0

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  function handleCustomerChange(customerId: string) {
    const customer = customers.find((c) => c.id === customerId)
    setValue("customerPin", customer?.pinNumber ?? "")
  }

  const partsById = useMemo(() => new Map(spareParts.map((p) => [p.id, p])), [spareParts])

  const subtotal = (watchedItems ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const vatAmount = (subtotal * vatPercent) / 100
  const total = subtotal + vatAmount

  function addStockItem(part: SparePartOption) {
    append({ partId: part.id, quantity: 1, unitPrice: 0 })
  }

  async function onSubmit(data: DirectInvoiceInput) {
    const result = isEdit ? await updateInvoice(invoiceId!, data) : await createDirectInvoice(data)
    if (result?.error) {
      toast.error(result.error === "INVOICE_NUMBER_EXISTS" ? t("invoiceNumberExists") : result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">
        {/* Customer + Invoice Number + Date */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">{t("customer")}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("invoiceNumberLabel")} htmlFor="invoiceNumber" required error={errors.invoiceNumber?.message}>
              <Input id="invoiceNumber" placeholder="e.g. CN00456" {...register("invoiceNumber")} error={errors.invoiceNumber?.message} />
            </FormField>
            <FormField label={t("customer")} htmlFor="customerId" required error={errors.customerId?.message}>
              <Select
                id="customerId"
                placeholder="Select customer…"
                {...register("customerId", { onChange: (e) => handleCustomerChange(e.target.value) })}
                error={errors.customerId?.message}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.code})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("invoiceDateLabel2")} htmlFor="date" required error={errors.date?.message}>
              <Input id="date" type="date" {...register("date")} />
            </FormField>
            {/* Readonly, synced from the selected Customer's record (see handleCustomerChange)
                — still submitted as Invoice.customerPin (a snapshot field), just not
                freely user-editable, per spec. */}
            <FormField label={t("invoiceCustomerPinLabel")} htmlFor="customerPin">
              <div id="customerPin" className="block w-full select-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 sm:py-2">
                {watch("customerPin") || "—"}
              </div>
              <input type="hidden" {...register("customerPin")} />
            </FormField>
          </div>

          {selectedCustomer && (
            <FormField label={t("companyName")} htmlFor="directInvoiceCustomerName">
              <div id="directInvoiceCustomerName" className="block w-full select-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 sm:py-2">
                {selectedCustomer.companyName}
              </div>
            </FormField>
          )}
        </div>

        {/* Stock Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("invoiceItems")}</h2>

          <StockItemSearch spareParts={spareParts} onSelect={addStockItem} />

          {errors.items?.message && (
            <p className="text-xs text-red-600">{errors.items.message}</p>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">{t("noItemsAdded")}</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 pb-1 border-b border-slate-100">
                <div className="col-span-5">{t("product")}</div>
                <div className="col-span-2 text-right">{t("quantity")}</div>
                <div className="col-span-2 text-right">{t("unitPrice")}</div>
                <div className="col-span-2 text-right">{t("lineTotal")}</div>
                <div className="col-span-1" />
              </div>
              {fields.map((field, index) => {
                const itemPartId = watchedItems?.[index]?.partId
                const part = itemPartId ? partsById.get(itemPartId) : undefined
                const qty = Number(watchedItems?.[index]?.quantity) || 0
                const price = Number(watchedItems?.[index]?.unitPrice) || 0
                const amount = qty * price
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start sm:items-center">
                    <div className="col-span-12 sm:col-span-5 flex items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {part?.imageUrl ? (
                          <Image src={part.imageUrl} alt={part.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <ImageOff className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {part ? (part.brand ? `${part.brand} — ${part.name}` : part.name) : "Unknown item"}
                          </p>
                          {part && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                              {STOCK_TYPE_LABELS[getStockType(part.category)]}
                            </span>
                          )}
                        </div>
                        {part && (
                          <p className="text-xs text-slate-400 truncate">
                            {part.model ? `${part.model} · ` : ""}
                            {part.stock?.quantity ?? 0} {part.unit} in stock
                          </p>
                        )}
                      </div>
                      <input type="hidden" {...register(`items.${index}.partId`)} />
                    </div>

                    <div className="col-span-12 flex items-end gap-2 sm:contents">
                      <div className="flex-1 sm:col-span-2">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          onFocus={selectOnFocus}
                          {...register(`items.${index}.quantity`)}
                          error={errors.items?.[index]?.quantity?.message}
                        />
                      </div>
                      <div className="flex-1 sm:col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          onFocus={selectOnFocus}
                          {...register(`items.${index}.unitPrice`)}
                          error={errors.items?.[index]?.unitPrice?.message}
                        />
                      </div>
                      <div className="shrink-0 min-w-[4.5rem] py-2.5 text-right text-sm font-medium text-slate-600 sm:col-span-2 sm:py-0">
                        {formatCurrency(amount)}
                      </div>
                      <div className="shrink-0 sm:col-span-1 sm:flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cost Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-5">{t("costSummary")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={`${t("vat")} (%)`} htmlFor="vatPercent" error={errors.vatPercent?.message}>
              <Input id="vatPercent" type="number" min="0" max="100" step="0.01" placeholder="0.00" {...register("vatPercent")} />
            </FormField>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{t("subtotal")}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {vatPercent > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{t("vat")} ({vatPercent}%)</span>
                  <span>{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-1">
                <span>{t("total")}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("remarks")}</h2>
          <FormField label={t("remarks")} htmlFor="remarks" error={errors.remarks?.message}>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </FormField>
        </div>
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
