"use client"

import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"
import { RepairReportSchema, type RepairReportInput } from "@/lib/schemas"
import { saveRepairReport } from "@/lib/actions/reports"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { formatCurrency } from "@/lib/utils"
import type { SparePartOption } from "@/lib/data/inventory"

interface RepairReportFormProps {
  jobId: string
  spareParts: SparePartOption[]
  defaultValues?: Partial<RepairReportInput>
}

export function RepairReportForm({ jobId, spareParts, defaultValues }: RepairReportFormProps) {
  const router = useRouter()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RepairReportInput>({
    resolver: zodResolver(RepairReportSchema) as Resolver<RepairReportInput>,
    defaultValues: {
      diagnosis: "",
      workDone: "",
      recommendations: "",
      labourCost: 0,
      parts: [],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "parts" })

  const watchedParts = watch("parts")
  const labourCost = Number(watch("labourCost")) || 0
  const partsCost = (watchedParts ?? []).reduce(
    (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0),
    0
  )
  const total = labourCost + partsCost

  async function onSubmit(data: RepairReportInput) {
    const result = await saveRepairReport(jobId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Repair report saved")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormField label="Diagnosis" htmlFor="diagnosis" required error={errors.diagnosis?.message}>
        <Textarea
          id="diagnosis"
          rows={3}
          placeholder="What was found to be the cause of the fault…"
          {...register("diagnosis")}
          error={errors.diagnosis?.message}
        />
      </FormField>

      <FormField label="Work Performed" htmlFor="workDone" required error={errors.workDone?.message}>
        <Textarea
          id="workDone"
          rows={3}
          placeholder="What was done to resolve the issue…"
          {...register("workDone")}
          error={errors.workDone?.message}
        />
      </FormField>

      <FormField label="Recommendations" htmlFor="recommendations" error={errors.recommendations?.message}>
        <Textarea
          id="recommendations"
          rows={2}
          placeholder="Recommendations for the customer (optional)…"
          {...register("recommendations")}
        />
      </FormField>

      {/* Spare parts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Spare Parts Replaced</h4>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => append({ partId: "", partName: "", quantity: 1, unitPrice: 0 })}
          >
            Add Part
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-1">No spare parts recorded.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 pb-1 border-b border-slate-100">
              <div className="col-span-6">Part Name</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1 text-right">Subtotal</div>
              <div className="col-span-1" />
            </div>
            {fields.map((field, index) => {
              const qty = Number(watchedParts?.[index]?.quantity) || 0
              const price = Number(watchedParts?.[index]?.unitPrice) || 0
              const rowSubtotal = qty * price
              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 sm:col-span-6 space-y-1.5">
                    {spareParts.length > 0 && (
                      <Select
                        aria-label="Select inventory part"
                        defaultValue=""
                        onChange={(e) => {
                          const part = spareParts.find((p) => p.id === e.target.value)
                          if (!part) return
                          setValue(`parts.${index}.partId`, part.id, { shouldValidate: true })
                          setValue(`parts.${index}.partName`, `${part.partNumber} — ${part.name}`, { shouldValidate: true })
                          setValue(`parts.${index}.unitPrice`, Number(part.sellingPrice), { shouldValidate: true })
                        }}
                      >
                        <option value="">— Select from inventory (optional) —</option>
                        {spareParts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.partNumber} — {p.name} ({formatCurrency(Number(p.sellingPrice))}, {p.stock?.quantity ?? 0} {p.unit} in stock)
                          </option>
                        ))}
                      </Select>
                    )}
                    <Input
                      placeholder="Part name"
                      {...register(`parts.${index}.partName`)}
                      error={errors.parts?.[index]?.partName?.message}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      {...register(`parts.${index}.quantity`)}
                      error={errors.parts?.[index]?.quantity?.message}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...register(`parts.${index}.unitPrice`)}
                      error={errors.parts?.[index]?.unitPrice?.message}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 text-right text-sm text-slate-600 pt-2 font-medium">
                    {formatCurrency(rowSubtotal)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-1.5 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cost summary */}
      <div className="border-t border-slate-100 pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-sm">
          <FormField label="Labour Cost (KES)" htmlFor="labourCost" error={errors.labourCost?.message}>
            <Input id="labourCost" type="number" min="0" step="0.01" placeholder="0.00" {...register("labourCost")} />
          </FormField>
        </div>
        <div className="mt-3 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Labour</span>
            <span>{formatCurrency(labourCost)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Parts</span>
            <span>{formatCurrency(partsCost)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2 mt-1">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Save Repair Report
        </Button>
      </div>
    </form>
  )
}
