"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { CustomerProjectSchema, type CustomerProjectInput } from "@/lib/schemas"
import { createCustomerBranch, updateCustomerBranch } from "@/lib/actions/customerBranches"
import { Modal } from "@/components/ui/modal"
import { FormField, Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { CustomerBranchDetail } from "@/lib/data/customerBranches"

interface ProjectFormModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  project?: CustomerBranchDetail | null
}

const EMPTY_VALUES: CustomerProjectInput = {
  name: "",
  contactPerson: "",
  phone: "",
  contactEmail: "",
  address: "",
  notes: "",
}

export function ProjectFormModal({ isOpen, onClose, customerId, project }: ProjectFormModalProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const isEdit = Boolean(project)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerProjectInput>({
    resolver: zodResolver(CustomerProjectSchema) as Resolver<CustomerProjectInput>,
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    if (!isOpen) return
    reset(
      project
        ? {
            name: project.name,
            contactPerson: project.contactPerson ?? "",
            phone: project.phone ?? "",
            contactEmail: project.contactEmail ?? "",
            address: project.address ?? "",
            notes: project.notes ?? "",
          }
        : EMPTY_VALUES
    )
  }, [isOpen, project, reset])

  async function onSubmit(data: CustomerProjectInput) {
    const result = isEdit
      ? await updateCustomerBranch(customerId, project!.id, data)
      : await createCustomerBranch(customerId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? "Project updated" : "Project added")
    onClose()
    router.refresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("editProject") : t("addProject")}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="project-form" loading={isSubmitting}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <form id="project-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label={t("projectName")} htmlFor="name" required error={errors.name?.message}>
          <Input id="name" {...register("name")} error={errors.name?.message} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("contactName")} htmlFor="contactPerson">
            <Input id="contactPerson" {...register("contactPerson")} />
          </FormField>
          <FormField label={t("contactPhone")} htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" {...register("phone")} />
          </FormField>
        </div>
        <FormField label={t("contactEmail")} htmlFor="contactEmail" error={errors.contactEmail?.message}>
          <Input id="contactEmail" type="email" {...register("contactEmail")} />
        </FormField>
        <FormField label={t("projectAddress")} htmlFor="address">
          <Input id="address" {...register("address")} />
        </FormField>
        <FormField label={t("notes")} htmlFor="notes">
          <Textarea id="notes" rows={2} {...register("notes")} />
        </FormField>
      </form>
    </Modal>
  )
}
