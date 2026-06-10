"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { CustomerSchema, type CustomerInput } from "@/lib/schemas"
import { createCustomer, updateCustomer } from "@/lib/actions/customers"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

interface CustomerFormProps {
  defaultValues?: Partial<CustomerInput>
  customerId?: string
}

export function CustomerForm({ defaultValues, customerId }: CustomerFormProps) {
  const toast = useToast()
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
          <FormField label="Customer Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Ahmad bin Abdullah" {...register("name")} error={errors.name?.message} />
          </FormField>
          <FormField label="Company / Business Name" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" placeholder="e.g. ABC Sdn Bhd" {...register("companyName")} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Phone Number" htmlFor="phone" required error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="e.g. 012-3456789" {...register("phone")} error={errors.phone?.message} />
          </FormField>
          <FormField label="Email Address" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" placeholder="e.g. customer@email.com" {...register("email")} />
          </FormField>
        </div>

        <FormField label="Address" htmlFor="address" error={errors.address?.message}>
          <Textarea id="address" placeholder="Full address" rows={3} {...register("address")} />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {customerId ? "Save Changes" : "Create Customer"}
        </Button>
      </div>
    </form>
  )
}
