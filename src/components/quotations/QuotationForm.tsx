"use client"

import { useEffect, useMemo } from "react"
import Image from "next/image"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { ImageOff, Trash2 } from "lucide-react"
import { QuotationSchema, type QuotationInput } from "@/lib/schemas"
import { createQuotation, updateQuotation } from "@/lib/actions/quotations"
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

interface CustomerProjectOption {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  contactEmail: string | null
  address: string | null
}

interface CustomerOption {
  id: string
  name: string | null
  code: string
  companyName: string
  pinNumber: string | null
  phone: string | null
  location: string | null
  email: string | null
  branches: CustomerProjectOption[]
}

interface QuotationFormProps {
  customers: CustomerOption[]
  spareParts: SparePartOption[]
  defaultValues?: Partial<QuotationInput>
  quotationId?: string
  /** The quotation's currently-selected Project, even if it has since been
   * deactivated (and so is absent from `customers[].branches`) — keeps the
   * historical selection visible/selectable on the edit form. */
  currentInactiveBranch?: CustomerProjectOption | null
}

export function QuotationForm({
  customers,
  spareParts,
  defaultValues,
  quotationId,
  currentInactiveBranch,
}: QuotationFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(quotationId)

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuotationInput>({
    resolver: zodResolver(QuotationSchema) as Resolver<QuotationInput>,
    defaultValues: {
      vatPercent: DEFAULT_VAT_PERCENT,
      items: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Default "Valid Until" to today in the BROWSER's local timezone (not the
  // server's) — computed client-side after mount so SSR and the first client
  // render still match (no hydration mismatch), only backfilling on create
  // (never overwrites an existing Quotation's date when editing).
  useEffect(() => {
    if (!isEdit) setValue("validUntil", todayLocalDate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCustomerId = watch("customerId")
  const watchedItems = watch("items")
  const vatPercent = Number(watch("vatPercent")) || 0

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const projectOptions =
    currentInactiveBranch && !selectedCustomer?.branches.some((b) => b.id === currentInactiveBranch.id)
      ? [...(selectedCustomer?.branches ?? []), currentInactiveBranch]
      : selectedCustomer?.branches ?? []

  function applyContact(source: { name?: string | null; phone?: string | null; email?: string | null; address?: string | null } | null) {
    setValue("contactName", source?.name ?? "")
    setValue("contactPhone", source?.phone ?? "")
    setValue("contactEmail", source?.email ?? "")
    setValue("contactAddress", source?.address ?? "")
  }

  function handleCustomerChange(customerId: string) {
    setValue("customerBranchId", "")
    const customer = customers.find((c) => c.id === customerId)
    applyContact(customer ? { name: customer.name, phone: customer.phone, email: customer.email, address: customer.location } : null)
  }

  function handleProjectChange(branchId: string) {
    if (!branchId) {
      applyContact(selectedCustomer ? { name: selectedCustomer.name, phone: selectedCustomer.phone, email: selectedCustomer.email, address: selectedCustomer.location } : null)
      return
    }
    const branch = projectOptions.find((b) => b.id === branchId)
    applyContact(branch ? { name: branch.contactPerson, phone: branch.phone, email: branch.contactEmail, address: branch.address } : null)
  }

  const partsById = useMemo(() => new Map(spareParts.map((p) => [p.id, p])), [spareParts])

  const subtotal = (watchedItems ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const vatAmount = (subtotal * vatPercent) / 100
  const total = subtotal + vatAmount

  function addStockItem(part: SparePartOption) {
    // Unit Price is always typed in by the user (never auto-filled from the
    // stock item's sellingPrice) — only category/brand/name/model/specification
    // and current stock quantity are auto-populated, per spec.
    append({ partId: part.id, quantity: 1, unitPrice: 0 })
  }

  async function onSubmit(data: QuotationInput) {
    const result = isEdit
      ? await updateQuotation(quotationId!, data)
      : await createQuotation(data)
    if (result?.error) {
      toast.error(result.error === "QUOTATION_NUMBER_EXISTS" ? t("quotationNumberExists") : result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">

        {/* Customer */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label={t("quotationNumber")} htmlFor="quotationNumber" required error={errors.quotationNumber?.message}>
              <Input id="quotationNumber" placeholder="e.g. QT00455" {...register("quotationNumber")} error={errors.quotationNumber?.message} />
            </FormField>
            <FormField label="Customer" htmlFor="customerId" required error={errors.customerId?.message}>
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
            <FormField label="Valid Until" htmlFor="validUntil" error={errors.validUntil?.message}>
              <Input id="validUntil" type="date" {...register("validUntil")} />
            </FormField>
          </div>

          {/* Auto-filled from selected customer — always reflects the live Customer
              record, so shown as a readonly field rather than an editable input
              (there's nothing to submit here; editing the customer's PIN happens
              on the Customer record itself, not per-quotation). */}
          {selectedCustomer && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label={t("companyName")} htmlFor="quotationCustomerCompanyName">
                <div id="quotationCustomerCompanyName" className="block w-full select-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 sm:py-2">
                  {selectedCustomer.companyName}
                </div>
              </FormField>
              <FormField label={t("pinNumber")} htmlFor="quotationCustomerPin">
                <div id="quotationCustomerPin" className="block w-full select-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 sm:py-2">
                  {selectedCustomer.pinNumber || "—"}
                </div>
              </FormField>
            </div>
          )}

          {selectedCustomer && projectOptions.length > 0 && (
            <FormField label="Contact / Project" htmlFor="customerBranchId">
              <Select
                id="customerBranchId"
                {...register("customerBranchId", { onChange: (e) => handleProjectChange(e.target.value) })}
              >
                <option value="">{t("headOfficeMainContact")}</option>
                {projectOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.contactPerson || "—"} — {b.phone || "—"}
                    {currentInactiveBranch?.id === b.id && !selectedCustomer.branches.some((sb) => sb.id === b.id)
                      ? ` (${t("inactiveLabel")})`
                      : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {selectedCustomer && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label={t("contactName")} htmlFor="contactName" error={errors.contactName?.message}>
                <Input id="contactName" {...register("contactName")} />
              </FormField>
              <FormField label={t("contactPhone")} htmlFor="contactPhone" error={errors.contactPhone?.message}>
                <Input id="contactPhone" type="tel" {...register("contactPhone")} />
              </FormField>
              <FormField label={t("contactEmail")} htmlFor="contactEmail" error={errors.contactEmail?.message}>
                <Input id="contactEmail" type="email" {...register("contactEmail")} />
              </FormField>
              <FormField label={t("mainAddress")} htmlFor="contactAddress" error={errors.contactAddress?.message}>
                <Input id="contactAddress" {...register("contactAddress")} />
              </FormField>
            </div>
          )}
        </div>

        {/* Stock Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Quotation Items</h2>

          <StockItemSearch spareParts={spareParts} onSelect={addStockItem} />

          {errors.items?.message && (
            <p className="text-xs text-red-600">{errors.items.message}</p>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">No items added yet. Search for a stock item above to add it.</p>
          ) : (
            <div className="space-y-3">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 pb-1 border-b border-slate-100">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-right">Quantity</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Amount</div>
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
                            {part.stock?.quantity ?? 0} {part.unit || "units"} in stock
                          </p>
                        )}
                      </div>
                      <input type="hidden" {...register(`items.${index}.partId`)} />
                    </div>

                    {/* Mobile: qty/price/amount/delete share one full-width flex row so
                        none of them get squeezed. Desktop: `sm:contents` drops this wrapper
                        so its children rejoin the 12-col grid exactly as before. */}
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
          <h2 className="text-sm font-semibold text-slate-900 mb-5">Cost Summary</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={`${t("vat")} (%)`} htmlFor="vatPercent" error={errors.vatPercent?.message}>
              <Input id="vatPercent" type="number" min="0" max="100" step="0.01" placeholder="0.00" {...register("vatPercent")} />
            </FormField>
          </div>

          {/* Live total */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
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

        {/* Remarks + Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Additional Information</h2>
          <FormField label="Remarks (customer-facing)" htmlFor="remarks" error={errors.remarks?.message}>
            <Textarea
              id="remarks"
              rows={2}
              placeholder="e.g. Quotation valid for 15 days. Price excludes site visit charges."
              {...register("remarks")}
            />
          </FormField>
          <FormField label="Internal Notes" htmlFor="internalNotes" error={errors.internalNotes?.message}>
            <Textarea
              id="internalNotes"
              rows={2}
              placeholder="Internal notes not shown to the customer…"
              {...register("internalNotes")}
            />
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
