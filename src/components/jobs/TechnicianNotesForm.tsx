"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { TechnicianNotesSchema, type TechnicianNotesInput } from "@/lib/schemas"
import { updateTechnicianNotes } from "@/lib/actions/jobs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { EquipmentType } from "@/types"
import { TECHNICIAN_NOTES_PLACEHOLDER } from "@/types"

interface TechnicianNotesFormProps {
  jobId: string
  currentNotes: string | null
  equipmentType: EquipmentType
}

export function TechnicianNotesForm({ jobId, currentNotes, equipmentType }: TechnicianNotesFormProps) {
  const router = useRouter()
  const toast = useToast()
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TechnicianNotesInput>({
    resolver: zodResolver(TechnicianNotesSchema) as Resolver<TechnicianNotesInput>,
    defaultValues: { technicianNotes: currentNotes ?? "" },
  })

  async function onSubmit(data: TechnicianNotesInput) {
    const result = await updateTechnicianNotes(jobId, data)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success("Notes saved")
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <div>
        {currentNotes ? (
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{currentNotes}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No technician notes recorded yet.</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-3 text-xs text-blue-600 hover:underline"
          type="button"
        >
          {currentNotes ? "Edit notes" : "Add notes"}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Textarea
        rows={6}
        placeholder={TECHNICIAN_NOTES_PLACEHOLDER[equipmentType]}
        {...register("technicianNotes")}
        className="w-full"
      />
      <div className="flex gap-2 mt-3">
        <Button type="submit" size="sm" loading={isSubmitting}>{t("save")}</Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            reset({ technicianNotes: currentNotes ?? "" })
            setEditing(false)
          }}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
