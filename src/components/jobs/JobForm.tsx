"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { JobSchema, type JobInput } from "@/lib/schemas"
import { createJob } from "@/lib/actions/jobs"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import {
  SERVICE_TYPE_LABELS,
  PRIORITY_LABELS,
  EQUIPMENT_TYPE_LABELS,
  METER_READING_TYPES,
  UPGRADE_APPLICABLE_TYPES,
} from "@/types"
import type { EquipmentType, Role, ServiceType } from "@/types"

const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]
const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS) as Array<keyof typeof PRIORITY_LABELS>

interface CustomerOption {
  id: string
  name: string
  code: string
  companyName: string | null
  branches: { id: string; name: string }[]
}

interface EquipmentOption {
  id: string
  brand: string
  model: string
  serialNumber: string
  type: EquipmentType
  customerId: string
}

interface EngineerOption {
  id: string
  name: string
  email: string
  role: Role
}

interface JobFormProps {
  customers: CustomerOption[]
  allEquipment: EquipmentOption[]
  engineers: EngineerOption[]
  defaultValues?: Partial<JobInput>
}

export function JobForm({ customers, allEquipment, engineers, defaultValues }: JobFormProps) {
  const toast = useToast()
  const { t } = useLanguage()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobInput>({
    resolver: zodResolver(JobSchema) as Resolver<JobInput>,
    defaultValues: {
      priority: "NORMAL",
      serviceType: "REPAIR",
      ...defaultValues,
    },
  })

  const selectedCustomerId = watch("customerId")
  const selectedEquipmentId = watch("equipmentId")
  const selectedType = watch("serviceType") as ServiceType

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const branches = selectedCustomer?.branches ?? []

  const customerEquipment = useMemo(
    () => allEquipment.filter((e) => e.customerId === selectedCustomerId),
    [allEquipment, selectedCustomerId]
  )

  const selectedEquipment = allEquipment.find((e) => e.id === selectedEquipmentId)
  const equipType = selectedEquipment?.type as EquipmentType | undefined
  const showMeter = equipType ? METER_READING_TYPES.includes(equipType) : false
  const availableServiceTypes = equipType
    ? ALL_SERVICE_TYPES.filter(
        (st) => st !== "UPGRADE" || UPGRADE_APPLICABLE_TYPES.includes(equipType)
      )
    : ALL_SERVICE_TYPES

  // When customer changes, clear equipment and branch
  useEffect(() => {
    setValue("equipmentId", "")
    setValue("branchId", "")
  }, [selectedCustomerId, setValue])

  // When equipment changes, reset service type if UPGRADE not valid
  useEffect(() => {
    if (equipType && !UPGRADE_APPLICABLE_TYPES.includes(equipType) && selectedType === "UPGRADE") {
      setValue("serviceType", "REPAIR")
    }
  }, [equipType, selectedType, setValue])

  // Auto-select branch from equipment if no branch set
  useEffect(() => {
    if (!selectedEquipmentId) return
    const eq = allEquipment.find((e) => e.id === selectedEquipmentId)
    if (!eq) return
  }, [selectedEquipmentId, allEquipment])

  async function onSubmit(data: JobInput) {
    const result = await createJob(data)
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
            <Select id="customerId" placeholder="Select customer…" {...register("customerId")} error={errors.customerId?.message}>
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

        {/* Equipment */}
        <FormField label="Equipment" htmlFor="equipmentId" required error={errors.equipmentId?.message}>
          <Select
            id="equipmentId"
            placeholder={selectedCustomerId ? "Select equipment…" : "Select a customer first"}
            {...register("equipmentId")}
            disabled={!selectedCustomerId || customerEquipment.length === 0}
            error={errors.equipmentId?.message}
          >
            {customerEquipment.map((e) => (
              <option key={e.id} value={e.id}>
                {EQUIPMENT_TYPE_LABELS[e.type]} — {e.brand} {e.model} ({e.serialNumber})
              </option>
            ))}
          </Select>
          {selectedCustomerId && customerEquipment.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">This customer has no registered equipment.</p>
          )}
        </FormField>

        {/* Service + Priority */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Service Type" htmlFor="serviceType" required error={errors.serviceType?.message}>
            <Select id="serviceType" {...register("serviceType")} error={errors.serviceType?.message}>
              {availableServiceTypes.map((st) => (
                <option key={st} value={st}>{SERVICE_TYPE_LABELS[st]}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Priority" htmlFor="priority" required error={errors.priority?.message}>
            <Select id="priority" {...register("priority")} error={errors.priority?.message}>
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]}</option>
              ))}
            </Select>
          </FormField>
        </div>

        {/* Assigned engineer */}
        <FormField label={t("engineer")} htmlFor="assignedToId" required error={errors.assignedToId?.message}>
          <Select id="assignedToId" placeholder="Select engineer…" {...register("assignedToId")} error={errors.assignedToId?.message}>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </Select>
        </FormField>

        {/* Problem description */}
        <FormField label={t("problemReported")} htmlFor="problemDesc" required error={errors.problemDesc?.message}>
          <Textarea
            id="problemDesc"
            rows={3}
            placeholder="Describe the fault or service required…"
            {...register("problemDesc")}
            error={errors.problemDesc?.message}
          />
        </FormField>

        {/* Meter readings at intake */}
        {showMeter && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
              Meter Reading at Intake
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Black Pages" htmlFor="meterBlack" error={errors.meterBlack?.message}>
                <Input id="meterBlack" type="number" min="0" placeholder="0" {...register("meterBlack")} />
              </FormField>
              <FormField label="Colour Pages" htmlFor="meterColor" error={errors.meterColor?.message}>
                <Input id="meterColor" type="number" min="0" placeholder="0" {...register("meterColor")} />
              </FormField>
            </div>
          </div>
        )}

        {/* Due date + Internal notes */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Due Date" htmlFor="dueDate" error={errors.dueDate?.message}>
            <Input id="dueDate" type="date" {...register("dueDate")} />
          </FormField>
          <div />
        </div>
        <FormField label="Internal Notes" htmlFor="internalNotes" error={errors.internalNotes?.message}>
          <Textarea
            id="internalNotes"
            rows={2}
            placeholder="Internal notes visible to staff only…"
            {...register("internalNotes")}
          />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {t("create")}
        </Button>
      </div>
    </form>
  )
}
