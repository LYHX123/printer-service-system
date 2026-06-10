"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { StockTransactionSchema, type StockTransactionInput } from "@/lib/schemas"
import { recordStockTransaction } from "@/lib/actions/inventory"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import type { TransactionType } from "@/types"

interface StockTransactionModalProps {
  partId: string
  currentQuantity: number
  unit: string
  open: boolean
  onClose: () => void
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment (Stock Count)" },
]

export function StockTransactionModal({ partId, currentQuantity, unit, open, onClose }: StockTransactionModalProps) {
  const router = useRouter()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockTransactionInput>({
    resolver: zodResolver(StockTransactionSchema) as Resolver<StockTransactionInput>,
    defaultValues: {
      type: "IN",
      quantity: 0,
      unitPrice: undefined,
      reference: "",
    },
  })

  const type = watch("type")

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(data: StockTransactionInput) {
    const result = await recordStockTransaction(partId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Stock transaction recorded")
    reset()
    onClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Update Stock"
      description={`Current quantity: ${currentQuantity} ${unit}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="stock-transaction-form" loading={isSubmitting}>
            Save
          </Button>
        </div>
      }
    >
      <form id="stock-transaction-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <FormField label="Transaction Type" htmlFor="type" required error={errors.type?.message}>
            <Select id="type" {...register("type")} error={errors.type?.message}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField
            label={type === "ADJUSTMENT" ? "New Counted Quantity" : "Quantity"}
            htmlFor="quantity"
            required
            error={errors.quantity?.message}
            hint={type === "ADJUSTMENT" ? "Enter the actual counted stock on hand" : undefined}
          >
            <Input id="quantity" type="number" min="0" step="1" {...register("quantity")} error={errors.quantity?.message} />
          </FormField>

          {type === "IN" && (
            <FormField label="Unit Cost (KES)" htmlFor="unitPrice" error={errors.unitPrice?.message} hint="Optional — updates the part's unit cost">
              <Input id="unitPrice" type="number" min="0" step="0.01" placeholder="0.00" {...register("unitPrice")} error={errors.unitPrice?.message} />
            </FormField>
          )}

          <FormField label="Reference / Note" htmlFor="reference" error={errors.reference?.message}>
            <Input id="reference" placeholder="e.g. Supplier invoice #, job reference" {...register("reference")} />
          </FormField>
        </div>
      </form>
    </Modal>
  )
}
