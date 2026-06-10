"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { useRouter } from "next/navigation"
import { BranchSchema, type BranchInput } from "@/lib/schemas"
import { createBranch } from "@/lib/actions/customers"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface BranchModalProps {
  customerId: string
  isOpen: boolean
  onClose: () => void
}

export function BranchModal({ customerId, isOpen, onClose }: BranchModalProps) {
  const router = useRouter()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchInput>({
    resolver: zodResolver(BranchSchema) as Resolver<BranchInput>,
    defaultValues: { isPrimary: false },
  })

  async function onSubmit(data: BranchInput) {
    const result = await createBranch(customerId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Branch added successfully")
    reset()
    router.refresh()
    onClose()
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Branch"
      description="Add a new branch or site location for this customer."
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="branch-form"
            loading={isSubmitting}
          >
            Add Branch
          </Button>
        </div>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Branch Name" htmlFor="bname" required error={errors.name?.message}>
          <Input id="bname" placeholder="e.g. KL HQ, PJ Branch, Setia Alam Site" {...register("name")} error={errors.name?.message} />
        </FormField>
        <FormField label="Contact Person" htmlFor="contactPerson" error={errors.contactPerson?.message}>
          <Input id="contactPerson" placeholder="Person in charge at this location" {...register("contactPerson")} />
        </FormField>
        <FormField label="Branch Phone" htmlFor="bphone" error={errors.phone?.message}>
          <Input id="bphone" type="tel" placeholder="e.g. 03-12345678" {...register("phone")} />
        </FormField>
        <FormField label="Address" htmlFor="baddress" error={errors.address?.message}>
          <Textarea id="baddress" placeholder="Full address of this branch" rows={2} {...register("address")} />
        </FormField>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            {...register("isPrimary")}
          />
          <span className="text-sm text-slate-700">Set as primary location</span>
        </label>
      </form>
    </Modal>
  )
}
