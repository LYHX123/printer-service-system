"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { EquipmentSchema, type EquipmentInput } from "@/lib/schemas"
import { createEquipment, updateEquipment } from "@/lib/actions/equipment"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { EQUIPMENT_TYPE_LABELS, EQUIPMENT_NOTES_PLACEHOLDER } from "@/types"
import type { EquipmentType } from "@/types"

const EQUIPMENT_TYPES = Object.entries(EQUIPMENT_TYPE_LABELS) as [EquipmentType, string][]
const METER_TYPES: EquipmentType[] = ["PRINTER", "COPIER"]

interface CustomerOption {
  id: string
  name: string
  code: string
  companyName?: string | null
  branches: { id: string; name: string }[]
}

interface EquipmentFormProps {
  customers: CustomerOption[]
  defaultValues?: Partial<EquipmentInput>
  equipmentId?: string
}

export function EquipmentForm({ customers, defaultValues, equipmentId }: EquipmentFormProps) {
  const toast = useToast()
  const { t } = useLanguage()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentInput>({
    resolver: zodResolver(EquipmentSchema) as Resolver<EquipmentInput>,
    defaultValues: { type: "PRINTER", ...defaultValues },
  })

  const selectedCustomerId = watch("customerId")
  const selectedType = watch("type") as EquipmentType | undefined

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const branches = selectedCustomer?.branches ?? []
  const showMeter = selectedType ? METER_TYPES.includes(selectedType) : false
  const notesPlaceholder = selectedType
    ? EQUIPMENT_NOTES_PLACEHOLDER[selectedType]
    : "Enter equipment specifications"

  // Clear branch when customer changes
  useEffect(() => {
    if (!equipmentId) {
      setValue("branchId", "")
    }
  }, [selectedCustomerId, equipmentId, setValue])

  async function onSubmit(data: EquipmentInput) {
    const result = equipmentId
      ? await updateEquipment(equipmentId, data)
      : await createEquipment(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">

        {/* Customer + Branch */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Customer" htmlFor="customerId" required error={errors.customerId?.message}>
            <Select
              id="customerId"
              placeholder="Select customer…"
              {...register("customerId")}
              error={errors.customerId?.message}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.companyName ? ` — ${c.companyName}` : ""} ({c.code})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Branch / Site" htmlFor="branchId" error={errors.branchId?.message}>
            <Select
              id="branchId"
              placeholder="None (main location)"
              {...register("branchId")}
              disabled={!selectedCustomerId || branches.length === 0}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </FormField>
        </div>

        {/* Equipment type */}
        <FormField label={t("equipmentType")} htmlFor="type" required error={errors.type?.message}>
          <Select id="type" {...register("type")} error={errors.type?.message}>
            {EQUIPMENT_TYPES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </Select>
        </FormField>

        {/* Brand + Model */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("brand")} htmlFor="brand" required error={errors.brand?.message}>
            <Input id="brand" placeholder="e.g. HP, Canon, Ricoh, Lenovo" {...register("brand")} error={errors.brand?.message} />
          </FormField>
          <FormField label={t("model")} htmlFor="model" required error={errors.model?.message}>
            <Input id="model" placeholder="e.g. LaserJet Pro M404dn" {...register("model")} error={errors.model?.message} />
          </FormField>
        </div>

        {/* Serial + Asset */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("serialNumber")} htmlFor="serialNumber" required error={errors.serialNumber?.message}>
            <Input id="serialNumber" placeholder="Manufacturer serial number" {...register("serialNumber")} error={errors.serialNumber?.message} />
          </FormField>
          <FormField label={t("assetNumber")} htmlFor="assetNumber" error={errors.assetNumber?.message}>
            <Input id="assetNumber" placeholder="Internal asset tag (optional)" {...register("assetNumber")} />
          </FormField>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Purchase Date" htmlFor="purchaseDate" error={errors.purchaseDate?.message}>
            <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          </FormField>
          <FormField label="Warranty Expiry" htmlFor="warrantyExpiry" error={errors.warrantyExpiry?.message}>
            <Input id="warrantyExpiry" type="date" {...register("warrantyExpiry")} />
          </FormField>
        </div>

        {/* Initial meter readings (PRINTER/COPIER only) */}
        {showMeter && !equipmentId && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">Initial Meter Reading</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Black Pages" htmlFor="initialBlackPages" error={errors.initialBlackPages?.message}>
                <Input id="initialBlackPages" type="number" min="0" placeholder="0" {...register("initialBlackPages")} />
              </FormField>
              <FormField label="Colour Pages" htmlFor="initialColorPages" error={errors.initialColorPages?.message}>
                <Input id="initialColorPages" type="number" min="0" placeholder="0" {...register("initialColorPages")} />
              </FormField>
            </div>
          </div>
        )}

        {/* Notes (type-adaptive placeholder) */}
        <FormField label="Specifications & Notes" htmlFor="notes" error={errors.notes?.message}>
          <Textarea
            id="notes"
            rows={4}
            placeholder={notesPlaceholder}
            {...register("notes")}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>{t("cancel")}</Button>
        <Button type="submit" loading={isSubmitting}>
          {equipmentId ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  )
}
