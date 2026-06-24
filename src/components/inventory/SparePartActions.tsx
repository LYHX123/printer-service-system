"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { setSparePartActive } from "@/lib/actions/inventory"
import { AddMovementModal } from "./AddMovementModal"

interface SparePartActionsProps {
  partId: string
  partName: string
  unit: string
  currentQuantity: number
  isActive: boolean
  canEdit: boolean
}

export function SparePartActions({
  partId,
  partName,
  unit,
  currentQuantity,
  isActive,
  canEdit,
}: SparePartActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [movementOpen, setMovementOpen] = useState(false)

  if (!canEdit) return null

  function toggleActive() {
    startTransition(async () => {
      const result = await setSparePartActive(partId, !isActive)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(isActive ? "Part archived" : "Part reactivated")
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/stock/${partId}/edit`}>
          <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
            Edit
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
          onClick={() => setMovementOpen(true)}
        >
          Add Movement
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
          onClick={toggleActive}
          loading={isPending}
        >
          {isActive ? "Archive" : "Reactivate"}
        </Button>
      </div>
      <AddMovementModal
        partId={partId}
        partName={partName}
        unit={unit}
        currentQuantity={currentQuantity}
        isOpen={movementOpen}
        onClose={() => setMovementOpen(false)}
      />
    </>
  )
}
