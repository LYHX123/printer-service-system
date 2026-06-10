"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, PackagePlus, Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { setSparePartActive } from "@/lib/actions/inventory"
import { StockTransactionModal } from "@/components/inventory/StockTransactionModal"

interface SparePartActionsProps {
  partId: string
  currentQuantity: number
  unit: string
  isActive: boolean
  canEdit: boolean
}

export function SparePartActions({ partId, currentQuantity, unit, isActive, canEdit }: SparePartActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [stockOpen, setStockOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<PackagePlus className="h-3.5 w-3.5" />}
          onClick={() => setStockOpen(true)}
        >
          Adjust Stock
        </Button>
        <Link href={`/inventory/${partId}/edit`}>
          <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />}>
            Edit
          </Button>
        </Link>
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

      <StockTransactionModal
        partId={partId}
        currentQuantity={currentQuantity}
        unit={unit}
        open={stockOpen}
        onClose={() => setStockOpen(false)}
      />
    </>
  )
}
