"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { SparePartSchema, type SparePartInput } from "@/lib/schemas"
import { createSparePart, updateSparePart } from "@/lib/actions/inventory"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { PART_CATEGORY_LABELS } from "@/types"
import type { PartCategory } from "@/types"

const CATEGORIES = Object.keys(PART_CATEGORY_LABELS) as PartCategory[]

interface InventoryFormProps {
  defaultValues?: Partial<SparePartInput>
  partId?: string
}

export function InventoryForm({ defaultValues, partId }: InventoryFormProps) {
  const toast = useToast()
  const isEdit = Boolean(partId)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SparePartInput>({
    resolver: zodResolver(SparePartSchema) as Resolver<SparePartInput>,
    defaultValues: {
      partNumber: "",
      name: "",
      description: "",
      category: "GENERAL",
      brand: "",
      supplier: "",
      compatibleWith: "",
      unit: "pcs",
      unitCost: 0,
      sellingPrice: 0,
      reorderLevel: 0,
      location: "",
      quantity: 0,
      ...defaultValues,
    },
  })

  async function onSubmit(data: SparePartInput) {
    const result = isEdit
      ? await updateSparePart(partId!, data)
      : await createSparePart(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5">
        {/* Identification */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Part Details</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              label="Part Number"
              htmlFor="partNumber"
              error={errors.partNumber?.message}
              hint={isEdit ? undefined : "Leave blank to auto-generate"}
            >
              <Input id="partNumber" placeholder="e.g. PRT-00001" {...register("partNumber")} error={errors.partNumber?.message} />
            </FormField>
            <FormField label="Part Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="e.g. HP CF217A Toner Cartridge" {...register("name")} error={errors.name?.message} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FormField label="Category" htmlFor="category" required error={errors.category?.message}>
              <Select id="category" {...register("category")} error={errors.category?.message}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{PART_CATEGORY_LABELS[c]}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Brand" htmlFor="brand" error={errors.brand?.message}>
              <Input id="brand" placeholder="e.g. HP, Canon, Ricoh" {...register("brand")} />
            </FormField>
            <FormField label="Supplier" htmlFor="supplier" error={errors.supplier?.message}>
              <Input id="supplier" placeholder="e.g. Mediatech Distributors" {...register("supplier")} />
            </FormField>
          </div>

          <FormField label="Compatible With" htmlFor="compatibleWith" error={errors.compatibleWith?.message}>
            <Input id="compatibleWith" placeholder="e.g. HP LaserJet Pro M102, M130" {...register("compatibleWith")} />
          </FormField>

          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={2} placeholder="Additional notes about this part…" {...register("description")} />
          </FormField>
        </div>

        {/* Pricing & Stock */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-900">Pricing & Stock</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FormField label="Unit" htmlFor="unit" required error={errors.unit?.message}>
              <Input id="unit" placeholder="pcs, box, roll, set" {...register("unit")} error={errors.unit?.message} />
            </FormField>
            <FormField label="Unit Cost (KES)" htmlFor="unitCost" required error={errors.unitCost?.message}>
              <Input id="unitCost" type="number" min="0" step="0.01" placeholder="0.00" {...register("unitCost")} error={errors.unitCost?.message} />
            </FormField>
            <FormField label="Selling Price (KES)" htmlFor="sellingPrice" required error={errors.sellingPrice?.message}>
              <Input id="sellingPrice" type="number" min="0" step="0.01" placeholder="0.00" {...register("sellingPrice")} error={errors.sellingPrice?.message} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FormField
              label={isEdit ? "Current Quantity" : "Initial Quantity"}
              htmlFor="quantity"
              error={errors.quantity?.message}
              hint={isEdit ? "Use Adjust Stock to change quantity" : undefined}
            >
              <Input id="quantity" type="number" min="0" step="1" {...register("quantity")} error={errors.quantity?.message} disabled={isEdit} />
            </FormField>
            <FormField label="Minimum Quantity" htmlFor="reorderLevel" error={errors.reorderLevel?.message}>
              <Input id="reorderLevel" type="number" min="0" step="1" {...register("reorderLevel")} error={errors.reorderLevel?.message} />
            </FormField>
            <FormField label="Storage Location" htmlFor="location" error={errors.location?.message}>
              <Input id="location" placeholder="e.g. Shelf A2, Bin 14" {...register("location")} />
            </FormField>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? "Save Changes" : "Add Part"}
        </Button>
      </div>
    </form>
  )
}
