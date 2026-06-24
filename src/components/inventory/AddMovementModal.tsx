"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { StockMovementSchema, type StockMovementInput } from "@/lib/schemas"
import { recordStockMovement } from "@/lib/actions/inventory"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { TransactionType } from "@/types"

const MOVEMENT_TYPES: TransactionType[] = ["IN", "OUT", "RETURN", "DAMAGE", "ADJUSTMENT"]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface AddMovementModalProps {
  partId: string
  partName: string
  unit: string
  currentQuantity: number
  isOpen: boolean
  onClose: () => void
}

export function AddMovementModal({
  partId,
  partName,
  unit,
  currentQuantity,
  isOpen,
  onClose,
}: AddMovementModalProps) {
  const router = useRouter()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockMovementInput>({
    resolver: zodResolver(StockMovementSchema) as Resolver<StockMovementInput>,
    defaultValues: { type: "IN", quantity: 0, date: todayIso(), reference: "", remark: "" },
  })

  const selectedType = watch("type")
  const isAdjustment = selectedType === "ADJUSTMENT"

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: StockMovementInput) {
    const result = await recordStockMovement(partId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Movement recorded")
    handleClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Stock Movement"
      description={`${partName} — Current Qty: ${currentQuantity} ${unit}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-movement-form" loading={isSubmitting}>
            Save Movement
          </Button>
        </div>
      }
    >
      <form id="add-movement-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Movement Type" htmlFor="movementType" required error={errors.type?.message}>
          <Select id="movementType" {...register("type")}>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </FormField>

        <FormField
          label={isAdjustment ? "New Quantity" : "Quantity"}
          htmlFor="movementQuantity"
          required
          hint={isAdjustment ? `Set the actual quantity on hand, in ${unit}.` : `Amount to ${selectedType === "IN" || selectedType === "RETURN" ? "add" : "remove"}, in ${unit}.`}
          error={errors.quantity?.message}
        >
          <Input id="movementQuantity" type="number" min={0} step={1} {...register("quantity")} />
        </FormField>

        <FormField label="Date" htmlFor="movementDate" error={errors.date?.message}>
          <Input id="movementDate" type="date" {...register("date")} />
        </FormField>

        <FormField label="Reference No" htmlFor="movementReference" error={errors.reference?.message}>
          <Input id="movementReference" placeholder="e.g. PO-0001, JOB-20260001…" {...register("reference")} />
        </FormField>

        <FormField label="Remark" htmlFor="movementRemark" error={errors.remark?.message}>
          <Textarea id="movementRemark" rows={3} placeholder="Optional note…" {...register("remark")} />
        </FormField>
      </form>
    </Modal>
  )
}
