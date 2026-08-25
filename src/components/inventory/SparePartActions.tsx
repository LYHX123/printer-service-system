"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { setSparePartActive } from "@/lib/actions/inventory"
import { AddMovementModal } from "./AddMovementModal"
import { AppActionMenu } from "@/components/app-ui/AppActionMenu"

interface SparePartActionsProps {
  partId: string
  partName: string
  unit: string | null
  currentQuantity: number
  isActive: boolean
  canEdit: boolean
  /**
   * "menu" renders a compact ⋮ overflow menu (Add Movement / Archive only —
   * Edit is omitted since the App-mode mobile card's own tap target already
   * goes to the edit page) instead of the row of icon buttons. Same actions,
   * same permission gate, same server action — presentation only.
   */
  variant?: "buttons" | "menu"
}

export function SparePartActions({
  partId,
  partName,
  unit,
  currentQuantity,
  isActive,
  canEdit,
  variant = "buttons",
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

  if (variant === "menu") {
    return (
      <>
        <AppActionMenu
          ariaLabel="Item actions"
          items={[
            { label: "Add Movement", icon: <ArrowLeftRight />, onClick: () => setMovementOpen(true) },
            {
              label: isActive ? "Archive" : "Reactivate",
              icon: isActive ? <Archive /> : <ArchiveRestore />,
              onClick: toggleActive,
              disabled: isPending,
            },
          ]}
        />
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

  return (
    <>
      <div className="flex flex-nowrap items-center justify-end gap-1.5">
        <Link href={`/stock/${partId}/edit`} title="Edit">
          <Button variant="outline" size="sm" className="h-8 w-8 px-0" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          aria-label="Add Movement"
          title="Add Movement"
          onClick={() => setMovementOpen(true)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          aria-label={isActive ? "Archive" : "Reactivate"}
          title={isActive ? "Archive" : "Reactivate"}
          onClick={toggleActive}
          loading={isPending}
        >
          {isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
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
