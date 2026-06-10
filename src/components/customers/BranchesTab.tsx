"use client"

import { useState } from "react"
import { Plus, MapPin, Phone, User, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BranchModal } from "./BranchModal"
import { EmptyState } from "@/components/ui/empty-state"
import type { CustomerBranch } from "@/types"

interface BranchesTabProps {
  customerId: string
  branches: CustomerBranch[]
}

export function BranchesTab({ customerId, branches }: BranchesTabProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">
          {branches.length} branch{branches.length !== 1 ? "es" : ""} registered
        </p>
        <Button
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setModalOpen(true)}
        >
          Add Branch
        </Button>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={<MapPin className="h-7 w-7" />}
            title="No branches yet"
            description="Add branch locations or project sites for this customer."
            action={{ label: "Add Branch", onClick: () => setModalOpen(true) }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-slate-900 leading-tight">
                  {branch.name}
                </h4>
                {branch.isPrimary && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 shrink-0">
                    <Star className="h-2.5 w-2.5" />
                    Primary
                  </span>
                )}
              </div>
              {branch.contactPerson && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3 w-3 shrink-0" />
                  {branch.contactPerson}
                </p>
              )}
              {branch.phone && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3 w-3 shrink-0" />
                  {branch.phone}
                </p>
              )}
              {branch.address && (
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{branch.address}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <BranchModal
        customerId={customerId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
